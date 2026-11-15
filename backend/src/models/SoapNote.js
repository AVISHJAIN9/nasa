import mongoose from 'mongoose';

const NoteVersionSchema = new mongoose.Schema(
  {
    version_number: { type: Number, required: true },
    edited_by: { type: String, required: true },
    edited_at: { type: Date, default: Date.now },
    subjective: { type: String, default: '' },
    objective: { type: String, default: '' },
    assessment: { type: String, default: '' },
    plan: { type: String, default: '' },
    change_summary: { type: String, default: 'Updated clinical note' }
  },
  { _id: false }
);

const SoapNoteSchema = new mongoose.Schema(
  {
    note_id: {
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
    author_id: {
      type: String,
      required: true,
      default: 'flight_surgeon_01'
    },
    author_name: {
      type: String,
      default: 'Flight Surgeon'
    },
    author_role: {
      type: String,
      default: 'flight_surgeon'
    },
    subjective: {
      type: String,
      default: ''
    },
    objective: {
      type: String,
      default: ''
    },
    assessment: {
      type: String,
      default: ''
    },
    plan: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['DRAFT', 'SUBMITTED', 'AMENDED', 'FINALIZED'],
      default: 'DRAFT',
      index: true
    },
    ai_drafted: {
      type: Boolean,
      default: true
    },
    ai_draft_snapshot: {
      subjective: { type: String, default: '' },
      objective: { type: String, default: '' },
      assessment: { type: String, default: '' },
      plan: { type: String, default: '' },
      generated_at: { type: Date, default: Date.now }
    },
    versions: [NoteVersionSchema],
    current_version: {
      type: Number,
      default: 1
    },
    provenance: {
      type: String,
      enum: ['SIMULATED', 'REPLAY', 'REAL'],
      default: 'SIMULATED'
    },
    disclaimer: {
      type: String,
      default:
        'Decision-support prototype on synthetic and public data. Not a certified medical device. No diagnosis claims. Requires flight surgeon clinical judgment.'
    }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

SoapNoteSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

export const SoapNote = mongoose.models.SoapNote || mongoose.model('SoapNote', SoapNoteSchema);
