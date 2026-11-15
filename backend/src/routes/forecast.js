import express from 'express';
import { z } from 'zod';
import {
  fitHarmonicDiurnalModel,
  forecastTrajectory,
  runRollingBacktest
} from '../services/earlyWarningForecastService.js';

const router = express.Router();

const forecastSchema = z.object({
  timestamps: z.array(z.string()).min(24),
  values: z.array(z.number()).min(24),
  horizon_hours: z.number().int().positive().default(24),
  limits: z.object({
    high: z.number().optional(),
    low: z.number().optional()
  }).optional()
});

const backtestSchema = z.object({
  timestamps: z.array(z.string()).min(48),
  values: z.array(z.number()).min(48),
  horizon_hours: z.number().int().positive().default(24),
  n_folds: z.number().int().positive().default(3)
});

// POST /api/v1/forecaster/predict
router.post('/api/v1/forecaster/predict', (req, res, next) => {
  try {
    const { timestamps, values, horizon_hours, limits } = forecastSchema.parse(req.body);
    const dateObjs = timestamps.map((t) => new Date(t));
    const model = fitHarmonicDiurnalModel(dateObjs, values);
    const result = forecastTrajectory(model, dateObjs[dateObjs.length - 1], horizon_hours, limits);
    res.status(200).json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/forecaster/backtest
router.post('/api/v1/forecaster/backtest', (req, res, next) => {
  try {
    const { timestamps, values, horizon_hours, n_folds } = backtestSchema.parse(req.body);
    const dateObjs = timestamps.map((t) => new Date(t));
    const result = runRollingBacktest(dateObjs, values, horizon_hours, n_folds);
    res.status(200).json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
