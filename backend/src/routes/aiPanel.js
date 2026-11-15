import express from 'express';
import {
  getAiPanelData,
  generateAlertExplanation
} from '../services/aiExplanationService.js';

const router = express.Router();

// GET /api/v1/ai/panel/:alert_id
router.get('/api/v1/ai/panel/:alert_id', async (req, res, next) => {
  try {
    const data = await getAiPanelData(req.params.alert_id);
    res.status(200).json({ status: 'success', data });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/ai/panel/evaluate
router.post('/api/v1/ai/panel/evaluate', (req, res, next) => {
  try {
    const explanation = generateAlertExplanation(req.body);
    res.status(200).json({ status: 'success', data: explanation });
  } catch (err) {
    next(err);
  }
});

export default router;
