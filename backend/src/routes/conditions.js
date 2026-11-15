import express from 'express';
import { z } from 'zod';
import {
  evaluateAndSaveCondition,
  evaluateConditionClassifier
} from '../services/conditionClassifierService.js';
import { ConditionClassification } from '../models/ConditionClassification.js';

const router = express.Router();

const classifySchema = z.object({
  crew_id: z.string().default('ast-01'),
  features: z.object({
    heart_rate: z.number().optional(),
    spo2: z.number().optional(),
    systolic_bp: z.number().optional(),
    temperature: z.number().optional(),
    respiration_rate: z.number().optional(),
    cabin_co2: z.number().optional(),
    sleep_debt_hours: z.number().optional(),
    ambient_pressure_psi: z.number().optional(),
    symptom_tags: z.array(z.string()).optional(),
    urine_output_ml_day: z.number().optional(),
    is_post_eva: z.boolean().optional()
  }),
  allow_abstain: z.boolean().default(true),
  abstain_threshold: z.number().optional()
});

// POST /api/v1/conditions/classify
router.post('/api/v1/conditions/classify', async (req, res, next) => {
  try {
    const { crew_id, features, allow_abstain, abstain_threshold } = classifySchema.parse(req.body);
    const result = await evaluateAndSaveCondition(crew_id, features, {
      allow_abstain,
      abstain_threshold
    });
    res.status(200).json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/conditions/crew/:crew_id
router.get('/api/v1/conditions/crew/:crew_id', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const history = await ConditionClassification.find({ crew_id: req.params.crew_id })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
    res.status(200).json({ status: 'success', count: history.length, data: history });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/conditions/confusion-matrix
router.get('/api/v1/conditions/confusion-matrix', (req, res, next) => {
  try {
    const report = evaluateConditionClassifier();
    res.status(200).json({ status: 'success', data: report });
  } catch (err) {
    next(err);
  }
});

export default router;
