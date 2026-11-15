import crypto from 'crypto';
import { HealthRecord } from '../models/HealthRecord.js';
import { NotFoundException } from '../middleware/errors.js';

export async function createOrGetHealthRecord(crewId, initialData = {}) {
  let record = await HealthRecord.findOne({ crew_id: crewId });

  if (!record) {
    record = await HealthRecord.create({
      record_id: `ehr-${crypto.randomBytes(6).toString('hex')}`,
      crew_id: crewId,
      blood_type: initialData.blood_type || 'O+',
      conditions: initialData.conditions || [],
      allergies: initialData.allergies || [],
      medications: initialData.medications || [],
      immunizations: initialData.immunizations || [],
      clinical_notes: initialData.clinical_notes || [],
      medical_clearance: initialData.medical_clearance || {
        status: 'cleared',
        certified_by: 'NASA Medical Board',
        restrictions: []
      }
    });
  }

  return record.toJSON();
}

export async function addClinicalNote(crewId, noteData) {
  const record = await HealthRecord.findOne({ crew_id: crewId });
  if (!record) {
    throw new NotFoundException(`Health record for crew '${crewId}' not found`);
  }

  const note = {
    note_id: `note-${crypto.randomBytes(6).toString('hex')}`,
    author_id: noteData.author_id || 'system',
    author_role: noteData.author_role || 'flight_surgeon',
    note_type: noteData.note_type || 'soap',
    date: noteData.date ? new Date(noteData.date) : new Date(),
    subjective: noteData.subjective || '',
    objective: noteData.objective || '',
    assessment: noteData.assessment || '',
    plan: noteData.plan || ''
  };

  record.clinical_notes.push(note);
  await record.save();
  return record.toJSON();
}

export async function updateMedications(crewId, medications) {
  const record = await HealthRecord.findOne({ crew_id: crewId });
  if (!record) {
    throw new NotFoundException(`Health record for crew '${crewId}' not found`);
  }

  record.medications = medications;
  await record.save();
  return record.toJSON();
}

export async function updateMedicalClearance(crewId, clearanceData) {
  const record = await HealthRecord.findOne({ crew_id: crewId });
  if (!record) {
    throw new NotFoundException(`Health record for crew '${crewId}' not found`);
  }

  record.medical_clearance = {
    ...record.medical_clearance.toObject(),
    ...clearanceData,
    certified_date: new Date()
  };
  await record.save();
  return record.toJSON();
}

export async function getHealthRecord(crewId) {
  const record = await HealthRecord.findOne({ crew_id: crewId }).lean();
  if (!record) {
    throw new NotFoundException(`Health record for crew '${crewId}' not found`);
  }
  return record;
}
