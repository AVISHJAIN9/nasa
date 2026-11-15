import express from 'express';
import { z } from 'zod';
import {
  interactWithMentalHealthCompanion,
  getCompanionHistory
} from '../services/mentalHealthCompanionService.js';

const router = express.Router();

const companionChatSchema = z.object({
  crew_id: z.string().optional().default('ast-01'),
  message: z.string().min(1),
  is_confidential: z.boolean().optional().default(true)
});

// POST /api/v1/companion/chat
router.post('/api/v1/companion/chat', async (req, res, next) => {
  try {
    const { crew_id, message, is_confidential } = companionChatSchema.parse(req.body);
    const result = await interactWithMentalHealthCompanion({
      crew_id,
      message,
      is_confidential,
      userContext: req.user || {}
    });

    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/companion/history/:crew_id
router.get('/api/v1/companion/history/:crew_id', async (req, res, next) => {
  try {
    const history = await getCompanionHistory(req.params.crew_id);
    res.status(200).json({
      status: 'success',
      data: history
    });
  } catch (err) {
    next(err);
  }
});

export default router;
