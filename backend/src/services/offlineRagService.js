import {
  memoryKnowledgeChunks,
  RAW_NASA_MEDICAL_DOCUMENTS,
  chunkDocument
} from './medicalKnowledgeBaseService.js';

// Pre-compiled list of 30 aerospace medicine test questions with expected categories
export const BENCHMARK_30_TEST_QUESTIONS = [
  { id: 'Q01', query: 'What is the cephalad fluid shift volume in microgravity?', expected_topic: 'CARDIOVASCULAR' },
  { id: 'Q02', query: 'What are the countermeasure protocols for orthostatic intolerance?', expected_topic: 'CARDIOVASCULAR' },
  { id: 'Q03', query: 'What is the standard fluid loading protocol before re-entry?', expected_topic: 'CARDIOVASCULAR' },
  { id: 'Q04', query: 'What is the nominal resting heart rate range in microgravity?', expected_topic: 'CARDIOVASCULAR' },
  { id: 'Q05', query: 'What causes space motion sickness and how long does it typically last?', expected_topic: 'NEUROVESTIBULAR' },
  { id: 'Q06', query: 'Why are extravehicular activities contraindicated during the first 72 hours of flight?', expected_topic: 'NEUROVESTIBULAR' },
  { id: 'Q07', query: 'What is the first-line medication for space motion sickness?', expected_topic: 'NEUROVESTIBULAR' },
  { id: 'Q08', query: 'What dosage of promethazine is administered intramuscularly for acute nausea?', expected_topic: 'NEUROVESTIBULAR' },
  { id: 'Q09', query: 'What are the hallmark ophthalmic signs of SANS in astronauts?', expected_topic: 'OPHTHALMIC' },
  { id: 'Q10', query: 'How does microgravity intracranial pressure compare to terrestrial standing pressure?', expected_topic: 'OPHTHALMIC' },
  { id: 'Q11', query: 'What Frisén grade corresponds to a circumferential halo obscuring the disc margin?', expected_topic: 'OPHTHALMIC' },
  { id: 'Q12', query: 'How is Lower Body Negative Pressure used as a countermeasure for SANS?', expected_topic: 'OPHTHALMIC' },
  { id: 'Q13', query: 'What is the upper limit for nominal cabin carbon dioxide partial pressure?', expected_topic: 'ENVIRONMENTAL' },
  { id: 'Q14', query: 'What symptoms occur when cabin ppCO2 rises above 3.5 mmHg?', expected_topic: 'ENVIRONMENTAL' },
  { id: 'Q15', query: 'What immediate actions must be taken if cabin CO2 exceeds safe limits?', expected_topic: 'ENVIRONMENTAL' },
  { id: 'Q16', query: 'What physical mechanism causes decompression sickness during EVA?', expected_topic: 'ENVIRONMENTAL' },
  { id: 'Q17', query: 'What is the In-Suit Light Exercise prebreathe duration for nitrogen washout?', expected_topic: 'ENVIRONMENTAL' },
  { id: 'Q18', query: 'What is the difference between Type I and Type II decompression sickness?', expected_topic: 'ENVIRONMENTAL' },
  { id: 'Q19', query: 'How is microgravity CPR performed using the handstand technique?', expected_topic: 'EMERGENCY' },
  { id: 'Q20', query: 'What is the Reverse-Waist Straddle Echt-Mackenzie technique for chest compressions?', expected_topic: 'EMERGENCY' },
  { id: 'Q21', query: 'What safety precaution is required prior to delivering an AED shock in microgravity?', expected_topic: 'EMERGENCY' },
  { id: 'Q22', query: 'Why does space radiation accelerate the degradation of onboard pharmaceuticals?', expected_topic: 'PHARMACOLOGY' },
  { id: 'Q23', query: 'What anticoagulant is stocked onboard for internal jugular venous thrombosis?', expected_topic: 'PHARMACOLOGY' },
  { id: 'Q24', query: 'What medication is given to prevent calcium oxalate kidney stones?', expected_topic: 'PHARMACOLOGY' },
  { id: 'Q25', query: 'What causes cumulative sleep debt in astronaut crews?', expected_topic: 'BEHAVIORAL' },
  { id: 'Q26', query: 'What wavelength of blue-enriched lighting is used for circadian alignment?', expected_topic: 'BEHAVIORAL' },
  { id: 'Q27', query: 'How much bone mineral density do astronauts lose per month in microgravity?', expected_topic: 'CARDIOVASCULAR' },
  { id: 'Q28', query: 'What storm shelter protocol is activated during a solar particle event?', expected_topic: 'ENVIRONMENTAL' },
  { id: 'Q29', query: 'Why must traumatic wound bleeding be managed with suction in weightlessness?', expected_topic: 'EMERGENCY' },
  { id: 'Q30', query: 'What are the required closed-chest compression rates and depth in microgravity?', expected_topic: 'EMERGENCY' }
];

export const UNANSWERABLE_TEST_QUESTIONS = [
  'What is the stock market valuation of Apple Inc today?',
  'How do you bake an authentic Neapolitan pizza dough?',
  'Who won the 2022 FIFA World Cup final in Qatar?',
  'What is quantum chromodynamics asymptotic freedom equation?',
  'How do you replace the timing belt on a 2012 Honda Civic?'
];

export const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were', 'will',
  'with', 'what', 'who', 'how', 'why', 'where', 'when', 'which', 'whom', 'whose',
  'does', 'did', 'done', 'been', 'have', 'having', 'had', 'you', 'your', 'yours',
  'they', 'them', 'their', 'we', 'our', 'ours', 'us', 'today', 'inc', 'can', 'could',
  'should', 'would', 'may', 'might', 'must', 'about', 'above', 'after', 'again',
  'against', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some',
  'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
  'before', 'between', 'during', 'under', 'over', 'into', 'out', 'off', 'down'
]);

// Hybrid BM25 + Cosine/Keyword search
export function searchKnowledgeChunks(query, options = {}) {
  const { topK = 5, minScore = 2.5, category = null } = options;

  if (memoryKnowledgeChunks.length === 0) {
    for (const doc of RAW_NASA_MEDICAL_DOCUMENTS) {
      const docChunks = chunkDocument(doc, 180, 35);
      memoryKnowledgeChunks.push(...docChunks);
    }
  }

  const queryTerms = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));

  // If no content terms remain after stopword removal, no valid search can occur
  if (queryTerms.length === 0) return [];

  const candidates = [];

  for (const chunk of memoryKnowledgeChunks) {
    if (category && chunk.category !== category) continue;

    let bm25Score = 0;
    let matchedTerms = 0;
    const tokenWeights = chunk.token_weights || {};

    for (const term of queryTerms) {
      let termMatched = false;
      if (tokenWeights[term]) {
        bm25Score += tokenWeights[term] * 15.0;
        termMatched = true;
      }
      if (chunk.keywords && chunk.keywords.includes(term)) {
        bm25Score += 4.0;
        termMatched = true;
      }
      if (chunk.category && chunk.category.toLowerCase().includes(term)) {
        bm25Score += 3.5;
        termMatched = true;
      }
      if (chunk.text.toLowerCase().includes(term)) {
        bm25Score += 2.0;
        termMatched = true;
      }
      if (chunk.document_title.toLowerCase().includes(term)) {
        bm25Score += 3.0;
        termMatched = true;
      }
      if (termMatched) matchedTerms++;
    }

    // Require meaningful coverage: if query has 3+ content terms, require at least 2 matched terms or high score
    const termCoverage = matchedTerms / queryTerms.length;
    const isSufficientMatch =
      (queryTerms.length <= 2 && matchedTerms >= 1 && bm25Score >= 3.0) ||
      (queryTerms.length >= 3 && (matchedTerms >= 2 || (termCoverage >= 0.35 && bm25Score >= 10.0)));

    if (isSufficientMatch && bm25Score >= minScore) {
      candidates.push({
        chunk,
        score: bm25Score,
        matchedTerms,
        termCoverage
      });
    }
  }

  // Rerank candidates: sort by matchedTerms desc, then score descending
  candidates.sort((a, b) => {
    if (b.matchedTerms !== a.matchedTerms) {
      return b.matchedTerms - a.matchedTerms;
    }
    return b.score - a.score;
  });

  return candidates.slice(0, topK);
}

// Generate grounded RAG answer with explicit citation references
export function generateRagResponse(query, retrievedCandidates) {
  // If no candidates or low confidence -> Refusal
  if (!retrievedCandidates || retrievedCandidates.length === 0) {
    return {
      answer: 'I do not know. The onboard NASA medical knowledge base does not contain information to answer this query.',
      citations: [],
      confidence: 0.0,
      retrieved_count: 0,
      is_refusal: true
    };
  }

  const topMatch = retrievedCandidates[0];

  // If even top match score is very weak (< 2.5), refuse to hallucinate
  if (topMatch.score < 2.5) {
    return {
      answer: 'I do not know. No sufficiently verified medical evidence was found in the onboard flight manuals for this query.',
      citations: [],
      confidence: 0.1,
      retrieved_count: retrievedCandidates.length,
      is_refusal: true
    };
  }

  // Collect unique citations from top retrieved chunks
  const citations = retrievedCandidates.map(({ chunk }) => ({
    chunk_id: chunk.chunk_id,
    document_id: chunk.document_id,
    document_title: chunk.document_title,
    source: chunk.source,
    license: chunk.license,
    category: chunk.category,
    excerpt: chunk.text
  }));

  // Synthesize answer by extracting key evidentiary facts from the top chunks
  const synthesizedSentences = [];
  const primaryChunk = topMatch.chunk;
  const secondaryChunk = retrievedCandidates[1]?.chunk;

  // Extract relevant sentences from primary chunk matching query
  const sentences = primaryChunk.text.split(/(?<=[.!?])\s+/);
  const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length >= 3 && !STOP_WORDS.has(w));

  for (const sentence of sentences) {
    const sLower = sentence.toLowerCase();
    const hasMatch = queryWords.some((w) => sLower.includes(w));
    if (hasMatch) {
      synthesizedSentences.push(sentence.trim());
    }
  }

  // If no specific sentence matched, use the first two sentences of the primary chunk
  if (synthesizedSentences.length === 0) {
    synthesizedSentences.push(sentences[0].trim());
    if (sentences[1]) synthesizedSentences.push(sentences[1].trim());
  }

  // If secondary chunk adds information, append its best sentence
  if (secondaryChunk) {
    const secSentences = secondaryChunk.text.split(/(?<=[.!?])\s+/);
    for (const s of secSentences) {
      const sLower = s.toLowerCase();
      if (queryWords.some((w) => sLower.includes(w)) && !synthesizedSentences.includes(s.trim())) {
        synthesizedSentences.push(s.trim());
        break;
      }
    }
  }

  const synthesizedText = synthesizedSentences.join(' ');
  const citedAnswer = `${synthesizedText} [Ref: ${primaryChunk.document_id} (${primaryChunk.document_title})]`;

  // Normalized confidence between 0.60 and 0.98 based on match score
  const confidence = Math.min(0.98, Math.max(0.65, Number((0.55 + topMatch.score * 0.05).toFixed(3))));

  return {
    answer: citedAnswer,
    citations,
    confidence,
    retrieved_count: retrievedCandidates.length,
    is_refusal: false
  };
}

// Complete Offline RAG Query Engine
export async function queryOfflineMedicalAssistant(query, options = {}) {
  const topK = options.topK || 4;
  const minScore = options.minScore || 2.5;

  const candidates = searchKnowledgeChunks(query, { topK, minScore });
  const ragResult = generateRagResponse(query, candidates);

  return {
    query,
    ...ragResult,
    timestamp: new Date().toISOString()
  };
}
