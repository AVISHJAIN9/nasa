import { TelemetryReading } from '../models/TelemetryReading.js';

// Deterministic Mulberry32 32-bit PRNG
export function createPRNG(seed) {
  let s = Math.floor(Math.abs(seed)) || 1;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const BASELINE_VITALS = {
  heart_rate: { mean: 68, amp: 6, unit: 'bpm', min: 45, max: 140 },
  spo2: { mean: 98.2, amp: 0.5, unit: '%', min: 90, max: 100 },
  sys_bp: { mean: 118, amp: 6, unit: 'mmHg', min: 90, max: 180 },
  dia_bp: { mean: 76, amp: 4, unit: 'mmHg', min: 60, max: 110 },
  temperature: { mean: 36.8, amp: 0.4, unit: 'celsius', min: 35.5, max: 39.5 },
  respiration_rate: { mean: 14, amp: 1.5, unit: 'rpm', min: 8, max: 28 },
  hrv: { mean: 55, amp: 5, unit: 'ms', min: 15, max: 120 }
};

/**
 * Generates deterministic physiological vitals for a given timestamp and crew baseline
 */
export function generateVitalsPoint({ crewId = 'CREW-01', timestamp = new Date(), prng, baselines = {} }) {
  const dateObj = new Date(timestamp);
  const secondsOfDay =
    dateObj.getUTCHours() * 3600 + dateObj.getUTCMinutes() * 60 + dateObj.getUTCSeconds();
  
  // Circadian phase: lowest at ~05:00 UTC (18000s), peaks at ~17:00 UTC (61200s)
  const circadianPhase = Math.sin((2 * Math.PI * (secondsOfDay - 18000)) / 86400);

  const vitals = {};
  for (const [metric, cfg] of Object.entries(BASELINE_VITALS)) {
    const base = baselines[metric] ?? cfg.mean;
    // noise is in range [-1, 1]
    const noise = (prng() * 2 - 1) * (cfg.amp * 0.4);
    const circadian = circadianPhase * (cfg.amp * 0.6);
    let val = base + circadian + noise;

    // Metric specific rounding
    if (metric === 'spo2' || metric === 'temperature') {
      val = Math.round(val * 10) / 10;
    } else {
      val = Math.round(val);
    }

    // Clamp within biological limits
    val = Math.max(cfg.min, Math.min(cfg.max, val));
    vitals[metric] = {
      value: val,
      unit: cfg.unit
    };
  }

  return {
    crew_id: crewId,
    timestamp: dateObj,
    vitals
  };
}

/**
 * Streams or generates a vitals sequence over time
 */
export async function generateVitalsStream({
  crewId = 'CREW-01',
  startTime = new Date(),
  durationSeconds = 60,
  stepSeconds = 1,
  seed = 42,
  baselines = {},
  ingest = false
}) {
  const prng = createPRNG(seed);
  const startMs = new Date(startTime).getTime();
  const points = [];
  const telemetryDocs = [];

  for (let sec = 0; sec < durationSeconds; sec += stepSeconds) {
    const ptTimestamp = new Date(startMs + sec * 1000);
    const point = generateVitalsPoint({ crewId, timestamp: ptTimestamp, prng, baselines });
    points.push(point);

    if (ingest) {
      for (const [metric, data] of Object.entries(point.vitals)) {
        telemetryDocs.push({
          reading_id: `tel-sim-${crewId}-${metric}-${point.timestamp.getTime()}-${Math.floor(prng() * 10000)}`,
          crew_id: crewId,
          metric,
          value: data.value,
          unit: data.unit,
          timestamp: point.timestamp,
          provenance: 'SIMULATED',
          dataset_id: 'SYNTHETIC_MARS_01'
        });
      }
    }
  }

  if (ingest && telemetryDocs.length > 0) {
    await TelemetryReading.insertMany(telemetryDocs, { ordered: false });
  }

  return {
    crew_id: crewId,
    total_points: points.length,
    duration_seconds: durationSeconds,
    step_seconds: stepSeconds,
    points
  };
}

/**
 * Runs 6 crew members at 1 Hz for a given duration (benchmarking & load test validation)
 */
export function benchmarkMultiCrewStream({ crewCount = 6, durationSeconds = 3600, stepSeconds = 1, seed = 1337 }) {
  const results = [];
  const startTime = new Date();

  for (let c = 1; c <= crewCount; c++) {
    const crewId = `CREW-0${c}`;
    const prng = createPRNG(seed + c * 1000);
    let sampleCount = 0;
    let minHR = 999;
    let maxHR = 0;

    for (let sec = 0; sec < durationSeconds; sec += stepSeconds) {
      const ts = new Date(startTime.getTime() + sec * 1000);
      const pt = generateVitalsPoint({ crewId, timestamp: ts, prng });
      sampleCount++;
      const hr = pt.vitals.heart_rate.value;
      if (hr < minHR) minHR = hr;
      if (hr > maxHR) maxHR = hr;
    }

    results.push({
      crewId,
      sampleCount,
      minHR,
      maxHR,
      stable: minHR >= BASELINE_VITALS.heart_rate.min && maxHR <= BASELINE_VITALS.heart_rate.max
    });
  }

  return {
    crew_count: crewCount,
    duration_seconds: durationSeconds,
    total_readings_generated: crewCount * durationSeconds * Object.keys(BASELINE_VITALS).length,
    crews: results
  };
}
