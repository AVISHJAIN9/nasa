import mongoose from 'mongoose';

const ReadReceiptSchema = new mongoose.Schema(
  {
    user_id: { type: String, required: true },
    crew_id: { type: String, default: null },
    read_at: { type: Date, default: Date.now },
    acknowledged: { type: Boolean, default: true }
  },
  { _id: false }
);

const BroadcastAnnouncementSchema = new mongoose.Schema(
  {
    announcement_id: { type: String, required: true, unique: true, index: true },
    sender_id: { type: String, required: true, index: true },
    sender_name: { type: String, default: 'Flight Surgeon Control' },
    priority: {
      type: String,
      enum: ['normal', 'urgent', 'emergency'],
      default: 'normal',
      index: true
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    target_audience: {
      type: String,
      enum: ['all', 'crew', 'medical_team'],
      default: 'all',
      index: true
    },
    receipts: [ReadReceiptSchema]
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

BroadcastAnnouncementSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

export const BroadcastAnnouncement =
  mongoose.models.BroadcastAnnouncement ||
  mongoose.model('BroadcastAnnouncement', BroadcastAnnouncementSchema);
