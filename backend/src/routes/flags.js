import { Router } from 'express';
import { z } from 'zod';
import { getFlag, listFlags, setFlag } from '../services/flagService.js';
import { NotFoundException } from '../middleware/errors.js';

const router = Router();

const flagUpdateSchema = z.object({
  is_enabled: z.boolean(),
  updated_by: z.string().default('admin')
});

router.get('/api/v1/flags', async (req, res, next) => {
  try {
    const flags = await listFlags();
    return res.json(flags);
  } catch (err) {
    next(err);
  }
});

router.get('/api/v1/flags/:name', async (req, res, next) => {
  try {
    const flag = await getFlag(req.params.name);
    if (!flag) {
      return next(new NotFoundException(`Feature flag '${req.params.name}' not found`));
    }
    return res.json(flag);
  } catch (err) {
    next(err);
  }
});

router.patch('/api/v1/flags/:name', async (req, res, next) => {
  try {
    const parsed = flagUpdateSchema.parse(req.body);
    const updated = await setFlag(req.params.name, parsed.is_enabled, parsed.updated_by);
    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
