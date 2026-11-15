import { Router } from 'express';
import { isFlagEnabled } from '../services/flagService.js';
import { requireFlag } from '../middleware/flags.js';

const router = Router();

router.get('/api/v1/ml/status', async (req, res, next) => {
  try {
    const mlActive = await isFlagEnabled('enable_ml');
    const llmActive = await isFlagEnabled('enable_local_llm');

    const mode = mlActive ? 'active_ml_inference' : 'rule_based_fallback';
    const description = mlActive
      ? 'LightGBM + Random Forest models active for risk scoring and baseline comparison'
      : 'ML disabled via feature flag; system safely operating using deterministic heuristic rules';

    return res.json({
      ml_enabled: mlActive,
      local_llm_enabled: llmActive,
      operational_mode: mode,
      description,
      system_status: 'CORRECT',
      disclaimer: 'Decision-support prototype on synthetic and public data. Not a medical device. No diagnosis claims.'
    });
  } catch (err) {
    next(err);
  }
});

router.get('/api/v1/ml/predict-mock', requireFlag('enable_ml'), (req, res) => {
  return res.json({
    status: 'success',
    model: 'synthetic_vital_classifier',
    prediction: 'normal_sinus_rhythm',
    confidence: 0.98,
    source: 'SIMULATED'
  });
});

export default router;
