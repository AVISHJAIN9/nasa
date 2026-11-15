import crypto from 'node:crypto';
import { Alert } from '../models/Alert.js';
import { eventBus } from '../bus/index.js';
import { logAuditEvent } from './auditLogService.js';
import { logMedicalEvent } from './medicalEventLogService.js';

let activeEmergency = null;

export function getActiveEmergencyState() {
  return activeEmergency;
}

export function clearEmergencyState() {
  activeEmergency = null;
}

/**
 * Declares a spacecraft medical emergency.
 * Broadcasts to all mission roles in < 3s (astronaut, flight_surgeon, mission_control, admin).
 */
export async function declareEmergency(payload, userContext = {}) {
  const {
    declared_by = userContext.username || 'CREW-01',
    target_crew_id = 'CREW-01',
    reason = 'Immediate medical distress reported',
    level = 'CRITICAL'
  } = payload;

  const emergencyId = `emg-${crypto.randomBytes(6).toString('hex')}`;
  const now = new Date();

  // 1. Create top-priority EMERGENCY alert
  const alert = await Alert.create({
    alert_id: emergencyId,
    crew_id: target_crew_id,
    source: 'MANUAL_EMERGENCY',
    category: 'EMERGENCY',
    metric: 'emergency_declaration',
    severity: 'EMERGENCY',
    title: `[EMERGENCY DECLARATION] ${level} for ${target_crew_id}`,
    message: `${declared_by} declared a spacecraft medical emergency: ${reason}`,
    status: 'ACTIVE',
    metadata: {
      declared_by,
      level,
      reason,
      declared_at: now.toISOString()
    }
  });

  // 2. Set global emergency state
  activeEmergency = {
    emergency_id: emergencyId,
    level,
    target_crew_id,
    declared_by,
    reason,
    declared_at: now.toISOString(),
    status: 'ACTIVE'
  };

  // 3. Broadcast to all roles via EventBus and Socket.IO
  const broadcastPayload = {
    emergency_id: emergencyId,
    alert_id: emergencyId,
    target_crew_id,
    declared_by,
    level,
    reason,
    timestamp: now.toISOString(),
    roles_notified: ['astronaut', 'flight_surgeon', 'mission_control', 'admin']
  };

  await eventBus.publish({
    event_type: 'emergency:declared',
    channel: 'emergency',
    severity: 'emergency',
    payload: broadcastPayload
  });

  // Also publish role-specific events to guarantee all role queues receive it
  for (const role of broadcastPayload.roles_notified) {
    await eventBus.publish({
      event_type: `emergency:role_alert`,
      channel: `role:${role}`,
      recipient_role: role,
      severity: 'emergency',
      payload: broadcastPayload
    });
  }

  // 4. Audit & Medical log
  try {
    await logAuditEvent({
      acting_user: declared_by,
      action: 'DECLARE_EMERGENCY',
      resource: `emergency:${emergencyId}`,
      details: { level, reason, target_crew_id }
    });

    await logMedicalEvent({
      crew_id: target_crew_id,
      event_type: 'EMERGENCY_DECLARED',
      severity: 'CRITICAL',
      title: `Emergency declared by ${declared_by}`,
      description: reason,
      data: { emergency_id: emergencyId, level }
    });
  } catch {
    // Audit logging is non-blocking to ensure rapid emergency dispatch
  }

  return {
    emergency: activeEmergency,
    alert: alert.toObject()
  };
}

/**
 * Stands down an active medical emergency.
 */
export async function standDownEmergency(payload, userContext = {}) {
  const {
    authorized_by = userContext.username || 'flight_surgeon',
    reason = 'Patient stabilized; vitals within manageable parameters'
  } = payload;

  if (!activeEmergency) {
    return { active: false, message: 'No active emergency in progress' };
  }

  const previousId = activeEmergency.emergency_id;
  const now = new Date();

  // Resolve associated emergency alert
  await Alert.updateOne(
    { alert_id: previousId },
    {
      $set: {
        status: 'RESOLVED',
        resolved_at: now,
        resolved_by: authorized_by,
        resolution_notes: `Emergency stand-down: ${reason}`
      }
    }
  );

  activeEmergency = null;

  const standDownPayload = {
    emergency_id: previousId,
    authorized_by,
    reason,
    timestamp: now.toISOString()
  };

  await eventBus.publish({
    event_type: 'emergency:stand_down',
    channel: 'emergency',
    severity: 'info',
    payload: standDownPayload
  });

  try {
    await logAuditEvent({
      acting_user: authorized_by,
      action: 'STAND_DOWN_EMERGENCY',
      resource: `emergency:${previousId}`,
      details: { reason }
    });
  } catch {
    // Non-blocking
  }

  return {
    active: false,
    emergency_id: previousId,
    status: 'STAND_DOWN',
    reason
  };
}
