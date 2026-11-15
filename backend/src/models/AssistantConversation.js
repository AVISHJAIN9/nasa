import mongoose from 'mongoose';

const AssistantMessageSchema = new mongoose.Schema({
  message_id: { type: String, required: true },
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  citations: [
    {
      source: String,
      document_id: String,
      title: String,
      license: String,
      excerpt: String
    }
  ],
  is_refusal: { type: Boolean, default: false },
  guardrail_action: { type: String, enum: ['PASS', 'BLOCKED', 'ESCALATED', 'DISCLAIMER_ADDED'], default: 'PASS' },
  escalated_to_emergency: { type: Boolean, default: false },
  mode_used: { type: String, enum: ['CLOUD_API', 'LOCAL_OFFLINE'], default: 'LOCAL_OFFLINE' },
  latency_ms: Number
});

const AssistantConversationSchema = new mongoose.Schema(
  {
    conversation_id: {
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
    conversation_type: {
      type: String,
      enum: ['MEDICAL_ASSISTANT', 'MENTAL_HEALTH_COMPANION'],
      default: 'MEDICAL_ASSISTANT',
      index: true
    },
    messages: [AssistantMessageSchema],
    is_crisis_flagged: {
      type: Boolean,
      default: false,
      index: true
    },
    crisis_escalated_at: Date,
    crisis_escalated_by: String,
    last_interaction: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

AssistantConversationSchema.index({ crew_id: 1, conversation_type: 1 });

export const AssistantConversation =
  mongoose.models.AssistantConversation ||
  mongoose.model('AssistantConversation', AssistantConversationSchema);
