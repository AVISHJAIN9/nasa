import crypto from 'crypto';
import { AuditLog } from '../models/AuditLog.js';

export const GENESIS_AUDIT_HASH = 'GENESIS_AUDIT_CHAIN_ASTROCARE_V2';

export function computeAuditHash(sequence, logId, userId, action, resource, timestampIso, detailsJson, prevHash) {
  const content = `${sequence}|${logId}|${userId}|${action}|${resource}|${timestampIso}|${detailsJson}|${prevHash}`;
  return crypto.createHash('sha256').update(content).digest('hex');
}

export const logAuditEvent = async (data) => recordAuditEntry(data);

export async function recordAuditEntry(data) {
  const latest = await AuditLog.findOne().sort({ sequence: -1 });

  const nextSequence = latest ? latest.sequence + 1 : 1;
  const prevHash = latest ? latest.entry_hash : GENESIS_AUDIT_HASH;

  const logId = data.log_id || `aud-${crypto.randomBytes(6).toString('hex')}`;
  const timestamp = data.timestamp ? new Date(data.timestamp) : new Date();
  const details = data.details || {};
  const detailsJson = JSON.stringify(details);

  const entryHash = computeAuditHash(
    nextSequence,
    logId,
    data.user_id,
    data.action,
    data.resource,
    timestamp.toISOString(),
    detailsJson,
    prevHash
  );

  const entry = await AuditLog.create({
    sequence: nextSequence,
    log_id: logId,
    user_id: data.user_id,
    user_role: data.user_role || 'flight_surgeon',
    action: data.action,
    resource: data.resource,
    ip_address: data.ip_address || '127.0.0.1',
    timestamp,
    details,
    prev_hash: prevHash,
    entry_hash: entryHash
  });

  return entry.toJSON();
}

export async function verifyAuditChain() {
  const entries = await AuditLog.find().sort({ sequence: 1 });

  if (entries.length === 0) {
    return { valid: true, total_entries: 0, message: 'Empty chain is valid' };
  }

  let expectedPrevHash = GENESIS_AUDIT_HASH;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const expectedSequence = i + 1;

    // 1. Verify sequence order
    if (entry.sequence !== expectedSequence) {
      return {
        valid: false,
        broken_at_sequence: entry.sequence,
        reason: `Sequence break: expected ${expectedSequence}, found ${entry.sequence}`
      };
    }

    // 2. Verify hash pointer
    if (entry.prev_hash !== expectedPrevHash) {
      return {
        valid: false,
        broken_at_sequence: entry.sequence,
        reason: `Hash pointer broken: prev_hash mismatch at sequence ${entry.sequence}`
      };
    }

    // 3. Recompute hash
    const detailsJson = JSON.stringify(entry.details || {});
    const recomputed = computeAuditHash(
      entry.sequence,
      entry.log_id,
      entry.user_id,
      entry.action,
      entry.resource,
      new Date(entry.timestamp).toISOString(),
      detailsJson,
      entry.prev_hash
    );

    if (recomputed !== entry.entry_hash) {
      return {
        valid: false,
        broken_at_sequence: entry.sequence,
        reason: `Tamper detected: entry_hash mismatch at sequence ${entry.sequence}`
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

export async function listAuditLogs(filter = {}) {
  const logs = await AuditLog.find(filter).sort({ sequence: -1 }).limit(100).lean();
  return logs;
}
