import mongoose from 'mongoose';

const DataCitationSchema = new mongoose.Schema(
  {
    ref_id: { type: String, required: true },
    metric: { type: String, required: true },
    value: { type: String, required: true },
    source_dataset_or_model: { type: String, required: true }
  },
  { _id: false }
);

const DailyHealthBriefSchema = new mongoose.Schema(
  {
    brief_id: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    crew_id: {
      type: String,
      required: true,
      index: true
    },
    sol_date: {
      type: String,
      required: true,
      index: true
    },
    mission_day: {
      type: Number,
      required: true
    },
    summary_headline: {
      type: String,
      required: true
    },
    what_changed: {
      type: String,
      required: true
    },
    what_to_watch: {
      type: String,
      required: true
    },
    key_metrics: {
      hr_mean_bpm: { type: Number, default: 70 },
      hr_delta_bpm: { type: Number, default: 0 },
      sys_bp_mmHg: { type: Number, default: 118 },
      spo2_min_percent: { type: Number, default: 97 },
      sleep_hours: { type: Number, default: 7.5 },
      sleep_delta_hours: { type: Number, default: 0 },
      radiation_dose_msv: { type: Number, default: 0.45 },
      active_alert_count: { type: Number, default: 0 }
    },
    citations: [DataCitationSchema],
    guardrail_status: {
      type: String,
      enum: ['PASS', 'BLOCKED', 'ESCALATED'],
      default: 'PASS'
    },
    citation_check_status: {
      type: String,
      enum: ['GROUNDED', 'FLAGGED'],
      default: 'GROUNDED'
    },
    provenance: {
      type: String,
      enum: ['SIMULATED', 'REPLAY', 'REAL'],
      default: 'SIMULATED'
    },
    disclaimer: {
      type: String,
      default:
        'Decision-support prototype on synthetic and public data. Not a certified medical device. No diagnosis claims.'
    }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

DailyHealthBriefSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

export const DailyHealthBrief =
  mongoose.models.DailyHealthBrief || mongoose.model('DailyHealthBrief', DailyHealthBriefSchema);
