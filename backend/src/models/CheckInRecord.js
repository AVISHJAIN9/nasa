import mongoose from 'mongoose';

const CheckInRecordSchema = new mongoose.Schema(
  {
    checkin_id: {
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
    mood: {
      type: Number,
      default: 3
    },
    energy: {
      type: Number,
      default: 3
    },
    pain: {
      type: Number,
      default: 0
    },
    pain_locations: [{ type: String }],
    symptoms: [{ type: String }],
    vision_score: { type: Number },
    sleep_hours: { type: Number },
    notes: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'synced', 'reviewed'],
      default: 'synced'
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.__v;
        return ret;
      }
    }
  }
);

export const CheckInRecord =
  mongoose.models.CheckInRecord || mongoose.model('CheckInRecord', CheckInRecordSchema);
