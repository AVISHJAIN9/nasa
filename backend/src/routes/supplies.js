import express from 'express';
import { z } from 'zod';
import {
  generateSupplyConstrainedPlan,
  evaluateEvaReadiness,
  evaluateMissionReadiness
} from '../services/treatmentPlannerService.js';

const router = express.Router();

const treatmentPlanSchema = z.object({
  scenario: z.string().optional().default('DEHYDRATION'),
  severity: z.enum(['MILD', 'MODERATE', 'SEVERE', 'CRITICAL']).optional().default('MODERATE'),
  mission_days_remaining: z.number().nonnegative().optional().default(180),
  iv_saline_available: z.number().nonnegative().nullable().optional(),
  ors_packets_available: z.number().nonnegative().nullable().optional(),
  crew_size: z.number().positive().optional().default(4)
});

const evaReadinessSchema = z.object({
  crew_id: z.string().optional().default('CREW-01'),
  heart_rate_bpm: z.number().positive().optional().default(68),
  sys_bp: z.number().positive().optional().default(118),
  spo2_percent: z.number().min(0).max(100).optional().default(98),
  sleep_hours_last_24h: z.number().nonnegative().optional().default(7.5),
  hydration_status: z.enum(['ADEQUATE', 'MARGINAL', 'DEHYDRATED']).optional().default('ADEQUATE'),
  prebreathe_minutes: z.number().nonnegative().optional().default(120),
  suit_co2_scrubber_hours: z.number().nonnegative().optional().default(8.0)
});

// POST /api/v1/supplies/treatment-plan (X10)
router.post('/api/v1/supplies/treatment-plan', async (req, res, next) => {
  try {
    const params = treatmentPlanSchema.parse(req.body);
    const plan = await generateSupplyConstrainedPlan(params);
    res.status(200).json({ status: 'success', data: plan });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/supplies/eva-readiness (F090)
router.post('/api/v1/supplies/eva-readiness', (req, res, next) => {
  try {
    const params = evaReadinessSchema.parse(req.body);
    const assessment = evaluateEvaReadiness(params);
    res.status(200).json({ status: 'success', data: assessment });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/supplies/mission-readiness (F112)
router.get('/api/v1/supplies/mission-readiness', async (req, res, next) => {
  try {
    const readiness = await evaluateMissionReadiness();
    res.status(200).json({ status: 'success', data: readiness });
  } catch (err) {
    next(err);
  }
});

export default router;
