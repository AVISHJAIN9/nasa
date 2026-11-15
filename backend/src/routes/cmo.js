import express from 'express';
import { z } from 'zod';
import {
  grantCmoRole,
  revokeCmoRole,
  getCmoStatus,
  CMO_CHECKLISTS
} from '../services/cmoService.js';

const router = express.Router();

const grantSchema = z.object({
  granted_by: z.string().optional(),
  reason: z.string().optional()
});

const revokeSchema = z.object({
  revoked_by: z.string().optional(),
  reason: z.string().optional()
});

// GET /api/v1/cmo/checklists
router.get('/api/v1/cmo/checklists', (req, res) => {
  res.status(200).json({
    status: 'success',
    data: CMO_CHECKLISTS
  });
});

// GET /api/v1/cmo/:crew_id
router.get('/api/v1/cmo/:crew_id', async (req, res, next) => {
  try {
    const status = await getCmoStatus(req.params.crew_id);
    res.status(200).json({
      status: 'success',
      data: status
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/cmo/:crew_id/grant
router.post('/api/v1/cmo/:crew_id/grant', async (req, res, next) => {
  try {
    const data = grantSchema.parse(req.body || {});
    const result = await grantCmoRole(
      req.params.crew_id,
      data.granted_by || req.user?.username || 'flight_surgeon',
      data.reason
    );
    res.status(200).json({
      status: 'success',
      message: `CMO role granted to ${req.params.crew_id}`,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/cmo/:crew_id/revoke
router.post('/api/v1/cmo/:crew_id/revoke', async (req, res, next) => {
  try {
    const data = revokeSchema.parse(req.body || {});
    const result = await revokeCmoRole(
      req.params.crew_id,
      data.revoked_by || req.user?.username || 'flight_surgeon',
      data.reason
    );
    res.status(200).json({
      status: 'success',
      message: `CMO role revoked from ${req.params.crew_id}`,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

export default router;
