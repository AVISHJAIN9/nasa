import mongoose from 'mongoose';

const MedicalEventLogSchema = new mongoose.Schema(
  {
    sequence: { type: Number, required: true, unique: true, index: true },
    event_id: { type: String, required: true, unique: true, index: true },
    crew_id: { type: String, required: true, index: true },
    action: { type: String, required: true, index: true },
    performer_id: { type: String, required: true },
    performer_role: { type: String, default: 'crew_medical_officer' },
    timestamp: { type: Date, required: true, index: true },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    prev_hash: { type: String, required: true },
    entry_hash: { type: String, required: true }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

MedicalEventLogSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

export const MedicalEventLog =
  mongoose.models.MedicalEventLog ||
  mongoose.model('MedicalEventLog', MedicalEventLogSchema);
