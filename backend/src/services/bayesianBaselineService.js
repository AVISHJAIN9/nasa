export const POPULATION_PRIORS = {
  heart_rate: { mu_0: 70.0, sigma_0: 10.0, kappa_0: 5 },
  spo2: { mu_0: 98.2, sigma_0: 1.0, kappa_0: 10 },
  sys_bp: { mu_0: 120.0, sigma_0: 12.0, kappa_0: 5 },
  dia_bp: { mu_0: 78.0, sigma_0: 8.0, kappa_0: 5 },
  temperature: { mu_0: 36.8, sigma_0: 0.4, kappa_0: 10 },
  hrv: { mu_0: 58.0, sigma_0: 15.0, kappa_0: 5 },
  respiration_rate: { mu_0: 14.0, sigma_0: 2.5, kappa_0: 5 }
};

// Standard error function approximation for CDF
export function erf(x) {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return sign * y;
}

export function normalCDF(z) {
  return 0.5 * (1.0 + erf(z / Math.SQRT2));
}

/**
 * Computes individual Bayesian N-of-1 posterior parameters using conjugate updating
 */
export function computeBayesianPosterior({
  metric,
  observations = [],
  priorOverride = null,
  crewBaseline = null
}) {
  const prior = priorOverride || POPULATION_PRIORS[metric] || { mu_0: 70.0, sigma_0: 10.0, kappa_0: 5 };
  let { mu_0, sigma_0, kappa_0 } = prior;

  // If a known crew baseline resting vital is supplied, shrink prior center towards individual baseline
  if (crewBaseline !== null && crewBaseline !== undefined) {
    mu_0 = 0.4 * mu_0 + 0.6 * crewBaseline;
  }

  const validObs = observations.filter((y) => typeof y === 'number' && !Number.isNaN(y));
  const n = validObs.length;

  if (n === 0) {
    // Return pure prior band
    const z90 = 1.645;
    return {
      metric,
      n_observations: 0,
      posterior_mean: mu_0,
      posterior_sd: sigma_0,
      credible_band_90: {
        lower: Math.round((mu_0 - z90 * sigma_0) * 100) / 100,
        upper: Math.round((mu_0 + z90 * sigma_0) * 100) / 100
      },
      prior_used: { mu_0, sigma_0, kappa_0 }
    };
  }

  // Sample mean and sample variance
  const yBar = validObs.reduce((a, b) => a + b, 0) / n;
  const sampleVar = n > 1
    ? validObs.reduce((acc, y) => acc + Math.pow(y - yBar, 2), 0) / (n - 1)
    : Math.pow(sigma_0, 2);

  // Conjugate updating formulas
  const kappa_n = kappa_0 + n;
  const mu_n = (kappa_0 * mu_0 + n * yBar) / kappa_n;
  
  const pooledVar = (
    kappa_0 * Math.pow(sigma_0, 2) +
    (n - 1) * sampleVar +
    (kappa_0 * n / kappa_n) * Math.pow(yBar - mu_0, 2)
  ) / kappa_n;

  // Posterior SD with variance floor
  const sigma_n = Math.max(0.2, Math.sqrt(pooledVar));
  const z90 = 1.645;

  return {
    metric,
    n_observations: n,
    sample_mean: Math.round(yBar * 100) / 100,
    posterior_mean: Math.round(mu_n * 100) / 100,
    posterior_sd: Math.round(sigma_n * 100) / 100,
    credible_band_90: {
      lower: Math.round((mu_n - z90 * sigma_n) * 100) / 100,
      upper: Math.round((mu_n + z90 * sigma_n) * 100) / 100
    },
    prior_used: { mu_0, sigma_0, kappa_0 }
  };
}

/**
 * Evaluates an observation against personal posterior model
 */
export function evaluateBayesianDeviation({
  posterior,
  value,
  timestamp = new Date()
}) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return { is_valid: false };
  }

  const { posterior_mean, posterior_sd, credible_band_90 } = posterior;
  const zScore = (value - posterior_mean) / posterior_sd;
  const absZ = Math.abs(zScore);

  // Two-tailed probability of deviation: P(|Y - mu| >= |y_obs - mu|)
  const probDeviation = Math.min(0.9999, Math.max(0.0, Math.round(erf(absZ / Math.SQRT2) * 10000) / 10000));
  const isInside90Credible = value >= credible_band_90.lower && value <= credible_band_90.upper;

  return {
    value,
    timestamp: new Date(timestamp),
    posterior_mean,
    posterior_sd,
    z_score: Math.round(zScore * 100) / 100,
    probability_of_deviation: probDeviation,
    inside_90_credible: isInside90Credible,
    anomaly_status: probDeviation >= 0.99 ? 'CRITICAL_DEVIATION' : probDeviation >= 0.95 ? 'MODERATE_DEVIATION' : 'NOMINAL'
  };
}

/**
 * Produces short-term forecast (e.g. 1h, 6h ahead)
 */
export function forecastBayesianTrajectory({
  posterior,
  currentValue,
  horizonHours = 6,
  timeOfDayHours = 12
}) {
  const trajectory = [];
  const meanReversionRate = 0.7; // Autoregressive decay factor

  for (let h = 1; h <= horizonHours; h++) {
    const futureHour = (timeOfDayHours + h) % 24;
    // Circadian sinusoidal term (peak at ~17:00, trough at ~05:00)
    const circadianOffset = Math.sin((2 * Math.PI * (futureHour - 5)) / 24) * (posterior.posterior_sd * 0.4);
    
    // Mean reverting component
    const deviation = (currentValue - posterior.posterior_mean) * Math.pow(meanReversionRate, h);
    const predictedMean = posterior.posterior_mean + circadianOffset + deviation;
    const futureSD = posterior.posterior_sd * Math.sqrt(1 + 0.1 * h);

    trajectory.push({
      horizon_hour: h,
      time_of_day_hour: futureHour,
      predicted_mean: Math.round(predictedMean * 10) / 10,
      credible_band_90: {
        lower: Math.round((predictedMean - 1.645 * futureSD) * 10) / 10,
        upper: Math.round((predictedMean + 1.645 * futureSD) * 10) / 10
      }
    });
  }

  return {
    metric: posterior.metric,
    current_value: currentValue,
    horizon_hours: horizonHours,
    forecast: trajectory
  };
}
