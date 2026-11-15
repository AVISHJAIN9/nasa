import mongoose from 'mongoose';

const AuditLogSchema = new mongoose.Schema(
  {
    sequence: { type: Number, required: true, unique: true, index: true },
    log_id: { type: String, required: true, unique: true, index: true },
    user_id: { type: String, required: true, index: true },
    user_role: { type: String, default: 'flight_surgeon', index: true },
    action: {
      type: String,
      required: true,
      index: true
    },
    resource: { type: String, required: true, index: true },
    ip_address: { type: String, default: '127.0.0.1' },
    timestamp: { type: Date, required: true, index: true },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    prev_hash: { type: String, required: true },
    entry_hash: { type: String, required: true }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

AuditLogSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

export const AuditLog =
  mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);
