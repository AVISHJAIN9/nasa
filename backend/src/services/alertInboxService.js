import { Alert } from '../models/Alert.js';
import { eventBus } from '../bus/index.js';
import { NotFoundException, BadRequestException } from '../middleware/errors.js';

const SEVERITY_SORT_ORDER = {
  EMERGENCY: 4,
  CRITICAL: 3,
  WARNING: 2,
  INFO: 1
};

/**
 * Retrieves prioritized alert inbox with filtering and automatic wake-up of expired snoozes.
 */
export async function getAlertInbox(query = {}) {
  const {
    status,
    severity,
    crew_id,
    limit = 50,
    offset = 0
  } = query;

  const now = new Date();

  // Wake up any snoozed alerts whose snooze period has expired
  await Alert.updateMany(
    {
      status: 'SNOOZED',
      snoozed_until: { $lte: now }
    },
    {
      $set: { status: 'ACTIVE', snoozed_until: null }
    }
  );

  const filter = {};
  if (status) {
    filter.status = status;
  }
  if (severity) {
    filter.severity = severity.toUpperCase();
  }
  if (crew_id) {
    filter.crew_id = crew_id;
  }

  const alerts = await Alert.find(filter)
    .sort({ created_at: -1 })
    .skip(Number(offset))
    .limit(Number(limit))
    .lean();

  // Sort by priority order: EMERGENCY (4) > CRITICAL (3) > WARNING (2) > INFO (1)
  alerts.sort((a, b) => {
    const wA = SEVERITY_SORT_ORDER[a.severity] || 0;
    const wB = SEVERITY_SORT_ORDER[b.severity] || 0;
    if (wB !== wA) return wB - wA;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  const total = await Alert.countDocuments(filter);

  return {
    total,
    count: alerts.length,
    alerts
  };
}

/**
 * Acknowledges an alert and broadcasts live state change to all connected viewers.
 */
export async function acknowledgeAlert(alertId, acknowledgedBy = 'flight_surgeon') {
  const alert = await Alert.findOne({ alert_id: alertId });
  if (!alert) {
    throw new NotFoundException(`Alert not found: ${alertId}`);
  }

  if (alert.status === 'RESOLVED') {
    throw new BadRequestException('Cannot acknowledge an already resolved alert');
  }

  const now = new Date();
  alert.status = 'ACKNOWLEDGED';
  alert.acknowledged_at = now;
  alert.acknowledged_by = acknowledgedBy;
  await alert.save();

  const payload = {
    alert_id: alert.alert_id,
    status: alert.status,
    acknowledged_at: now.toISOString(),
    acknowledged_by: acknowledgedBy,
    crew_id: alert.crew_id,
    severity: alert.severity,
    metric: alert.metric
  };

  // Broadcast live change across EventBus & Socket.IO so all viewers update live
  await eventBus.publish({
    event_type: 'alert:acknowledged',
    channel: 'alerts',
    severity: alert.severity.toLowerCase(),
    payload
  });

  return alert.toObject();
}

/**
 * Snoozes an alert for a specified duration in minutes.
 */
export async function snoozeAlert(alertId, durationMinutes = 15, snoozedBy = 'flight_surgeon') {
  const alert = await Alert.findOne({ alert_id: alertId });
  if (!alert) {
    throw new NotFoundException(`Alert not found: ${alertId}`);
  }

  const snoozedUntil = new Date(Date.now() + Number(durationMinutes) * 60 * 1000);
  alert.status = 'SNOOZED';
  alert.snoozed_until = snoozedUntil;
  await alert.save();

  const payload = {
    alert_id: alert.alert_id,
    status: alert.status,
    snoozed_until: snoozedUntil.toISOString(),
    snoozed_by: snoozedBy
  };

  await eventBus.publish({
    event_type: 'alert:snoozed',
    channel: 'alerts',
    severity: alert.severity.toLowerCase(),
    payload
  });

  return alert.toObject();
}

/**
 * Resolves an alert with mandatory resolution notes.
 */
export async function resolveAlert(alertId, resolutionNotes, resolvedBy = 'flight_surgeon') {
  if (!resolutionNotes || resolutionNotes.trim().length === 0) {
    throw new BadRequestException('Resolution notes are required to resolve an alert');
  }

  const alert = await Alert.findOne({ alert_id: alertId });
  if (!alert) {
    throw new NotFoundException(`Alert not found: ${alertId}`);
  }

  const now = new Date();
  alert.status = 'RESOLVED';
  alert.resolved_at = now;
  alert.resolved_by = resolvedBy;
  alert.resolution_notes = resolutionNotes.trim();
  await alert.save();

  const payload = {
    alert_id: alert.alert_id,
    status: alert.status,
    resolved_at: now.toISOString(),
    resolved_by: resolvedBy,
    resolution_notes: alert.resolution_notes
  };

  await eventBus.publish({
    event_type: 'alert:resolved',
    channel: 'alerts',
    severity: alert.severity.toLowerCase(),
    payload
  });

  return alert.toObject();
}

/**
 * Assigns an alert to a specific caregiver or flight surgeon.
 */
export async function assignAlert(alertId, assignTo) {
  if (!assignTo) {
    throw new BadRequestException('assignTo is required');
  }

  const alert = await Alert.findOne({ alert_id: alertId });
  if (!alert) {
    throw new NotFoundException(`Alert not found: ${alertId}`);
  }

  alert.assigned_to = assignTo;
  await alert.save();

  const payload = {
    alert_id: alert.alert_id,
    assigned_to: assignTo
  };

  await eventBus.publish({
    event_type: 'alert:assigned',
    channel: 'alerts',
    severity: alert.severity.toLowerCase(),
    payload
  });

  return alert.toObject();
}
