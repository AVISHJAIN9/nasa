import { Router } from 'express';
import { z } from 'zod';
import { getMissionConfig, setMissionMode, updateMissionConfig } from '../services/missionConfigService.js';

const router = Router();

const setModeSchema = z.object({
  mode: z.enum(['ISS', 'Moon', 'Mars']),
  updated_by: z.string().default('admin')
});

const updateConfigSchema = z.object({
  comms_delay_seconds: z.number().min(0).optional(),
  radiation_rate_msv_per_day: z.number().min(0).optional(),
  radiation_alert_threshold_msv: z.number().min(0).optional(),
  supply_days_limit: z.number().min(1).optional(),
  crew_size: z.number().int().min(1).optional(),
  clinical_thresholds: z
    .object({
      hr_low: z.number().optional(),
      hr_high: z.number().optional(),
      spo2_low: z.number().optional(),
      sys_bp_high: z.number().optional(),
      dia_bp_high: z.number().optional(),
      temp_high: z.number().optional()
    })
    .optional(),
  updated_by: z.string().default('admin')
});

router.get('/api/v1/mission-config', (req, res) => {
  const current = getMissionConfig();
  return res.json(current);
});

router.post('/api/v1/mission-config/mode', async (req, res, next) => {
  try {
    const { mode, updated_by } = setModeSchema.parse(req.body);
    const updated = await setMissionMode(mode, updated_by);
    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.patch('/api/v1/mission-config', async (req, res, next) => {
  try {
    const parsed = updateConfigSchema.parse(req.body);
    const updated = await updateMissionConfig(parsed, parsed.updated_by);
    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
