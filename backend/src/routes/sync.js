import { Router } from 'express';
import { z } from 'zod';
import {
  recordLocalChange,
  reconcileIncomingBatch
} from '../services/syncEngineService.js';
import { SyncEntity, SyncConflictAudit } from '../models/SyncEntity.js';
import { SyncChangeLog } from '../models/SyncChangeLog.js';
import { validateBody } from '../middleware/validation.js';
import { NotFoundException } from '../middleware/errors.js';

const router = Router();

const ChangeSchema = z.object({
  entity_type: z.string().default('clinical_note'),
  entity_id: z.string().min(1),
  node_id: z.enum(['onboard_spacecraft', 'ground_control']).default('onboard_spacecraft'),
  action: z.enum(['CREATE', 'UPDATE', 'DELETE']).default('UPDATE'),
  payload: z.record(z.any()).default({}),
  timestamp: z.string().optional()
});

router.post('/api/v1/sync/changes', validateBody(ChangeSchema), async (req, res, next) => {
  try {
    const data = {
      ...req.body,
      timestamp: req.body.timestamp ? new Date(req.body.timestamp) : new Date()
    };
    const result = await recordLocalChange(data);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/api/v1/sync/changelog', async (req, res, next) => {
  try {
    const { node_id, entity_id } = req.query;
    const filter = {};
    if (node_id) filter.node_id = node_id;
    if (entity_id) filter.entity_id = entity_id;

    const changes = await SyncChangeLog.find(filter).sort({ timestamp: -1 }).limit(100).lean();
    res.json({ count: changes.length, changes });
  } catch (err) {
    next(err);
  }
});

router.post('/api/v1/sync/reconcile', async (req, res, next) => {
  try {
    const changes = req.body.changes || [];
    const result = await reconcileIncomingBatch(changes);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/api/v1/sync/entities/:id', async (req, res, next) => {
  try {
    const entity = await SyncEntity.findOne({ entity_id: req.params.id }).lean();
    if (!entity) {
      throw new NotFoundException(`SyncEntity '${req.params.id}' not found`);
    }
    res.json(entity);
  } catch (err) {
    next(err);
  }
});

router.get('/api/v1/sync/conflicts', async (req, res, next) => {
  try {
    const conflicts = await SyncConflictAudit.find().sort({ resolved_at: -1 }).limit(50).lean();
    res.json({ count: conflicts.length, conflicts });
  } catch (err) {
    next(err);
  }
});

export default router;
