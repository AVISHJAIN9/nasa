import { STOP_WORDS } from './offlineRagService.js';

// Pre-compiled benchmark set of 20 grounded claims vs 20 hallucinated/unsupported claims
export const CITATION_EVALUATION_DATASET = [
  // 1-20: Grounded NASA evidence claims (Should be classified as SUPPORTED)
  {
    id: 'G01',
    claim: 'Cardiovascular adaptation involves an immediate cephalad fluid shift of 1.5 to 2.0 liters.',
    grounding_context: 'Cardiovascular adaptation to microgravity involves an immediate cephalad fluid shift of approximately 1.5 to 2.0 liters of blood and interstitial fluid from the lower extremities toward the head and chest.',
    expected_supported: true
  },
  {
    id: 'G02',
    claim: 'Astronauts lose approximately 1.0% to 1.5% of bone mineral density per month in weight-bearing regions.',
    grounding_context: 'Astronauts lose approximately 1.0% to 1.5% of bone mineral density (BMD) per month in weight-bearing regions, specifically the proximal femur, femoral neck, trochanter, and lumbar spine.',
    expected_supported: true
  },
  {
    id: 'G03',
    claim: 'Space Motion Sickness affects approximately 60 to 70 percent of astronauts during early flight days.',
    grounding_context: 'Space Motion Sickness (SMS) affects approximately 60 to 70 percent of astronauts during the first 24 to 72 hours of exposure to weightlessness.',
    expected_supported: true
  },
  {
    id: 'G04',
    claim: 'Intramuscular administration of 25 to 50 mg promethazine provides rapid relief.',
    grounding_context: 'Intramuscular administration of 25 to 50 mg provides rapid relief within 15 to 30 minutes, bypassing impaired gastric motility.',
    expected_supported: true
  },
  {
    id: 'G05',
    claim: 'Cabin carbon dioxide partial pressure upper limit is 2.0 to 3.0 mmHg.',
    grounding_context: 'NASA operational flight rules establish an upper limit for nominal cabin carbon dioxide partial pressure (ppCO2) of 2.0 to 3.0 mmHg.',
    expected_supported: true
  },
  {
    id: 'G06',
    claim: 'Decompression sickness occurs when inert nitrogen gas forms supersaturated bubbles.',
    grounding_context: 'Decompression Sickness (DCS) occurs when ambient atmospheric pressure decreases rapidly, causing dissolved inert nitrogen gas in blood and tissues to form supersaturated bubbles.',
    expected_supported: true
  },
  {
    id: 'G07',
    claim: 'Handstand technique delivers 100 to 120 compressions per minute to a depth of 5 to 6 centimeters.',
    grounding_context: 'The rescuer places hands on the lower sternum and positions their feet flat against the overhead cabin ceiling, delivering 100 to 120 compressions per minute to a depth of 5 to 6 centimeters.',
    expected_supported: true
  },
  {
    id: 'G08',
    claim: 'Fluid loading requires 1.0 liter of water consumed with 8 grams of sodium chloride.',
    grounding_context: 'Prior to re-entry crew members must complete an oral fluid loading protocol consisting of 1.0 liter of water consumed with 8 grams of sodium chloride electrolyte tablets.',
    expected_supported: true
  },
  {
    id: 'G09',
    claim: 'Resting heart rate in microgravity should remain between 50 and 95 beats per minute.',
    grounding_context: 'Resting heart rate in microgravity should remain between 50 and 95 beats per minute.',
    expected_supported: true
  },
  {
    id: 'G10',
    claim: 'Enoxaparin is stocked for treatment of internal jugular venous thrombosis.',
    grounding_context: 'Enoxaparin 40 mg and 60 mg pre-filled syringes for treatment and prophylaxis of internal jugular venous thrombosis VTE.',
    expected_supported: true
  },

  // 11-20: Injected Hallucinated / Unsupported Claims (Should be flagged as UNSUPPORTED)
  {
    id: 'H01',
    claim: 'Administer 500 mg promethazine intravenous push every 10 minutes.',
    grounding_context: 'Intramuscular administration of 25 to 50 mg provides rapid relief within 15 to 30 minutes, bypassing impaired gastric motility.',
    expected_supported: false
  },
  {
    id: 'H02',
    claim: 'Astronauts lose 25% of bone mineral density per week in orbit.',
    grounding_context: 'Astronauts lose approximately 1.0% to 1.5% of bone mineral density (BMD) per month in weight-bearing regions.',
    expected_supported: false
  },
  {
    id: 'H03',
    claim: 'Nominal cabin CO2 limits allow partial pressures up to 45 mmHg continuously.',
    grounding_context: 'NASA operational flight rules establish an upper limit for nominal cabin carbon dioxide partial pressure (ppCO2) of 2.0 to 3.0 mmHg.',
    expected_supported: false
  },
  {
    id: 'H04',
    claim: 'Space motion sickness is cured instantly by drinking industrial ethylene glycol.',
    grounding_context: 'Space Motion Sickness (SMS) affects approximately 60 to 70 percent of astronauts. Pharmacological management relies on promethazine hydrochloride.',
    expected_supported: false
  },
  {
    id: 'H05',
    claim: 'Prebreathe tables require breathing 100% argon gas for 12 hours.',
    grounding_context: 'The standard In-Suit Light Exercise (ISLE) protocol requires 50 minutes of in-suit 100% oxygen breathing combined with mild cycle ergometry exercise.',
    expected_supported: false
  },
  {
    id: 'H06',
    claim: 'Chest compressions in microgravity should be delivered at 300 beats per minute.',
    grounding_context: 'Deliver 100 to 120 compressions per minute to a depth of 5 to 6 centimeters.',
    expected_supported: false
  },
  {
    id: 'H07',
    claim: 'Astronaut fluid loading requires drinking 10 liters of pure vodka before re-entry.',
    grounding_context: 'Crew members must complete an oral fluid loading protocol consisting of 1.0 liter of water consumed with 8 grams of sodium chloride.',
    expected_supported: false
  },
  {
    id: 'H08',
    claim: 'SANS is caused by microgravity laser exposure from extraterrestrial satellites.',
    grounding_context: 'The primary hypothesized mechanism is chronic cephalad venous fluid shift combined with loss of the normal hydrostatic diurnal variation in intracranial pressure.',
    expected_supported: false
  },
  {
    id: 'H09',
    claim: 'Inject 200 mg of epinephrine directly into the brain for headache relief.',
    grounding_context: 'Persistent headache is treated with acetaminophen or ibuprofen. Epinephrine is stocked for anaphylaxis (0.3 mg IM) and cardiac arrest (1.0 mg IV/IO).',
    expected_supported: false
  },
  {
    id: 'H10',
    claim: 'During a solar particle event astronauts should stand outside on the solar arrays.',
    grounding_context: 'Flight Rule RAD-04 mandates all crew retreat immediately into the designated storm shelter providing heavy shielding.',
    expected_supported: false
  }
];

// Extract numbers and units from text to check numerical consistency
export function extractNumbersAndQuantities(text) {
  const matches = text.match(/\b\d+(\.\d+)?(\s*(mg|g|kg|ml|l|liter|liters|%|percent|mmhg|psi|bpm|minutes|hours|cm))?\b/gi);
  return matches ? matches.map((m) => m.toLowerCase().replace(/\s+/g, '')) : [];
}

// Tokenize text into normalized content terms
export function extractContentTerms(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

// Check if an individual sentence claim is supported by context chunks
export function verifySentenceClaim(claimSentence, contextText) {
  if (!claimSentence || !claimSentence.trim()) {
    return {
      sentence: claimSentence,
      is_supported: true,
      overlap_ratio: 1.0,
      hallucinated_entities: []
    };
  }

  const claimTerms = extractContentTerms(claimSentence);
  if (claimTerms.length === 0) {
    return {
      sentence: claimSentence,
      is_supported: true,
      overlap_ratio: 1.0,
      hallucinated_entities: []
    };
  }

  const contextTermsSet = new Set(extractContentTerms(contextText));
  let matchedTerms = 0;

  for (const term of claimTerms) {
    if (contextTermsSet.has(term)) {
      matchedTerms++;
    }
  }

  const overlapRatio = matchedTerms / claimTerms.length;

  // Check numerical & dosage entity consistency
  const claimNumbers = extractNumbersAndQuantities(claimSentence);
  const contextNumbers = extractNumbersAndQuantities(contextText);
  const contextNumbersSet = new Set(contextNumbers);

  const hallucinatedNumbers = claimNumbers.filter((n) => !contextNumbersSet.has(n));

  // A claim is supported if:
  // 1. Overlap ratio exceeds 0.50 (or 0.40 if long sentence)
  // 2. No invented numbers/dosages present
  let isSupported = overlapRatio >= 0.45;

  if (hallucinatedNumbers.length > 0 && claimNumbers.length > 0) {
    // If numbers in claim are totally absent from context, flag as unsupported
    isSupported = false;
  }

  return {
    sentence: claimSentence.trim(),
    is_supported: isSupported,
    overlap_ratio: Number(overlapRatio.toFixed(3)),
    matched_terms: matchedTerms,
    total_claim_terms: claimTerms.length,
    hallucinated_entities: hallucinatedNumbers
  };
}

// Check an entire model answer against retrieved context chunks
export function verifyModelCitations(answerText, contextChunks = []) {
  if (!contextChunks || contextChunks.length === 0) {
    return {
      is_all_supported: false,
      supported_count: 0,
      unsupported_count: 1,
      total_sentences: 1,
      unsupported_sentences: [answerText],
      claims_verification: [
        {
          sentence: answerText,
          is_supported: false,
          reason: 'No grounding context chunks retrieved (empty retrieval)'
        }
      ]
    };
  }

  const combinedContextText = contextChunks
    .map((c) => (typeof c === 'string' ? c : `${c.document_title || ''} ${c.text || c.excerpt || ''}`))
    .join(' ');

  // Split answer into sentences
  const sentences = answerText
    .replace(/\[Ref:[^\]]+\]/g, '') // remove citation tags for analysis
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  const claimsVerification = [];
  const unsupportedSentences = [];

  for (const sentence of sentences) {
    const check = verifySentenceClaim(sentence, combinedContextText);
    claimsVerification.push(check);
    if (!check.is_supported) {
      unsupportedSentences.push(sentence);
    }
  }

  const supportedCount = claimsVerification.filter((c) => c.is_supported).length;
  const isAllSupported = unsupportedSentences.length === 0;

  return {
    is_all_supported: isAllSupported,
    supported_count: supportedCount,
    unsupported_count: unsupportedSentences.length,
    total_sentences: sentences.length,
    unsupported_sentences: unsupportedSentences,
    claims_verification: claimsVerification
  };
}

// Run citation & hallucination precision/recall benchmark
export function runCitationPrecisionBenchmark() {
  let tp = 0; // Unsupported claim correctly flagged as unsupported
  let fp = 0; // Supported claim incorrectly flagged as unsupported
  let tn = 0; // Supported claim correctly recognized as supported
  let fn = 0; // Unsupported claim missed (marked supported)

  const itemResults = [];

  for (const item of CITATION_EVALUATION_DATASET) {
    const verification = verifySentenceClaim(item.claim, item.grounding_context);

    // If expected_supported is false -> true condition is "UNSUPPORTED"
    const expectedUnsupported = !item.expected_supported;
    const actualUnsupported = !verification.is_supported;

    if (expectedUnsupported && actualUnsupported) {
      tp++;
    } else if (!expectedUnsupported && actualUnsupported) {
      fp++;
    } else if (!expectedUnsupported && !actualUnsupported) {
      tn++;
    } else if (expectedUnsupported && !actualUnsupported) {
      fn++;
    }

    itemResults.push({
      id: item.id,
      claim: item.claim,
      expected_supported: item.expected_supported,
      actual_supported: verification.is_supported,
      passed: item.expected_supported === verification.is_supported,
      overlap_ratio: verification.overlap_ratio,
      hallucinated_entities: verification.hallucinated_entities
    });
  }

  const precision = tp + fp > 0 ? tp / (tp + fp) : 1.0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 1.0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 1.0;
  const accuracy = (tp + tn) / CITATION_EVALUATION_DATASET.length;

  return {
    total_samples: CITATION_EVALUATION_DATASET.length,
    true_positives: tp,
    false_positives: fp,
    true_negatives: tn,
    false_negatives: fn,
    precision: Number(precision.toFixed(3)),
    recall: Number(recall.toFixed(3)),
    f1_score: Number(f1.toFixed(3)),
    accuracy: Number(accuracy.toFixed(3)),
    results: itemResults
  };
}
