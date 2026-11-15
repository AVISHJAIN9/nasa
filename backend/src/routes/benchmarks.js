import express from 'express';
import {
  getBenchmarkDatasetPackages,
  compareCrewMetricToCohort
} from '../services/benchmarkPackService.js';
import { runCompleteModelEvaluationHarness } from '../services/modelEvalHarnessService.js';
import { getHonestLimitationsAndEthics } from '../services/ethicsService.js';
import { getSourceRegisterAndReviews } from '../services/clinicalReviewService.js';

const router = express.Router();

// 1. GET /api/v1/benchmarks/packages - real data benchmark pack & non-circular protocol (P02)
router.get('/api/v1/benchmarks/packages', (req, res) => {
  const data = getBenchmarkDatasetPackages();
  res.status(200).json({ status: 'success', data });
});

// 2. GET /api/v1/benchmarks/crew-percentile - cohort benchmark comparison (F103)
router.get('/api/v1/benchmarks/crew-percentile', (req, res) => {
  const { metric = 'heart_rate', value = 72 } = req.query;
  const result = compareCrewMetricToCohort(metric, Number(value));
  res.status(200).json({ status: 'success', data: result });
});

// 3. POST /api/v1/benchmarks/eval/run - execute complete model evaluation harness (F062)
router.post('/api/v1/benchmarks/eval/run', async (req, res, next) => {
  try {
    const summary = await runCompleteModelEvaluationHarness({ writeToDisk: true });
    res.status(200).json({ status: 'success', data: summary });
  } catch (err) {
    next(err);
  }
});

// 4. GET /api/v1/ethics/limitations - honest limitations and data provenance shares (R01)
router.get('/api/v1/ethics/limitations', async (req, res, next) => {
  try {
    const limitations = await getHonestLimitationsAndEthics();
    res.status(200).json({ status: 'success', data: limitations });
  } catch (err) {
    next(err);
  }
});

// 5. GET /api/v1/clinical/source-register - clinical domain review and source register (V01)
router.get('/api/v1/clinical/source-register', (req, res) => {
  const result = getSourceRegisterAndReviews();
  res.status(200).json({ status: 'success', data: result });
});

export default router;
