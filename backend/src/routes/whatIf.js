import express from 'express';
import { z } from 'zod';
import {
  getWhatIfScenarios,
  simulateWhatIfScenario
} from '../services/whatIfService.js';

const router = express.Router();

const simulateSchema = z.object({
  scenario_id: z.string().min(1),
  crew_id: z.string().default('ast-01'),
  duration_days: z.number().int().positive().optional()
});

// GET /api/v1/what-if/scenarios
router.get('/api/v1/what-if/scenarios', (req, res) => {
  const scenarios = getWhatIfScenarios();
  res.status(200).json({ status: 'success', count: scenarios.length, data: scenarios });
});

// POST /api/v1/what-if/simulate
router.post('/api/v1/what-if/simulate', async (req, res, next) => {
  try {
    const { scenario_id, crew_id, duration_days } = simulateSchema.parse(req.body);
    const result = await simulateWhatIfScenario(scenario_id, { crew_id, duration_days });
    res.status(200).json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
