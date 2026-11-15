import express from 'express';
import { z } from 'zod';
import {
  executeDualModeQuery,
  getDualModeStatus,
  setPreferredMode,
  simulateNetworkCable
} from '../services/llmDualModeService.js';
import {
  evaluateMedicalGuardrails,
  runRedTeamBenchmark,
  MEDICAL_DISCLAIMER
} from '../services/medicalGuardrailsService.js';
import { verifyModelCitations } from '../services/citationCheckerService.js';

const router = express.Router();

const chatSchema = z.object({
  message: z.string().min(1),
  crew_id: z.string().optional().default('ast-01'),
  preferred_mode: z.enum(['AUTO', 'CLOUD_API', 'LOCAL_OFFLINE']).optional()
});

const toggleSchema = z.object({
  mode: z.enum(['AUTO', 'CLOUD_API', 'LOCAL_OFFLINE']).optional(),
  network_cable_connected: z.boolean().optional()
});

const citationCheckSchema = z.object({
  answer: z.string().min(1),
  context_chunks: z.array(z.any()).default([])
});

// POST /api/v1/assistant/chat
router.post('/api/v1/assistant/chat', async (req, res, next) => {
  try {
    const { message, crew_id, preferred_mode } = chatSchema.parse(req.body);

    if (preferred_mode) {
      setPreferredMode(preferred_mode);
    }

    // 1. Guardrail evaluation
    const guardrail = await evaluateMedicalGuardrails(message, {
      crew_id,
      username: req.user?.username || crew_id
    });

    if (guardrail.action !== 'PASS') {
      return res.status(200).json({
        status: 'success',
        data: {
          answer: guardrail.response,
          citations: [],
          confidence: 1.0,
          guardrail_action: guardrail.action,
          escalated_to_emergency: guardrail.escalated_to_emergency,
          is_refusal: true,
          mode_used: 'LOCAL_OFFLINE',
          disclaimer: MEDICAL_DISCLAIMER
        }
      });
    }

    // 2. Dual-mode RAG query
    const inference = await executeDualModeQuery(message);

    // 3. Hallucination & citation verification
    const citationCheck = verifyModelCitations(inference.answer, inference.citations);

    res.status(200).json({
      status: 'success',
      data: {
        answer: inference.answer,
        citations: inference.citations,
        confidence: inference.confidence,
        mode_used: inference.mode_used,
        is_refusal: inference.is_refusal,
        guardrail_action: 'PASS',
        escalated_to_emergency: false,
        latency_ms: inference.total_pipeline_latency_ms,
        citation_check: {
          is_all_supported: citationCheck.is_all_supported,
          supported_count: citationCheck.supported_count,
          unsupported_count: citationCheck.unsupported_count
        },
        disclaimer: MEDICAL_DISCLAIMER
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/assistant/dual-mode/status
router.get('/api/v1/assistant/dual-mode/status', (req, res) => {
  const status = getDualModeStatus();
  res.status(200).json({
    status: 'success',
    data: status
  });
});

// POST /api/v1/assistant/dual-mode/toggle
router.post('/api/v1/assistant/dual-mode/toggle', (req, res, next) => {
  try {
    const { mode, network_cable_connected } = toggleSchema.parse(req.body);

    if (network_cable_connected !== undefined) {
      simulateNetworkCable(network_cable_connected);
    }
    if (mode) {
      setPreferredMode(mode);
    }

    res.status(200).json({
      status: 'success',
      data: getDualModeStatus()
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/assistant/red-team-results
router.get('/api/v1/assistant/red-team-results', async (req, res, next) => {
  try {
    const results = await runRedTeamBenchmark();
    res.status(200).json({
      status: 'success',
      data: results
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/assistant/check-citations
router.post('/api/v1/assistant/check-citations', (req, res, next) => {
  try {
    const { answer, context_chunks } = citationCheckSchema.parse(req.body);
    const verification = verifyModelCitations(answer, context_chunks);
    res.status(200).json({
      status: 'success',
      data: verification
    });
  } catch (err) {
    next(err);
  }
});

export default router;
