import { MissionConfig } from '../models/MissionConfig.js';
import { BadRequestException } from '../middleware/errors.js';

export const MISSION_PRESETS = {
  ISS: {
    mode: 'ISS',
    comms_delay_seconds: 0.5,
    blackout_schedule: [],
    radiation_rate_msv_per_day: 0.5,
    radiation_alert_threshold_msv: 5.0,
    supply_days_limit: 90,
    crew_size: 6,
    clinical_thresholds: {
      hr_low: 50,
      hr_high: 100,
      spo2_low: 95,
      sys_bp_high: 140,
      dia_bp_high: 90,
      temp_high: 38.0
    }
  },
  Moon: {
    mode: 'Moon',
    comms_delay_seconds: 1.3,
    blackout_schedule: [{ start_time: '02:00', duration_seconds: 45 }],
    radiation_rate_msv_per_day: 1.5,
    radiation_alert_threshold_msv: 10.0,
    supply_days_limit: 30,
    crew_size: 4,
    clinical_thresholds: {
      hr_low: 48,
      hr_high: 105,
      spo2_low: 94,
      sys_bp_high: 142,
      dia_bp_high: 92,
      temp_high: 38.2
    }
  },
  Mars: {
    mode: 'Mars',
    comms_delay_seconds: 720.0, // 12 minutes
    blackout_schedule: [{ start_time: '04:00', duration_seconds: 3600 }],
    radiation_rate_msv_per_day: 2.2,
    radiation_alert_threshold_msv: 25.0,
    supply_days_limit: 500,
    crew_size: 4,
    clinical_thresholds: {
      hr_low: 45,
      hr_high: 110,
      spo2_low: 93,
      sys_bp_high: 145,
      dia_bp_high: 95,
      temp_high: 38.5
    }
  }
};

// In-memory active configuration cache for sub-millisecond access and instant live updates
let activeConfigCache = { ...MISSION_PRESETS.ISS, is_active: true };

export async function initializeMissionConfig() {
  for (const [mode, preset] of Object.entries(MISSION_PRESETS)) {
    const isActive = mode === 'ISS';
    await MissionConfig.findOneAndUpdate(
      { mode },
      {
        $setOnInsert: {
          ...preset,
          is_active: isActive,
          updated_by: 'system'
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  // Load whichever is currently marked is_active
  const currentActive = await MissionConfig.findOne({ is_active: true });
  if (currentActive) {
    activeConfigCache = currentActive.toJSON();
  }
  return activeConfigCache;
}

export function getMissionConfig() {
  return activeConfigCache;
}

export async function setMissionMode(mode, updatedBy = 'system') {
  const normalizedKey = Object.keys(MISSION_PRESETS).find(
    (k) => k.toLowerCase() === String(mode).toLowerCase()
  );
  if (!normalizedKey) {
    throw new BadRequestException(`Invalid mission mode '${mode}'. Allowed: ['ISS', 'Moon', 'Mars']`);
  }

  const targetMode = normalizedKey;

  // Deactivate all modes, activate chosen mode
  await MissionConfig.updateMany({}, { $set: { is_active: false } });
  const updated = await MissionConfig.findOneAndUpdate(
    { mode: targetMode },
    {
      $set: {
        is_active: true,
        updated_by: updatedBy,
        updated_at: new Date()
      }
    },
    { new: true }
  );

  if (updated) {
    activeConfigCache = updated.toJSON();
  } else {
    // If somehow missing in DB, recreate from preset
    activeConfigCache = { ...MISSION_PRESETS[targetMode], is_active: true, updated_by: updatedBy };
  }

  return activeConfigCache;
}

export async function updateMissionConfig(partialUpdates, updatedBy = 'system') {
  const currentMode = activeConfigCache.mode || 'ISS';
  const updated = await MissionConfig.findOneAndUpdate(
    { mode: currentMode },
    {
      $set: {
        ...partialUpdates,
        updated_by: updatedBy,
        updated_at: new Date()
      }
    },
    { new: true }
  );

  if (updated) {
    activeConfigCache = updated.toJSON();
  }
  return activeConfigCache;
}
