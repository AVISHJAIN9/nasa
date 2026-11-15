import mongoose from 'mongoose';

const RadiationHistorySchema = new mongoose.Schema(
  {
    timestamp: { type: Date, default: Date.now },
    dose_delta_msv: { type: Number, required: true },
    type: {
      type: String,
      enum: ['DAILY_BACKGROUND', 'SPE_SPIKE', 'EVA_EXPOSURE', 'MANUAL_ADJUSTMENT'],
      default: 'DAILY_BACKGROUND'
    },
    mission_mode: { type: String, default: 'Mars' },
    notes: { type: String, default: '' }
  },
  { _id: false }
);

const RadiationDoseSchema = new mongoose.Schema(
  {
    crew_id: { type: String, required: true, unique: true, index: true },
    career_limit_msv: { type: Number, default: 600.0 },
    cumulative_dose_msv: { type: Number, default: 0.0 },
    current_mission_mode: { type: String, default: 'Mars' },
    daily_rate_msv: { type: Number, default: 2.2 },
    percentage: { type: Number, default: 0.0 },
    status: {
      type: String,
      enum: ['NOMINAL', 'AMBER', 'RED'],
      default: 'NOMINAL',
      index: true
    },
    last_accumulated_at: { type: Date, default: Date.now },
    history: { type: [RadiationHistorySchema], default: [] }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

RadiationDoseSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

export const RadiationDose =
  mongoose.models.RadiationDose ||
  mongoose.model('RadiationDose', RadiationDoseSchema);
