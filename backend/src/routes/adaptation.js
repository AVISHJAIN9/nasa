import express from 'express';
import { z } from 'zod';
import {
  ENCODED_ADAPTATION_EFFECTS,
  getAdaptationShift,
  evaluateAdaptationVsIllness
} from '../services/microgravityAdaptationService.js';
import { validateBody } from '../middleware/validation.js';

const router = express.Router();

const EvaluateAdaptationSchema = z.object({
  metric: z.enum(['heart_rate', 'spo2', 'sys_bp', 'dia_bp', 'temperature', 'hrv', 'respiration_rate']),
  observed_value: z.number(),
  flight_day: z.number().int().min(1).max(1000).default(1),
  mission_mode: z.enum(['ISS', 'Moon', 'Mars']).default('Mars'),
  posterior_baseline: z
    .object({
      posterior_mean: z.number(),
      posterior_sd: z.number()
    })
    .optional()
});

router.get('/api/v1/adaptation/curves', (req, res) => {
  const flightDays = [1, 2, 3, 4, 5, 10, 30, 90];
  const metrics = ['heart_rate', 'temperature', 'hrv'];

  const curves = {};
  for (const metric of metrics) {
    curves[metric] = flightDays.map((day) => ({
      flight_day: day,
      ...getAdaptationShift({ metric, flightDay: day, missionMode: 'Mars' })
    }));
  }

  res.json({
    status: 'success',
    documented_effects_count: ENCODED_ADAPTATION_EFFECTS.length,
    effects: ENCODED_ADAPTATION_EFFECTS,
    adaptation_curves: curves
  });
});

router.post('/api/v1/adaptation/evaluate', validateBody(EvaluateAdaptationSchema), (req, res) => {
  const { metric, observed_value, flight_day, mission_mode, posterior_baseline } = req.body;
  const result = evaluateAdaptationVsIllness({
    metric,
    observedValue: observed_value,
    flightDay: flight_day,
    missionMode: mission_mode,
    posteriorBaseline: posterior_baseline || { posterior_mean: 64.0, posterior_sd: 4.0 }
  });

  res.json({
    status: 'success',
    data: result
  });
});

export default router;
