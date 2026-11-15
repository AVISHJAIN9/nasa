import express from 'express';
import { z } from 'zod';
import {
  submitAlertFeedback,
  getAdaptedThresholdsForCrew,
  replayAlertEvaluation
} from '../services/alertFeedbackService.js';

const router = express.Router();

const feedbackSchema = z.object({
  label: z.enum(['TRUE_POSITIVE', 'FALSE_POSITIVE']),
  surgeon_id: z.string().optional(),
  reason: z.string().optional()
});

const replaySchema = z.object({
  crew_id: z.string().min(1, 'crew_id is required'),
  readings: z.array(
    z.object({
      metric: z.string(),
      value: z.number()
    })
  )
});

// POST /api/v1/alerts/:id/feedback
router.post('/api/v1/alerts/:id/feedback', async (req, res, next) => {
  try {
    const data = feedbackSchema.parse(req.body);
    const feedback = await submitAlertFeedback(
      {
        alert_id: req.params.id,
        ...data
      },
      req.user || {}
    );

    res.status(200).json({
      status: 'success',
      message: 'Surgeon feedback recorded and threshold adapted',
      data: feedback
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/alerts/feedback/thresholds/:crew_id
router.get('/api/v1/alerts/feedback/thresholds/:crew_id', async (req, res, next) => {
  try {
    const thresholds = await getAdaptedThresholdsForCrew(req.params.crew_id);
    res.status(200).json({
      status: 'success',
      data: {
        crew_id: req.params.crew_id,
        adapted_thresholds: thresholds
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/alerts/feedback/replay
router.post('/api/v1/alerts/feedback/replay', async (req, res, next) => {
  try {
    const { crew_id, readings } = replaySchema.parse(req.body);
    const result = await replayAlertEvaluation(readings, crew_id);
    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (err) {
    next(err);
  }
});

export default router;
