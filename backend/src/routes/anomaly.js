import express from 'express';
import { z } from 'zod';
import {
  evaluateAnomalyEnsemble,
  detectCrewAnomalies,
  compareWithRulesOnly
} from '../services/anomalyDetectionService.js';

const router = express.Router();

const evaluateSchema = z.object({
  value: z.number(),
  baseline_values: z.array(z.number()).min(5),
  threshold: z.number().optional()
});

const scanSchema = z.object({
  crew_id: z.string().min(1),
  metric: z.string().min(1),
  value: z.number(),
  create_alert: z.boolean().default(true)
});

// POST /api/v1/ml/anomaly/evaluate
router.post('/api/v1/ml/anomaly/evaluate', (req, res, next) => {
  try {
    const { value, baseline_values, threshold } = evaluateSchema.parse(req.body);
    const result = evaluateAnomalyEnsemble(value, baseline_values, { threshold });
    res.status(200).json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/ml/anomaly/scan
router.post('/api/v1/ml/anomaly/scan', async (req, res, next) => {
  try {
    const { crew_id, metric, value, create_alert } = scanSchema.parse(req.body);
    const result = await detectCrewAnomalies(crew_id, metric, value, { createAlert: create_alert });
    res.status(200).json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/ml/anomaly/compare-rules
router.post('/api/v1/ml/anomaly/compare-rules', (req, res, next) => {
  try {
    const { nominal_set, injected_anomalies, low_limit = 45, high_limit = 120 } = req.body;
    const rulesCheck = (val) => val > high_limit || val < low_limit;
    const result = compareWithRulesOnly(nominal_set || [], injected_anomalies || [], rulesCheck);
    res.status(200).json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
