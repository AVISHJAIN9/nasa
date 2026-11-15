import mongoose from 'mongoose';

const SignalingPacketSchema = new mongoose.Schema(
  {
    packet_id: { type: String, required: true },
    sender_id: { type: String, required: true },
    packet_type: {
      type: String,
      enum: ['offer', 'answer', 'ice_candidate'],
      required: true
    },
    sdp: { type: String, default: null },
    candidate: { type: mongoose.Schema.Types.Mixed, default: null },
    sent_at: { type: Date, default: Date.now },
    deliver_at: { type: Date, required: true },
    delivered_at: { type: Date, default: null },
    status: {
      type: String,
      enum: ['in_transit', 'delivered'],
      default: 'in_transit'
    }
  },
  { _id: false }
);

const DelayedChatSchema = new mongoose.Schema(
  {
    message_id: { type: String, required: true },
    sender_id: { type: String, required: true },
    text: { type: String, required: true },
    sent_at: { type: Date, default: Date.now },
    deliver_at: { type: Date, required: true },
    delivered_at: { type: Date, default: null },
    status: {
      type: String,
      enum: ['in_transit', 'delivered'],
      default: 'in_transit'
    }
  },
  { _id: false }
);

const TelemedicineSessionSchema = new mongoose.Schema(
  {
    session_id: { type: String, required: true, unique: true, index: true },
    patient_id: { type: String, required: true, index: true },
    surgeon_id: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['initiating', 'active', 'paused', 'ended'],
      default: 'initiating',
      index: true
    },
    artificial_delay_seconds: { type: Number, default: 5.0 },
    signaling_queue: [SignalingPacketSchema],
    chat_messages: [DelayedChatSchema],
    session_notes: { type: String, default: '' },
    started_at: { type: Date, default: Date.now },
    ended_at: { type: Date, default: null }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

TelemedicineSessionSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

export const TelemedicineSession =
  mongoose.models.TelemedicineSession ||
  mongoose.model('TelemedicineSession', TelemedicineSessionSchema);
