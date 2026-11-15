import { Router } from 'express';
import { z } from 'zod';
import {
  refreshDailyRollups,
  getDashboardAnalyticsView
} from '../services/analyticsViewsService.js';
import { validateQuery } from '../middleware/validation.js';

const router = Router();

const AnalyticsViewQuerySchema = z.object({
  crew_id: z.string().optional(),
  metric: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional()
});

router.post('/api/v1/analytics/rollups/refresh', async (req, res, next) => {
  try {
    const { date } = req.body;
    const result = await refreshDailyRollups(date);
    res.json({
      message: 'Daily rollups refreshed successfully',
      ...result
    });
  } catch (err) {
    next(err);
  }
});

router.get('/api/v1/analytics/dashboard/views', validateQuery(AnalyticsViewQuerySchema), async (req, res, next) => {
  try {
    const view = await getDashboardAnalyticsView(req.query);
    res.json(view);
  } catch (err) {
    next(err);
  }
});

export default router;
