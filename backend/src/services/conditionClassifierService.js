import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { ConditionClassification } from '../models/ConditionClassification.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SUPPORTED_CONDITIONS = [
  'DEHYDRATION',
  'ACUTE_INFECTION',
  'CO2_EXPOSURE',
  'FATIGUE_EXHAUSTION',
  'ACUTE_ANXIETY_PANIC',
  'DECOMPRESSION_SICKNESS_DCS',
  'NOMINAL_HEALTHY'
];

export const CONDITION_PROFILES = {
  DEHYDRATION: {
    description: 'Reduced intravascular volume and electrolyte depletion from fluid intake deficit or microgravity diuresis.',
    severity: 'WARNING',
    eval: (f) => {
      let score = 0;
      if (f.heart_rate >= 88) score += 3.5;
      if (f.systolic_bp && f.systolic_bp < 105) score += 3.0;
      if (f.symptom_tags?.includes('DRY_MOUTH') || f.symptom_tags?.includes('THIRST')) score += 3.0;
      if (f.urine_output_ml_day && f.urine_output_ml_day < 1200) score += 2.5;
      if (f.temperature && f.temperature < 37.5) score += 1.0;
      return score;
    }
  },

  ACUTE_INFECTION: {
    description: 'Systemic inflammatory or microbial infection presenting with fever, tachycardia, and tachypnea.',
    severity: 'CRITICAL',
    eval: (f) => {
      let score = 0;
      if (f.temperature >= 38.0) score += 5.5;
      else if (f.temperature >= 37.6) score += 2.5;
      if (f.heart_rate >= 95) score += 3.0;
      if (f.respiration_rate >= 20) score += 2.5;
      if (f.symptom_tags?.includes('CHILLS') || f.symptom_tags?.includes('MALAISE')) score += 3.0;
      return score;
    }
  },

  CO2_EXPOSURE: {
    description: 'Elevated partial pressure of cabin carbon dioxide causing respiratory acidosis and vascular headache.',
    severity: 'CRITICAL',
    eval: (f) => {
      let score = 0;
      if (f.cabin_co2 >= 3.8) score += 6.0;
      else if (f.cabin_co2 >= 2.8) score += 3.5;
      if (f.symptom_tags?.includes('HEADACHE') || f.symptom_tags?.includes('COGNITIVE_FOG')) score += 3.5;
      if (f.respiration_rate >= 20) score += 2.0;
      if (f.systolic_bp && f.systolic_bp >= 135) score += 1.5;
      return score;
    }
  },

  FATIGUE_EXHAUSTION: {
    description: 'Acute or cumulative circadian sleep deprivation with autonomic exhaustion and cognitive degradation.',
    severity: 'WARNING',
    eval: (f) => {
      let score = 0;
      if (f.sleep_debt_hours >= 4.5) score += 5.0;
      else if (f.sleep_debt_hours >= 2.5) score += 2.5;
      if (f.symptom_tags?.includes('DROWSINESS') || f.symptom_tags?.includes('EYE_STRAIN')) score += 3.0;
      if (f.temperature && f.temperature < 37.4) score += 1.5;
      if (f.heart_rate && f.heart_rate < 85) score += 1.0;
      return score;
    }
  },

  ACUTE_ANXIETY_PANIC: {
    description: 'Acute sympathetic autonomic surge presenting with sudden tachycardia, hyperventilation, and normal cabin environment.',
    severity: 'WARNING',
    eval: (f) => {
      let score = 0;
      if (f.heart_rate >= 105) score += 4.0;
      if (f.respiration_rate >= 24) score += 3.5;
      if (f.spo2 >= 97) score += 2.0; // Rule-out hypoxia
      if (f.cabin_co2 && f.cabin_co2 < 2.5) score += 1.5; // Rule-out CO2
      if (f.symptom_tags?.includes('PALPITATIONS') || f.symptom_tags?.includes('PANIC')) score += 3.5;
      return score;
    }
  },

  DECOMPRESSION_SICKNESS_DCS: {
    description: 'Nitrogen gas emboli and microbubble formation in tissues due to rapid hypobaric depressurization.',
    severity: 'CRITICAL',
    eval: (f) => {
      let score = 0;
      if (f.ambient_pressure_psi && f.ambient_pressure_psi < 10.0) score += 4.5;
      if (f.spo2 && f.spo2 < 93.0) score += 3.5;
      if (f.symptom_tags?.includes('JOINT_PAIN') || f.symptom_tags?.includes('BENDS')) score += 5.0;
      if (f.is_post_eva) score += 3.0;
      return score;
    }
  },

  NOMINAL_HEALTHY: {
    description: 'All physiological telemetry and cabin environmental parameters within baseline flight limits.',
    severity: 'INFO',
    eval: (f) => {
      let score = 0;
      const hrNominal = f.heart_rate >= 50 && f.heart_rate <= 80;
      const spo2Nominal = (f.spo2 ?? 98) >= 96;
      const tempNominal = (f.temperature ?? 36.8) >= 36.4 && (f.temperature ?? 36.8) <= 37.3;
      const co2Nominal = (f.cabin_co2 ?? 1.5) < 2.5;
      const sleepNominal = (f.sleep_debt_hours ?? 0) < 2.0;

      if (hrNominal) score += 2.0;
      if (spo2Nominal) score += 2.0;
      if (tempNominal) score += 2.0;
      if (co2Nominal) score += 2.0;
      if (sleepNominal) score += 2.0;
      if (!f.symptom_tags || f.symptom_tags.length === 0) score += 2.0;
      return score;
    }
  }
};

// Classify condition from physiological and environmental features
export function classifyCondition(features, options = {}) {
  const abstainThreshold = options.abstain_threshold ?? 0.38;

  // 1. Calculate raw logits
  const logits = {};
  for (const cond of SUPPORTED_CONDITIONS) {
    const evaluator = CONDITION_PROFILES[cond]?.eval;
    logits[cond] = evaluator ? evaluator(features) : 0;
  }

  // 2. Softmax transformation with temperature scaling
  const temp = options.temperature ?? 1.5;
  const expLogits = {};
  let sumExp = 0;
  for (const [cond, score] of Object.entries(logits)) {
    const val = Math.exp(score / temp);
    expLogits[cond] = val;
    sumExp += val;
  }

  const probabilities = {};
  for (const [cond, expVal] of Object.entries(expLogits)) {
    probabilities[cond] = Number((expVal / sumExp).toFixed(4));
  }

  // 3. Sort descending
  const sorted = Object.entries(probabilities)
    .sort((a, b) => b[1] - a[1])
    .map(([cond, prob]) => ({
      condition: cond,
      probability: prob,
      clinical_description: CONDITION_PROFILES[cond]?.description || '',
      severity_category: CONDITION_PROFILES[cond]?.severity || 'INFO'
    }));

  const top3 = sorted.slice(0, 3);
  const primary = top3[0];

  // 4. Entropy calculation
  let entropy = 0;
  for (const p of Object.values(probabilities)) {
    if (p > 1e-6) {
      entropy -= p * Math.log(p);
    }
  }

  // 5. Check abstention criteria: low top probability or high entropy
  const isUnsure = primary.probability < abstainThreshold || entropy > 1.68;
  const isAbstained = options.allow_abstain !== false && isUnsure;

  return {
    primary_condition: isAbstained ? 'UNRESOLVED_AMBIGUOUS' : primary.condition,
    confidence: primary.probability,
    entropy: Number(entropy.toFixed(3)),
    is_abstained: isAbstained,
    abstention_reason: isAbstained
      ? `Clinical features are ambiguous across multiple differential diagnoses (top probability: ${Math.round(primary.probability * 100)}% < ${Math.round(abstainThreshold * 100)}%, entropy: ${Number(entropy.toFixed(2))}). Decision abstained; Flight Surgeon consult recommended.`
      : null,
    top_conditions: top3,
    all_probabilities: probabilities
  };
}

// Classify condition and persist to DB
export async function evaluateAndSaveCondition(crewId, features, options = {}) {
  const result = classifyCondition(features, options);
  const classificationId = `cls-${crypto.randomBytes(4).toString('hex')}`;

  const doc = await ConditionClassification.create({
    classification_id: classificationId,
    crew_id: crewId,
    timestamp: options.timestamp || new Date(),
    top_conditions: result.top_conditions,
    primary_condition: result.primary_condition,
    confidence: result.confidence,
    is_abstained: result.is_abstained,
    abstention_reason: result.abstention_reason,
    features_snapshot: features,
    source: options.source || 'LIVE'
  });

  return {
    classification_id: classificationId,
    crew_id: crewId,
    ...result,
    created_at: doc.createdAt
  };
}

// 70 Labeled test scenario cases (10 per condition class) for Macro-F1 & Confusion Matrix validation
export function generateValidationScenarios() {
  const cases = [];

  // 1. DEHYDRATION (10 cases)
  for (let i = 0; i < 10; i++) {
    cases.push({
      true_label: 'DEHYDRATION',
      features: {
        heart_rate: 90 + i,
        systolic_bp: 98 - i * 0.5,
        temperature: 36.9,
        cabin_co2: 1.8,
        sleep_debt_hours: 1.0,
        symptom_tags: ['DRY_MOUTH', 'THIRST'],
        urine_output_ml_day: 900
      }
    });
  }

  // 2. ACUTE_INFECTION (10 cases)
  for (let i = 0; i < 10; i++) {
    cases.push({
      true_label: 'ACUTE_INFECTION',
      features: {
        heart_rate: 100 + i,
        temperature: 38.2 + i * 0.1,
        respiration_rate: 22,
        cabin_co2: 1.5,
        symptom_tags: ['FEVER', 'CHILLS', 'MALAISE']
      }
    });
  }

  // 3. CO2_EXPOSURE (10 cases)
  for (let i = 0; i < 10; i++) {
    cases.push({
      true_label: 'CO2_EXPOSURE',
      features: {
        cabin_co2: 4.2 + i * 0.2,
        heart_rate: 82,
        temperature: 36.8,
        systolic_bp: 140,
        respiration_rate: 22,
        symptom_tags: ['HEADACHE', 'COGNITIVE_FOG']
      }
    });
  }

  // 4. FATIGUE_EXHAUSTION (10 cases)
  for (let i = 0; i < 10; i++) {
    cases.push({
      true_label: 'FATIGUE_EXHAUSTION',
      features: {
        sleep_debt_hours: 5.5 + i * 0.3,
        heart_rate: 68,
        temperature: 36.6,
        cabin_co2: 1.6,
        symptom_tags: ['DROWSINESS', 'EYE_STRAIN']
      }
    });
  }

  // 5. ACUTE_ANXIETY_PANIC (10 cases)
  for (let i = 0; i < 10; i++) {
    cases.push({
      true_label: 'ACUTE_ANXIETY_PANIC',
      features: {
        heart_rate: 115 + i * 2,
        respiration_rate: 28 + i * 0.5,
        spo2: 99,
        temperature: 36.9,
        cabin_co2: 1.4,
        symptom_tags: ['PALPITATIONS', 'PANIC']
      }
    });
  }

  // 6. DECOMPRESSION_SICKNESS_DCS (10 cases)
  for (let i = 0; i < 10; i++) {
    cases.push({
      true_label: 'DECOMPRESSION_SICKNESS_DCS',
      features: {
        ambient_pressure_psi: 8.5 - i * 0.2,
        spo2: 91 - i * 0.3,
        heart_rate: 88,
        is_post_eva: true,
        symptom_tags: ['JOINT_PAIN', 'BENDS']
      }
    });
  }

  // 7. NOMINAL_HEALTHY (10 cases)
  for (let i = 0; i < 10; i++) {
    cases.push({
      true_label: 'NOMINAL_HEALTHY',
      features: {
        heart_rate: 62 + (i % 5),
        spo2: 98,
        temperature: 36.8,
        cabin_co2: 1.5,
        sleep_debt_hours: 0.5,
        symptom_tags: []
      }
    });
  }

  return cases;
}

// Evaluate Macro-F1 and confusion matrix across validation scenarios
export function evaluateConditionClassifier(outputPath) {
  const scenarios = generateValidationScenarios();
  const classes = SUPPORTED_CONDITIONS;
  const K = classes.length;

  // Initialize confusion matrix K x K
  const matrix = {};
  for (const c1 of classes) {
    matrix[c1] = {};
    for (const c2 of classes) {
      matrix[c1][c2] = 0;
    }
  }

  let totalCorrect = 0;

  for (const item of scenarios) {
    const res = classifyCondition(item.features, { allow_abstain: false });
    const pred = res.primary_condition;
    if (matrix[item.true_label] && matrix[item.true_label][pred] !== undefined) {
      matrix[item.true_label][pred]++;
    }
    if (pred === item.true_label) {
      totalCorrect++;
    }
  }

  // Compute precision, recall, and F1 per class
  const classMetrics = {};
  let sumF1 = 0;

  for (const cls of classes) {
    const tp = matrix[cls][cls];
    let fn = 0;
    for (const other of classes) {
      if (other !== cls) fn += matrix[cls][other];
    }
    let fp = 0;
    for (const other of classes) {
      if (other !== cls) fp += matrix[other][cls];
    }

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    classMetrics[cls] = {
      tp,
      fp,
      fn,
      precision: Number(precision.toFixed(3)),
      recall: Number(recall.toFixed(3)),
      f1_score: Number(f1.toFixed(3))
    };
    sumF1 += f1;
  }

  const macroF1 = Number((sumF1 / K).toFixed(3));
  const accuracy = Number((totalCorrect / scenarios.length).toFixed(3));

  const report = {
    model: 'ConditionClassifier_Bayesian_Softmax_F045',
    macro_f1: macroF1,
    accuracy,
    total_samples: scenarios.length,
    classes,
    confusion_matrix: matrix,
    class_metrics: classMetrics,
    evaluated_at: new Date().toISOString()
  };

  const target = outputPath || path.join(__dirname, '../../../build/reports/confusion_matrix_F045.json');
  fs.writeFileSync(target, JSON.stringify(report, null, 2), 'utf8');
  return report;
}
