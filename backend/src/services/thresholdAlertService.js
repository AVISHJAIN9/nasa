import crypto from 'node:crypto';
import { Alert } from '../models/Alert.js';
import { eventBus } from '../bus/index.js';

export const STANDARD_THRESHOLDS = {
  heart_rate: {
    critical_high: 160,
    warning_high: 110,
    warning_low: 50,
    critical_low: 45,
    unit: 'bpm'
  },
  spo2: {
    critical_low: 90,
    warning_low: 95,
    unit: '%'
  },
  sys_bp: {
    critical_high: 180,
    warning_high: 140,
    critical_low: 85,
    unit: 'mmHg'
  },
  dia_bp: {
    critical_high: 110,
    warning_high: 90,
    unit: 'mmHg'
  },
  temperature: {
    critical_high: 39.0,
    warning_high: 38.0,
    critical_low: 35.0,
    unit: '°C'
  },
  respiration_rate: {
    critical_high: 30,
    warning_high: 24,
    critical_low: 8,
    unit: '/min'
  }
};

// In-memory cooldown registry: key -> timestamp (epoch ms)
const cooldownRegistry = new Map();

export function clearCooldownRegistry() {
  cooldownRegistry.clear();
}

/**
 * Evaluates a single telemetry reading against clinical threshold rules.
 * Respects cooldown windows and signal quality flags.
 */
export async function evaluateThresholdRules(reading, options = {}) {
  const {
    cooldownSeconds = 60,
    customThresholds = {},
    broadcast = true
  } = options;

  // Signal Quality Gate (F019): never alert on dropped or artifact readings
  if (reading.is_alertable === false) {
    return {
      alert_generated: false,
      reason: 'SIGNAL_QUALITY_SUPPRESSED',
      reading_id: reading.reading_id || null
    };
  }

  const metric = reading.metric;
  const value = Number(reading.value);
  if (isNaN(value)) {
    return { alert_generated: false, reason: 'INVALID_METRIC_VALUE' };
  }

  const crewId = reading.crew_id || 'UNKNOWN';
  const bounds = {
    ...(STANDARD_THRESHOLDS[metric] || {}),
    ...(customThresholds[metric] || {})
  };

  if (!bounds || Object.keys(bounds).length === 0) {
    return { alert_generated: false, reason: 'NO_RULES_FOR_METRIC' };
  }

  let violation = null;

  if (bounds.critical_high !== undefined && value >= bounds.critical_high) {
    violation = {
      condition: 'CRITICAL_HIGH',
      severity: 'CRITICAL',
      threshold: bounds.critical_high,
      title: `Critical High ${metric}`,
      message: `${crewId} ${metric} is critically high at ${value} ${bounds.unit || ''} (limit: >= ${bounds.critical_high})`
    };
  } else if (bounds.critical_low !== undefined && value <= bounds.critical_low) {
    violation = {
      condition: 'CRITICAL_LOW',
      severity: 'CRITICAL',
      threshold: bounds.critical_low,
      title: `Critical Low ${metric}`,
      message: `${crewId} ${metric} is critically low at ${value} ${bounds.unit || ''} (limit: <= ${bounds.critical_low})`
    };
  } else if (bounds.warning_high !== undefined && value >= bounds.warning_high) {
    violation = {
      condition: 'WARNING_HIGH',
      severity: 'WARNING',
      threshold: bounds.warning_high,
      title: `Elevated ${metric}`,
      message: `${crewId} ${metric} is elevated at ${value} ${bounds.unit || ''} (limit: >= ${bounds.warning_high})`
    };
  } else if (bounds.warning_low !== undefined && value <= bounds.warning_low) {
    violation = {
      condition: 'WARNING_LOW',
      severity: 'WARNING',
      threshold: bounds.warning_low,
      title: `Low ${metric}`,
      message: `${crewId} ${metric} is low at ${value} ${bounds.unit || ''} (limit: <= ${bounds.warning_low})`
    };
  }

  if (!violation) {
    return { alert_generated: false, reason: 'NOMINAL' };
  }

  // Check cooldown to prevent alert flooding
  const cooldownKey = `${crewId}:${metric}:${violation.condition}`;
  const now = Date.now();
  const lastAlertTime = cooldownRegistry.get(cooldownKey) || 0;
  const elapsedSeconds = (now - lastAlertTime) / 1000;

  if (elapsedSeconds < cooldownSeconds) {
    return {
      alert_generated: false,
      reason: 'COOLDOWN_ACTIVE',
      condition: violation.condition,
      cooldown_remaining_sec: Number((cooldownSeconds - elapsedSeconds).toFixed(1))
    };
  }

  // Record new alert firing time in cooldown registry
  cooldownRegistry.set(cooldownKey, now);

  const alertId = `alt-${crypto.randomBytes(6).toString('hex')}`;
  const alertDoc = await Alert.create({
    alert_id: alertId,
    crew_id: crewId,
    source: 'RULE',
    category: 'PHYSIOLOGY',
    metric,
    severity: violation.severity,
    title: violation.title,
    message: violation.message,
    value,
    threshold: violation.threshold,
    status: 'ACTIVE',
    metadata: {
      condition: violation.condition,
      reading_id: reading.reading_id || null,
      cooldown_sec: cooldownSeconds
    }
  });

  if (broadcast) {
    try {
      await eventBus.publish({
        event_type: 'alert.created',
        channel: 'alerts',
        severity: violation.severity.toLowerCase(),
        payload: {
          alert_id: alertId,
          crew_id: crewId,
          metric,
          severity: violation.severity,
          title: violation.title,
          message: violation.message,
          value,
          timestamp: new Date().toISOString()
        }
      });
    } catch {
      // Non-blocking event bus broadcast
    }
  }

  return {
    alert_generated: true,
    alert: alertDoc.toObject()
  };
}

/**
 * Batch evaluates a list of telemetry readings against threshold rules.
 */
export async function evaluateTelemetryBatch(readings, options = {}) {
  const results = [];
  for (const reading of readings) {
    const res = await evaluateThresholdRules(reading, options);
    results.push(res);
  }
  return results;
}
