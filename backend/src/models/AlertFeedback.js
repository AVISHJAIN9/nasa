import mongoose from 'mongoose';

const AlertFeedbackSchema = new mongoose.Schema(
  {
    feedback_id: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    alert_id: {
      type: String,
      required: true,
      index: true
    },
    crew_id: {
      type: String,
      required: true,
      index: true
    },
    metric: {
      type: String,
      required: true,
      index: true
    },
    label: {
      type: String,
      enum: ['TRUE_POSITIVE', 'FALSE_POSITIVE'],
      required: true,
      index: true
    },
    value: {
      type: Number,
      required: true
    },
    original_threshold: {
      type: Number,
      required: true
    },
    adapted_threshold: {
      type: Number,
      default: null
    },
    surgeon_id: {
      type: String,
      default: 'flight_surgeon'
    },
    reason: {
      type: String,
      default: null
    },
    created_at: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

AlertFeedbackSchema.index({ crew_id: 1, metric: 1, label: 1 });

export const AlertFeedback =
  mongoose.models.AlertFeedback || mongoose.model('AlertFeedback', AlertFeedbackSchema);
