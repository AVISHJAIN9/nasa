export const METRIC_PLAUSIBILITY_BOUNDS = {
  heart_rate: { min: 30, max: 220, max_delta_per_sec: 40, zero_allowed: false },
  spo2: { min: 70, max: 100, max_delta_per_sec: 15, zero_allowed: false },
  sys_bp: { min: 60, max: 240, max_delta_per_sec: 35, zero_allowed: false },
  dia_bp: { min: 40, max: 140, max_delta_per_sec: 25, zero_allowed: false },
  temperature: { min: 32.0, max: 43.0, max_delta_per_sec: 2.0, zero_allowed: false },
  respiration_rate: { min: 4, max: 50, max_delta_per_sec: 15, zero_allowed: false },
  hrv: { min: 5, max: 250, max_delta_per_sec: 80, zero_allowed: false }
};

export function assessReadingQuality({
  metric,
  value,
  timestamp = new Date(),
  previousReadings = []
}) {
  const flags = [];
  const bounds = METRIC_PLAUSIBILITY_BOUNDS[metric];

  // 1. Missing / Dropout Check
  if (value === null || value === undefined || Number.isNaN(value) || (!bounds?.zero_allowed && value === 0)) {
    return {
      quality_score: 0.0,
      quality_status: 'DROPOUT',
      is_alertable: false,
      flags: ['SENSOR_DROPOUT', 'MISSING_DATA'],
      cleaned_value: null
    };
  }

  // 2. Plausibility Range Check
  if (bounds) {
    if (value < bounds.min || value > bounds.max) {
      flags.push(`IMPLAUSIBLE_RANGE (${value} outside [${bounds.min}, ${bounds.max}])`);
      return {
        quality_score: 0.1,
        quality_status: 'ARTIFACT',
        is_alertable: false,
        flags,
        cleaned_value: value
      };
    }
  }

  // 3. Spike / Rate-of-Change Check against previous reading
  if (previousReadings.length > 0 && bounds) {
    const prev = previousReadings[previousReadings.length - 1];
    const dtSeconds = Math.max(0.1, (new Date(timestamp).getTime() - new Date(prev.timestamp).getTime()) / 1000);
    const delta = Math.abs(value - prev.value);
    const ratePerSec = delta / dtSeconds;

    if (ratePerSec > bounds.max_delta_per_sec) {
      flags.push(`PHYSIOLOGICAL_SPIKE (delta ${delta} in ${dtSeconds.toFixed(1)}s exceeds limit ${bounds.max_delta_per_sec}/s)`);
      return {
        quality_score: 0.25,
        quality_status: 'ARTIFACT',
        is_alertable: false,
        flags,
        cleaned_value: value
      };
    }

    // 4. Flatline Detection (sensor freeze over 5+ identical consecutive readings)
    if (previousReadings.length >= 4) {
      const recentVals = previousReadings.slice(-4).map((r) => r.value);
      if (recentVals.every((v) => v === value)) {
        flags.push('SENSOR_FLATLINE_DETECTED');
        return {
          quality_score: 0.3,
          quality_status: 'ARTIFACT',
          is_alertable: false,
          flags,
          cleaned_value: value
        };
      }
    }
  }

  // Reading passes all plausibility checks
  return {
    quality_score: 1.0,
    quality_status: 'GOOD',
    is_alertable: true,
    flags: [],
    cleaned_value: value
  };
}

/**
 * Short-gap interpolation for missing readings between valid points
 */
export function interpolateShortGap(prevReading, nextReading, targetTimestamp) {
  if (!prevReading || !nextReading) return null;
  const t0 = new Date(prevReading.timestamp).getTime();
  const t1 = new Date(nextReading.timestamp).getTime();
  const target = new Date(targetTimestamp).getTime();

  if (target <= t0 || target >= t1 || (t1 - t0) > 10000) {
    // Gap longer than 10 seconds cannot be safely interpolated
    return null;
  }

  const fraction = (target - t0) / (t1 - t0);
  const interpolatedValue = Math.round((prevReading.value + fraction * (nextReading.value - prevReading.value)) * 10) / 10;

  return {
    value: interpolatedValue,
    quality_score: 0.85,
    quality_status: 'INTERPOLATED',
    is_alertable: true,
    flags: ['SHORT_GAP_INTERPOLATED']
  };
}
