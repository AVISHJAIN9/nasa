import mongoose from 'mongoose';

const SyncChangeLogSchema = new mongoose.Schema(
  {
    change_id: { type: String, required: true, unique: true, index: true },
    entity_type: { type: String, required: true, index: true },
    entity_id: { type: String, required: true, index: true },
    node_id: {
      type: String,
      enum: ['onboard_spacecraft', 'ground_control'],
      required: true,
      index: true
    },
    action: {
      type: String,
      enum: ['CREATE', 'UPDATE', 'DELETE'],
      required: true
    },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    vector_clock: {
      onboard: { type: Number, default: 0 },
      ground: { type: Number, default: 0 }
    },
    timestamp: { type: Date, default: Date.now, index: true },
    applied: { type: Boolean, default: true }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

SyncChangeLogSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

export const SyncChangeLog =
  mongoose.models.SyncChangeLog || mongoose.model('SyncChangeLog', SyncChangeLogSchema);
