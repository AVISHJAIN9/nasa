import mongoose from 'mongoose';

const VitalsDailyRollupSchema = new mongoose.Schema(
  {
    crew_id: { type: String, required: true, index: true },
    date: { type: String, required: true, index: true }, // Format: YYYY-MM-DD
    metric: { type: String, required: true, index: true },
    count: { type: Number, required: true },
    min: { type: Number, required: true },
    max: { type: Number, required: true },
    avg: { type: Number, required: true },
    p50: { type: Number, default: 0 },
    p95: { type: Number, default: 0 },
    source: { type: String, default: 'ROLLUP_VIEW' },
    refreshed_at: { type: Date, default: Date.now }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

VitalsDailyRollupSchema.index({ crew_id: 1, date: 1, metric: 1 }, { unique: true });

VitalsDailyRollupSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

export const VitalsDailyRollup =
  mongoose.models.VitalsDailyRollup ||
  mongoose.model('VitalsDailyRollup', VitalsDailyRollupSchema);
