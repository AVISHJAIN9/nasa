import mongoose from 'mongoose';

const KnowledgeChunkSchema = new mongoose.Schema(
  {
    chunk_id: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    document_id: {
      type: String,
      required: true,
      index: true
    },
    document_title: {
      type: String,
      required: true
    },
    source: {
      type: String,
      required: true
    },
    license: {
      type: String,
      required: true,
      default: 'PUBLIC_DOMAIN_NASA_OPEN_GOV'
    },
    version: {
      type: String,
      default: 'v2.0.0'
    },
    category: {
      type: String,
      enum: ['CARDIOVASCULAR', 'NEUROVESTIBULAR', 'OPHTHALMIC', 'ENVIRONMENTAL', 'EMERGENCY', 'PHARMACOLOGY', 'BEHAVIORAL'],
      required: true,
      index: true
    },
    text: {
      type: String,
      required: true
    },
    keywords: [{ type: String, index: true }],
    token_weights: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({})
    }
  },
  {
    timestamps: true
  }
);

KnowledgeChunkSchema.index({ category: 1, document_id: 1 });
KnowledgeChunkSchema.index({ text: 'text', document_title: 'text' });

export const KnowledgeChunk =
  mongoose.models.KnowledgeChunk || mongoose.model('KnowledgeChunk', KnowledgeChunkSchema);
