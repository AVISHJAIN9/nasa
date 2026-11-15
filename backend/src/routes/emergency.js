import express from 'express';
import { z } from 'zod';
import {
  declareEmergency,
  standDownEmergency,
  getActiveEmergencyState
} from '../services/emergencyService.js';

const router = express.Router();

const declareSchema = z.object({
  declared_by: z.string().optional(),
  target_crew_id: z.string().min(1, 'target_crew_id is required'),
  reason: z.string().min(1, 'Emergency reason is required'),
  level: z.enum(['CRITICAL', 'CATASTROPHIC']).default('CRITICAL')
});

const standDownSchema = z.object({
  authorized_by: z.string().optional(),
  reason: z.string().min(1, 'Stand-down reason is required')
});

// GET /api/v1/emergency/status
router.get('/api/v1/emergency/status', (req, res) => {
  const active = getActiveEmergencyState();
  res.status(200).json({
    status: 'success',
    data: {
      active: active !== null,
      emergency: active
    }
  });
});

// POST /api/v1/emergency/declare
router.post('/api/v1/emergency/declare', async (req, res, next) => {
  try {
    const data = declareSchema.parse(req.body);
    const result = await declareEmergency(data, req.user || {});
    res.status(201).json({
      status: 'success',
      message: 'Medical emergency declared successfully across all roles',
      data: result
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/emergency/stand-down
router.post('/api/v1/emergency/stand-down', async (req, res, next) => {
  try {
    const data = standDownSchema.parse(req.body);
    const result = await standDownEmergency(data, req.user || {});
    res.status(200).json({
      status: 'success',
      message: 'Medical emergency stood down',
      data: result
    });
  } catch (err) {
    next(err);
  }
});

export default router;
