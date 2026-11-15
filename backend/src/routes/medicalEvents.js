import { Router } from 'express';
import { z } from 'zod';
import {
  appendMedicalEvent,
  verifyMedicalEventChain,
  listMedicalEvents
} from '../services/medicalEventLogService.js';
import { validateBody } from '../middleware/validation.js';

const router = Router();

const EventSchema = z.object({
  crew_id: z.string().min(1),
  action: z.string().min(1),
  performer_id: z.string().min(1),
  performer_role: z.string().default('crew_medical_officer'),
  timestamp: z.string().optional(),
  details: z.record(z.any()).default({})
});

router.post('/api/v1/medical-events', validateBody(EventSchema), async (req, res, next) => {
  try {
    const entry = await appendMedicalEvent(req.body);
    res.status(201).json(entry);
  } catch (err) {
    next(err);
  }
});

router.get('/api/v1/medical-events', async (req, res, next) => {
  try {
    const events = await listMedicalEvents(req.query.crew_id);
    res.json({ count: events.length, events });
  } catch (err) {
    next(err);
  }
});

router.get('/api/v1/medical-events/verify-chain', async (req, res, next) => {
  try {
    const verification = await verifyMedicalEventChain();
    res.json(verification);
  } catch (err) {
    next(err);
  }
});

export default router;
