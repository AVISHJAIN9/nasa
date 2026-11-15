import mongoose from 'mongoose';

const ProtocolStepSchema = new mongoose.Schema(
  {
    step_number: { type: Number, required: true },
    action: { type: String, required: true },
    instruction: { type: String, required: true },
    caution_notes: { type: String, default: null },
    duration_seconds: { type: Number, default: 0 }
  },
  { _id: false }
);

const EmergencyProtocolSchema = new mongoose.Schema(
  {
    protocol_id: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    title: {
      type: String,
      required: true
    },
    category: {
      type: String,
      enum: ['RESUSCITATION', 'ENVIRONMENTAL', 'TRAUMA', 'PHARMACOLOGY', 'SURGICAL', 'DENTAL'],
      required: true,
      index: true
    },
    version: {
      type: String,
      default: 'v2.1.0'
    },
    source_citation: {
      type: String,
      required: true
    },
    license: {
      type: String,
      default: 'PUBLIC_DOMAIN_NASA_OPEN_GOV'
    },
    prerequisites: [{ type: String }],
    equipment_needed: [{ type: String }],
    steps: [ProtocolStepSchema],
    escalation_criteria: [{ type: String }],
    applicable_mission_modes: {
      type: [String],
      default: ['ISS', 'MOON', 'MARS']
    }
  },
  {
    timestamps: true
  }
);

EmergencyProtocolSchema.index({ category: 1, protocol_id: 1 });

export const EmergencyProtocol =
  mongoose.models.EmergencyProtocol ||
  mongoose.model('EmergencyProtocol', EmergencyProtocolSchema);
