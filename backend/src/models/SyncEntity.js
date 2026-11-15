import mongoose from 'mongoose';

const SyncEntitySchema = new mongoose.Schema(
  {
    entity_id: { type: String, required: true, unique: true, index: true },
    entity_type: { type: String, required: true, index: true },
    title: { type: String, default: '' },
    content: { type: String, default: '' },
    author_id: { type: String, default: 'system' },
    last_modifying_node: { type: String, default: 'onboard_spacecraft' },
    vector_clock: {
      onboard: { type: Number, default: 0 },
      ground: { type: Number, default: 0 }
    },
    version: { type: Number, default: 1 },
    last_modified: { type: Date, default: Date.now },
    is_deleted: { type: Boolean, default: false },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

SyncEntitySchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

export const SyncEntity =
  mongoose.models.SyncEntity || mongoose.model('SyncEntity', SyncEntitySchema);

const SyncConflictAuditSchema = new mongoose.Schema(
  {
    conflict_id: { type: String, required: true, unique: true, index: true },
    entity_id: { type: String, required: true, index: true },
    entity_type: { type: String, required: true },
    resolution_strategy: { type: String, required: true },
    winning_node: { type: String, required: true },
    winning_payload: { type: mongoose.Schema.Types.Mixed, required: true },
    losing_node: { type: String, required: true },
    losing_payload: { type: mongoose.Schema.Types.Mixed, required: true },
    resolved_at: { type: Date, default: Date.now }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

SyncConflictAuditSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

export const SyncConflictAudit =
  mongoose.models.SyncConflictAudit ||
  mongoose.model('SyncConflictAudit', SyncConflictAuditSchema);
