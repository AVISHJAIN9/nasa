import mongoose from 'mongoose';

const inventorySchema = new mongoose.Schema(
  {
    item_id: {
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
    category: {
      type: String,
      enum: ['medication', 'surgical', 'diagnostic', 'ppe', 'first_aid', 'general'],
      required: true,
      index: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 0
    },
    min_threshold: {
      type: Number,
      required: true,
      min: 0,
      default: 5
    },
    unit: {
      type: String,
      required: true
    },
    expiry_date: {
      type: Date,
      required: true,
      index: true
    },
    location: {
      type: String,
      default: 'MedKit Alpha, Drawer 1'
    },
    is_critical: {
      type: Boolean,
      default: false
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

export const Inventory =
  mongoose.models.Inventory || mongoose.model('Inventory', inventorySchema);
