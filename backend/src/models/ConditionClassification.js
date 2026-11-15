import mongoose from 'mongoose';

const ConditionClassificationSchema = new mongoose.Schema(
  {
    classification_id: {
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
    top_conditions: [
      {
        condition: { type: String, required: true },
        probability: { type: Number, required: true, min: 0, max: 1 },
        clinical_description: String,
        severity_category: String
      }
    ],
    primary_condition: {
      type: String,
      required: true
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },
    is_abstained: {
      type: Boolean,
      default: false
    },
    abstention_reason: String,
    features_snapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({})
    },
    source: {
      type: String,
      enum: ['SIMULATED', 'LIVE', 'REPLAY', 'TEST'],
      default: 'LIVE'
    }
  },
  {
    timestamps: true
  }
);

ConditionClassificationSchema.index({ crew_id: 1, timestamp: -1 });

export const ConditionClassification =
  mongoose.models.ConditionClassification ||
  mongoose.model('ConditionClassification', ConditionClassificationSchema);
