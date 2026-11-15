import crypto from 'crypto';
import { TelemedicineSession } from '../models/TelemedicineSession.js';
import { NotFoundException } from '../middleware/errors.js';
import { eventBus } from '../bus/index.js';

export async function createTelemedicineSession(data) {
  const sessionId = data.session_id || `telemed-${crypto.randomBytes(6).toString('hex')}`;
  const delaySec = data.artificial_delay_seconds !== undefined ? Number(data.artificial_delay_seconds) : 5.0;

  const session = await TelemedicineSession.create({
    session_id: sessionId,
    patient_id: data.patient_id,
    surgeon_id: data.surgeon_id,
    status: 'initiating',
    artificial_delay_seconds: delaySec,
    signaling_queue: [],
    chat_messages: []
  });

  await eventBus.publish({
    event_type: 'telemed.session.created',
    channel: 'telemedicine',
    payload: { session_id: sessionId, patient_id: data.patient_id, surgeon_id: data.surgeon_id }
  });

  return session.toJSON();
}

export async function sendSignalingPacket(sessionId, packetData) {
  const session = await TelemedicineSession.findOne({ session_id: sessionId });
  if (!session) {
    throw new NotFoundException(`Telemedicine session '${sessionId}' not found`);
  }

  const sentAt = packetData.sent_at ? new Date(packetData.sent_at) : new Date();
  const deliverAt = new Date(sentAt.getTime() + session.artificial_delay_seconds * 1000);

  const packet = {
    packet_id: `sig-${crypto.randomBytes(6).toString('hex')}`,
    sender_id: packetData.sender_id,
    packet_type: packetData.packet_type,
    sdp: packetData.sdp || null,
    candidate: packetData.candidate || null,
    sent_at: sentAt,
    deliver_at: deliverAt,
    delivered_at: null,
    status: 'in_transit'
  };

  session.signaling_queue.push(packet);
  if (session.status === 'initiating' && packet.packet_type === 'offer') {
    session.status = 'active';
  }
  await session.save();

  return packet;
}

export async function getDueSignals(sessionId, recipientId, referenceDate = new Date()) {
  const session = await TelemedicineSession.findOne({ session_id: sessionId });
  if (!session) {
    throw new NotFoundException(`Telemedicine session '${sessionId}' not found`);
  }

  let updated = false;
  const readySignals = [];

  for (const packet of session.signaling_queue) {
    if (packet.sender_id !== recipientId) {
      if (packet.status === 'in_transit' && packet.deliver_at <= referenceDate) {
        packet.status = 'delivered';
        packet.delivered_at = referenceDate;
        updated = true;
        readySignals.push(packet);
      } else if (packet.status === 'delivered') {
        readySignals.push(packet);
      }
    }
  }

  if (updated) {
    await session.save();
  }

  return readySignals;
}

export async function sendSessionChatMessage(sessionId, chatData) {
  const session = await TelemedicineSession.findOne({ session_id: sessionId });
  if (!session) {
    throw new NotFoundException(`Telemedicine session '${sessionId}' not found`);
  }

  const sentAt = chatData.sent_at ? new Date(chatData.sent_at) : new Date();
  const deliverAt = new Date(sentAt.getTime() + session.artificial_delay_seconds * 1000);

  const msg = {
    message_id: `chat-${crypto.randomBytes(6).toString('hex')}`,
    sender_id: chatData.sender_id,
    text: chatData.text,
    sent_at: sentAt,
    deliver_at: deliverAt,
    delivered_at: null,
    status: 'in_transit'
  };

  session.chat_messages.push(msg);
  await session.save();
  return msg;
}

export async function getDueChatMessages(sessionId, referenceDate = new Date()) {
  const session = await TelemedicineSession.findOne({ session_id: sessionId });
  if (!session) {
    throw new NotFoundException(`Telemedicine session '${sessionId}' not found`);
  }

  let updated = false;
  const readyMessages = [];

  for (const msg of session.chat_messages) {
    if (msg.status === 'in_transit' && msg.deliver_at <= referenceDate) {
      msg.status = 'delivered';
      msg.delivered_at = referenceDate;
      updated = true;
      readyMessages.push(msg);
    } else if (msg.status === 'delivered') {
      readyMessages.push(msg);
    }
  }

  if (updated) {
    await session.save();
  }

  return readyMessages;
}

export async function endTelemedicineSession(sessionId) {
  const session = await TelemedicineSession.findOne({ session_id: sessionId });
  if (!session) {
    throw new NotFoundException(`Telemedicine session '${sessionId}' not found`);
  }

  session.status = 'ended';
  session.ended_at = new Date();
  await session.save();

  return session.toJSON();
}
