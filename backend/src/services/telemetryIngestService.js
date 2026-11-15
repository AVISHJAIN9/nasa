import crypto from 'crypto';
import { TelemetryReading } from '../models/TelemetryReading.js';
import { assessReadingQuality } from './signalQualityService.js';
import { eventBus } from '../bus/index.js';

// In-memory idempotency cache for deduplication
const idempotencyStore = new Map();

export async function ingestTelemetryBatch({
  readings = [],
  idempotencyKey = null,
  provenance = 'SIMULATED',
  datasetId = 'SYNTHETIC_MARS_01'
}) {
  // 1. Idempotency Check
  if (idempotencyKey) {
    if (idempotencyStore.has(idempotencyKey)) {
      const cached = idempotencyStore.get(idempotencyKey);
      return {
        is_duplicate_retry: true,
        idempotency_key: idempotencyKey,
        ingested_count: cached.ingested_count,
        readings: cached.readings
      };
    }
  }

  // 2. Assess signal quality on every reading & prepare documents
  const bulkOps = [];
  const processedReadings = [];

  for (const r of readings) {
    const readingId = r.reading_id || `tel-${r.crew_id}-${r.metric}-${new Date(r.timestamp || Date.now()).getTime()}-${crypto.randomBytes(4).toString('hex')}`;
    const timestamp = r.timestamp ? new Date(r.timestamp) : new Date();

    const qualityAssessment = assessReadingQuality({
      metric: r.metric,
      value: r.value,
      timestamp,
      previousReadings: []
    });

    const doc = {
      reading_id: readingId,
      crew_id: r.crew_id,
      metric: r.metric,
      value: qualityAssessment.cleaned_value !== null ? qualityAssessment.cleaned_value : 0,
      unit: r.unit || (r.metric === 'spo2' ? '%' : r.metric === 'heart_rate' ? 'bpm' : 'mmHg'),
      timestamp,
      provenance: r.provenance || provenance,
      dataset_id: r.dataset_id || datasetId,
      quality_score: qualityAssessment.quality_score,
      quality_status: qualityAssessment.quality_status,
      is_alertable: qualityAssessment.is_alertable,
      is_anomaly: false
    };

    processedReadings.push(doc);

    bulkOps.push({
      updateOne: {
        filter: { reading_id: doc.reading_id },
        update: { $setOnInsert: doc },
        upsert: true
      }
    });
  }

  // 3. Write via async MongoDB pool
  if (bulkOps.length > 0) {
    await TelemetryReading.bulkWrite(bulkOps, { ordered: false });
  }

  const result = {
    is_duplicate_retry: false,
    idempotency_key: idempotencyKey,
    ingested_count: processedReadings.length,
    quality_summary: {
      good: processedReadings.filter((p) => p.quality_status === 'GOOD').length,
      dropouts: processedReadings.filter((p) => p.quality_status === 'DROPOUT').length,
      artifacts: processedReadings.filter((p) => p.quality_status === 'ARTIFACT').length,
      interpolated: processedReadings.filter((p) => p.quality_status === 'INTERPOLATED').length
    },
    readings: processedReadings
  };

  // Cache idempotency key
  if (idempotencyKey) {
    idempotencyStore.set(idempotencyKey, result);
    // Limit store size to 2000 entries
    if (idempotencyStore.size > 2000) {
      const firstKey = idempotencyStore.keys().next().value;
      idempotencyStore.delete(firstKey);
    }
  }

  // Publish telemetry stream to eventBus
  if (processedReadings.length > 0) {
    await eventBus.publish({
      event_type: 'TELEMETRY_INGESTED',
      channel: 'telemetry',
      severity: 'info',
      source: 'telemetry_ingestion_api',
      title: `Ingested ${processedReadings.length} telemetry readings`,
      payload: {
        count: processedReadings.length,
        crew_ids: Array.from(new Set(processedReadings.map((p) => p.crew_id))),
        has_dropouts: result.quality_summary.dropouts > 0
      }
    });
  }

  return result;
}
