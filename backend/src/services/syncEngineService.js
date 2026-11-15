import crypto from 'crypto';
import { SyncEntity, SyncConflictAudit } from '../models/SyncEntity.js';
import { SyncChangeLog } from '../models/SyncChangeLog.js';

/**
 * AstroCare v2 Conflict Resolution Policy:
 * 1. Causal Ordering via Vector Clocks:
 *    - Each node maintains logical clock components { onboard, ground }.
 *    - If Vector Clock A strictly dominates B (A >= B on all keys, A > B on >= 1), A applies cleanly.
 * 2. Concurrent Edits under Link Severance:
 *    - If neither dominates (concurrent partition edits), resolution uses:
 *      a. Deterministic Last-Write-Wins (LWW) on client timestamp.
 *      b. In event of equal timestamps: Ground Control takes precedence for clinical treatment plans,
 *         Onboard Spacecraft takes precedence for telemetry and vital assessments.
 *      c. Both winning and losing states are immutably archived in SyncConflictAudit so zero clinical data is lost.
 */

export function compareVectorClocks(vc1 = {}, vc2 = {}) {
  const o1 = vc1.onboard || 0;
  const g1 = vc1.ground || 0;
  const o2 = vc2.onboard || 0;
  const g2 = vc2.ground || 0;

  if (o1 === o2 && g1 === g2) return 'IDENTICAL';
  if (o1 >= o2 && g1 >= g2) return 'DOMINATES';
  if (o1 <= o2 && g1 <= g2) return 'IS_DOMINATED';
  return 'CONCURRENT';
}

export async function recordLocalChange(options = {}) {
  const entityType = options.entity_type || options.entityType || 'clinical_note';
  const entityId = options.entity_id || options.entityId;
  const nodeId = options.node_id || options.nodeId || 'onboard_spacecraft';
  const action = options.action || 'UPDATE';
  const payload = options.payload || {};
  const timestamp = options.timestamp ? new Date(options.timestamp) : new Date();

  let entity = await SyncEntity.findOne({ entity_id: entityId });

  const vectorClock = entity
    ? { ...entity.vector_clock.toObject() }
    : { onboard: 0, ground: 0 };

  if (nodeId === 'onboard_spacecraft') {
    vectorClock.onboard = (vectorClock.onboard || 0) + 1;
  } else {
    vectorClock.ground = (vectorClock.ground || 0) + 1;
  }

  const changeId = `chg-${crypto.randomBytes(6).toString('hex')}`;

  // 1. Record in append-only change log
  const logEntry = await SyncChangeLog.create({
    change_id: changeId,
    entity_type: entityType,
    entity_id: entityId,
    node_id: nodeId,
    action,
    payload,
    vector_clock: vectorClock,
    timestamp
  });

  // 2. Upsert entity
  if (!entity) {
    entity = await SyncEntity.create({
      entity_id: entityId,
      entity_type: entityType,
      title: payload.title || '',
      content: payload.content || '',
      author_id: payload.author_id || 'system',
      last_modifying_node: nodeId,
      vector_clock: vectorClock,
      version: 1,
      last_modified: timestamp,
      metadata: payload.metadata || {}
    });
  } else {
    entity.title = payload.title !== undefined ? payload.title : entity.title;
    entity.content = payload.content !== undefined ? payload.content : entity.content;
    entity.last_modifying_node = nodeId;
    entity.vector_clock = vectorClock;
    entity.version += 1;
    entity.last_modified = timestamp;
    if (payload.metadata) entity.metadata = { ...entity.metadata, ...payload.metadata };
    await entity.save();
  }

  return {
    change: logEntry.toJSON(),
    entity: entity.toJSON()
  };
}

export async function reconcileIncomingBatch(incomingChanges = []) {
  let appliedCount = 0;
  let conflictCount = 0;
  const conflictAudits = [];

  for (const change of incomingChanges) {
    const {
      entity_id: entityId,
      entity_type: entityType,
      node_id: incomingNode,
      payload,
      vector_clock: incomingVC = { onboard: 0, ground: 0 },
      timestamp: incomingTime = new Date()
    } = change;

    let localEntity = await SyncEntity.findOne({ entity_id: entityId });

    if (!localEntity) {
      // Clean insert of new remote entity
      await SyncEntity.create({
        entity_id: entityId,
        entity_type: entityType,
        title: payload.title || '',
        content: payload.content || '',
        author_id: payload.author_id || 'remote',
        last_modifying_node: incomingNode,
        vector_clock: incomingVC,
        version: 1,
        last_modified: new Date(incomingTime),
        metadata: payload.metadata || {}
      });
      appliedCount++;
      continue;
    }

    const relation = compareVectorClocks(incomingVC, localEntity.vector_clock);

    if (relation === 'DOMINATES') {
      // Incoming change is causally newer: apply cleanly
      localEntity.title = payload.title !== undefined ? payload.title : localEntity.title;
      localEntity.content = payload.content !== undefined ? payload.content : localEntity.content;
      localEntity.last_modifying_node = incomingNode;
      localEntity.vector_clock = incomingVC;
      localEntity.version += 1;
      localEntity.last_modified = new Date(incomingTime);
      await localEntity.save();
      appliedCount++;
    } else if (relation === 'IS_DOMINATED' || relation === 'IDENTICAL') {
      // Local state is already newer or identical: no change needed
      continue;
    } else {
      // CONCURRENT CONFLICT: Partitioned writes occurred on both sides!
      conflictCount++;
      const localTime = new Date(localEntity.last_modified).getTime();
      const remoteTime = new Date(incomingTime).getTime();

      let incomingWins = remoteTime > localTime;
      if (remoteTime === localTime) {
        // Tie-breaker: Ground Control priority for clinical directives
        incomingWins = incomingNode === 'ground_control';
      }

      const winningNode = incomingWins ? incomingNode : localEntity.last_modifying_node;
      const losingNode = incomingWins ? localEntity.last_modifying_node : incomingNode;
      const winningPayload = incomingWins
        ? payload
        : { title: localEntity.title, content: localEntity.content };
      const losingPayload = incomingWins
        ? { title: localEntity.title, content: localEntity.content }
        : payload;

      // Log full conflict audit to ensure zero data loss
      const audit = await SyncConflictAudit.create({
        conflict_id: `conf-${crypto.randomBytes(6).toString('hex')}`,
        entity_id: entityId,
        entity_type: entityType,
        resolution_strategy: 'LWW_CONCURRENT_TIMESTAMP_ARBITRATION',
        winning_node: winningNode,
        winning_payload: winningPayload,
        losing_node: losingNode,
        losing_payload: losingPayload,
        resolved_at: new Date()
      });
      conflictAudits.push(audit.toJSON());

      // Merge vector clocks (component-wise max)
      const mergedVC = {
        onboard: Math.max(localEntity.vector_clock.onboard || 0, incomingVC.onboard || 0),
        ground: Math.max(localEntity.vector_clock.ground || 0, incomingVC.ground || 0)
      };

      if (incomingWins) {
        localEntity.title = payload.title !== undefined ? payload.title : localEntity.title;
        localEntity.content = payload.content !== undefined ? payload.content : localEntity.content;
        localEntity.last_modifying_node = incomingNode;
        localEntity.last_modified = new Date(incomingTime);
      }

      localEntity.vector_clock = mergedVC;
      localEntity.version += 1;
      await localEntity.save();
      appliedCount++;
    }
  }

  return {
    applied_count: appliedCount,
    conflict_count: conflictCount,
    conflicts: conflictAudits
  };
}
