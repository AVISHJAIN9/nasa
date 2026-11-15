import { Router } from 'express';
import { z } from 'zod';
import {
  createTelemedicineSession,
  sendSignalingPacket,
  getDueSignals,
  sendSessionChatMessage,
  getDueChatMessages,
  endTelemedicineSession
} from '../services/telemedicineService.js';
import { TelemedicineSession } from '../models/TelemedicineSession.js';
import { validateBody } from '../middleware/validation.js';
import { NotFoundException } from '../middleware/errors.js';

const router = Router();

const SessionCreateSchema = z.object({
  patient_id: z.string().min(1),
  surgeon_id: z.string().min(1),
  artificial_delay_seconds: z.number().min(0).max(3600).default(5.0)
});

const SignalSchema = z.object({
  sender_id: z.string().min(1),
  packet_type: z.enum(['offer', 'answer', 'ice_candidate']),
  sdp: z.string().nullable().optional(),
  candidate: z.record(z.any()).nullable().optional(),
  sent_at: z.string().optional()
});

const ChatSchema = z.object({
  sender_id: z.string().min(1),
  text: z.string().min(1),
  sent_at: z.string().optional()
});

router.post('/api/v1/telemed/sessions', validateBody(SessionCreateSchema), async (req, res, next) => {
  try {
    const session = await createTelemedicineSession(req.body);
    res.status(201).json(session);
  } catch (err) {
    next(err);
  }
});

router.get('/api/v1/telemed/sessions/:id', async (req, res, next) => {
  try {
    const session = await TelemedicineSession.findOne({ session_id: req.params.id }).lean();
    if (!session) {
      throw new NotFoundException(`Telemedicine session '${req.params.id}' not found`);
    }
    res.json(session);
  } catch (err) {
    next(err);
  }
});

router.post('/api/v1/telemed/sessions/:id/signal', validateBody(SignalSchema), async (req, res, next) => {
  try {
    const packet = await sendSignalingPacket(req.params.id, req.body);
    res.status(201).json(packet);
  } catch (err) {
    next(err);
  }
});

router.get('/api/v1/telemed/sessions/:id/signals', async (req, res, next) => {
  try {
    const { recipient_id, reference_date } = req.query;
    const refDate = reference_date ? new Date(reference_date) : new Date();
    const signals = await getDueSignals(req.params.id, recipient_id, refDate);
    res.json({ count: signals.length, signals });
  } catch (err) {
    next(err);
  }
});

router.post('/api/v1/telemed/sessions/:id/chat', validateBody(ChatSchema), async (req, res, next) => {
  try {
    const message = await sendSessionChatMessage(req.params.id, req.body);
    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
});

router.get('/api/v1/telemed/sessions/:id/chat', async (req, res, next) => {
  try {
    const { reference_date } = req.query;
    const refDate = reference_date ? new Date(reference_date) : new Date();
    const messages = await getDueChatMessages(req.params.id, refDate);
    res.json({ count: messages.length, messages });
  } catch (err) {
    next(err);
  }
});

router.post('/api/v1/telemed/sessions/:id/end', async (req, res, next) => {
  try {
    const session = await endTelemedicineSession(req.params.id);
    res.json(session);
  } catch (err) {
    next(err);
  }
});

export default router;
