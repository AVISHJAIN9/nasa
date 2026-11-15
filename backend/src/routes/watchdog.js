import express from 'express';
import { z } from 'zod';
import {
  getWatchdogStatus,
  injectSensorFailure,
  injectDataDrift,
  recoverWatchdog
} from '../services/selfWatchdogService.js';
import { WatchdogLog } from '../models/WatchdogLog.js';

const router = express.Router();

const sensorFailureSchema = z.object({
  sensor: z.string().default('heart_rate'),
  dropout_rate: z.number().min(0.0).max(1.0).default(0.45)
});

const driftSchema = z.object({
  metric: z.string().default('heart_rate'),
  drift_factor: z.number().default(1.6)
});

const recoverSchema = z.object({
  recovered_by: z.string().default('flight_surgeon')
});

// GET /api/v1/watchdog/status
router.get('/api/v1/watchdog/status', (req, res) => {
  const status = getWatchdogStatus();
  res.status(200).json({ status: 'success', data: status });
});

// POST /api/v1/watchdog/inject-sensor-failure
router.post('/api/v1/watchdog/inject-sensor-failure', async (req, res, next) => {
  try {
    const { sensor, dropout_rate } = sensorFailureSchema.parse(req.body || {});
    const incident = await injectSensorFailure(sensor, dropout_rate);
    res.status(200).json({
      status: 'success',
      message: 'Injected sensor failure triggered safe fallback',
      data: incident
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/watchdog/inject-drift
router.post('/api/v1/watchdog/inject-drift', async (req, res, next) => {
  try {
    const { metric, drift_factor } = driftSchema.parse(req.body || {});
    const incident = await injectDataDrift(metric, drift_factor);
    res.status(200).json({
      status: 'success',
      message: 'Injected data distribution drift triggered safe fallback',
      data: incident
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/watchdog/recover
router.post('/api/v1/watchdog/recover', async (req, res, next) => {
  try {
    const { recovered_by } = recoverSchema.parse(req.body || {});
    const result = await recoverWatchdog(recovered_by);
    res.status(200).json({
      status: 'success',
      message: 'Watchdog recovered system to ACTIVE_ML',
      data: result
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/watchdog/logs
router.get('/api/v1/watchdog/logs', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const logs = await WatchdogLog.find().sort({ timestamp: -1 }).limit(limit).lean();
    res.status(200).json({ status: 'success', count: logs.length, data: logs });
  } catch (err) {
    next(err);
  }
});

export default router;
