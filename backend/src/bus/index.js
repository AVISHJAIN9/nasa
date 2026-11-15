import { EventEmitter } from 'events';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { EventLog } from '../models/EventLog.js';

class EventBus extends EventEmitter {
  constructor() {
    super();
    this.io = null;
    this.inMemoryRingBuffer = [];
    this.maxBufferSize = 500;
  }

  setSocketIO(ioInstance) {
    this.io = ioInstance;
    this.setupSocketHandlers();
  }

  setupSocketHandlers() {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      // Allow client to subscribe to specific rooms / channels
      socket.on('join', ({ rooms = [] }) => {
        rooms.forEach((room) => socket.join(room));
      });

      socket.on('leave', ({ rooms = [] }) => {
        rooms.forEach((room) => socket.leave(room));
      });

      // Catch-up on reconnect: delivers any alerts missed while disconnected
      socket.on('catchup', async ({ since, channel, limit = 50 }, callback) => {
        try {
          const missedEvents = await this.getMissedEvents({ since, channel, limit });
          if (typeof callback === 'function') {
            callback({ status: 'ok', events: missedEvents });
          } else {
            socket.emit('catchup_response', { events: missedEvents });
          }
        } catch (err) {
          if (typeof callback === 'function') {
            callback({ status: 'error', error: err.message });
          }
        }
      });
    });
  }

  async publish(event) {
    const envelope = {
      event_id: event.event_id || `evt-${crypto.randomBytes(6).toString('hex')}`,
      event_type: event.event_type || 'system.event',
      channel: event.channel || 'general',
      severity: event.severity || 'info',
      source: event.source || 'SIMULATED',
      correlation_id: event.correlation_id || null,
      recipient_role: event.recipient_role || null,
      recipient_id: event.recipient_id || null,
      timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
      payload: event.payload || {}
    };

    // 1. Maintain in-memory ring buffer for fast catchup even if DB is busy
    this.inMemoryRingBuffer.push(envelope);
    if (this.inMemoryRingBuffer.length > this.maxBufferSize) {
      this.inMemoryRingBuffer.shift();
    }

    // 2. Emit in-process to event listeners
    this.emit(envelope.event_type, envelope);
    this.emit('*', envelope);

    // 3. Fan-out via Socket.IO if attached
    if (this.io) {
      this.io.emit(envelope.event_type, envelope);
      if (envelope.channel && envelope.channel !== 'general') {
        this.io.to(envelope.channel).emit(envelope.event_type, envelope);
      }
      if (envelope.recipient_role) {
        this.io.to(`role:${envelope.recipient_role}`).emit(envelope.event_type, envelope);
      }
      if (envelope.recipient_id) {
        this.io.to(`crew:${envelope.recipient_id}`).emit(envelope.event_type, envelope);
      }
    }

    // 4. Persist to MongoDB EventLog if database is connected (guarantees zero alert loss)
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        await EventLog.create(envelope);
      } catch (err) {
        // Fall back to memory buffer without crashing the caller
        console.error('Failed to persist EventLog to MongoDB:', err.message);
      }
    }

    return envelope;
  }

  subscribe(pattern, handler) {
    this.on(pattern, handler);
  }

  unsubscribe(pattern, handler) {
    this.removeListener(pattern, handler);
  }

  async getMissedEvents({ since, channel, eventType, severity, limit = 100 } = {}) {
    const sinceDate = since ? new Date(since) : new Date(0);

    // Query from persistent database if available
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      const query = { timestamp: { $gte: sinceDate } };
      if (channel) query.channel = channel;
      if (eventType) query.event_type = eventType;
      if (severity) query.severity = severity;

      const events = await EventLog.find(query).sort({ timestamp: 1 }).limit(limit).lean();
      return events;
    }

    // Fallback to in-memory buffer
    return this.inMemoryRingBuffer
      .filter((evt) => {
        if (new Date(evt.timestamp) < sinceDate) return false;
        if (channel && evt.channel !== channel) return false;
        if (eventType && evt.event_type !== eventType) return false;
        if (severity && evt.severity !== severity) return false;
        return true;
      })
      .slice(0, limit);
  }
}

export const eventBus = new EventBus();
