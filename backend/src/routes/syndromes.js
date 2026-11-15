import express from 'express';
import { z } from 'zod';
import {
  SPACE_SYNDROMES_KNOWLEDGE_BASE,
  evaluateSpaceSyndromes,
  evaluateSingleSyndrome
} from '../services/spaceSyndromesService.js';
import { SyndromeAssessment } from '../models/SyndromeAssessment.js';

const router = express.Router();

const evalBatchSchema = z.object({
  crew_id: z.string().default('ast-01'),
  clinical_data: z.record(z.any()).default({})
});

const evalSingleSchema = z.object({
  crew_id: z.string().default('ast-01'),
  data: z.record(z.any()).default({})
});

// GET /api/v1/syndromes/knowledge-base
router.get('/api/v1/syndromes/knowledge-base', (req, res) => {
  res.status(200).json({
    status: 'success',
    count: Object.keys(SPACE_SYNDROMES_KNOWLEDGE_BASE).length,
    data: Object.values(SPACE_SYNDROMES_KNOWLEDGE_BASE)
  });
});

// POST /api/v1/syndromes/evaluate
router.post('/api/v1/syndromes/evaluate', async (req, res, next) => {
  try {
    const { crew_id, clinical_data } = evalBatchSchema.parse(req.body);
    const result = await evaluateSpaceSyndromes(crew_id, clinical_data);
    res.status(200).json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/syndromes/evaluate/:syndrome_id
router.post('/api/v1/syndromes/evaluate/:syndrome_id', async (req, res, next) => {
  try {
    const { crew_id, data } = evalSingleSchema.parse(req.body);
    const result = await evaluateSingleSyndrome(crew_id, req.params.syndrome_id, data);
    res.status(200).json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/syndromes/crew/:crew_id
router.get('/api/v1/syndromes/crew/:crew_id', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const records = await SyndromeAssessment.find({ crew_id: req.params.crew_id })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
    res.status(200).json({ status: 'success', count: records.length, data: records });
  } catch (err) {
    next(err);
  }
});

export default router;
