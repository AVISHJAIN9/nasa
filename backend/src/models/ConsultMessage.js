import mongoose from 'mongoose';

const AttachmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    url: { type: String, required: true },
    size_bytes: { type: Number, default: 0 },
    mime_type: { type: String, default: 'application/octet-stream' }
  },
  { _id: false }
);

const ConsultMessageSchema = new mongoose.Schema(
  {
    message_id: { type: String, required: true, unique: true, index: true },
    sender_id: { type: String, required: true, index: true },
    sender_name: { type: String, default: 'Unknown Crew' },
    sender_role: { type: String, default: 'astronaut' },
    recipient_id: { type: String, default: null, index: true },
    recipient_role: { type: String, default: 'flight_surgeon', index: true },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    priority: {
      type: String,
      enum: ['routine', 'urgent', 'stat'],
      default: 'routine'
    },
    direction: {
      type: String,
      enum: ['space_to_ground', 'ground_to_space', 'local'],
      default: 'space_to_ground'
    },
    attachments: [AttachmentSchema],
    mission_mode: { type: String, default: 'ISS' },
    delay_seconds_applied: { type: Number, default: 0 },
    sent_at: { type: Date, default: Date.now, index: true },
    deliver_at: { type: Date, required: true, index: true },
    delivered_at: { type: Date, default: null },
    status: {
      type: String,
      enum: ['queued', 'in_transit', 'delivered', 'held_blackout'],
      default: 'in_transit',
      index: true
    },
    read_at: { type: Date, default: null }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

ConsultMessageSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

export const ConsultMessage =
  mongoose.models.ConsultMessage || mongoose.model('ConsultMessage', ConsultMessageSchema);
