import express from 'express';
import { z } from 'zod';
import {
  getDemoPanelState,
  setDemoTimeSpeed,
  switchDemoMissionMode,
  triggerScenarioFromPanel,
  stopActiveScenario,
  triggerDemoSeed
} from '../services/demoControlService.js';
import { validateBody } from '../middleware/validation.js';

const router = express.Router();

const TimeSpeedSchema = z.object({
  multiplier: z.number().positive().max(1000).default(1.0)
});

const ModeSwitchSchema = z.object({
  mode: z.enum(['ISS', 'Moon', 'Mars'])
});

const TriggerScenarioSchema = z.object({
  target_crew_id: z.string().default('CREW-01'),
  speed: z.number().positive().optional(),
  dry_run: z.boolean().default(false)
});

const SeedSchema = z.object({
  reset: z.boolean().default(false)
});

router.get('/api/v1/demo/panel', (req, res) => {
  const panelState = getDemoPanelState();
  res.json({
    status: 'success',
    data: panelState
  });
});

router.post('/api/v1/demo/time-speed', validateBody(TimeSpeedSchema), (req, res) => {
  const result = setDemoTimeSpeed(req.body.multiplier);
  res.json({
    status: 'success',
    data: result
  });
});

router.post('/api/v1/demo/mode', validateBody(ModeSwitchSchema), async (req, res, next) => {
  try {
    const updated = await switchDemoMissionMode(req.body.mode);
    res.json({
      status: 'success',
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

router.post('/api/v1/demo/scenarios/:id/trigger', validateBody(TriggerScenarioSchema), async (req, res, next) => {
  try {
    const { target_crew_id, speed, dry_run } = req.body;
    const result = await triggerScenarioFromPanel({
      scenarioId: req.params.id,
      targetCrewId: target_crew_id,
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

router.post('/api/v1/demo/scenarios/stop', (req, res) => {
  const result = stopActiveScenario();
  res.json({
    status: 'success',
    data: result
  });
});

router.post('/api/v1/demo/seed', validateBody(SeedSchema), async (req, res, next) => {
  try {
    const result = await triggerDemoSeed({ reset: req.body.reset });
    res.json({
      status: 'success',
      data: result
    });
  } catch (err) {
    next(err);
  }
});

export default router;
