import { Router } from 'express';
import { z } from 'zod';
import {
  sendConsultMessage,
  deliverDueMessages,
  getInbox,
  getOutbox,
  getMessageById
} from '../services/storeForwardService.js';
import { validateBody } from '../middleware/validation.js';
import { NotFoundException } from '../middleware/errors.js';

const router = Router();

const SendMessageSchema = z.object({
  message_id: z.string().optional(),
  sender_id: z.string().min(1),
  sender_name: z.string().optional(),
  sender_role: z.string().default('astronaut'),
  recipient_id: z.string().nullable().optional(),
  recipient_role: z.string().default('flight_surgeon'),
  subject: z.string().min(1).max(256),
  body: z.string().min(1),
  priority: z.enum(['routine', 'urgent', 'stat']).default('routine'),
  direction: z.enum(['space_to_ground', 'ground_to_space', 'local']).default('space_to_ground'),
  attachments: z
    .array(
      z.object({
        name: z.string(),
        url: z.string(),
        size_bytes: z.number().default(0),
        mime_type: z.string().default('application/octet-stream')
      })
    )
    .optional()
});

router.post('/api/v1/consults/messages', validateBody(SendMessageSchema), async (req, res, next) => {
  try {
    const message = await sendConsultMessage(req.body);
    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
});

router.get('/api/v1/consults/inbox', async (req, res, next) => {
  try {
    const { recipient_id, recipient_role, include_in_transit } = req.query;
    const messages = await getInbox({
      recipient_id,
      recipient_role: recipient_role || 'flight_surgeon',
      include_in_transit: include_in_transit === 'true'
    });
    res.json({ count: messages.length, messages });
  } catch (err) {
    next(err);
  }
});

router.get('/api/v1/consults/outbox', async (req, res, next) => {
  try {
    const { sender_id } = req.query;
    const messages = await getOutbox(sender_id);
    res.json({ count: messages.length, messages });
  } catch (err) {
    next(err);
  }
});

router.get('/api/v1/consults/messages/:id', async (req, res, next) => {
  try {
    const message = await getMessageById(req.params.id);
    if (!message) {
      throw new NotFoundException(`Consult message '${req.params.id}' not found`);
    }
    res.json(message);
  } catch (err) {
    next(err);
  }
});

router.post('/api/v1/consults/process-deliveries', async (req, res, next) => {
  try {
    const referenceDate = req.body.reference_date ? new Date(req.body.reference_date) : new Date();
    const delivered = await deliverDueMessages(referenceDate);
    res.json({ count: delivered.length, delivered });
  } catch (err) {
    next(err);
  }
});

export default router;
