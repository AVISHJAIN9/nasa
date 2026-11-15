import express from 'express';
import { z } from 'zod';
import {
  createClinicalOrder,
  getOrdersForCrew,
  acknowledgeClinicalOrder,
  completeClinicalOrder
} from '../services/clinicalOrderService.js';

const router = express.Router();

const orderSchema = z.object({
  target_crew_id: z.string().min(1, 'target_crew_id is required'),
  issued_by: z.string().optional(),
  type: z.enum(['MEDICATION', 'EXERCISE', 'REST', 'DIET', 'DIAGNOSTIC', 'PROCEDURE']).default('MEDICATION'),
  title: z.string().min(1, 'title is required'),
  instructions: z.string().min(1, 'instructions are required'),
  dosage: z.string().optional(),
  frequency: z.string().optional(),
  priority: z.enum(['ROUTINE', 'URGENT', 'STAT']).default('ROUTINE')
});

const ackOrderSchema = z.object({
  acknowledged_by: z.string().optional(),
  acknowledgment_notes: z.string().optional()
});

// POST /api/v1/orders
router.post('/api/v1/orders', async (req, res, next) => {
  try {
    const data = orderSchema.parse(req.body);
    const order = await createClinicalOrder(data, req.user || {});
    res.status(201).json({
      status: 'success',
      message: 'Clinical order issued and delivered',
      data: order
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/orders/crew/:crew_id
router.get('/api/v1/orders/crew/:crew_id', async (req, res, next) => {
  try {
    const orders = await getOrdersForCrew(req.params.crew_id, req.query.status);
    res.status(200).json({
      status: 'success',
      count: orders.length,
      data: orders
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/orders/:id/acknowledge
router.post('/api/v1/orders/:id/acknowledge', async (req, res, next) => {
  try {
    const ackData = ackOrderSchema.parse(req.body || {});
    const order = await acknowledgeClinicalOrder(req.params.id, ackData, req.user || {});
    res.status(200).json({
      status: 'success',
      message: 'Clinical order acknowledged by crew member',
      data: order
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/orders/:id/complete
router.post('/api/v1/orders/:id/complete', async (req, res, next) => {
  try {
    const order = await completeClinicalOrder(req.params.id, req.user?.username || 'crew_member');
    res.status(200).json({
      status: 'success',
      message: 'Clinical order marked as completed',
      data: order
    });
  } catch (err) {
    next(err);
  }
});

export default router;
