import express from 'express';
import crypto from 'crypto';
import { CheckInRecord } from '../models/CheckInRecord.js';
import { authenticateToken } from '../middleware/auth.js';
import { ForbiddenException } from '../middleware/errors.js';

const router = express.Router();

// POST /api/v1/checkins (Idempotent write-through with client-generated ID)
router.post(['/api/v1/checkins', '/checkins'], authenticateToken, async (req, res, next) => {
  try {
    const checkinId = req.body.checkin_id || req.body.id || `chk-${crypto.randomBytes(4).toString('hex')}`;
    let crewId = (req.body.crew_id || req.body.crewId || req.user?.crew_id || 'vega').toLowerCase();

    // Astronaut role can only submit for their own crew_id
    if (req.user && req.user.role === 'astronaut' && req.user.crew_id && req.user.crew_id.toLowerCase() !== crewId) {
      return next(new ForbiddenException(`Astronaut '${req.user.crew_id}' cannot submit check-in for '${crewId}'`));
    }

    const checkinDoc = await CheckInRecord.findOneAndUpdate(
      { checkin_id: checkinId },
      {
        $setOnInsert: {
          checkin_id: checkinId,
          timestamp: req.body.timestamp ? new Date(req.body.timestamp) : new Date()
        },
        $set: {
          crew_id: crewId,
          mood: Number(req.body.mood ?? 3),
          energy: Number(req.body.energy ?? 3),
          pain: Number(req.body.pain ?? 0),
          pain_locations: req.body.pain_locations || [],
          symptoms: req.body.symptoms || [],
          vision_score: req.body.vision_score !== undefined ? Number(req.body.vision_score) : undefined,
          sleep_hours: req.body.sleep_hours !== undefined ? Number(req.body.sleep_hours) : undefined,
          notes: req.body.notes || '',
          status: req.body.status || 'synced'
        }
      },
      { upsert: true, new: true, runValidators: true }
    );

    res.status(201).json({
      status: 'success',
      data: checkinDoc
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/checkins (Fetch checkin history)
router.get(['/api/v1/checkins', '/checkins'], authenticateToken, async (req, res, next) => {
  try {
    const filter = {};
    const requestedCrew = (req.query.crew_id || req.query.crewId || '').toLowerCase();

    // Astronaut can only view their own check-ins
    if (req.user && req.user.role === 'astronaut' && req.user.crew_id) {
      if (requestedCrew && requestedCrew !== req.user.crew_id.toLowerCase()) {
        return next(new ForbiddenException(`Astronaut '${req.user.crew_id}' cannot view check-ins for '${requestedCrew}'`));
      }
      filter.crew_id = req.user.crew_id.toLowerCase();
    } else if (requestedCrew) {
      filter.crew_id = requestedCrew;
    }

    const limit = Math.min(Number(req.query.limit || 50), 200);
    const records = await CheckInRecord.find(filter)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    res.status(200).json({
      status: 'success',
      data: records
    });
  } catch (err) {
    next(err);
  }
});

export default router;
