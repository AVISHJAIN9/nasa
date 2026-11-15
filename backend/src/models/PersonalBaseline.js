import mongoose from 'mongoose';

const HourlyBaselineSchema = new mongoose.Schema(
  {
    hour: { type: Number, required: true, min: 0, max: 23 },
    median: { type: Number, required: true },
    mad: { type: Number, required: true },
    normal_low: { type: Number, required: true },
    normal_high: { type: Number, required: true },
    sample_count: { type: Number, default: 0 }
  },
  { _id: false }
);

const PersonalBaselineSchema = new mongoose.Schema(
  {
    crew_id: { type: String, required: true, index: true },
    metric: {
      type: String,
      required: true,
      enum: ['heart_rate', 'spo2', 'sys_bp', 'dia_bp', 'temperature', 'hrv', 'respiration_rate'],
      index: true
    },
    version: { type: Number, default: 1 },
    updated_at: { type: Date, default: Date.now },
    hourly_baselines: { type: [HourlyBaselineSchema], default: [] }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

PersonalBaselineSchema.index({ crew_id: 1, metric: 1 }, { unique: true });

PersonalBaselineSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

export const PersonalBaseline =
  mongoose.models.PersonalBaseline ||
  mongoose.model('PersonalBaseline', PersonalBaselineSchema);
