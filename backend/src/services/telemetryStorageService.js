import crypto from 'crypto';
import { TelemetryReading } from '../models/TelemetryReading.js';

export async function insertBatchReadings(readings = []) {
  if (readings.length === 0) return [];

  const prepared = readings.map((r) => ({
    reading_id: r.reading_id || `read-${crypto.randomBytes(6).toString('hex')}`,
    crew_id: r.crew_id,
    metric: r.metric,
    value: Number(r.value),
    unit: r.unit || 'units',
    timestamp: r.timestamp ? new Date(r.timestamp) : new Date(),
    provenance: r.provenance || 'SIMULATED',
    dataset_id: r.dataset_id || 'SYNTHETIC_MARS_01',
    is_anomaly: Boolean(r.is_anomaly)
  }));

  const inserted = await TelemetryReading.insertMany(prepared);
  return inserted;
}

export async function queryTimeSeriesRange({
  crew_id,
  metric,
  start_time,
  end_time,
  bucket_interval_minutes
}) {
  const start = process.hrtime.bigint();

  const matchFilter = {
    crew_id,
    timestamp: {
      $gte: new Date(start_time),
      $lte: new Date(end_time)
    }
  };

  if (metric) {
    matchFilter.metric = metric;
  }

  // 1. Raw point query with index optimization
  const readings = await TelemetryReading.find(matchFilter)
    .sort({ timestamp: 1 })
    .lean();

  // 2. Summary stats calculation
  let summary = { min: 0, max: 0, avg: 0, count: readings.length };
  if (readings.length > 0) {
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;

    for (const r of readings) {
      sum += r.value;
      if (r.value < min) min = r.value;
      if (r.value > max) max = r.value;
    }

    summary = {
      count: readings.length,
      min: Number(min.toFixed(2)),
      max: Number(max.toFixed(2)),
      avg: Number((sum / readings.length).toFixed(2))
    };
  }

  // 3. Optional bucketing
  let buckets = [];
  if (bucket_interval_minutes && readings.length > 0) {
    const bucketMs = bucket_interval_minutes * 60 * 1000;
    const bucketMap = new Map();

    for (const r of readings) {
      const bucketTime = new Date(
        Math.floor(new Date(r.timestamp).getTime() / bucketMs) * bucketMs
      ).toISOString();

      if (!bucketMap.has(bucketTime)) {
        bucketMap.set(bucketTime, { bucket_time: bucketTime, count: 0, sum: 0, min: Infinity, max: -Infinity });
      }

      const b = bucketMap.get(bucketTime);
      b.count += 1;
      b.sum += r.value;
      if (r.value < b.min) b.min = r.value;
      if (r.value > b.max) b.max = r.value;
    }

    buckets = Array.from(bucketMap.values()).map((b) => ({
      bucket_time: b.bucket_time,
      count: b.count,
      avg: Number((b.sum / b.count).toFixed(2)),
      min: Number(b.min.toFixed(2)),
      max: Number(b.max.toFixed(2))
    }));
  }

  const end = process.hrtime.bigint();
  const durationMs = Number(end - start) / 1_000_000;

  return {
    crew_id,
    metric: metric || 'all',
    start_time,
    end_time,
    query_duration_ms: Number(durationMs.toFixed(2)),
    under_target_100ms: durationMs < 100,
    point_count: readings.length,
    summary,
    buckets: buckets.length > 0 ? buckets : undefined,
    data_points: readings
  };
}
