import { TelemetryReading } from '../models/TelemetryReading.js';
import { VitalsDailyRollup } from '../models/VitalsDailyRollup.js';

export async function refreshDailyRollups(targetDateStr = null) {
  const matchFilter = {};

  if (targetDateStr) {
    const startOfDay = new Date(`${targetDateStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${targetDateStr}T23:59:59.999Z`);
    matchFilter.timestamp = { $gte: startOfDay, $lte: endOfDay };
  }

  // Aggregate raw readings into daily stats
  const pipeline = [
    { $match: matchFilter },
    {
      $project: {
        crew_id: 1,
        metric: 1,
        value: 1,
        dateStr: {
          $dateToString: { format: '%Y-%m-%d', date: '$timestamp' }
        }
      }
    },
    {
      $group: {
        _id: { crew_id: '$crew_id', metric: '$metric', date: '$dateStr' },
        count: { $sum: 1 },
        min: { $min: '$value' },
        max: { $max: '$value' },
        avg: { $avg: '$value' },
        values: { $push: '$value' }
      }
    }
  ];

  const results = await TelemetryReading.aggregate(pipeline);

  const rollups = [];
  const now = new Date();

  for (const group of results) {
    const { crew_id, metric, date } = group._id;
    const sortedValues = group.values.sort((a, b) => a - b);
    const p50 = sortedValues[Math.floor(sortedValues.length * 0.5)] || 0;
    const p95 = sortedValues[Math.floor(sortedValues.length * 0.95)] || 0;

    const doc = await VitalsDailyRollup.findOneAndUpdate(
      { crew_id, date, metric },
      {
        $set: {
          count: group.count,
          min: Number(group.min.toFixed(2)),
          max: Number(group.max.toFixed(2)),
          avg: Number(group.avg.toFixed(2)),
          p50: Number(p50.toFixed(2)),
          p95: Number(p95.toFixed(2)),
          source: 'ROLLUP_VIEW',
          refreshed_at: now
        }
      },
      { upsert: true, new: true }
    );
    rollups.push(doc);
  }

  return {
    refreshed_count: rollups.length,
    rollups
  };
}

export async function getDashboardAnalyticsView({ crew_id, metric, start_date, end_date }) {
  const filter = {};
  if (crew_id) filter.crew_id = crew_id;
  if (metric) filter.metric = metric;

  if (start_date || end_date) {
    filter.date = {};
    if (start_date) filter.date.$gte = start_date;
    if (end_date) filter.date.$lte = end_date;
  }

  // Dashboard queries the materialized rollup view ONLY — not scanning raw point telemetry
  const start = process.hrtime.bigint();
  const rollups = await VitalsDailyRollup.find(filter).sort({ date: 1, metric: 1 }).lean();
  const end = process.hrtime.bigint();
  const queryDurationMs = Number(end - start) / 1_000_000;

  return {
    view_type: 'MATERIALIZED_DAILY_ROLLUP',
    source_collection: 'vitalsdailyrollups',
    used_materialized_view: true,
    query_duration_ms: Number(queryDurationMs.toFixed(2)),
    count: rollups.length,
    rollups
  };
}
