import express from 'express';
import { z } from 'zod';
import {
  seedEmergencyProtocols,
  listEmergencyProtocols,
  getEmergencyProtocolById
} from '../services/emergencyProtocolService.js';
import {
  TRIAGE_DECISION_TREES,
  startTriageSession,
  advanceTriageStep,
  getTriageSession
} from '../services/triageEngineService.js';

const router = express.Router();

const startSessionSchema = z.object({
  crew_id: z.string().optional().default('CREW-01'),
  tree_id: z.string().default('ACUTE_CHEST_PAIN'),
  mission_mode: z.enum(['ISS', 'MOON', 'MARS']).optional()
});

const advanceSessionSchema = z.object({
  session_id: z.string().min(1),
  option_id: z.string().min(1),
  vital_snapshot: z.record(z.any()).optional()
});

// GET /api/v1/triage/protocols
router.get('/api/v1/triage/protocols', async (req, res, next) => {
  try {
    const { category, mission_mode } = req.query;
    const protocols = await listEmergencyProtocols({ category, mission_mode });
    res.status(200).json({
      status: 'success',
      count: protocols.length,
      data: protocols
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/triage/protocols/:protocol_id
router.get('/api/v1/triage/protocols/:protocol_id', async (req, res, next) => {
  try {
    const proto = await getEmergencyProtocolById(req.params.protocol_id);
    if (!proto) {
      return res.status(404).json({
        status: 'error',
        message: `Protocol ${req.params.protocol_id} not found`
      });
    }
    res.status(200).json({ status: 'success', data: proto });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/triage/protocols/seed
router.post('/api/v1/triage/protocols/seed', async (req, res, next) => {
  try {
    const result = await seedEmergencyProtocols();
    res.status(200).json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/triage/trees
router.get('/api/v1/triage/trees', (req, res) => {
  const treeList = Object.values(TRIAGE_DECISION_TREES).map((t) => ({
    tree_id: t.tree_id,
    title: t.title,
    category: t.category,
    root_node_id: t.root_node_id,
    node_count: Object.keys(t.nodes).length
  }));
  res.status(200).json({ status: 'success', data: treeList });
});

// POST /api/v1/triage/session/start
router.post('/api/v1/triage/session/start', async (req, res, next) => {
  try {
    const params = startSessionSchema.parse(req.body);
    const session = await startTriageSession(params);
    res.status(200).json({ status: 'success', data: session });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/triage/session/advance
router.post('/api/v1/triage/session/advance', async (req, res, next) => {
  try {
    const params = advanceSessionSchema.parse(req.body);
    const result = await advanceTriageStep(params);
    res.status(200).json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/triage/session/:session_id
router.get('/api/v1/triage/session/:session_id', async (req, res, next) => {
  try {
    const session = await getTriageSession(req.params.session_id);
    if (!session) {
      return res.status(404).json({
        status: 'error',
        message: `Triage session ${req.params.session_id} not found`
      });
    }
    res.status(200).json({ status: 'success', data: session });
  } catch (err) {
    next(err);
  }
});

export default router;
