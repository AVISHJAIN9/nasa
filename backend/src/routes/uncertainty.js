import express from 'express';
import { z } from 'zod';
import {
  evaluatePredictionUncertainty,
  generateAndSaveReliabilityDiagram
} from '../services/uncertaintyService.js';

const router = express.Router();

const evalSchema = z.object({
  prediction: z.number(),
  ensemble_predictions: z.array(z.number()).default([]),
  sensor_quality_score: z.number().min(0).max(1).default(1.0),
  threshold: z.number().default(0.70)
});

// POST /api/v1/uncertainty/evaluate
router.post('/api/v1/uncertainty/evaluate', (req, res, next) => {
  try {
    const { prediction, ensemble_predictions, sensor_quality_score, threshold } = evalSchema.parse(req.body);
    const result = evaluatePredictionUncertainty(prediction, ensemble_predictions, {
      sensor_quality_score,
      threshold
    });
    res.status(200).json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/uncertainty/reliability-diagram
router.get('/api/v1/uncertainty/reliability-diagram', (req, res, next) => {
  try {
    const report = generateAndSaveReliabilityDiagram();
    res.status(200).json({ status: 'success', data: report });
  } catch (err) {
    next(err);
  }
});

export default router;
