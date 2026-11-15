import express from 'express';
import {
  execute8MinuteStoryline,
  rehearse8MinuteStoryline3Times,
  rehearse3MomentChoreography3Times,
  THREE_MOMENT_CHOREOGRAPHY,
  EIGHT_MINUTE_STORYLINE_PHASES
} from '../services/demoStorylineService.js';
import {
  evaluateCabinToBodyEarlyWarning,
  runCabinToBodyBenchmark
} from '../services/cabinToBodyEarlyWarningService.js';

const router = express.Router();

// 1. GET /api/v1/demo/storyline - phases and script breakdown (F145)
router.get('/api/v1/demo/storyline', (req, res) => {
  res.status(200).json({
    status: 'success',
    data: {
      storyline: '8-Minute Mars Medical Emergency & Autonomous Triage Storyline',
      target_duration_minutes: 8.0,
      total_phases: EIGHT_MINUTE_STORYLINE_PHASES.length,
      phases: EIGHT_MINUTE_STORYLINE_PHASES
    }
  });
});

// 2. POST /api/v1/demo/storyline/run - execute 8-minute storyline simulation (F145)
router.post('/api/v1/demo/storyline/run', (req, res) => {
  const result = execute8MinuteStoryline();
  res.status(200).json({ status: 'success', data: result });
});

// 3. GET /api/v1/demo/storyline/rehearse-3 - 3 consecutive rehearsals under 8 min (F145)
router.get('/api/v1/demo/storyline/rehearse-3', (req, res) => {
  const result = rehearse8MinuteStoryline3Times();
  res.status(200).json({ status: 'success', data: result });
});

// 4. POST /api/v1/demo/choreography/moment/:moment_id - trigger demo panel choreography moment (D01)
router.post('/api/v1/demo/choreography/moment/:moment_id', async (req, res, next) => {
  try {
    const { moment_id } = req.params;
    const moment = THREE_MOMENT_CHOREOGRAPHY[moment_id];
    if (!moment) {
      return res.status(404).json({
        status: 'error',
        message: `Choreography moment "${moment_id}" not found. Available: ${Object.keys(THREE_MOMENT_CHOREOGRAPHY).join(', ')}`
      });
    }
    const result = await moment.action(req.body.crew_id || req.body.query);
    res.status(200).json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
});

// 5. GET /api/v1/demo/choreography/rehearse-3 - 3 clean consecutive rehearsals (D01)
router.get('/api/v1/demo/choreography/rehearse-3', async (req, res, next) => {
  try {
    const result = await rehearse3MomentChoreography3Times();
    res.status(200).json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
});

// 6. POST /api/v1/demo/cabin-to-body/evaluate - evaluate ppCO2 early warning (X09)
router.post('/api/v1/demo/cabin-to-body/evaluate', async (req, res, next) => {
  try {
    const result = await evaluateCabinToBodyEarlyWarning(req.body);
    res.status(200).json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
});

// 7. GET /api/v1/demo/cabin-to-body/benchmark - run X09 benchmark with false alarm rate
router.get('/api/v1/demo/cabin-to-body/benchmark', async (req, res, next) => {
  try {
    const benchmark = await runCabinToBodyBenchmark();
    res.status(200).json({ status: 'success', data: benchmark });
  } catch (err) {
    next(err);
  }
});

export default router;
