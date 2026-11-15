import mongoose from 'mongoose';

const ClinicalOrderSchema = new mongoose.Schema(
  {
    order_id: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    target_crew_id: {
      type: String,
      required: true,
      index: true
    },
    issued_by: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['MEDICATION', 'EXERCISE', 'REST', 'DIET', 'DIAGNOSTIC', 'PROCEDURE'],
      default: 'MEDICATION',
      index: true
    },
    title: {
      type: String,
      required: true
    },
    instructions: {
      type: String,
      required: true
    },
    dosage: {
      type: String,
      default: null
    },
    frequency: {
      type: String,
      default: null
    },
    priority: {
      type: String,
      enum: ['ROUTINE', 'URGENT', 'STAT'],
      default: 'ROUTINE'
    },
    status: {
      type: String,
      enum: ['PENDING', 'DELIVERED', 'ACKNOWLEDGED', 'COMPLETED', 'CANCELLED'],
      default: 'DELIVERED',
      index: true
    },
    delivered_at: {
      type: Date,
      default: Date.now
    },
    acknowledged_at: {
      type: Date,
      default: null
    },
    acknowledged_by: {
      type: String,
      default: null
    },
    acknowledgment_notes: {
      type: String,
      default: null
    },
    completed_at: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

ClinicalOrderSchema.index({ target_crew_id: 1, status: 1 });

export const ClinicalOrder =
  mongoose.models.ClinicalOrder || mongoose.model('ClinicalOrder', ClinicalOrderSchema);
