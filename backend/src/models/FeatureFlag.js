import mongoose from 'mongoose';

const featureFlagSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    is_enabled: {
      type: Boolean,
      default: true,
      required: true
    },
    description: {
      type: String,
      default: ''
    },
    updated_at: {
      type: Date,
      default: Date.now
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

export const FeatureFlag = mongoose.models.FeatureFlag || mongoose.model('FeatureFlag', featureFlagSchema);
