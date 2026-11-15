import { Router } from 'express';
import { z } from 'zod';
import {
  createCrewProfile,
  deleteCrewProfile,
  generateSyntheticCrews,
  getCrewProfile,
  listCrewProfiles,
  simulateBaseline,
  updateCrewProfile
} from '../services/crewService.js';

const router = Router();

const crewSchema = z.object({
  crew_id: z.string().min(3).max(16),
  name: z.string().min(2).max(64),
  role: z.string().min(2).max(64),
  age: z.number().int().min(18).max(120),
  sex: z.enum(['male', 'female', 'other']),
  height_cm: z.number().min(120).max(220),
  weight_kg: z.number().min(40).max(160),
  medical_history: z.string().optional(),
  allergies: z.array(z.string()).optional(),
  provenance: z.enum(['SIMULATED', 'REPLAY', 'REAL']).default('SIMULATED')
});

const simulateSchema = z.object({
  days: z.number().min(1).default(3)
});

const generateSchema = z.object({
  count: z.number().int().min(1).max(500).default(100),
  seed: z.number().int().default(42)
});

router.post('/api/v1/crew', async (req, res, next) => {
  try {
    const data = crewSchema.parse(req.body);
    const profile = await createCrewProfile(data);
    return res.status(201).json(profile);
  } catch (err) {
    next(err);
  }
});

router.get('/api/v1/crew', async (req, res, next) => {
  try {
    const list = await listCrewProfiles();
    return res.json(list);
  } catch (err) {
    next(err);
  }
});

router.post('/api/v1/crew/generate-synthetic', async (req, res, next) => {
  try {
    const { count, seed } = generateSchema.parse(req.body);
    const result = await generateSyntheticCrews(count, seed);
    return res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/api/v1/crew/:id', async (req, res, next) => {
  try {
    const profile = await getCrewProfile(req.params.id);
    return res.json(profile);
  } catch (err) {
    next(err);
  }
});

router.patch('/api/v1/crew/:id', async (req, res, next) => {
  try {
    const updated = await updateCrewProfile(req.params.id, req.body);
    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete('/api/v1/crew/:id', async (req, res, next) => {
  try {
    const deleted = await deleteCrewProfile(req.params.id);
    return res.json({ message: 'Crew profile deleted', crew_id: deleted.crew_id });
  } catch (err) {
    next(err);
  }
});

router.post('/api/v1/crew/:id/simulate-baseline', async (req, res, next) => {
  try {
    const { days } = simulateSchema.parse(req.body);
    const updated = await simulateBaseline(req.params.id, days);
    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
