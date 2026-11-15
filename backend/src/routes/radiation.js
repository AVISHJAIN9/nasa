import express from 'express';
import { z } from 'zod';
import {
  accumulateRadiationDose,
  getCrewRadiationGauge,
  getAllRadiationSummaries
} from '../services/radiationTrackerService.js';
import { RadiationDose } from '../models/RadiationDose.js';
import { validateBody } from '../middleware/validation.js';

const router = express.Router();

const AccumulateDoseSchema = z.object({
  crew_id: z.string().min(1),
  days: z.number().min(0).default(1),
  spe_spike_msv: z.number().min(0).default(0),
  notes: z.string().optional()
});

const SPESpikeSchema = z.object({
  crew_id: z.string().min(1),
  spike_msv: z.number().positive().default(50.0),
  notes: z.string().optional()
});

router.get('/api/v1/radiation/crew/:crew_id', async (req, res, next) => {
  try {
    const gauge = await getCrewRadiationGauge(req.params.crew_id);
    res.json({
      status: 'success',
      data: gauge
    });
  } catch (err) {
    next(err);
  }
});

router.get('/api/v1/radiation/crew/:crew_id/history', async (req, res, next) => {
  try {
    const record = await RadiationDose.findOne({ crew_id: req.params.crew_id }).lean();
    res.json({
      status: 'success',
      crew_id: req.params.crew_id,
      history: record ? record.history : []
    });
  } catch (err) {
    next(err);
  }
});

router.post('/api/v1/radiation/accumulate', validateBody(AccumulateDoseSchema), async (req, res, next) => {
  try {
    const { crew_id, days, spe_spike_msv, notes } = req.body;
    const result = await accumulateRadiationDose({
      crewId: crew_id,
      days,
      speSpikeMsv: spe_spike_msv,
      notes
    });
    res.json({
      status: 'success',
      data: result
    });
  } catch (err) {
    next(err);
  }
});

router.post('/api/v1/radiation/spe-spike', validateBody(SPESpikeSchema), async (req, res, next) => {
  try {
    const { crew_id, spike_msv, notes } = req.body;
    const result = await accumulateRadiationDose({
      crewId: crew_id,
      days: 0,
      speSpikeMsv: spike_msv,
      notes: notes || `Solar Particle Event Radiation Surge: +${spike_msv} mSv`
    });
    res.json({
      status: 'success',
      data: result
    });
  } catch (err) {
    next(err);
  }
});

router.get('/api/v1/radiation/summary', async (req, res, next) => {
  try {
    const summary = await getAllRadiationSummaries();
    res.json({
      status: 'success',
      count: summary.length,
      data: summary
    });
  } catch (err) {
    next(err);
  }
});

export default router;
