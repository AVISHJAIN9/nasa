import crypto from 'crypto';
import { WatchdogLog } from '../models/WatchdogLog.js';
import { eventBus } from '../bus/index.js';
import { recordAuditEntry } from './auditLogService.js';

// In-memory watchdog state
const watchdogState = {
  current_mode: 'ACTIVE_ML',
  ai_degraded: false,
  banner_message: null,
  active_incident: null,
  last_evaluated: new Date(),
  monitored_sensors: {
    heart_rate: { status: 'HEALTHY', dropout_rate: 0.0, last_reading: null },
    spo2: { status: 'HEALTHY', dropout_rate: 0.0, last_reading: null },
    sys_bp: { status: 'HEALTHY', dropout_rate: 0.0, last_reading: null },
    temperature: { status: 'HEALTHY', dropout_rate: 0.0, last_reading: null }
  }
};

// Population Stability Index (PSI) calculation
export function calculatePSI(referenceData, observedData, numBins = 5) {
  if (!referenceData?.length || !observedData?.length) return 0.0;

  // Find min and max across all data
  const allData = [...referenceData, ...observedData];
  const min = Math.min(...allData);
  const max = Math.max(...allData);

  if (Math.abs(max - min) < 1e-5) return 0.0;

  const step = (max - min) / numBins;
  const binEdges = [];
  for (let i = 0; i <= numBins; i++) {
    binEdges.push(min + i * step);
  }

  const refCounts = new Array(numBins).fill(0);
  const obsCounts = new Array(numBins).fill(0);

  referenceData.forEach((val) => {
    let b = Math.floor((val - min) / step);
    if (b >= numBins) b = numBins - 1;
    refCounts[b]++;
  });

  observedData.forEach((val) => {
    let b = Math.floor((val - min) / step);
    if (b >= numBins) b = numBins - 1;
    obsCounts[b]++;
  });

  let psi = 0;
  const eps = 0.0001; // Avoid divide by zero
  for (let i = 0; i < numBins; i++) {
    const p = (refCounts[i] + eps) / (referenceData.length + eps * numBins);
    const q = (obsCounts[i] + eps) / (observedData.length + eps * numBins);
    psi += (p - q) * Math.log(p / q);
  }

  return Number(Math.max(0, psi).toFixed(4));
}

// Kolmogorov-Smirnov two-sample statistic
export function calculateKS(referenceData, observedData) {
  if (!referenceData?.length || !observedData?.length) return 0.0;

  const sortedRef = [...referenceData].sort((a, b) => a - b);
  const sortedObs = [...observedData].sort((a, b) => a - b);

  const allPoints = Array.from(new Set([...sortedRef, ...sortedObs])).sort((a, b) => a - b);
  let maxD = 0;

  for (const x of allPoints) {
    // Empirical CDF ref
    const cdfRef = sortedRef.filter((v) => v <= x).length / sortedRef.length;
    // Empirical CDF obs
    const cdfObs = sortedObs.filter((v) => v <= x).length / sortedObs.length;
    const d = Math.abs(cdfRef - cdfObs);
    if (d > maxD) maxD = d;
  }

  return Number(maxD.toFixed(4));
}

// Trigger safe fallback to rules mode
export async function triggerFallback({ eventType, reason, bannerMessage, recoveryGuidance, metrics = {}, createdBy = 'system_watchdog' }) {
  const previousMode = watchdogState.current_mode;
  watchdogState.current_mode = 'DEGRADED_FALLBACK_RULES';
  watchdogState.ai_degraded = true;
  watchdogState.banner_message = bannerMessage || `⚠️ AI SYSTEM DEGRADED: ${reason}. Deterministic safety rules active.`;
  watchdogState.last_evaluated = new Date();

  const eventId = `wd-evt-${crypto.randomBytes(4).toString('hex')}`;
  const incident = {
    event_id: eventId,
    event_type: eventType,
    previous_mode: previousMode,
    current_mode: 'DEGRADED_FALLBACK_RULES',
    reason,
    banner_message: watchdogState.banner_message,
    recovery_guidance: recoveryGuidance || 'Inspect sensor connections, rerun calibration, or verify baseline drift.',
    drift_metrics: metrics.drift || {},
    sensor_metrics: metrics.sensor || {},
    created_by: createdBy,
    timestamp: new Date()
  };

  watchdogState.active_incident = incident;

  // Persist WatchdogLog
  await WatchdogLog.create(incident);

  // Record in cryptographic AuditLog
  try {
    await recordAuditEntry({
      user_id: createdBy || 'system_watchdog',
      user_role: 'admin',
      action: 'WATCHDOG_SAFE_FALLBACK',
      resource: 'ML_SUBSYSTEM',
      details: { event_id: eventId, reason, previous_mode: previousMode, current_mode: 'DEGRADED_FALLBACK_RULES' }
    });
  } catch (err) {
    // Non-blocking if audit fails
    console.error('AuditLog error in watchdog:', err);
  }

  // Publish event bus alert
  eventBus.publish('watchdog:fallback_triggered', incident);

  return incident;
}

// Injected Sensor Failure (Demo control panel)
export async function injectSensorFailure(sensor = 'heart_rate', dropoutRate = 0.45) {
  if (watchdogState.monitored_sensors[sensor]) {
    watchdogState.monitored_sensors[sensor].status = 'DEGRADED';
    watchdogState.monitored_sensors[sensor].dropout_rate = dropoutRate;
  }

  return triggerFallback({
    eventType: 'SENSOR_FAILURE',
    reason: `Critical sensor dropouts on ${sensor} (${Math.round(dropoutRate * 100)}% packet loss). Signal quality unreliable.`,
    bannerMessage: `⚠️ AI DEGRADED: High sensor dropout rate (${Math.round(dropoutRate * 100)}%) on ${sensor}. Falling back to deterministic clinical rules.`,
    recoveryGuidance: `Check lead attachment on ${sensor} monitor and verify signal SNR.`,
    metrics: { sensor: { dropout_rate: dropoutRate, failed_sensors: [sensor] } },
    createdBy: 'demo_control_panel'
  });
}

// Injected Data Distribution Drift (Demo control panel)
export async function injectDataDrift(metric = 'heart_rate', driftFactor = 1.6) {
  // Generate reference data and shifted observed data
  const refData = [];
  const obsData = [];
  for (let i = 0; i < 100; i++) {
    refData.push(65 + (Math.random() - 0.5) * 10);
    obsData.push(65 * driftFactor + (Math.random() - 0.5) * 12);
  }

  const psi = calculatePSI(refData, obsData);
  const ks = calculateKS(refData, obsData);

  return triggerFallback({
    eventType: 'DATA_DRIFT',
    reason: `Severe statistical distribution shift detected on ${metric} (PSI: ${psi}, KS-statistic: ${ks}). Features outside model calibration domain.`,
    bannerMessage: `⚠️ AI DEGRADED: Distribution drift detected on ${metric} (PSI: ${psi} > 0.25). AI models suspended; clinical safety rules active.`,
    recoveryGuidance: 'Recalculate astronaut circadian baseline or review environmental cabin stressors.',
    metrics: { drift: { psi, ks_statistic: ks } },
    createdBy: 'demo_control_panel'
  });
}

// Recover watchdog back to active ML
export async function recoverWatchdog(recoveredBy = 'flight_surgeon') {
  const previousMode = watchdogState.current_mode;
  watchdogState.current_mode = 'ACTIVE_ML';
  watchdogState.ai_degraded = false;
  watchdogState.banner_message = null;
  watchdogState.active_incident = null;
  watchdogState.last_evaluated = new Date();

  // Reset sensors
  Object.keys(watchdogState.monitored_sensors).forEach((s) => {
    watchdogState.monitored_sensors[s].status = 'HEALTHY';
    watchdogState.monitored_sensors[s].dropout_rate = 0.0;
  });

  const eventId = `wd-rec-${crypto.randomBytes(4).toString('hex')}`;
  const log = {
    event_id: eventId,
    event_type: 'WATCHDOG_RECOVERED',
    previous_mode: previousMode,
    current_mode: 'ACTIVE_ML',
    reason: 'Manual or automated system recovery. All telemetry sensors verified healthy.',
    banner_message: 'System nominal: Active ML models restored.',
    recovery_guidance: 'Nominal monitoring resumed.',
    created_by: recoveredBy,
    timestamp: new Date()
  };

  await WatchdogLog.create(log);
  eventBus.publish('watchdog:recovered', log);

  return {
    status: 'success',
    current_mode: 'ACTIVE_ML',
    ai_degraded: false
  };
}

// Get current watchdog status
export function getWatchdogStatus() {
  return {
    operational_mode: watchdogState.current_mode,
    ai_degraded: watchdogState.ai_degraded,
    banner_message: watchdogState.banner_message,
    active_incident: watchdogState.active_incident,
    monitored_sensors: watchdogState.monitored_sensors,
    last_evaluated: watchdogState.last_evaluated
  };
}
