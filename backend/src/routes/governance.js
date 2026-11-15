import { Router } from 'express';
import { z } from 'zod';
import {
  createDatabaseSnapshot,
  restoreDatabaseSnapshot,
  listSnapshots
} from '../services/backupRestoreService.js';
import { validateBody } from '../middleware/validation.js';

const router = Router();

const BackupSchema = z.object({
  description: z.string().optional()
});

const RestoreSchema = z.object({
  snapshot_id: z.string().min(1)
});

router.post('/api/v1/governance/backup', validateBody(BackupSchema), async (req, res, next) => {
  try {
    const snapshot = await createDatabaseSnapshot(req.body.description);
    res.status(201).json(snapshot);
  } catch (err) {
    next(err);
  }
});

router.get('/api/v1/governance/backups', async (req, res, next) => {
  try {
    const snapshots = await listSnapshots();
    res.json({ count: snapshots.length, snapshots });
  } catch (err) {
    next(err);
  }
});

router.post('/api/v1/governance/restore', validateBody(RestoreSchema), async (req, res, next) => {
  try {
    const result = await restoreDatabaseSnapshot(req.body.snapshot_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
