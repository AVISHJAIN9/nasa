import express from 'express';
import { z } from 'zod';
import {
  evaluateWaitOrActDecision,
  runWaitOrAct1000Simulation
} from '../services/waitOrActService.js';
import {
  calculateEarthIndependenceScore
} from '../services/earthIndependenceService.js';
import {
  evaluateConformalAbstention,
  generateRiskCoverageCurve
} from '../services/conformalAbstentionService.js';

const router = express.Router();

const waitOrActSchema = z.object({
  time_to_critical_min: z.number().positive(),
  round_trip_delay_min: z.number().nonnegative().optional(),
  risk_score: z.number().min(0).max(100).optional().default(50),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'EMERGENCY']).optional().default('HIGH')
});

const conformalSchema = z.object({
  features: z.record(z.any()),
  alpha: z.number().min(0.01).max(0.50).optional().default(0.10)
});

// POST /api/v1/decisions/wait-or-act
router.post('/api/v1/decisions/wait-or-act', (req, res, next) => {
  try {
    const params = waitOrActSchema.parse(req.body);
    const decision = evaluateWaitOrActDecision(params);
    res.status(200).json({ status: 'success', data: decision });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/decisions/wait-or-act/benchmark
router.get('/api/v1/decisions/wait-or-act/benchmark', (req, res, next) => {
  try {
    const benchmark = runWaitOrAct1000Simulation({ saveReport: true });
    res.status(200).json({ status: 'success', data: benchmark });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/decisions/earth-independence
router.get('/api/v1/decisions/earth-independence', (req, res, next) => {
  try {
    const { delay_seconds, is_blackout, severity } = req.query;
    const score = calculateEarthIndependenceScore({
      delay_seconds: delay_seconds !== undefined ? Number(delay_seconds) : undefined,
      is_blackout: is_blackout !== undefined ? is_blackout === 'true' || is_blackout === '1' : undefined,
      severity
    });
    res.status(200).json({ status: 'success', data: score });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/decisions/conformal/evaluate
router.post('/api/v1/decisions/conformal/evaluate', (req, res, next) => {
  try {
    const { features, alpha } = conformalSchema.parse(req.body);
    const result = evaluateConformalAbstention(features, { alpha });
    res.status(200).json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/decisions/conformal/risk-coverage
router.get('/api/v1/decisions/conformal/risk-coverage', (req, res, next) => {
  try {
    const curve = generateRiskCoverageCurve({ saveReport: true });
    res.status(200).json({ status: 'success', data: curve });
  } catch (err) {
    next(err);
  }
});

export default router;
