import mongoose from 'mongoose';

const rangeStatSchema = new mongoose.Schema(
  {
    min: { type: Number, default: 0 },
    max: { type: Number, default: 0 },
    mean: { type: Number, default: 0 },
    resting: { type: Number, default: 0 }
  },
  { _id: false }
);

const baselineVitalsSchema = new mongoose.Schema(
  {
    heart_rate_bpm: { type: rangeStatSchema, default: () => ({}) },
    blood_pressure_systolic: { type: rangeStatSchema, default: () => ({}) },
    blood_pressure_diastolic: { type: rangeStatSchema, default: () => ({}) },
    spo2_percent: { type: rangeStatSchema, default: () => ({}) },
    respiratory_rate_bpm: { type: rangeStatSchema, default: () => ({}) },
    core_temp_celsius: { type: rangeStatSchema, default: () => ({}) },
    hrv_rmssd_ms: { type: rangeStatSchema, default: () => ({}) },
    days_monitored: { type: Number, default: 0 },
    baseline_established: { type: Boolean, default: false }
  },
  { _id: false }
);

const crewProfileSchema = new mongoose.Schema(
  {
    crew_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    role: {
      type: String,
      required: true,
      trim: true
    },
    age: {
      type: Number,
      required: true,
      min: 18,
      max: 120
    },
    sex: {
      type: String,
      enum: ['male', 'female', 'other'],
      required: true
    },
    height_cm: {
      type: Number,
      required: true,
      min: 120,
      max: 220
    },
    weight_kg: {
      type: Number,
      required: true,
      min: 40,
      max: 160
    },
    medical_history: {
      type: String,
      default: 'No chronic conditions'
    },
    allergies: {
      type: [String],
      default: []
    },
    baseline_vitals: {
      type: baselineVitalsSchema,
      default: () => ({ days_monitored: 0, baseline_established: false })
    },
    provenance: {
      type: String,
      enum: ['SIMULATED', 'REPLAY', 'REAL'],
      default: 'SIMULATED'
    },
    is_cmo: {
      type: Boolean,
      default: false,
      index: true
    },
    cmo_granted_at: {
      type: Date,
      default: null
    },
    cmo_granted_by: {
      type: String,
      default: null
    },
    seed_used: {
      type: Number,
      default: null
    }
  },
  {
    timestamps: true,
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

export const CrewProfile =
  mongoose.models.CrewProfile || mongoose.model('CrewProfile', crewProfileSchema);
