import crypto from 'node:crypto';
import { AlertFeedback } from '../models/AlertFeedback.js';
import { Alert } from '../models/Alert.js';
import { STANDARD_THRESHOLDS } from './thresholdAlertService.js';
import { NotFoundException, BadRequestException } from '../middleware/errors.js';
import { eventBus } from '../bus/index.js';

// In-memory / cache of adapted per-astronaut thresholds: crew_id -> { metric: { warning_high, ... } }
const adaptedThresholdsMap = new Map();

export function clearFeedbackCache() {
  adaptedThresholdsMap.clear();
}

/**
 * Returns adapted thresholds for a specific crew member.
 */
export async function getAdaptedThresholdsForCrew(crewId) {
  if (adaptedThresholdsMap.has(crewId)) {
    return adaptedThresholdsMap.get(crewId);
  }

  // Load latest false-positive feedback from database to reconstruct adapted thresholds
  const falsePositives = await AlertFeedback.find({
    crew_id: crewId,
    label: 'FALSE_POSITIVE'
  }).lean();

  const adapted = {};
  for (const fp of falsePositives) {
    if (!adapted[fp.metric]) {
      adapted[fp.metric] = {};
    }
    if (fp.adapted_threshold !== null) {
      adapted[fp.metric].warning_high = fp.adapted_threshold;
    }
  }

  adaptedThresholdsMap.set(crewId, adapted);
  return adapted;
}

/**
 * Submits flight surgeon feedback on an alert and computes personalized threshold adaptation.
 * Requirement: "Surgeon marks alerts true or false and thresholds improve."
 */
export async function submitAlertFeedback(feedbackData, userContext = {}) {
  const {
    alert_id,
    label, // 'TRUE_POSITIVE' | 'FALSE_POSITIVE'
    surgeon_id = userContext.username || 'flight_surgeon',
    reason = ''
  } = feedbackData;

  if (!alert_id || !label) {
    throw new BadRequestException('alert_id and label (TRUE_POSITIVE or FALSE_POSITIVE) are required');
  }

  const alert = await Alert.findOne({ alert_id });
  if (!alert) {
    throw new NotFoundException(`Alert not found: ${alert_id}`);
  }

  const crewId = alert.crew_id;
  const metric = alert.metric;
  const val = Number(alert.value);
  const origThresh = Number(alert.threshold || STANDARD_THRESHOLDS[metric]?.warning_high || 110);

  let adaptedThresh = null;

  if (label === 'FALSE_POSITIVE') {
    // Threshold adaptation rule:
    // Widen upper warning bound beyond the false-positive value with safety buffer (+2)
    adaptedThresh = Math.max(origThresh, Math.ceil(val) + 2);

    // Update in-memory registry for this astronaut
    const currentCrewAdapted = (await getAdaptedThresholdsForCrew(crewId)) || {};
    if (!currentCrewAdapted[metric]) {
      currentCrewAdapted[metric] = {};
    }
    currentCrewAdapted[metric].warning_high = adaptedThresh;
    adaptedThresholdsMap.set(crewId, currentCrewAdapted);
  }

  const feedbackId = `fb-${crypto.randomBytes(6).toString('hex')}`;
  const feedbackDoc = await AlertFeedback.create({
    feedback_id: feedbackId,
    alert_id,
    crew_id: crewId,
    metric,
    label,
    value: val,
    original_threshold: origThresh,
    adapted_threshold: adaptedThresh,
    surgeon_id,
    reason
  });

  await eventBus.publish({
    event_type: 'alert:feedback_recorded',
    channel: 'alerts',
    severity: 'info',
    payload: {
      feedback_id: feedbackId,
      alert_id,
      crew_id: crewId,
      metric,
      label,
      adapted_threshold: adaptedThresh
    }
  });

  return feedbackDoc.toObject();
}

/**
 * Replays a historical series of telemetry readings through threshold evaluation
 * before feedback (using standard static thresholds) vs after feedback (using adapted thresholds).
 * Demonstrates that false-alarm rate drops on replay.
 * Requirement: "Done when: False-alarm rate drops on replay after feedback."
 */
export async function replayAlertEvaluation(readings, crewId) {
  const adapted = await getAdaptedThresholdsForCrew(crewId);

  let baselineAlertCount = 0;
  let adaptedAlertCount = 0;

  for (const reading of readings) {
    const val = Number(reading.value);
    const metric = reading.metric;
    const stdThresh = STANDARD_THRESHOLDS[metric]?.warning_high;
    const adaptThresh = adapted[metric]?.warning_high || stdThresh;

    if (stdThresh !== undefined && val >= stdThresh) {
      baselineAlertCount++;
    }

    if (adaptThresh !== undefined && val >= adaptThresh) {
      adaptedAlertCount++;
    }
  }

  const reductionCount = baselineAlertCount - adaptedAlertCount;
  const reductionPercent = baselineAlertCount > 0
    ? Number(((reductionCount / baselineAlertCount) * 100).toFixed(1))
    : 0;

  return {
    total_readings: readings.length,
    crew_id: crewId,
    baseline_alert_count: baselineAlertCount,
    adapted_alert_count: adaptedAlertCount,
    reduction_count: reductionCount,
    reduction_percent: reductionPercent,
    rate_dropped: adaptedAlertCount < baselineAlertCount
  };
}
