import { PersonalBaseline } from '../models/PersonalBaseline.js';
import { TelemetryReading } from '../models/TelemetryReading.js';

export function computeMedian(numbers) {
  if (!numbers || numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) {
    return sorted[mid];
  }
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

export function computeMAD(numbers, median) {
  if (!numbers || numbers.length === 0) return 0;
  const med = median !== undefined ? median : computeMedian(numbers);
  const absoluteDeviations = numbers.map((x) => Math.abs(x - med));
  const rawMad = computeMedian(absoluteDeviations);
  // Ensure non-zero MAD floor (at least 3% of median or 1.0) to prevent collapse
  return Math.max(rawMad, Math.max(1.0, med * 0.03));
}

export async function calculateBaselineFromReadings({ crewId, metric, readings = [] }) {
  // 1. Group readings into 24 hourly buckets (0..23)
  const buckets = Array.from({ length: 24 }, () => []);

  for (const r of readings) {
    if (r.value !== null && r.value !== undefined && r.is_alertable !== false) {
      const hour = new Date(r.timestamp).getUTCHours();
      buckets[hour].push(r.value);
    }
  }

  // 2. Compute Median and MAD for each hour
  const hourlyBaselines = [];
  for (let h = 0; h < 24; h++) {
    const vals = buckets[h];
    if (vals.length > 0) {
      const med = Math.round(computeMedian(vals) * 10) / 10;
      const mad = Math.round(computeMAD(vals, med) * 10) / 10;
      const low = Math.round((med - 2.5 * mad) * 10) / 10;
      const high = Math.round((med + 2.5 * mad) * 10) / 10;

      hourlyBaselines.push({
        hour: h,
        median: med,
        mad,
        normal_low: low,
        normal_high: high,
        sample_count: vals.length
      });
    } else {
      // Default placeholder if hour has no samples yet
      const fallbackMean = metric === 'heart_rate' ? 68 : metric === 'spo2' ? 98 : metric === 'sys_bp' ? 120 : metric === 'dia_bp' ? 80 : 36.8;
      const fallbackMad = metric === 'heart_rate' ? 4 : metric === 'spo2' ? 0.8 : metric === 'sys_bp' ? 5 : metric === 'dia_bp' ? 3 : 0.3;
      hourlyBaselines.push({
        hour: h,
        median: fallbackMean,
        mad: fallbackMad,
        normal_low: Math.round((fallbackMean - 2.5 * fallbackMad) * 10) / 10,
        normal_high: Math.round((fallbackMean + 2.5 * fallbackMad) * 10) / 10,
        sample_count: 0
      });
    }
  }

  // 3. Upsert into PersonalBaseline
  const existing = await PersonalBaseline.findOne({ crew_id: crewId, metric });
  const nextVersion = existing ? existing.version + 1 : 1;

  const updated = await PersonalBaseline.findOneAndUpdate(
    { crew_id: crewId, metric },
    {
      $set: {
        crew_id: crewId,
        metric,
        version: nextVersion,
        updated_at: new Date(),
        hourly_baselines: hourlyBaselines
      }
    },
    { upsert: true, new: true }
  );

  return updated.toJSON();
}

export async function calculateBaselinesForAllCrew({
  crewIds = ['CREW-01', 'CREW-02', 'CREW-03', 'CREW-04', 'CREW-05', 'CREW-06'],
  metrics = ['heart_rate', 'spo2', 'sys_bp', 'dia_bp', 'temperature']
} = {}) {
  const results = [];

  for (const crewId of crewIds) {
    for (const metric of metrics) {
      // Fetch recent valid readings
      const readings = await TelemetryReading.find({
        crew_id: crewId,
        metric,
        is_alertable: true
      })
        .sort({ timestamp: -1 })
        .limit(2000)
        .lean();

      const baseline = await calculateBaselineFromReadings({
        crewId,
        metric,
        readings
      });
      results.push(baseline);
    }
  }

  return {
    total_baselines_calculated: results.length,
    crews_calculated: crewIds.length,
    metrics_calculated: metrics.length,
    baselines: results
  };
}
