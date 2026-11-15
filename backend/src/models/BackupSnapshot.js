import mongoose from 'mongoose';

const BackupSnapshotSchema = new mongoose.Schema(
  {
    snapshot_id: { type: String, required: true, unique: true, index: true },
    description: { type: String, default: 'Automated System Backup' },
    checksum: { type: String, required: true },
    collection_counts: {
      health_records: { type: Number, default: 0 },
      telemetry_readings: { type: Number, default: 0 },
      medical_events: { type: Number, default: 0 },
      audit_logs: { type: Number, default: 0 },
      inventories: { type: Number, default: 0 },
      crew_profiles: { type: Number, default: 0 }
    },
    data: {
      health_records: [{ type: mongoose.Schema.Types.Mixed }],
      telemetry_readings: [{ type: mongoose.Schema.Types.Mixed }],
      medical_events: [{ type: mongoose.Schema.Types.Mixed }],
      audit_logs: [{ type: mongoose.Schema.Types.Mixed }],
      inventories: [{ type: mongoose.Schema.Types.Mixed }],
      crew_profiles: [{ type: mongoose.Schema.Types.Mixed }]
    }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

BackupSnapshotSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    delete ret.data; // Don't bloat JSON responses with full dump by default
    return ret;
  }
});

export const BackupSnapshot =
  mongoose.models.BackupSnapshot ||
  mongoose.model('BackupSnapshot', BackupSnapshotSchema);
