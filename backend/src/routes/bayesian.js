import express from 'express';
import { z } from 'zod';
import {
  computeBayesianPosterior,
  evaluateBayesianDeviation,
  forecastBayesianTrajectory
} from '../services/bayesianBaselineService.js';
import { TelemetryReading } from '../models/TelemetryReading.js';
import { CrewProfile } from '../models/CrewProfile.js';
import { validateBody } from '../middleware/validation.js';

const router = express.Router();

const FitModelSchema = z.object({
  crew_id: z.string().min(1),
  metric: z.enum(['heart_rate', 'spo2', 'sys_bp', 'dia_bp', 'temperature', 'hrv', 'respiration_rate']),
  recent_sample_limit: z.number().int().positive().max(5000).default(500)
});

const EvaluateSchema = z.object({
  crew_id: z.string().min(1),
  metric: z.enum(['heart_rate', 'spo2', 'sys_bp', 'dia_bp', 'temperature', 'hrv', 'respiration_rate']),
  value: z.number()
});

const ForecastSchema = z.object({
  crew_id: z.string().min(1),
  metric: z.enum(['heart_rate', 'spo2', 'sys_bp', 'dia_bp', 'temperature', 'hrv', 'respiration_rate']),
  current_value: z.number(),
  horizon_hours: z.number().int().min(1).max(24).default(6)
});

router.post('/api/v1/bayesian/model', validateBody(FitModelSchema), async (req, res, next) => {
  try {
    const { crew_id, metric, recent_sample_limit } = req.body;
    const readings = await TelemetryReading.find({
      crew_id,
      metric,
      is_alertable: true
    })
      .sort({ timestamp: -1 })
      .limit(recent_sample_limit)
      .lean();

    const crew = await CrewProfile.findOne({ crew_id }).lean();
    let baselineVal = null;
    if (crew?.baseline_vitals) {
      if (metric === 'heart_rate') baselineVal = crew.baseline_vitals.heart_rate_bpm?.resting;
      else if (metric === 'spo2') baselineVal = crew.baseline_vitals.spo2_percent?.resting;
      else if (metric === 'sys_bp') baselineVal = crew.baseline_vitals.blood_pressure_systolic?.resting;
    }

    const posterior = computeBayesianPosterior({
      metric,
      observations: readings.map((r) => r.value),
      crewBaseline: baselineVal
    });

    res.json({
      status: 'success',
      crew_id,
      data: posterior
    });
  } catch (err) {
    next(err);
  }
});

router.post('/api/v1/bayesian/evaluate', validateBody(EvaluateSchema), async (req, res, next) => {
  try {
    const { crew_id, metric, value } = req.body;
    const readings = await TelemetryReading.find({
      crew_id,
      metric,
      is_alertable: true
    })
      .sort({ timestamp: -1 })
      .limit(200)
      .lean();

    const posterior = computeBayesianPosterior({
      metric,
      observations: readings.map((r) => r.value)
    });

    const evaluation = evaluateBayesianDeviation({
      posterior,
      value
    });

    res.json({
      status: 'success',
      crew_id,
      metric,
      data: evaluation
    });
  } catch (err) {
    next(err);
  }
});

router.post('/api/v1/bayesian/forecast', validateBody(ForecastSchema), async (req, res, next) => {
  try {
    const { crew_id, metric, current_value, horizon_hours } = req.body;
    const readings = await TelemetryReading.find({
      crew_id,
      metric,
      is_alertable: true
    })
      .sort({ timestamp: -1 })
      .limit(200)
      .lean();

    const posterior = computeBayesianPosterior({
      metric,
      observations: readings.map((r) => r.value)
    });

    const forecast = forecastBayesianTrajectory({
      posterior,
      currentValue: current_value,
      horizonHours: horizon_hours
    });

    res.json({
      status: 'success',
      crew_id,
      data: forecast
    });
  } catch (err) {
    next(err);
  }
});

export default router;
