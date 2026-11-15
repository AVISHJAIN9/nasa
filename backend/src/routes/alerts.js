import express from 'express';
import { z } from 'zod';
import {
  getAlertInbox,
  acknowledgeAlert,
  snoozeAlert,
  resolveAlert,
  assignAlert
} from '../services/alertInboxService.js';
import {
  evaluateThresholdRules
} from '../services/thresholdAlertService.js';
import { fuseAlertStorm } from '../services/alertFusionService.js';

const router = express.Router();

const snoozeSchema = z.object({
  duration_minutes: z.number().positive().default(15),
  snoozed_by: z.string().optional()
});

const resolveSchema = z.object({
  notes: z.string().min(1, 'Resolution notes are required'),
  resolved_by: z.string().optional()
});

const assignSchema = z.object({
  assigned_to: z.string().min(1, 'assigned_to is required')
});

const ackSchema = z.object({
  acknowledged_by: z.string().optional()
});

// GET /api/v1/alerts/inbox
router.get('/api/v1/alerts/inbox', async (req, res, next) => {
  try {
    const result = await getAlertInbox(req.query);
    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/alerts/:id/acknowledge
router.post('/api/v1/alerts/:id/acknowledge', async (req, res, next) => {
  try {
    const { acknowledged_by } = ackSchema.parse(req.body || {});
    const alert = await acknowledgeAlert(req.params.id, acknowledged_by || req.user?.username || 'flight_surgeon');
    res.status(200).json({
      status: 'success',
      message: 'Alert acknowledged successfully',
      data: alert
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/alerts/:id/snooze
router.post('/api/v1/alerts/:id/snooze', async (req, res, next) => {
  try {
    const { duration_minutes, snoozed_by } = snoozeSchema.parse(req.body || {});
    const alert = await snoozeAlert(req.params.id, duration_minutes, snoozed_by || req.user?.username || 'flight_surgeon');
    res.status(200).json({
      status: 'success',
      message: `Alert snoozed for ${duration_minutes} minutes`,
      data: alert
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/alerts/:id/resolve
router.post('/api/v1/alerts/:id/resolve', async (req, res, next) => {
  try {
    const { notes, resolved_by } = resolveSchema.parse(req.body);
    const alert = await resolveAlert(req.params.id, notes, resolved_by || req.user?.username || 'flight_surgeon');
    res.status(200).json({
      status: 'success',
      message: 'Alert resolved successfully',
      data: alert
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/alerts/:id/assign
router.post('/api/v1/alerts/:id/assign', async (req, res, next) => {
  try {
    const { assigned_to } = assignSchema.parse(req.body);
    const alert = await assignAlert(req.params.id, assigned_to);
    res.status(200).json({
      status: 'success',
      message: `Alert assigned to ${assigned_to}`,
      data: alert
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/alerts/evaluate-rule (test / trigger endpoint)
router.post('/api/v1/alerts/evaluate-rule', async (req, res, next) => {
  try {
    const result = await evaluateThresholdRules(req.body);
    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/alerts/fuse (fusion storm endpoint)
router.post('/api/v1/alerts/fuse', async (req, res, next) => {
  try {
    const { raw_alerts, window_seconds } = req.body;
    const result = await fuseAlertStorm(raw_alerts || [], { windowSeconds: window_seconds });
    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (err) {
    next(err);
  }
});

export default router;
