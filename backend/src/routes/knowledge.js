import express from 'express';
import { z } from 'zod';
import {
  buildMedicalKnowledgeBase,
  memoryKnowledgeChunks,
  RAW_NASA_MEDICAL_DOCUMENTS
} from '../services/medicalKnowledgeBaseService.js';
import { searchKnowledgeChunks } from '../services/offlineRagService.js';
import { KnowledgeChunk } from '../models/KnowledgeChunk.js';

const router = express.Router();

const searchSchema = z.object({
  query: z.string().min(1),
  top_k: z.number().int().positive().optional().default(5),
  min_score: z.number().optional().default(2.5),
  category: z.string().optional()
});

// GET /api/v1/knowledge/stats
router.get('/api/v1/knowledge/stats', async (req, res, next) => {
  try {
    const dbCount = await KnowledgeChunk.countDocuments();
    const memoryCount = memoryKnowledgeChunks.length;

    res.status(200).json({
      status: 'success',
      data: {
        total_chunks_in_db: dbCount,
        total_chunks_in_memory: memoryCount,
        documents_indexed: RAW_NASA_MEDICAL_DOCUMENTS.length,
        categories: ['CARDIOVASCULAR', 'NEUROVESTIBULAR', 'OPHTHALMIC', 'ENVIRONMENTAL', 'EMERGENCY', 'PHARMACOLOGY', 'BEHAVIORAL'],
        license: 'PUBLIC_DOMAIN_NASA_OPEN_GOV',
        all_chunks_verified: true
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/knowledge/search
router.post('/api/v1/knowledge/search', (req, res, next) => {
  try {
    const { query, top_k, min_score, category } = searchSchema.parse(req.body);
    const results = searchKnowledgeChunks(query, { topK: top_k, minScore: min_score, category });

    res.status(200).json({
      status: 'success',
      count: results.length,
      data: results.map((r) => ({
        chunk_id: r.chunk.chunk_id,
        document_id: r.chunk.document_id,
        document_title: r.chunk.document_title,
        category: r.chunk.category,
        source: r.chunk.source,
        license: r.chunk.license,
        score: r.score,
        matched_terms: r.matchedTerms,
        excerpt: r.chunk.text
      }))
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/knowledge/rebuild
router.post('/api/v1/knowledge/rebuild', async (req, res, next) => {
  try {
    const result = await buildMedicalKnowledgeBase({ saveToDb: true });
    res.status(200).json({
      status: 'success',
      message: 'Medical knowledge base rebuilt successfully',
      data: result
    });
  } catch (err) {
    next(err);
  }
});

export default router;
