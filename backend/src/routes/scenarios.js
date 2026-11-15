import express from 'express';
import { z } from 'zod';
import {
  listAvailableScenarios,
  loadScenario,
  executeScenario
} from '../services/scenarioEngineService.js';
import { validateBody } from '../middleware/validation.js';

const router = express.Router();

const ExecuteScenarioSchema = z.object({
  target_crew_id: z.string().default('CREW-01'),
  start_time: z.string().optional(),
  speed: z.number().positive().default(1.0),
  dry_run: z.boolean().default(false)
});

router.get('/api/v1/scenarios', (req, res) => {
  const scenarios = listAvailableScenarios();
  res.json({
    status: 'success',
    count: scenarios.length,
    scenarios
  });
});

router.get('/api/v1/scenarios/:id', (req, res, next) => {
  try {
    const scenario = loadScenario(req.params.id);
    res.json({
      status: 'success',
      data: scenario
    });
  } catch (err) {
    next(err);
  }
});

router.post('/api/v1/scenarios/:id/play', validateBody(ExecuteScenarioSchema), async (req, res, next) => {
  try {
    const { target_crew_id, start_time, speed, dry_run } = req.body;
    const result = await executeScenario({
      scenarioId: req.params.id,
      targetCrewId: target_crew_id,
      startTime: start_time ? new Date(start_time) : new Date(),
      speed,
      dryRun: dry_run
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
