import express from 'express';
import { z } from 'zod';
import {
  recordCabinTelemetry,
  getCabin5Gauges,
  simulateCO2LeakScenario
} from '../services/cabinTelemetryService.js';
import { CabinTelemetry } from '../models/CabinTelemetry.js';
import { validateBody } from '../middleware/validation.js';

const router = express.Router();

const CabinReadingSchema = z.object({
  reading_id: z.string().optional(),
  compartment: z.enum(['hab_module_alpha', 'service_module', 'command_deck', 'airlock']).default('hab_module_alpha'),
  timestamp: z.string().optional(),
  co2_percent: z.number().min(0).max(10),
  o2_percent: z.number().min(0).max(100),
  cabin_pressure_kpa: z.number().min(0).max(200),
  temperature_c: z.number().min(-50).max(100),
  humidity_percent: z.number().min(0).max(100),
  ambient_noise_db: z.number().optional()
});

const SimulateCO2Schema = z.object({
  start_co2: z.number().min(0).max(5).default(0.4),
  peak_co2: z.number().min(0.5).max(5).default(1.25),
  steps: z.number().int().min(2).max(20).default(5),
  compartment: z.enum(['hab_module_alpha', 'service_module', 'command_deck', 'airlock']).default('hab_module_alpha')
});

router.post('/api/v1/cabin/readings', validateBody(CabinReadingSchema), async (req, res, next) => {
  try {
    const reading = await recordCabinTelemetry(req.body);
    res.status(201).json({
      status: 'success',
      data: reading
    });
  } catch (err) {
    next(err);
  }
});

router.get('/api/v1/cabin/gauges', async (req, res, next) => {
  try {
    const compartment = req.query.compartment || 'hab_module_alpha';
    const gaugesData = await getCabin5Gauges(compartment);
    res.json({
      status: 'success',
      data: gaugesData
    });
  } catch (err) {
    next(err);
  }
});

router.get('/api/v1/cabin/history', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);
    const compartment = req.query.compartment || 'hab_module_alpha';
    const history = await CabinTelemetry.find({ compartment }).sort({ timestamp: -1 }).limit(limit).lean();
    res.json({
      status: 'success',
      count: history.length,
      data: history
    });
  } catch (err) {
    next(err);
  }
});

router.post('/api/v1/cabin/simulate-leak', validateBody(SimulateCO2Schema), async (req, res, next) => {
  try {
    const { start_co2, peak_co2, steps, compartment } = req.body;
    const result = await simulateCO2LeakScenario({
      startCO2: start_co2,
      peakCO2: peak_co2,
      steps,
      compartment
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
