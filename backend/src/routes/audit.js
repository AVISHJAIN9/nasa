import { Router } from 'express';
import { z } from 'zod';
import {
  recordAuditEntry,
  verifyAuditChain,
  listAuditLogs
} from '../services/auditLogService.js';
import { validateBody } from '../middleware/validation.js';

const router = Router();

const AuditSchema = z.object({
  user_id: z.string().min(1),
  user_role: z.string().default('flight_surgeon'),
  action: z.string().min(1),
  resource: z.string().min(1),
  ip_address: z.string().optional(),
  timestamp: z.string().optional(),
  details: z.record(z.any()).default({})
});

router.post('/api/v1/audit/logs', validateBody(AuditSchema), async (req, res, next) => {
  try {
    const entry = await recordAuditEntry(req.body);
    res.status(201).json(entry);
  } catch (err) {
    next(err);
  }
});

router.get('/api/v1/audit/logs', async (req, res, next) => {
  try {
    const { user_id, action, resource } = req.query;
    const filter = {};
    if (user_id) filter.user_id = user_id;
    if (action) filter.action = action;
    if (resource) filter.resource = resource;

    const logs = await listAuditLogs(filter);
    res.json({ count: logs.length, logs });
  } catch (err) {
    next(err);
  }
});

router.get('/api/v1/audit/verify-chain', async (req, res, next) => {
  try {
    const result = await verifyAuditChain();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
