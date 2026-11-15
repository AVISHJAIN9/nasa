import mongoose from 'mongoose';

const HealthRiskScoreSchema = new mongoose.Schema(
  {
    score_id: {
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
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    },
    risk_score: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      index: true
    },
    readiness_score: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      index: true
    },
    status: {
      type: String,
      enum: ['OPTIMAL', 'ACCEPTABLE', 'ELEVATED_RISK', 'CRITICAL_RISK'],
      default: 'ACCEPTABLE',
      index: true
    },
    factors: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({})
    },
    shap_values: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({})
    },
    explanation: {
      type: String
    },
    confidence: {
      type: Number,
      default: 1.0,
      min: 0.0,
      max: 1.0
    },
    is_calibrated: {
      type: Boolean,
      default: true
    },
    source: {
      type: String,
      enum: ['SIMULATED', 'LIVE', 'REPLAY', 'BENCHMARK'],
      default: 'LIVE'
    }
  },
  {
    timestamps: true
  }
);

HealthRiskScoreSchema.index({ crew_id: 1, timestamp: -1 });

export const HealthRiskScore = mongoose.models.HealthRiskScore || mongoose.model('HealthRiskScore', HealthRiskScoreSchema);
