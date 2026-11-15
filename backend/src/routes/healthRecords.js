import { Router } from 'express';
import { z } from 'zod';
import {
  createOrGetHealthRecord,
  addClinicalNote,
  updateMedications,
  updateMedicalClearance,
  getHealthRecord
} from '../services/healthRecordService.js';
import { validateBody } from '../middleware/validation.js';

const router = Router();

const CreateHealthRecordSchema = z.object({
  crew_id: z.string().min(1),
  blood_type: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional(),
  conditions: z.array(z.record(z.any())).optional(),
  allergies: z.array(z.record(z.any())).optional(),
  medications: z.array(z.record(z.any())).optional(),
  immunizations: z.array(z.record(z.any())).optional(),
  medical_clearance: z.record(z.any()).optional()
});

const ClinicalNoteSchema = z.object({
  author_id: z.string().min(1),
  author_role: z.string().default('flight_surgeon'),
  note_type: z.enum(['soap', 'encounter', 'progress', 'eva_debrief']).default('soap'),
  date: z.string().optional(),
  subjective: z.string().default(''),
  objective: z.string().default(''),
  assessment: z.string().default(''),
  plan: z.string().default('')
});

const MedicationsSchema = z.object({
  medications: z.array(
    z.object({
      medication_name: z.string(),
      dose: z.string(),
      frequency: z.string(),
      route: z.string().default('oral'),
      status: z.enum(['active', 'discontinued']).default('active')
    })
  )
});

const ClearanceSchema = z.object({
  status: z.enum(['cleared', 'restricted', 'grounded']),
  certified_by: z.string().optional(),
  restrictions: z.array(z.string()).optional()
});

router.post('/api/v1/health-records', validateBody(CreateHealthRecordSchema), async (req, res, next) => {
  try {
    const record = await createOrGetHealthRecord(req.body.crew_id, req.body);
    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
});

router.get('/api/v1/health-records/:crew_id', async (req, res, next) => {
  try {
    const record = await getHealthRecord(req.params.crew_id);
    res.json(record);
  } catch (err) {
    next(err);
  }
});

router.post('/api/v1/health-records/:crew_id/notes', validateBody(ClinicalNoteSchema), async (req, res, next) => {
  try {
    const updated = await addClinicalNote(req.params.crew_id, req.body);
    res.status(201).json(updated);
  } catch (err) {
    next(err);
  }
});

router.patch('/api/v1/health-records/:crew_id/medications', validateBody(MedicationsSchema), async (req, res, next) => {
  try {
    const updated = await updateMedications(req.params.crew_id, req.body.medications);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.patch('/api/v1/health-records/:crew_id/clearance', validateBody(ClearanceSchema), async (req, res, next) => {
  try {
    const updated = await updateMedicalClearance(req.params.crew_id, req.body);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
