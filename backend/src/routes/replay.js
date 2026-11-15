import express from 'express';
import { z } from 'zod';
import { listAvailableReplayDatasets, replayDataset } from '../services/datasetReplayService.js';
import { validateBody } from '../middleware/validation.js';

const router = express.Router();

const ReplayTriggerSchema = z.object({
  dataset_id: z.string().min(1),
  crew_id: z.string().default('CREW-01'),
  start_time: z.string().optional(),
  speed: z.number().positive().default(1.0),
  ingest: z.boolean().default(true)
});

router.get('/api/v1/replay/datasets', (req, res) => {
  const datasets = listAvailableReplayDatasets();
  res.json({
    status: 'success',
    count: datasets.length,
    datasets
  });
});

router.post('/api/v1/replay/start', validateBody(ReplayTriggerSchema), async (req, res, next) => {
  try {
    const { dataset_id, crew_id, start_time, speed, ingest } = req.body;
    const result = await replayDataset({
      datasetId: dataset_id,
      crewId: crew_id,
      startTime: start_time ? new Date(start_time) : new Date(),
      speed,
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

export default router;
