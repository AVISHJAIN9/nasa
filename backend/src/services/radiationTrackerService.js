import { RadiationDose } from '../models/RadiationDose.js';
import { getMissionConfig } from './missionConfigService.js';
import { eventBus } from '../bus/index.js';

export function calculateRadiationStatus(cumulative, limit) {
  const percentage = Math.round((cumulative / limit) * 1000) / 10;
  let status = 'NOMINAL';
  let color = '#10b981'; // green

  if (percentage >= 80.0) {
    status = 'RED';
    color = '#ef4444'; // red
  } else if (percentage >= 60.0) {
    status = 'AMBER';
    color = '#f59e0b'; // amber
  }

  return { percentage, status, color };
}

export async function getOrCreateRadiationDose(crewId) {
  const missionConfig = getMissionConfig();
  const defaultRate = missionConfig.radiation_rate_msv_per_day || 2.2;
  const mode = missionConfig.mode || 'Mars';

  let record = await RadiationDose.findOne({ crew_id: crewId });
  if (!record) {
    record = await RadiationDose.create({
      crew_id: crewId,
      career_limit_msv: 600.0,
      cumulative_dose_msv: 0.0,
      current_mission_mode: mode,
      daily_rate_msv: defaultRate,
      percentage: 0.0,
      status: 'NOMINAL',
      history: []
    });
  }
  return record;
}

export async function accumulateRadiationDose({
  crewId,
  days = 1,
  speSpikeMsv = 0,
  type = 'DAILY_BACKGROUND',
  notes = ''
}) {
  const missionConfig = getMissionConfig();
  const currentMode = missionConfig.mode || 'Mars';
  const dailyRate = missionConfig.radiation_rate_msv_per_day || 2.2;

  const record = await getOrCreateRadiationDose(crewId);
  const doseDelta = Math.round((days * dailyRate + speSpikeMsv) * 100) / 100;
  const newCumulative = Math.round((record.cumulative_dose_msv + doseDelta) * 100) / 100;

  const { percentage, status, color } = calculateRadiationStatus(newCumulative, record.career_limit_msv);

  record.cumulative_dose_msv = newCumulative;
  record.current_mission_mode = currentMode;
  record.daily_rate_msv = dailyRate;
  record.percentage = percentage;
  record.status = status;
  record.last_accumulated_at = new Date();

  record.history.push({
    timestamp: new Date(),
    dose_delta_msv: doseDelta,
    type: speSpikeMsv > 0 ? 'SPE_SPIKE' : type,
    mission_mode: currentMode,
    notes: notes || (speSpikeMsv > 0 ? `Solar Particle Event spike of +${speSpikeMsv} mSv` : `Accumulated ${days} day(s) at ${dailyRate} mSv/day`)
  });

  await record.save();

  // If status escalated or SPE occurred, raise alert on eventBus
  if (status !== 'NOMINAL' || speSpikeMsv > 0) {
    await eventBus.publish({
      event_type: 'RADIATION_LIMIT_ALERT',
      channel: 'radiation_alerts',
      severity: status === 'RED' ? 'critical' : 'warning',
      source: 'radiation_tracker_service',
      title: `Radiation ${status} Warning: ${crewId} reached ${percentage}% of career limit`,
      payload: {
        crew_id: crewId,
        status,
        color,
        cumulative_dose_msv: newCumulative,
        career_limit_msv: record.career_limit_msv,
        percentage,
        mission_mode: currentMode
      }
    });
  }

  return {
    crew_id: crewId,
    cumulative_dose_msv: newCumulative,
    career_limit_msv: record.career_limit_msv,
    remaining_allowance_msv: Math.max(0, Math.round((record.career_limit_msv - newCumulative) * 100) / 100),
    percentage,
    status,
    color,
    daily_rate_msv: dailyRate,
    mission_mode: currentMode
  };
}

export async function getCrewRadiationGauge(crewId) {
  const missionConfig = getMissionConfig();
  const currentMode = missionConfig.mode || 'Mars';
  const dailyRate = missionConfig.radiation_rate_msv_per_day || 2.2;

  const record = await getOrCreateRadiationDose(crewId);
  const { percentage, status, color } = calculateRadiationStatus(record.cumulative_dose_msv, record.career_limit_msv);

  return {
    crew_id: crewId,
    cumulative_dose_msv: record.cumulative_dose_msv,
    career_limit_msv: record.career_limit_msv,
    remaining_allowance_msv: Math.max(0, Math.round((record.career_limit_msv - record.cumulative_dose_msv) * 100) / 100),
    percentage,
    status,
    color,
    daily_rate_msv: dailyRate,
    mission_mode: currentMode,
    history_count: record.history.length
  };
}

export async function getAllRadiationSummaries() {
  const records = await RadiationDose.find({}).sort({ crew_id: 1 }).lean();
  const missionConfig = getMissionConfig();

  return records.map((r) => {
    const { percentage, status, color } = calculateRadiationStatus(r.cumulative_dose_msv, r.career_limit_msv);
    return {
      crew_id: r.crew_id,
      cumulative_dose_msv: r.cumulative_dose_msv,
      career_limit_msv: r.career_limit_msv,
      percentage,
      status,
      color,
      daily_rate_msv: missionConfig.radiation_rate_msv_per_day,
      mission_mode: missionConfig.mode
    };
  });
}
