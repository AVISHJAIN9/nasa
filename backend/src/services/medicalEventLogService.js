import crypto from 'crypto';
import { MedicalEventLog } from '../models/MedicalEventLog.js';

export const GENESIS_HASH = 'GENESIS_ASTROCARE_EMERGENCY_LOG_V2';

export function computeHash(sequence, eventId, crewId, action, timestampIso, detailsJson, prevHash) {
  const content = `${sequence}|${eventId}|${crewId}|${action}|${timestampIso}|${detailsJson}|${prevHash}`;
  return crypto.createHash('sha256').update(content).digest('hex');
}

export const logMedicalEvent = appendMedicalEvent;

export async function appendMedicalEvent(data) {
  // Find latest entry to obtain previous hash and sequence
  const latest = await MedicalEventLog.findOne().sort({ sequence: -1 });

  const nextSequence = latest ? latest.sequence + 1 : 1;
  const prevHash = latest ? latest.entry_hash : GENESIS_HASH;

  const eventId = data.event_id || `medevt-${crypto.randomBytes(6).toString('hex')}`;
  const timestamp = data.timestamp ? new Date(data.timestamp) : new Date();
  const details = data.details || {};
  const detailsJson = JSON.stringify(details);

  const entryHash = computeHash(
    nextSequence,
    eventId,
    data.crew_id,
    data.action,
    timestamp.toISOString(),
    detailsJson,
    prevHash
  );

  const entry = await MedicalEventLog.create({
    sequence: nextSequence,
    event_id: eventId,
    crew_id: data.crew_id,
    action: data.action,
    performer_id: data.performer_id || 'system',
    performer_role: data.performer_role || 'crew_medical_officer',
    timestamp,
    details,
    prev_hash: prevHash,
    entry_hash: entryHash
  });

  return entry.toJSON();
}

export async function verifyMedicalEventChain() {
  const entries = await MedicalEventLog.find().sort({ sequence: 1 });

  if (entries.length === 0) {
    return { valid: true, total_entries: 0, message: 'Empty chain is valid' };
  }

  let expectedPrevHash = GENESIS_HASH;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const expectedSequence = i + 1;

    // 1. Verify sequence number is consecutive
    if (entry.sequence !== expectedSequence) {
      return {
        valid: false,
        broken_at_sequence: entry.sequence,
        reason: `Sequence break: expected ${expectedSequence}, found ${entry.sequence}`
      };
    }

    // 2. Verify link to previous entry
    if (entry.prev_hash !== expectedPrevHash) {
      return {
        valid: false,
        broken_at_sequence: entry.sequence,
        reason: `Hash chain broken: prev_hash mismatch at sequence ${entry.sequence}`
      };
    }

    // 3. Recompute hash and verify entry integrity
    const detailsJson = JSON.stringify(entry.details || {});
    const recomputed = computeHash(
      entry.sequence,
      entry.event_id,
      entry.crew_id,
      entry.action,
      new Date(entry.timestamp).toISOString(),
      detailsJson,
      entry.prev_hash
    );

    if (recomputed !== entry.entry_hash) {
      return {
        valid: false,
        broken_at_sequence: entry.sequence,
        reason: `Row tamper detected: entry_hash mismatch at sequence ${entry.sequence}`
      };
    }

    expectedPrevHash = entry.entry_hash;
  }

  return {
    valid: true,
    total_entries: entries.length,
    latest_sequence: entries[entries.length - 1].sequence,
    latest_hash: expectedPrevHash
  };
}

export async function listMedicalEvents(crewId) {
  const filter = {};
  if (crewId) filter.crew_id = crewId;
  const events = await MedicalEventLog.find(filter).sort({ sequence: 1 }).lean();
  return events;
}
