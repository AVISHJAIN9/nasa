import express from 'express';
import { z } from 'zod';
import {
  calculateHealthRiskScore,
  generateAndSaveCalibrationPlot
} from '../services/healthRiskScoreService.js';
import { HealthRiskScore } from '../models/HealthRiskScore.js';

const router = express.Router();

const calculateSchema = z.object({
  crew_id: z.string().min(1),
  features: z.object({
    vitals_deviation: z.number().default(0),
    hypoxia_index: z.number().default(0),
    sleep_debt_hours: z.number().default(0),
    stress_index: z.number().default(1),
    radiation_load: z.number().default(0)
  }),
  create_alert: z.boolean().default(true)
});

// POST /api/v1/risk/calculate
router.post('/api/v1/risk/calculate', async (req, res, next) => {
  try {
    const { crew_id, features, create_alert } = calculateSchema.parse(req.body);
    const result = await calculateHealthRiskScore(crew_id, features, { createAlert: create_alert });
    res.status(200).json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/risk/crew/:crew_id
router.get('/api/v1/risk/crew/:crew_id', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const scores = await HealthRiskScore.find({ crew_id: req.params.crew_id })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
    res.status(200).json({ status: 'success', count: scores.length, data: scores });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/risk/calibration
router.get('/api/v1/risk/calibration', (req, res, next) => {
  try {
    const plot = generateAndSaveCalibrationPlot();
    res.status(200).json({ status: 'success', data: plot });
  } catch (err) {
    next(err);
  }
});

export default router;
