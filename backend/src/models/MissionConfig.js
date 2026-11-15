import mongoose from 'mongoose';

const blackoutItemSchema = new mongoose.Schema(
  {
    start_time: { type: String, required: true },
    duration_seconds: { type: Number, required: true }
  },
  { _id: false }
);

const clinicalThresholdsSchema = new mongoose.Schema(
  {
    hr_low: { type: Number, default: 50 },
    hr_high: { type: Number, default: 100 },
    spo2_low: { type: Number, default: 95 },
    sys_bp_high: { type: Number, default: 140 },
    dia_bp_high: { type: Number, default: 90 },
    temp_high: { type: Number, default: 38.0 }
  },
  { _id: false }
);

const missionConfigSchema = new mongoose.Schema(
  {
    mode: {
      type: String,
      enum: ['ISS', 'Moon', 'Mars'],
      required: true,
      unique: true,
      index: true
    },
    is_active: {
      type: Boolean,
      default: false,
      index: true
    },
    comms_delay_seconds: {
      type: Number,
      required: true
    },
    blackout_schedule: {
      type: [blackoutItemSchema],
      default: []
    },
    radiation_rate_msv_per_day: {
      type: Number,
      required: true
    },
    radiation_alert_threshold_msv: {
      type: Number,
      required: true
    },
    supply_days_limit: {
      type: Number,
      required: true
    },
    crew_size: {
      type: Number,
      required: true
    },
    clinical_thresholds: {
      type: clinicalThresholdsSchema,
      required: true
    },
    updated_by: {
      type: String,
      default: 'system'
    }
  },
  {
    timestamps: { createdAt: false, updatedAt: 'updated_at' },
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

export const MissionConfig =
  mongoose.models.MissionConfig || mongoose.model('MissionConfig', missionConfigSchema);
