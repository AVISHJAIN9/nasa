import mongoose from 'mongoose';

const EventLogSchema = new mongoose.Schema(
  {
    event_id: { type: String, required: true, unique: true, index: true },
    event_type: { type: String, required: true, index: true },
    channel: { type: String, default: 'general', index: true },
    severity: {
      type: String,
      enum: ['info', 'warning', 'critical', 'emergency'],
      default: 'info',
      index: true
    },
    source: { type: String, default: 'SIMULATED' },
    correlation_id: { type: String, default: null },
    recipient_role: { type: String, default: null, index: true },
    recipient_id: { type: String, default: null, index: true },
    timestamp: { type: Date, default: Date.now, index: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

EventLogSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

export const EventLog = mongoose.models.EventLog || mongoose.model('EventLog', EventLogSchema);
