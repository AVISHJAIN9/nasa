import crypto from 'node:crypto';
import { ClinicalOrder } from '../models/ClinicalOrder.js';
import { eventBus } from '../bus/index.js';
import { NotFoundException, BadRequestException } from '../middleware/errors.js';
import { logAuditEvent } from './auditLogService.js';

/**
 * Creates and delivers a medical/exercise order from a flight surgeon to an astronaut.
 */
export async function createClinicalOrder(data, userContext = {}) {
  const {
    target_crew_id,
    issued_by = userContext.username || 'flight_surgeon',
    type = 'MEDICATION',
    title,
    instructions,
    dosage,
    frequency,
    priority = 'ROUTINE'
  } = data;

  if (!target_crew_id || !title || !instructions) {
    throw new BadRequestException('target_crew_id, title, and instructions are required');
  }

  const orderId = `ord-${crypto.randomBytes(6).toString('hex')}`;
  const now = new Date();

  const order = await ClinicalOrder.create({
    order_id: orderId,
    target_crew_id,
    issued_by,
    type,
    title,
    instructions,
    dosage,
    frequency,
    priority,
    status: 'DELIVERED',
    delivered_at: now
  });

  const payload = {
    order_id: orderId,
    target_crew_id,
    issued_by,
    type,
    title,
    priority,
    delivered_at: now.toISOString()
  };

  // Broadcast order delivery event to crew member and flight surgeon team
  await eventBus.publish({
    event_type: 'order:delivered',
    channel: `crew:${target_crew_id}`,
    recipient_id: target_crew_id,
    severity: priority === 'STAT' ? 'critical' : 'info',
    payload
  });

  try {
    await logAuditEvent({
      acting_user: issued_by,
      action: 'ISSUE_CLINICAL_ORDER',
      resource: `order:${orderId}`,
      details: { target_crew_id, type, title }
    });
  } catch {
    // Non-blocking
  }

  return order.toObject();
}

/**
 * Retrieves orders for a specific crew member.
 */
export async function getOrdersForCrew(crewId, status = null) {
  const query = { target_crew_id: crewId };
  if (status) {
    query.status = status;
  }
  return await ClinicalOrder.find(query).sort({ delivered_at: -1 }).lean();
}

/**
 * Acknowledges receipt and understanding of an order by the astronaut.
 */
export async function acknowledgeClinicalOrder(orderId, ackData = {}, userContext = {}) {
  const {
    acknowledged_by = userContext.username || 'crew_member',
    acknowledgment_notes
  } = ackData;

  const order = await ClinicalOrder.findOne({ order_id: orderId });
  if (!order) {
    throw new NotFoundException(`Order not found: ${orderId}`);
  }

  const now = new Date();
  order.status = 'ACKNOWLEDGED';
  order.acknowledged_at = now;
  order.acknowledged_by = acknowledged_by;
  if (acknowledgment_notes) {
    order.acknowledgment_notes = acknowledgment_notes;
  }
  await order.save();

  const payload = {
    order_id: order.order_id,
    target_crew_id: order.target_crew_id,
    status: order.status,
    acknowledged_at: now.toISOString(),
    acknowledged_by,
    acknowledgment_notes: order.acknowledgment_notes
  };

  await eventBus.publish({
    event_type: 'order:acknowledged',
    channel: 'medical_orders',
    severity: 'info',
    payload
  });

  try {
    await logAuditEvent({
      acting_user: acknowledged_by,
      action: 'ACKNOWLEDGE_CLINICAL_ORDER',
      resource: `order:${orderId}`,
      details: { target_crew_id: order.target_crew_id }
    });
  } catch {
    // Non-blocking
  }

  return order.toObject();
}

/**
 * Completes an order (e.g. medication administered, workout completed).
 */
export async function completeClinicalOrder(orderId, completedBy = 'crew_member') {
  const order = await ClinicalOrder.findOne({ order_id: orderId });
  if (!order) {
    throw new NotFoundException(`Order not found: ${orderId}`);
  }

  const now = new Date();
  order.status = 'COMPLETED';
  order.completed_at = now;
  await order.save();

  await eventBus.publish({
    event_type: 'order:completed',
    channel: 'medical_orders',
    severity: 'info',
    payload: {
      order_id: order.order_id,
      target_crew_id: order.target_crew_id,
      completed_at: now.toISOString(),
      completed_by: completedBy
    }
  });

  return order.toObject();
}
