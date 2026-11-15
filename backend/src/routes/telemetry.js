import { Router } from 'express';
import { z } from 'zod';
import {
  insertBatchReadings,
  queryTimeSeriesRange
} from '../services/telemetryStorageService.js';
import { ingestTelemetryBatch } from '../services/telemetryIngestService.js';
import { assessReadingQuality } from '../services/signalQualityService.js';
import { validateBody, validateQuery } from '../middleware/validation.js';

const router = Router();

const TelemetryItemSchema = z.object({
  reading_id: z.string().optional(),
  crew_id: z.string().min(1),
  metric: z.enum([
    'heart_rate',
    'spo2',
    'sys_bp',
    'dia_bp',
    'temperature',
    'hrv',
    'respiration_rate'
  ]),
  value: z.number().nullable(),
  unit: z.string().optional(),
  timestamp: z.string().optional(),
  provenance: z.enum(['SIMULATED', 'REPLAY', 'REAL_DEVICE']).default('SIMULATED'),
  dataset_id: z.string().optional()
});

const IngestBatchSchema = z.object({
  idempotency_key: z.string().optional(),
  provenance: z.enum(['SIMULATED', 'REPLAY', 'REAL_DEVICE']).optional(),
  dataset_id: z.string().optional(),
  readings: z.array(TelemetryItemSchema).min(1)
});

const QualityCheckSchema = z.object({
  metric: z.string(),
  value: z.number().nullable(),
  timestamp: z.string().optional()
});

const QueryRangeSchema = z.object({
  crew_id: z.string().min(1),
  metric: z.string().optional(),
  start_time: z.string(),
  end_time: z.string(),
  bucket_interval_minutes: z.coerce.number().optional()
});

router.post('/api/v1/telemetry/readings', validateBody(z.object({ readings: z.array(TelemetryItemSchema).min(1) })), async (req, res, next) => {
  try {
    const inserted = await insertBatchReadings(req.body.readings);
    res.status(201).json({
      message: 'Readings ingested successfully',
      count: inserted.length,
      sample_id: inserted[0]?.reading_id
    });
  } catch (err) {
    next(err);
  }
});

router.post('/api/v1/telemetry/ingest', validateBody(IngestBatchSchema), async (req, res, next) => {
  try {
    const { readings, idempotency_key, provenance, dataset_id } = req.body;
    const result = await ingestTelemetryBatch({
      readings,
      idempotencyKey: idempotency_key,
      provenance,
      datasetId: dataset_id
    });
    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (err) {
    next(err);
  }
});

router.post('/api/v1/telemetry/quality-check', validateBody(QualityCheckSchema), (req, res) => {
  const assessment = assessReadingQuality(req.body);
  res.json({
    status: 'success',
    data: assessment
  });
});

router.get('/api/v1/telemetry/range', validateQuery(QueryRangeSchema), async (req, res, next) => {
  try {
    const result = await queryTimeSeriesRange(req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
