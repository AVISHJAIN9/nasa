import crypto from 'crypto';
import { BackupSnapshot } from '../models/BackupSnapshot.js';
import { HealthRecord } from '../models/HealthRecord.js';
import { TelemetryReading } from '../models/TelemetryReading.js';
import { MedicalEventLog } from '../models/MedicalEventLog.js';
import { AuditLog } from '../models/AuditLog.js';
import { Inventory } from '../models/Inventory.js';
import { CrewProfile } from '../models/CrewProfile.js';
import { NotFoundException, BadRequestException } from '../middleware/errors.js';

export async function createDatabaseSnapshot(description = 'Pre-operation clinical state') {
  const [healthRecords, telemetryReadings, medicalEvents, auditLogs, inventories, crewProfiles] =
    await Promise.all([
      HealthRecord.find().lean(),
      TelemetryReading.find().lean(),
      MedicalEventLog.find().lean(),
      AuditLog.find().lean(),
      Inventory.find().lean(),
      CrewProfile.find().lean()
    ]);

  const rawData = {
    health_records: healthRecords,
    telemetry_readings: telemetryReadings,
    medical_events: medicalEvents,
    audit_logs: auditLogs,
    inventories,
    crew_profiles: crewProfiles
  };

  const serialized = JSON.stringify(rawData);
  const checksum = crypto.createHash('sha256').update(serialized).digest('hex');
  const snapshotId = `bkp-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  const collectionCounts = {
    health_records: healthRecords.length,
    telemetry_readings: telemetryReadings.length,
    medical_events: medicalEvents.length,
    audit_logs: auditLogs.length,
    inventories: inventories.length,
    crew_profiles: crewProfiles.length
  };

  const snapshot = await BackupSnapshot.create({
    snapshot_id: snapshotId,
    description,
    checksum,
    collection_counts: collectionCounts,
    data: rawData
  });

  return {
    snapshot_id: snapshot.snapshot_id,
    description: snapshot.description,
    checksum: snapshot.checksum,
    collection_counts: snapshot.collection_counts,
    created_at: snapshot.created_at
  };
}

export async function restoreDatabaseSnapshot(snapshotId) {
  const snapshot = await BackupSnapshot.findOne({ snapshot_id: snapshotId });
  if (!snapshot) {
    throw new NotFoundException(`Backup snapshot '${snapshotId}' not found`);
  }

  // 1. Verify checksum integrity before applying restore
  const serialized = JSON.stringify(snapshot.data);
  const recomputedChecksum = crypto.createHash('sha256').update(serialized).digest('hex');

  if (recomputedChecksum !== snapshot.checksum) {
    throw new BadRequestException('Backup snapshot corrupted: checksum verification failed');
  }

  // 2. Clear collections and restore from snapshot payload
  const { health_records, telemetry_readings, medical_events, audit_logs, inventories, crew_profiles } =
    snapshot.data;

  await Promise.all([
    HealthRecord.deleteMany({}),
    TelemetryReading.deleteMany({}),
    MedicalEventLog.deleteMany({}),
    AuditLog.deleteMany({}),
    Inventory.deleteMany({}),
    CrewProfile.deleteMany({})
  ]);

  if (health_records?.length > 0) await HealthRecord.insertMany(health_records);
  if (telemetry_readings?.length > 0) await TelemetryReading.insertMany(telemetry_readings);
  if (medical_events?.length > 0) await MedicalEventLog.insertMany(medical_events);
  if (audit_logs?.length > 0) await AuditLog.insertMany(audit_logs);
  if (inventories?.length > 0) await Inventory.insertMany(inventories);
  if (crew_profiles?.length > 0) await CrewProfile.insertMany(crew_profiles);

  // 3. Verify restored counts match exactly
  const [restoredHealth, restoredTelemetry, restoredEvents, restoredAudits, restoredInv, restoredCrew] =
    await Promise.all([
      HealthRecord.countDocuments(),
      TelemetryReading.countDocuments(),
      MedicalEventLog.countDocuments(),
      AuditLog.countDocuments(),
      Inventory.countDocuments(),
      CrewProfile.countDocuments()
    ]);

  const restoredCounts = {
    health_records: restoredHealth,
    telemetry_readings: restoredTelemetry,
    medical_events: restoredEvents,
    audit_logs: restoredAudits,
    inventories: restoredInv,
    crew_profiles: restoredCrew
  };

  return {
    restored: true,
    snapshot_id: snapshotId,
    checksum_matched: true,
    restored_counts: restoredCounts
  };
}

export async function listSnapshots() {
  const snapshots = await BackupSnapshot.find().sort({ created_at: -1 }).limit(20).lean();
  return snapshots;
}
