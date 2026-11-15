import { Router } from 'express';
import { z } from 'zod';
import {
  registerDataset,
  listDatasets,
  getProvenanceBadge
} from '../services/provenanceService.js';
import { validateBody, validateQuery } from '../middleware/validation.js';

const router = Router();

const DatasetSchema = z.object({
  dataset_id: z.string().min(1),
  name: z.string().min(1),
  provenance_type: z.enum(['SIMULATED', 'REPLAY', 'REAL_DEVICE']),
  source_url: z.string().url().optional(),
  license: z.string().min(1),
  citation: z.string().optional(),
  version: z.string().optional()
});

const BadgeQuerySchema = z.object({
  provenance: z.enum(['SIMULATED', 'REPLAY', 'REAL_DEVICE']).default('SIMULATED'),
  dataset_id: z.string().optional()
});

router.get('/api/v1/provenance/datasets', async (req, res, next) => {
  try {
    const { type } = req.query;
    const datasets = await listDatasets(type);
    res.json({ count: datasets.length, datasets });
  } catch (err) {
    next(err);
  }
});

router.post('/api/v1/provenance/datasets', validateBody(DatasetSchema), async (req, res, next) => {
  try {
    const dataset = await registerDataset(req.body);
    res.status(201).json(dataset);
  } catch (err) {
    next(err);
  }
});

router.get('/api/v1/provenance/badge', validateQuery(BadgeQuerySchema), async (req, res, next) => {
  try {
    const badge = await getProvenanceBadge(req.query);
    res.json(badge);
  } catch (err) {
    next(err);
  }
});

export default router;
