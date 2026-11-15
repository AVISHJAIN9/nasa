// Fit trend + 24h harmonic diurnal seasonality
export function fitHarmonicDiurnalModel(timestamps, values) {
  if (values.length < 24) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return { mean, trend: 0, a1: 0, b1: 0, residualSigma: 2.0 };
  }

  const n = values.length;
  // Convert timestamps to hours from start
  const t0 = timestamps[0].getTime();
  const hours = timestamps.map((ts) => (ts.getTime() - t0) / 3600000);

  // Linear trend regression: y = a + b * t
  let sumT = 0, sumY = 0, sumTY = 0, sumTT = 0;
  for (let i = 0; i < n; i++) {
    sumT += hours[i];
    sumY += values[i];
    sumTY += hours[i] * values[i];
    sumTT += hours[i] * hours[i];
  }
  const trend = (n * sumTY - sumT * sumY) / (n * sumTT - sumT * sumT || 1);
  const intercept = (sumY - trend * sumT) / n;

  // Detrend
  const detrended = values.map((y, i) => y - (intercept + trend * hours[i]));

  // Fit 24h harmonic Fourier coefficients: S(t) = a1*cos(2pi*t/24) + b1*sin(2pi*t/24)
  let sumCos = 0, sumSin = 0;
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * (hours[i] % 24)) / 24;
    sumCos += detrended[i] * Math.cos(angle);
    sumSin += detrended[i] * Math.sin(angle);
  }
  const a1 = (2 * sumCos) / n;
  const b1 = (2 * sumSin) / n;

  // Residual variance
  let sumResSq = 0;
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * (hours[i] % 24)) / 24;
    const fitted = intercept + trend * hours[i] + a1 * Math.cos(angle) + b1 * Math.sin(angle);
    sumResSq += Math.pow(values[i] - fitted, 2);
  }
  const residualSigma = Math.sqrt(sumResSq / (n - 4 || 1));

  return {
    intercept,
    trend,
    a1,
    b1,
    residualSigma: Math.max(1.0, residualSigma),
    t0
  };
}

// Generate multi-step forecast for selectable horizon (24h, 48h, 72h)
export function forecastTrajectory(model, startTimestamp, horizonHours = 24, limits = {}) {
  const steps = [];
  const startMs = startTimestamp.getTime();
  let breachPredicted = false;
  let breachHorizonHours = null;
  let maxProjected = -Infinity;
  let minProjected = Infinity;

  for (let h = 1; h <= horizonHours; h++) {
    const forecastTime = new Date(startMs + h * 3600000);
    const totalHours = (forecastTime.getTime() - model.t0) / 3600000;
    const angle = (2 * Math.PI * (totalHours % 24)) / 24;

    const point = model.intercept + model.trend * totalHours + model.a1 * Math.cos(angle) + model.b1 * Math.sin(angle);
    // Uncertainty grows moderately over forecast horizon
    const horizonSigma = model.residualSigma * Math.sqrt(1 + 0.04 * h);
    const low95 = point - 1.96 * horizonSigma;
    const high95 = point + 1.96 * horizonSigma;

    if (point > maxProjected) maxProjected = point;
    if (point < minProjected) minProjected = point;

    // Check breach
    if (limits.high && point >= limits.high && !breachPredicted) {
      breachPredicted = true;
      breachHorizonHours = h;
    }
    if (limits.low && point <= limits.low && !breachPredicted) {
      breachPredicted = true;
      breachHorizonHours = h;
    }

    steps.push({
      step: h,
      timestamp: forecastTime,
      predicted_value: Number(point.toFixed(2)),
      lower_95: Number(low95.toFixed(2)),
      upper_95: Number(high95.toFixed(2))
    });
  }

  return {
    horizon_hours: horizonHours,
    start_time: startTimestamp,
    end_time: steps[steps.length - 1]?.timestamp,
    breach_predicted: breachPredicted,
    breach_horizon_hours: breachHorizonHours,
    projected_min: Number(minProjected.toFixed(2)),
    projected_max: Number(maxProjected.toFixed(2)),
    trajectory: steps
  };
}

// Rolling backtest evaluation against naive baseline
export function runRollingBacktest(timestamps, values, horizonHours = 24, nFolds = 3) {
  if (values.length < horizonHours + 48) {
    throw new Error(`Insufficient data for backtest: need at least ${horizonHours + 48} hourly points`);
  }

  let totalModelMAE = 0;
  let totalNaiveMAE = 0;
  const foldResults = [];

  for (let f = 0; f < nFolds; f++) {
    // Cut point
    const trainEndIdx = values.length - (nFolds - f) * horizonHours;
    const trainTimes = timestamps.slice(0, trainEndIdx);
    const trainVals = values.slice(0, trainEndIdx);

    const testVals = values.slice(trainEndIdx, trainEndIdx + horizonHours);
    const lastTrainVal = trainVals[trainVals.length - 1];

    const model = fitHarmonicDiurnalModel(trainTimes, trainVals);
    const forecast = forecastTrajectory(model, trainTimes[trainTimes.length - 1], horizonHours);

    // Compute MAE
    let modelError = 0;
    let naiveError = 0;
    for (let h = 0; h < horizonHours; h++) {
      modelError += Math.abs(forecast.trajectory[h].predicted_value - testVals[h]);
      naiveError += Math.abs(lastTrainVal - testVals[h]); // Naive persistence: y_t+h = y_t
    }

    const modelMAE = modelError / horizonHours;
    const naiveMAE = naiveError / horizonHours;
    totalModelMAE += modelMAE;
    totalNaiveMAE += naiveMAE;

    foldResults.push({
      fold: f + 1,
      model_mae: Number(modelMAE.toFixed(3)),
      naive_mae: Number(naiveMAE.toFixed(3)),
      improvement_pct: Number((((naiveMAE - modelMAE) / naiveMAE) * 100).toFixed(1))
    });
  }

  const avgModelMAE = Number((totalModelMAE / nFolds).toFixed(3));
  const avgNaiveMAE = Number((totalNaiveMAE / nFolds).toFixed(3));
  const beatsNaive = avgModelMAE < avgNaiveMAE;

  return {
    horizon_hours: horizonHours,
    n_folds: nFolds,
    model_mae: avgModelMAE,
    naive_mae: avgNaiveMAE,
    beats_naive_baseline: beatsNaive,
    relative_reduction_pct: Number((((avgNaiveMAE - avgModelMAE) / avgNaiveMAE) * 100).toFixed(1)),
    folds: foldResults
  };
}
