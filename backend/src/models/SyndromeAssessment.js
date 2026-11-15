import mongoose from 'mongoose';

const SyndromeAssessmentSchema = new mongoose.Schema(
  {
    assessment_id: {
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
    syndrome_id: {
      type: String,
      required: true,
      enum: ['SANS', 'SMS', 'VTE', 'NEPHROLITHIASIS', 'CARDIOVASCULAR_DECONDITIONING'],
      index: true
    },
    syndrome_name: {
      type: String,
      required: true
    },
    risk_score: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      index: true
    },
    clinical_stage: {
      type: String,
      enum: ['NOMINAL', 'MONITORING', 'ELEVATED_RISK', 'CONFIRMED_CASE'],
      default: 'NOMINAL',
      index: true
    },
    detected_indicators: [
      {
        indicator: String,
        present: Boolean,
        value: mongoose.Schema.Types.Mixed,
        threshold: mongoose.Schema.Types.Mixed,
        clinical_weight: Number
      }
    ],
    sources: [
      {
        citation: String,
        document_code: String,
        url: String
      }
    ],
    recommended_protocol: [String],
    assessed_by: {
      type: String,
      default: 'ai_syndrome_engine'
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

SyndromeAssessmentSchema.index({ crew_id: 1, syndrome_id: 1, timestamp: -1 });

export const SyndromeAssessment =
  mongoose.models.SyndromeAssessment ||
  mongoose.model('SyndromeAssessment', SyndromeAssessmentSchema);
