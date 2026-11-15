import mongoose from 'mongoose';

const TriageStepLogSchema = new mongoose.Schema(
  {
    step_number: { type: Number, required: true },
    node_id: { type: String, required: true },
    node_title: String,
    prompt: { type: String, required: true },
    selected_option: { type: mongoose.Schema.Types.Mixed },
    clinical_explanation: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  },
  { _id: false }
);

const TriageSessionSchema = new mongoose.Schema(
  {
    session_id: {
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
    tree_id: {
      type: String,
      required: true,
      index: true
    },
    mission_mode: {
      type: String,
      enum: ['ISS', 'MOON', 'MARS'],
      default: 'MARS'
    },
    status: {
      type: String,
      enum: ['IN_PROGRESS', 'COMPLETED', 'ESCALATED'],
      default: 'IN_PROGRESS',
      index: true
    },
    current_node_id: {
      type: String,
      required: true
    },
    steps_log: [TriageStepLogSchema],
    triage_acuity: {
      type: String,
      enum: ['IMMEDIATE', 'URGENT', 'DELAYED', 'MINIMAL'],
      default: 'URGENT'
    },
    recommended_actions: [{ type: String }],
    protocol_triggered: { type: String, default: null },
    surgeon_report: { type: mongoose.Schema.Types.Mixed, default: null },
    store_forward_message_id: { type: String, default: null },
    ground_contact_made: { type: Boolean, default: false },
    completed_at: Date
  },
  {
    timestamps: true
  }
);

TriageSessionSchema.index({ crew_id: 1, status: 1 });

export const TriageSession =
  mongoose.models.TriageSession ||
  mongoose.model('TriageSession', TriageSessionSchema);
