import express from 'express';
import { z } from 'zod';
import {
  generateSoapDraft,
  updateSoapNote,
  getSoapNoteWithHistory,
  generateDailyHealthBrief,
  evaluate10HealthBriefs,
  generateSbarIncidentReport,
  generateSurgeonHandoffReport,
  generateMissionDebriefPackage,
  generateOfflinePdfReport
} from '../services/clinicalReportingService.js';

const router = express.Router();

const soapDraftSchema = z.object({
  crew_id: z.string().optional().default('CREW-01'),
  author_id: z.string().optional().default('flight_surgeon_01'),
  author_name: z.string().optional().default('Dr. E. Stone, Flight Surgeon'),
  author_role: z.string().optional().default('flight_surgeon'),
  clinical_context: z.record(z.any()).optional().default({})
});

const soapUpdateSchema = z.object({
  subjective: z.string().optional(),
  objective: z.string().optional(),
  assessment: z.string().optional(),
  plan: z.string().optional(),
  edited_by: z.string().optional().default('flight_surgeon_01'),
  change_summary: z.string().optional().default('Flight surgeon amended clinical note'),
  status: z.enum(['DRAFT', 'SUBMITTED', 'AMENDED', 'FINALIZED']).optional().default('SUBMITTED')
});

const dailyBriefSchema = z.object({
  crew_id: z.string().optional().default('CREW-01'),
  sol_date: z.string().optional().default('SOL-042'),
  mission_day: z.number().int().positive().optional().default(42),
  today_metrics: z.record(z.any()).optional().default({}),
  baseline_metrics: z.record(z.any()).optional().default({})
});

const pdfReportSchema = z.object({
  title: z.string().optional().default('AstroCare v2 Medical Report'),
  subtitle: z.string().optional().default('Autonomous Deep-Space Clinical Summary'),
  lines: z.array(z.string()).optional(),
  mission_mode: z.string().optional().default('Mars'),
  crew_id: z.string().optional().default('CREW-01')
});

// 1. POST /api/v1/reports/soap/draft (F099)
router.post('/api/v1/reports/soap/draft', async (req, res, next) => {
  try {
    const params = soapDraftSchema.parse(req.body);
    const draft = await generateSoapDraft(params);
    res.status(200).json({ status: 'success', data: draft });
  } catch (err) {
    next(err);
  }
});

// 2. PUT /api/v1/reports/soap/:note_id (F099)
router.put('/api/v1/reports/soap/:note_id', async (req, res, next) => {
  try {
    const updates = soapUpdateSchema.parse(req.body);
    const updated = await updateSoapNote(req.params.note_id, updates);
    res.status(200).json({ status: 'success', data: updated });
  } catch (err) {
    next(err);
  }
});

// 3. GET /api/v1/reports/soap/:note_id (F099)
router.get('/api/v1/reports/soap/:note_id', async (req, res, next) => {
  try {
    const note = await getSoapNoteWithHistory(req.params.note_id);
    if (!note) {
      return res.status(404).json({
        status: 'error',
        message: `SOAP note ${req.params.note_id} not found`
      });
    }
    res.status(200).json({ status: 'success', data: note });
  } catch (err) {
    next(err);
  }
});

// 4. POST /api/v1/reports/daily-brief (F101)
router.post('/api/v1/reports/daily-brief', async (req, res, next) => {
  try {
    const params = dailyBriefSchema.parse(req.body);
    const brief = await generateDailyHealthBrief(params);
    res.status(200).json({ status: 'success', data: brief });
  } catch (err) {
    next(err);
  }
});

// 5. GET /api/v1/reports/daily-brief/evaluate-10 (F101)
router.get('/api/v1/reports/daily-brief/evaluate-10', async (req, res, next) => {
  try {
    const crewId = req.query.crew_id || 'CREW-01';
    const benchmark = await evaluate10HealthBriefs(crewId);
    res.status(200).json({ status: 'success', data: benchmark });
  } catch (err) {
    next(err);
  }
});

// 6. POST /api/v1/reports/incident-sbar (F074)
router.post('/api/v1/reports/incident-sbar', (req, res) => {
  const sbar = generateSbarIncidentReport(req.body);
  res.status(200).json({ status: 'success', data: sbar });
});

// 7. GET /api/v1/reports/surgeon-handoff (F108)
router.get('/api/v1/reports/surgeon-handoff', (req, res) => {
  const handoff = generateSurgeonHandoffReport(req.query);
  res.status(200).json({ status: 'success', data: handoff });
});

// 8. GET /api/v1/reports/mission-debrief (F130)
router.get('/api/v1/reports/mission-debrief', (req, res) => {
  const debrief = generateMissionDebriefPackage(req.query);
  res.status(200).json({ status: 'success', data: debrief });
});

// 9. POST /api/v1/reports/pdf (F123)
router.post('/api/v1/reports/pdf', (req, res, next) => {
  try {
    const params = pdfReportSchema.parse(req.body);
    const pdfBuffer = generateOfflinePdfReport(params);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="medical_report.pdf"');
    res.status(200).send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

export default router;
