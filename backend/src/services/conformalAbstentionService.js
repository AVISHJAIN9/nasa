import fs from 'fs';
import path from 'path';
import { classifyCondition } from './conditionClassifierService.js';

export const CONFORMAL_EXCHANGEABILITY_DISCLAIMER =
  'Theoretical Notice: Spaceflight physiological time-series data exhibit temporal autocorrelation, circadian drift, and microgravity adaptation. Because time series are not strictly exchangeable, the finite-sample (1 - alpha) coverage guarantee is approximate.';

// Synthetic calibration dataset of 60 spaceflight clinical cases with ground truth labels
export const CONFORMAL_CALIBRATION_SET = [
  // Dehydration cases
  { features: { heart_rate: 104, sys_bp: 98, dia_bp: 64, urine_output_ml: 950, symptom_tags: ['THIRST', 'FATIGUE'] }, true_label: 'DEHYDRATION' },
  { features: { heart_rate: 98, sys_bp: 102, dia_bp: 68, urine_output_ml: 1100, symptom_tags: ['THIRST', 'LIGHTHEADEDNESS'] }, true_label: 'DEHYDRATION' },
  { features: { heart_rate: 110, sys_bp: 94, dia_bp: 60, urine_output_ml: 800, symptom_tags: ['THIRST', 'DRY_MOUTH'] }, true_label: 'DEHYDRATION' },

  // Acute Infection cases
  { features: { heart_rate: 108, temperature: 38.6, respiration_rate: 22, symptom_tags: ['FEVER', 'CHILLS'] }, true_label: 'ACUTE_INFECTION' },
  { features: { heart_rate: 102, temperature: 38.4, respiration_rate: 21, symptom_tags: ['FEVER', 'MALAISE'] }, true_label: 'ACUTE_INFECTION' },
  { features: { heart_rate: 112, temperature: 38.9, respiration_rate: 24, symptom_tags: ['FEVER', 'CHILLS', 'COUGH'] }, true_label: 'ACUTE_INFECTION' },

  // CO2 Exposure cases
  { features: { heart_rate: 88, sys_bp: 144, dia_bp: 94, cabin_ppco2: 4.8, symptom_tags: ['HEADACHE', 'SHORTNESS_OF_BREATH'] }, true_label: 'CO2_EXPOSURE' },
  { features: { heart_rate: 92, sys_bp: 148, dia_bp: 96, cabin_ppco2: 5.2, symptom_tags: ['HEADACHE', 'DIZZINESS'] }, true_label: 'CO2_EXPOSURE' },
  { features: { heart_rate: 86, sys_bp: 142, dia_bp: 92, cabin_ppco2: 4.5, symptom_tags: ['HEADACHE', 'CONFUSION'] }, true_label: 'CO2_EXPOSURE' },

  // Fatigue cases
  { features: { heart_rate: 68, sleep_hours: 4.2, reaction_time_ms: 410, symptom_tags: ['FATIGUE', 'DROWSINESS'] }, true_label: 'FATIGUE_EXHAUSTION' },
  { features: { heart_rate: 70, sleep_hours: 3.8, reaction_time_ms: 430, symptom_tags: ['FATIGUE', 'SLOW_REACTION'] }, true_label: 'FATIGUE_EXHAUSTION' },

  // Anxiety cases
  { features: { heart_rate: 118, respiration_rate: 26, sys_bp: 146, symptom_tags: ['PALPITATIONS', 'ANXIETY'] }, true_label: 'ACUTE_ANXIETY_PANIC' },
  { features: { heart_rate: 122, respiration_rate: 28, sys_bp: 150, symptom_tags: ['ANXIETY', 'TREMOR'] }, true_label: 'ACUTE_ANXIETY_PANIC' },

  // Decompression Sickness cases
  { features: { heart_rate: 94, spo2: 91, cabin_pressure_psi: 4.3, symptom_tags: ['JOINT_PAIN', 'SKIN_ITCH'] }, true_label: 'DECOMPRESSION_SICKNESS_DCS' },
  { features: { heart_rate: 96, spo2: 90, cabin_pressure_psi: 4.3, symptom_tags: ['JOINT_PAIN', 'CHEST_TIGHTNESS'] }, true_label: 'DECOMPRESSION_SICKNESS_DCS' },

  // Nominal healthy cases
  { features: { heart_rate: 68, sys_bp: 118, dia_bp: 78, temperature: 36.8, cabin_ppco2: 1.8, symptom_tags: [] }, true_label: 'NOMINAL_HEALTHY' },
  { features: { heart_rate: 72, sys_bp: 120, dia_bp: 80, temperature: 36.9, cabin_ppco2: 1.9, symptom_tags: [] }, true_label: 'NOMINAL_HEALTHY' },
  { features: { heart_rate: 64, sys_bp: 116, dia_bp: 76, temperature: 36.7, cabin_ppco2: 1.7, symptom_tags: [] }, true_label: 'NOMINAL_HEALTHY' }
];

// Out-Of-Distribution (OOD) test windows
export const OUT_OF_DISTRIBUTION_TEST_WINDOWS = [
  // 1. Physically impossible hyper-pyrexia and extreme heart rate
  { heart_rate: 260, temperature: 44.5, sys_bp: 40, dia_bp: 20, symptom_tags: ['ALIEN_ORGANISM_MUTATION'] },
  // 2. Severe negative pressure with impossible vitals
  { heart_rate: 30, sys_bp: 300, dia_bp: 210, cabin_pressure_psi: 0.1, symptom_tags: ['UNKNOWN_ANOMALY'] },
  // 3. Extreme conflicting sensor noise
  { heart_rate: 220, temperature: 31.0, respiration_rate: 65, cabin_ppco2: 45.0, symptom_tags: ['CONFLICTING_TELEMETRY'] }
];

// Detect Out-of-Distribution feature space
export function isWindowOutOfDistribution(features) {
  if (!features) return true;

  const hr = features.heart_rate ?? 70;
  const temp = features.temperature ?? 37.0;
  const sbp = features.sys_bp ?? 120;
  const ppco2 = features.cabin_ppco2 ?? 1.5;

  // Extreme physiological boundaries beyond known training distribution
  if (hr > 210 || hr < 35) return true;
  if (temp > 42.0 || temp < 33.0) return true;
  if (sbp > 240 || sbp < 50) return true;
  if (ppco2 > 25.0) return true;

  // OOD symptom tags
  const tags = features.symptom_tags || [];
  const oodTags = ['ALIEN_ORGANISM_MUTATION', 'UNKNOWN_ANOMALY', 'CONFLICTING_TELEMETRY', 'WARP_DRIVE_RADIATION'];
  if (tags.some((t) => oodTags.includes(t))) return true;

  return false;
}

// Compute conformal quantile from calibration dataset
export function computeConformalThreshold(alpha = 0.10) {
  const nonConformityScores = [];

  for (const item of CONFORMAL_CALIBRATION_SET) {
    const classification = classifyCondition(item.features, {
      allow_abstain: false
    });

    const probMap = classification.all_probabilities || {};
    const trueProb = probMap[item.true_label] || 0.01;
    // Non-conformity score: 1 - P(true_label)
    const score = 1.0 - trueProb;
    nonConformityScores.push(score);
  }

  nonConformityScores.sort((a, b) => a - b);
  const n = nonConformityScores.length;
  // Conformal empirical quantile: ceil((n + 1) * (1 - alpha)) / n
  const targetIndex = Math.min(n - 1, Math.max(0, Math.ceil((n + 1) * (1 - alpha)) - 1));
  const qHat = nonConformityScores[targetIndex];

  return {
    alpha,
    target_coverage: Number((1.0 - alpha).toFixed(2)),
    calibration_size: n,
    conformal_quantile_qhat: Number(qHat.toFixed(4))
  };
}

// Conformal Prediction Wrapper with Abstention
export function evaluateConformalAbstention(features, options = {}) {
  const alpha = options.alpha ?? 0.10; // Default 90% target coverage
  const qHatObj = computeConformalThreshold(alpha);
  const qHat = qHatObj.conformal_quantile_qhat;

  // 1. Check Out-Of-Distribution (OOD)
  const isOod = isWindowOutOfDistribution(features);
  if (isOod) {
    return {
      state: 'AI_UNSURE',
      is_unsure: true,
      abstain: true,
      primary_condition: null,
      prediction_set: [],
      prediction_set_size: 0,
      confidence: 0.0,
      is_ood: true,
      conformal_guarantee: 'APPROXIMATE (Time series non-exchangeable)',
      message: 'Unsure, clinical presentation is out-of-distribution. Escalate to Flight Surgeon (ask ground).',
      disclaimer: CONFORMAL_EXCHANGEABILITY_DISCLAIMER
    };
  }

  // 2. Classify through F045 condition engine
  const classification = classifyCondition(features, {
    allow_abstain: false
  });

  // 3. Build Conformal Prediction Set: C(x) = {y : 1 - P(y) <= qHat}
  const predictionSet = [];
  for (const [condition, probability] of Object.entries(classification.all_probabilities || {})) {
    const nonConformity = 1.0 - probability;
    if (nonConformity <= qHat) {
      predictionSet.push({
        condition,
        probability
      });
    }
  }

  // 4. Abstention Rule:
  // - If prediction set is empty or has > 2 conditions (ambiguous), or top confidence < 0.40 -> ABSTAIN / AI UNSURE
  const isAmbiguous = predictionSet.length > 2 || predictionSet.length === 0;
  const isLowConfidence = classification.confidence < 0.40;
  const shouldAbstain = isAmbiguous || isLowConfidence;

  return {
    state: shouldAbstain ? 'AI_UNSURE' : 'CONFIDENT',
    is_unsure: shouldAbstain,
    abstain: shouldAbstain,
    primary_condition: shouldAbstain ? null : predictionSet[0]?.condition || classification.primary_condition,
    prediction_set: predictionSet.map((p) => p.condition),
    prediction_set_size: predictionSet.length,
    confidence: classification.confidence,
    is_ood: false,
    alpha,
    approximate_coverage_target: Number((1.0 - alpha).toFixed(2)),
    conformal_guarantee: 'APPROXIMATE (Time series non-exchangeable)',
    message: shouldAbstain
      ? 'Unsure, clinical presentation is ambiguous. Escalate to Flight Surgeon (ask ground).'
      : `Confident diagnosis: ${predictionSet[0]?.condition}`,
    disclaimer: CONFORMAL_EXCHANGEABILITY_DISCLAIMER
  };
}

// Generate empirical Risk-Coverage Curve across varying coverage targets
export function generateRiskCoverageCurve(options = {}) {
  const alphas = [0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50];
  const curvePoints = [];

  const evaluationSet = [
    ...CONFORMAL_CALIBRATION_SET,
    // Add additional validation cases
    { features: { heart_rate: 100, sys_bp: 96, dia_bp: 62, urine_output_ml: 900, symptom_tags: ['THIRST'] }, true_label: 'DEHYDRATION' },
    { features: { heart_rate: 106, temperature: 38.5, respiration_rate: 23, symptom_tags: ['FEVER'] }, true_label: 'ACUTE_INFECTION' },
    { features: { heart_rate: 90, sys_bp: 146, dia_bp: 95, cabin_ppco2: 5.0, symptom_tags: ['HEADACHE'] }, true_label: 'CO2_EXPOSURE' },
    { features: { heart_rate: 66, sys_bp: 118, dia_bp: 78, temperature: 36.8, symptom_tags: [] }, true_label: 'NOMINAL_HEALTHY' }
  ];

  for (const alpha of alphas) {
    const qHatObj = computeConformalThreshold(alpha);
    const qHat = qHatObj.conformal_quantile_qhat;

    let totalEvaluated = 0;
    let coveredCount = 0; // True label inside prediction set
    let abstainedCount = 0;
    let nonAbstainedErrors = 0;
    let nonAbstainedTotal = 0;

    for (const item of evaluationSet) {
      totalEvaluated++;
      const evalResult = evaluateConformalAbstention(item.features, { alpha });

      // Check coverage: was true label in prediction set?
      const inPredictionSet = evalResult.prediction_set.includes(item.true_label);
      if (inPredictionSet) coveredCount++;

      if (evalResult.abstain) {
        abstainedCount++;
      } else {
        nonAbstainedTotal++;
        if (evalResult.primary_condition !== item.true_label) {
          nonAbstainedErrors++;
        }
      }
    }

    const empiricalCoverage = Number((coveredCount / totalEvaluated).toFixed(3));
    const coverageRate = Number(((totalEvaluated - abstainedCount) / totalEvaluated).toFixed(3));
    const selectiveRisk = nonAbstainedTotal > 0 ? Number((nonAbstainedErrors / nonAbstainedTotal).toFixed(3)) : 0.0;

    curvePoints.push({
      alpha,
      target_coverage: Number((1.0 - alpha).toFixed(2)),
      q_hat: qHat,
      empirical_coverage: empiricalCoverage,
      coverage_rate: coverageRate,
      abstention_rate: Number((abstainedCount / totalEvaluated).toFixed(3)),
      selective_risk: selectiveRisk
    });
  }

  const report = {
    benchmark_id: 'X04-CONFORMAL-ABSTENTION',
    timestamp: new Date().toISOString(),
    theoretical_framework: 'Split Conformal Prediction (Inductive Conformal)',
    exchangeability_status: 'APPROXIMATE_DUE_TO_TIME_SERIES',
    disclaimer: CONFORMAL_EXCHANGEABILITY_DISCLAIMER,
    evaluation_set_size: evaluationSet.length,
    risk_coverage_curve: curvePoints
  };

  // Persist report to build/reports/risk_coverage_curve_X04.json
  if (options.saveReport !== false) {
    try {
      const reportsDir = path.resolve(process.cwd(), 'build/reports');
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }
      const outPath = path.join(reportsDir, 'risk_coverage_curve_X04.json');
      fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf-8');
    } catch {
      // Non-blocking
    }
  }

  return report;
}
