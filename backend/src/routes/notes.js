import express from 'express';
import crypto from 'crypto';
import { SoapNote } from '../models/SoapNote.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// POST /api/v1/notes (Idempotent write-through, requires Flight Surgeon or Admin)
router.post(['/api/v1/notes', '/notes'], authenticateToken, requireRole(['flight_surgeon', 'admin']), async (req, res, next) => {
  try {
    const noteId = req.body.note_id || req.body.id || `note-${crypto.randomBytes(4).toString('hex')}`;
    const crewId = (req.body.crew_id || req.body.crewId || 'vega').toLowerCase();
    const authorName = req.body.author_name || req.body.author || 'Flight Surgeon';
    const subjective = req.body.subjective || '';
    const objective = req.body.objective || '';
    const assessment = req.body.assessment || '';
    const plan = req.body.plan || '';

    // Find existing note to manage versioning
    const existing = await SoapNote.findOne({ note_id: noteId });
    const currentVersion = existing ? (existing.version || existing.versions?.length || 1) + 1 : 1;

    const versionEntry = {
      version_number: currentVersion,
      edited_by: authorName,
      edited_at: new Date(),
      subjective,
      objective,
      assessment,
      plan,
      change_summary: req.body.change_summary || `Version ${currentVersion} committed`
    };

    const noteDoc = await SoapNote.findOneAndUpdate(
      { note_id: noteId },
      {
        $setOnInsert: {
          note_id: noteId,
          created_at: req.body.timestamp ? new Date(req.body.timestamp) : new Date()
        },
        $set: {
          crew_id: crewId,
          author_name: authorName,
          subjective,
          objective,
          assessment,
          plan,
          version: currentVersion,
          current_version: currentVersion,
          status: 'FINALIZED',
          is_active: true
        },
        $push: {
          versions: versionEntry
        }
      },
      { upsert: true, new: true, runValidators: true }
    );

    res.status(201).json({
      status: 'success',
      data: noteDoc
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/notes (Fetch SOAP notes with optional crew_id filter)
router.get(['/api/v1/notes', '/notes'], async (req, res, next) => {
  try {
    const filter = {};
    const crewId = req.query.crew_id || req.query.crewId;
    if (crewId) {
      filter.crew_id = String(crewId).toLowerCase();
    }

    const notes = await SoapNote.find(filter)
      .sort({ updated_at: -1, created_at: -1 })
      .lean();

    res.status(200).json({
      status: 'success',
      data: notes
    });
  } catch (err) {
    next(err);
  }
});

export default router;
