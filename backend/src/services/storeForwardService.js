import crypto from 'crypto';
import { ConsultMessage } from '../models/ConsultMessage.js';
import { calculateDeliveryTime } from './delayEmulatorService.js';
import { eventBus } from '../bus/index.js';

export async function sendConsultMessage(data) {
  const sentAt = data.sent_at ? new Date(data.sent_at) : new Date();
  const direction = data.direction || 'space_to_ground';

  const deliveryCalc = calculateDeliveryTime({
    direction,
    sentAt,
    forceBlackout: Boolean(data.force_blackout)
  });

  const now = new Date();
  const isDeliveredNow = deliveryCalc.deliver_at <= now;

  const messageDoc = {
    message_id: data.message_id || `msg-${crypto.randomBytes(6).toString('hex')}`,
    sender_id: data.sender_id,
    sender_name: data.sender_name || 'Anonymous',
    sender_role: data.sender_role || 'astronaut',
    recipient_id: data.recipient_id || null,
    recipient_role: data.recipient_role || 'flight_surgeon',
    subject: data.subject,
    body: data.body,
    priority: data.priority || 'routine',
    direction,
    attachments: data.attachments || [],
    mission_mode: deliveryCalc.mode,
    delay_seconds_applied: deliveryCalc.delay_seconds_applied,
    sent_at: sentAt,
    deliver_at: deliveryCalc.deliver_at,
    delivered_at: isDeliveredNow ? now : null,
    status: isDeliveredNow
      ? 'delivered'
      : deliveryCalc.is_blackout
        ? 'held_blackout'
        : 'in_transit'
  };

  const created = await ConsultMessage.create(messageDoc);

  if (isDeliveredNow) {
    await eventBus.publish({
      event_type: 'consult.message.delivered',
      channel: 'consults',
      severity: created.priority === 'stat' ? 'emergency' : 'info',
      payload: created.toJSON()
    });
  }

  return created.toJSON();
}

export async function deliverDueMessages(referenceDate = new Date()) {
  const dueMessages = await ConsultMessage.find({
    status: { $in: ['in_transit', 'queued', 'held_blackout'] },
    deliver_at: { $lte: referenceDate }
  });

  const delivered = [];
  for (const msg of dueMessages) {
    msg.status = 'delivered';
    msg.delivered_at = referenceDate;
    await msg.save();

    await eventBus.publish({
      event_type: 'consult.message.delivered',
      channel: 'consults',
      severity: msg.priority === 'stat' ? 'emergency' : 'info',
      payload: msg.toJSON()
    });

    delivered.push(msg.toJSON());
  }

  return delivered;
}

export async function getInbox(query = {}) {
  const { recipient_id, recipient_role, include_in_transit = false } = query;
  const filter = {};

  if (!include_in_transit) {
    filter.status = 'delivered';
  }

  const orConditions = [];
  if (recipient_id) orConditions.push({ recipient_id });
  if (recipient_role) orConditions.push({ recipient_role });

  if (orConditions.length > 0) {
    filter.$or = orConditions;
  }

  const messages = await ConsultMessage.find(filter).sort({ deliver_at: -1 }).lean();
  return messages;
}

export async function getOutbox(senderId) {
  const filter = {};
  if (senderId) {
    filter.sender_id = senderId;
  }
  const messages = await ConsultMessage.find(filter).sort({ sent_at: -1 }).lean();
  return messages;
}

export async function getMessageById(messageId) {
  const message = await ConsultMessage.findOne({ message_id: messageId }).lean();
  return message;
}
