import express from 'express';
import { z } from 'zod';
import { generateVitalsStream, benchmarkMultiCrewStream } from '../services/vitalsSimulatorService.js';
import { validateBody } from '../middleware/validation.js';

const router = express.Router();

const VitalsStreamSchema = z.object({
  crew_id: z.string().default('CREW-01'),
  start_time: z.string().optional(),
  duration_seconds: z.number().int().positive().max(3600).default(60),
  step_seconds: z.number().int().positive().max(60).default(1),
  seed: z.number().int().default(42),
  baselines: z.record(z.number()).optional(),
  ingest: z.boolean().default(false)
});

const MultiCrewBenchmarkSchema = z.object({
  crew_count: z.number().int().min(1).max(12).default(6),
  duration_seconds: z.number().int().positive().max(7200).default(3600),
  step_seconds: z.number().int().positive().max(60).default(1),
  seed: z.number().int().default(1337)
});

router.post('/api/v1/simulator/vitals/stream', validateBody(VitalsStreamSchema), async (req, res, next) => {
  try {
    const { crew_id, start_time, duration_seconds, step_seconds, seed, baselines, ingest } = req.body;
    const result = await generateVitalsStream({
      crewId: crew_id,
      startTime: start_time ? new Date(start_time) : new Date(),
      durationSeconds: duration_seconds,
      stepSeconds: step_seconds,
      seed,
      baselines,
      ingest
    });

    res.json({
      status: 'success',
      data: result
    });
  } catch (err) {
    next(err);
  }
});

router.post('/api/v1/simulator/vitals/benchmark', validateBody(MultiCrewBenchmarkSchema), async (req, res, next) => {
  try {
    const { crew_count, duration_seconds, step_seconds, seed } = req.body;
    const result = benchmarkMultiCrewStream({
      crewCount: crew_count,
      durationSeconds: duration_seconds,
      stepSeconds: step_seconds,
      seed
    });

    res.json({
      status: 'success',
      data: result
    });
  } catch (err) {
    next(err);
  }
});

export default router;
