import { TelemetryReading } from '../models/TelemetryReading.js';
import { PersonalBaseline } from '../models/PersonalBaseline.js';
import { eventBus } from '../bus/index.js';
import { Alert } from '../models/Alert.js';
import crypto from 'crypto';

// Average path length of unsuccessful search in BST
function c(n) {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  const eulerMascheroni = 0.5772156649;
  return 2 * (Math.log(n - 1) + eulerMascheroni) - (2 * (n - 1)) / n;
}

// Pseudo-random number generator for reproducible trees
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class IsolationTree {
  constructor(data, currentDepth = 0, maxDepth = 8, rng) {
    this.depth = currentDepth;
    this.size = data.length;

    if (currentDepth >= maxDepth || data.length <= 1) {
      this.isLeaf = true;
      return;
    }

    const min = Math.min(...data);
    const max = Math.max(...data);

    if (Math.abs(max - min) < 1e-6) {
      this.isLeaf = true;
      return;
    }

    this.splitValue = min + rng() * (max - min);
    const leftData = data.filter((v) => v <= this.splitValue);
    const rightData = data.filter((v) => v > this.splitValue);

    if (leftData.length === 0 || rightData.length === 0) {
      this.isLeaf = true;
      return;
    }

    this.isLeaf = false;
    this.left = new IsolationTree(leftData, currentDepth + 1, maxDepth, rng);
    this.right = new IsolationTree(rightData, currentDepth + 1, maxDepth, rng);
  }

  pathLength(x, depth = 0) {
    if (this.isLeaf) {
      return depth + c(this.size);
    }
    if (x <= this.splitValue) {
      return this.left.pathLength(x, depth + 1);
    }
    return this.right.pathLength(x, depth + 1);
  }
}

export class IsolationForest {
  constructor(nTrees = 25, subSampleSize = 64, seed = 42) {
    this.nTrees = nTrees;
    this.subSampleSize = subSampleSize;
    this.seed = seed;
    this.trees = [];
    this.referenceSize = 0;
  }

  fit(data) {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Training data cannot be empty');
    }
    this.referenceSize = Math.min(data.length, this.subSampleSize);
    this.trees = [];
    const maxDepth = Math.ceil(Math.log2(Math.max(this.referenceSize, 2)));

    for (let t = 0; t < this.nTrees; t++) {
      const rng = mulberry32(this.seed + t * 997);
      // Sample subset
      const sample = [];
      for (let i = 0; i < this.referenceSize; i++) {
        const idx = Math.floor(rng() * data.length);
        sample.push(data[idx]);
      }
      this.trees.push(new IsolationTree(sample, 0, maxDepth, rng));
    }
  }

  score(x) {
    if (this.trees.length === 0) return 0.5;
    let sumPath = 0;
    for (const tree of this.trees) {
      sumPath += tree.pathLength(x, 0);
    }
    const avgPath = sumPath / this.trees.length;
    const cVal = c(this.referenceSize);
    if (cVal === 0) return 0.5;
    return Math.pow(2, -avgPath / cVal);
  }
}

// Compute robust median and MAD
export function computeRobustStats(values) {
  if (!values || values.length === 0) return { median: 0, mad: 1 };
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  const deviations = sorted.map((v) => Math.abs(v - median)).sort((a, b) => a - b);
  const devMid = Math.floor(deviations.length / 2);
  let mad = deviations.length % 2 !== 0 ? deviations[devMid] : (deviations[devMid - 1] + deviations[devMid]) / 2;
  if (mad < 1.0) mad = 1.0; // Variance floor

  return { median, mad };
}

// Robust z-score
export function computeRobustZScore(value, median, mad) {
  const normalSigma = 1.4826 * Math.max(mad, 1.0);
  return (value - median) / normalSigma;
}

// Evaluates an observation against baseline with Isolation Forest + Robust Z Ensemble
export function evaluateAnomalyEnsemble(value, baselineValues, options = {}) {
  const threshold = options.threshold ?? 0.62;
  const isoTrees = options.nTrees ?? 30;

  const { median, mad } = computeRobustStats(baselineValues);
  const robustZ = computeRobustZScore(value, median, mad);
  const zScoreNormalized = Math.min(1.0, Math.abs(robustZ) / 4.0);

  const forest = new IsolationForest(isoTrees, 64, options.seed ?? 101);
  forest.fit(baselineValues);
  const isoScore = forest.score(value);

  // Ensemble weighted 50% Isolation Forest + 50% Robust Z
  const ensembleScore = 0.5 * isoScore + 0.5 * zScoreNormalized;
  const isAnomaly = ensembleScore >= threshold;

  return {
    value,
    median,
    mad,
    robust_z: Number(robustZ.toFixed(3)),
    isolation_score: Number(isoScore.toFixed(3)),
    ensemble_score: Number(ensembleScore.toFixed(3)),
    is_anomaly: isAnomaly,
    severity: ensembleScore >= 0.85 ? 'CRITICAL' : ensembleScore >= 0.70 ? 'WARNING' : 'INFO'
  };
}

// Evaluates rule vs anomaly recall on injected anomaly cases
export function compareWithRulesOnly(nominalSet, injectedAnomalies, ruleCheckFn, options = {}) {
  const forest = new IsolationForest(30, 64, 42);
  forest.fit(nominalSet);
  const { median, mad } = computeRobustStats(nominalSet);

  const evalEnsemble = (val) => {
    const rZ = Math.min(1.0, Math.abs(computeRobustZScore(val, median, mad)) / 4.0);
    const iso = forest.score(val);
    const score = 0.5 * iso + 0.5 * rZ;
    return score >= (options.threshold ?? 0.62);
  };

  // 1. Nominal false alarm rate (FAR)
  let modelFP = 0;
  let rulesFP = 0;
  for (const val of nominalSet) {
    if (evalEnsemble(val)) modelFP++;
    if (ruleCheckFn(val)) rulesFP++;
  }
  const modelFAR = modelFP / nominalSet.length;
  const rulesFAR = rulesFP / nominalSet.length;

  // 2. Injected anomalies recall
  let modelTP = 0;
  let rulesTP = 0;
  for (const val of injectedAnomalies) {
    if (evalEnsemble(val)) modelTP++;
    if (ruleCheckFn(val)) rulesTP++;
  }
  const modelRecall = modelTP / injectedAnomalies.length;
  const rulesRecall = rulesTP / injectedAnomalies.length;

  return {
    model_recall: Number(modelRecall.toFixed(3)),
    rules_recall: Number(rulesRecall.toFixed(3)),
    model_far: Number(modelFAR.toFixed(3)),
    rules_far: Number(rulesFAR.toFixed(3)),
    beats_rules: modelRecall > rulesRecall && modelFAR <= rulesFAR + 0.05
  };
}

// Scan crew telemetry for anomalies and optionally trigger alerts
export async function detectCrewAnomalies(crewId, metric, recentValue, options = {}) {
  // 1. Fetch personal baseline if available
  const baselineDoc = await PersonalBaseline.findOne({ crew_id: crewId, metric });
  let baselineValues = [];

  if (baselineDoc && baselineDoc.hourly_baselines && baselineDoc.hourly_baselines.length > 0) {
    // Generate synthetic distribution representative of personal diurnal baselines
    const med = baselineDoc.hourly_baselines[12]?.median ?? 65;
    const mad = baselineDoc.hourly_baselines[12]?.mad ?? 4;
    for (let i = 0; i < 100; i++) {
      baselineValues.push(med + (Math.random() - 0.5) * mad * 2.5);
    }
  } else {
    // Query last 100 readings
    const readings = await TelemetryReading.find({ crew_id: crewId, metric })
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();
    if (readings.length >= 10) {
      baselineValues = readings.map((r) => r.value);
    } else {
      // Default nominal distribution for metric
      const defaultMeans = { heart_rate: 65, spo2: 98, systolic_bp: 118, respiration_rate: 14 };
      const m = defaultMeans[metric] || 70;
      for (let i = 0; i < 80; i++) {
        baselineValues.push(m + (Math.random() - 0.5) * 6);
      }
    }
  }

  const result = evaluateAnomalyEnsemble(recentValue, baselineValues, options);

  if (result.is_anomaly && options.createAlert !== false) {
    const alertId = `alt-ano-${crypto.randomBytes(4).toString('hex')}`;
    const alert = await Alert.create({
      alert_id: alertId,
      crew_id: crewId,
      source: 'ANOMALY',
      category: 'PHYSIOLOGY',
      metric,
      severity: result.severity,
      title: `Unsupervised Anomaly: ${metric}`,
      message: `Ensemble anomaly detected for ${metric} (value: ${recentValue}, score: ${result.ensemble_score}, robust z: ${result.robust_z})`,
      value: recentValue,
      threshold: { baseline_median: result.median, mad: result.mad, ensemble_score: result.ensemble_score }
    });

    eventBus.publish('alert:created', {
      alert_id: alertId,
      crew_id: crewId,
      source: 'ANOMALY',
      severity: result.severity,
      metric
    });

    result.alert = alert;
  }

  return result;
}
