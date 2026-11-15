import express from 'express';
import { z } from 'zod';
import {
  calculateBaselinesForAllCrew,
  calculateBaselineFromReadings
} from '../services/baselineCalculatorService.js';
import { PersonalBaseline } from '../models/PersonalBaseline.js';
import { TelemetryReading } from '../models/TelemetryReading.js';
import { validateBody } from '../middleware/validation.js';

const router = express.Router();

const CalculateBaselineSchema = z.object({
  crew_ids: z.array(z.string()).optional(),
  metrics: z.array(z.string()).optional()
});

router.post('/api/v1/baselines/calculate', validateBody(CalculateBaselineSchema), async (req, res, next) => {
  try {
    const { crew_ids, metrics } = req.body;
    const result = await calculateBaselinesForAllCrew({
      crewIds: crew_ids,
      metrics
    });
    res.json({
      status: 'success',
      data: result
    });
  } catch (err) {
    next(err);
  }
});

router.get('/api/v1/baselines/:crew_id', async (req, res, next) => {
  try {
    const baselines = await PersonalBaseline.find({ crew_id: req.params.crew_id }).lean();
    res.json({
      status: 'success',
      crew_id: req.params.crew_id,
      count: baselines.length,
      data: baselines
    });
  } catch (err) {
    next(err);
  }
});

router.get('/api/v1/baselines/:crew_id/:metric', async (req, res, next) => {
  try {
    let baseline = await PersonalBaseline.findOne({
      crew_id: req.params.crew_id,
      metric: req.params.metric
    }).lean();

    if (!baseline) {
      // Auto-calculate on demand from readings
      const readings = await TelemetryReading.find({
        crew_id: req.params.crew_id,
        metric: req.params.metric,
        is_alertable: true
      }).lean();
      baseline = await calculateBaselineFromReadings({
        crewId: req.params.crew_id,
        metric: req.params.metric,
        readings
      });
    }

    res.json({
      status: 'success',
      data: baseline
    });
  } catch (err) {
    next(err);
  }
});

export default router;
