import express from 'express';
import { z } from 'zod';
import { eventBus } from '../bus/index.js';
import { validateBody, validateQuery } from '../middleware/validation.js';

const router = express.Router();

const QuerySchema = z.object({
  since: z.string().optional(),
  channel: z.string().optional(),
  event_type: z.string().optional(),
  severity: z.enum(['info', 'warning', 'critical', 'emergency']).optional(),
  limit: z.coerce.number().min(1).max(500).default(50)
});

const PublishSchema = z.object({
  event_type: z.string().min(1),
  channel: z.string().default('general'),
  severity: z.enum(['info', 'warning', 'critical', 'emergency']).default('info'),
  source: z.string().default('SIMULATED'),
  correlation_id: z.string().nullable().optional(),
  recipient_role: z.string().nullable().optional(),
  recipient_id: z.string().nullable().optional(),
  payload: z.record(z.any()).default({})
});

router.get('/api/v1/events/history', validateQuery(QuerySchema), async (req, res, next) => {
  try {
    const { since, channel, event_type, severity, limit } = req.query;
    const events = await eventBus.getMissedEvents({
      since,
      channel,
      eventType: event_type,
      severity,
      limit
    });

    res.json({
      count: events.length,
      since: since || null,
      events
    });
  } catch (err) {
    next(err);
  }
});

router.post('/api/v1/events/publish', validateBody(PublishSchema), async (req, res, next) => {
  try {
    const envelope = await eventBus.publish(req.body);
    res.status(201).json({
      message: 'Event published',
      event: envelope
    });
  } catch (err) {
    next(err);
  }
});

export default router;
