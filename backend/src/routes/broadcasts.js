import { Router } from 'express';
import { z } from 'zod';
import {
  createBroadcast,
  recordReadReceipt,
  getBroadcastReceipts,
  listBroadcasts
} from '../services/broadcastService.js';
import { BroadcastAnnouncement } from '../models/BroadcastAnnouncement.js';
import { validateBody } from '../middleware/validation.js';
import { NotFoundException } from '../middleware/errors.js';

const router = Router();

const BroadcastSchema = z.object({
  sender_id: z.string().min(1),
  sender_name: z.string().optional(),
  priority: z.enum(['normal', 'urgent', 'emergency']).default('normal'),
  title: z.string().min(1).max(256),
  message: z.string().min(1),
  target_audience: z.enum(['all', 'crew', 'medical_team']).default('all')
});

const ReceiptSchema = z.object({
  user_id: z.string().min(1),
  crew_id: z.string().optional()
});

router.post('/api/v1/broadcasts', validateBody(BroadcastSchema), async (req, res, next) => {
  try {
    const broadcast = await createBroadcast(req.body);
    res.status(201).json(broadcast);
  } catch (err) {
    next(err);
  }
});

router.get('/api/v1/broadcasts', async (req, res, next) => {
  try {
    const { audience } = req.query;
    const broadcasts = await listBroadcasts(audience);
    res.json({ count: broadcasts.length, broadcasts });
  } catch (err) {
    next(err);
  }
});

router.get('/api/v1/broadcasts/:id', async (req, res, next) => {
  try {
    const broadcast = await BroadcastAnnouncement.findOne({
      announcement_id: req.params.id
    }).lean();
    if (!broadcast) {
      throw new NotFoundException(`Broadcast '${req.params.id}' not found`);
    }
    res.json(broadcast);
  } catch (err) {
    next(err);
  }
});

router.post('/api/v1/broadcasts/:id/read', validateBody(ReceiptSchema), async (req, res, next) => {
  try {
    const updated = await recordReadReceipt(req.params.id, req.body);
    res.json({ message: 'Receipt recorded', broadcast: updated });
  } catch (err) {
    next(err);
  }
});

router.get('/api/v1/broadcasts/:id/receipts', async (req, res, next) => {
  try {
    const receiptsData = await getBroadcastReceipts(req.params.id);
    res.json(receiptsData);
  } catch (err) {
    next(err);
  }
});

export default router;
