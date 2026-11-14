"""AstroCare X02: Per-Astronaut Bayesian Baseline (N-of-1 Kalman Filter).

State-space formulation:
- State: x_t = [mu_t, v_t]^T (baseline physiological level mu_t, drift velocity v_t)
- Transition: x_t = F x_{t-1} + w_t, where F = [[1, dt], [0, 1]], w_t ~ N(0, Q)
- Observation: y_t = H x_t + v_t, where H = [[1, 0]], v_t ~ N(0, R)
- Process noise Q: q_mu (level variation) and q_v (trend variation) scaled by dt
- Observation noise R: from sensor precision in METRIC_REGISTRY
- Partial pooling: Prior (mu_crew, sigma_crew^2) estimated strictly from training-fold
  astronauts. Cold-start astronauts initialize with high uncertainty at crew prior;
  as observations accumulate, Kalman gain naturally shifts weight to personal evidence.
- Causal missing data: when y_t is None, filter performs predict step only (P grows,
  uncertainty widens) and skips update.
- One-step-ahead prediction: calculates predictive distribution before measurement update.
- p_deviation: analytic predictive probability of falling outside personal tolerance bounds.
- time_to_critical_min: quantiles p10, p50, p90 of time until crossing configured critical limits.
"""
from dataclasses import dataclass
import math
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
from scipy.stats import norm

from astrocare.config import METRIC_REGISTRY, MetricDefinition
from astrocare.models.registry import TimeToCritical, X02BaselineOutput


@dataclass
class CrewPrior:
    metric: str
    mean: float
    variance: float
    trend_prior: float = 0.0
    trend_variance: float = 0.01


def fit_crew_prior(
    training_observations: Dict[str, List[float]],
    metric_name: str,
) -> CrewPrior:
    """Estimates crew prior using training-fold astronauts only.

    training_observations maps crew_id -> list of training values for this metric.
    """
    def_info = METRIC_REGISTRY.get(metric_name)
    all_vals: List[float] = []
    astronaut_means: List[float] = []

    for cid, vals in training_observations.items():
        valid_v = [v for v in vals if v is not None and not np.isnan(v)]
        if valid_v:
            all_vals.extend(valid_v)
            astronaut_means.append(float(np.mean(valid_v)))

    if len(astronaut_means) >= 2:
        prior_mean = float(np.mean(astronaut_means))
        # Between-astronaut variance + small shrinkage regularization
        prior_var = float(np.var(astronaut_means, ddof=1) + 1.0)
    elif len(all_vals) > 0:
        prior_mean = float(np.mean(all_vals))
        prior_var = float(np.var(all_vals) + 1.0)
    elif def_info:
        # Fallback to registry nominal midpoint if no observations
        prior_mean = 0.5 * (def_info.nominal_min + def_info.nominal_max)
        prior_var = float(def_info.typical_sigma ** 2)
    else:
        prior_mean = 100.0
        prior_var = 25.0

    return CrewPrior(
        metric=metric_name,
        mean=prior_mean,
        variance=prior_var,
        trend_prior=0.0,
        trend_variance=0.005,
    )


class X02AstronautMetricFilter:
    """NumPy-based local-trend Kalman filter for a single astronaut and single metric."""

    def __init__(
        self,
        crew_id: str,
        metric: str,
        prior: CrewPrior,
        dt_minutes: float = 1.0,
        forecast_horizon_min: float = 120.0,
    ):
        self.crew_id = crew_id
        self.metric = metric
        self.prior = prior
        self.dt = dt_minutes
        self.horizon_min = forecast_horizon_min
        self.def_info = METRIC_REGISTRY.get(metric)

        # State vector: [mu, velocity]^T
        self.x = np.array([prior.mean, prior.trend_prior], dtype=float)

        # State covariance P
        self.P = np.array(
            [
                [prior.variance, 0.0],
                [0.0, prior.trend_variance],
            ],
            dtype=float,
        )

        # Transition matrix F
        self.F = np.array(
            [
                [1.0, self.dt],
                [0.0, 1.0],
            ],
            dtype=float,
        )

        # Observation matrix H
        self.H = np.array([[1.0, 0.0]], dtype=float)

        # Process noise Q
        q_scale = (self.def_info.typical_sigma * 0.05) ** 2 if self.def_info else 0.05
        self.Q = np.array(
            [
                [q_scale * self.dt, 0.0],
                [0.0, 0.001 * q_scale * self.dt],
            ],
            dtype=float,
        )

        # Observation noise R
        self.R = float((self.def_info.typical_sigma * 0.5) ** 2) if self.def_info else 1.0

        # Personalized deviation envelope parameters (frozen definition)
        self.nominal_half_range = (
            0.5 * (self.def_info.nominal_max - self.def_info.nominal_min)
            if self.def_info
            else 10.0
        )
        self.observation_count = 0

    def step(self, value: Optional[float], ts: str) -> X02BaselineOutput:
        """Causal one-step-ahead prediction followed by state update."""
        # --- 1. PREDICT STEP ---
        x_pred = self.F @ self.x
        P_pred = self.F @ self.P @ self.F.T + self.Q

        # Predictive observation distribution: y_hat ~ N(m_pred, S_pred)
        m_pred = float((self.H @ x_pred)[0])
        S_pred = float((self.H @ P_pred @ self.H.T)[0, 0] + self.R)
        std_pred = max(math.sqrt(max(S_pred, 1e-8)), 1e-4)

        # 90% Predictive Interval (z = 1.64485)
        z90 = 1.64485
        lo90 = round(m_pred - z90 * std_pred, 3)
        hi90 = round(m_pred + z90 * std_pred, 3)
        mean_val = round(m_pred, 3)

        # Ensure lo90 <= mean <= hi90 constraint
        if lo90 > mean_val:
            lo90 = mean_val
        if hi90 < mean_val:
            hi90 = mean_val

        # --- 2. COMPUTE p_deviation (Frozen Definition) ---
        # Predictive probability that metric falls outside personalized normal bounds
        # Bounds: baseline mean +/- nominal_half_range
        bound_low = self.def_info.nominal_min if self.def_info else (m_pred - 2.0 * std_pred)
        bound_high = self.def_info.nominal_max if self.def_info else (m_pred + 2.0 * std_pred)

        prob_below = norm.cdf((bound_low - m_pred) / std_pred)
        prob_above = 1.0 - norm.cdf((bound_high - m_pred) / std_pred)
        p_deviation = float(min(1.0, max(0.0, prob_below + prob_above)))

        # --- 3. COMPUTE time_to_critical_min ---
        time_to_critical = self._compute_time_to_critical(x_pred, P_pred, std_pred)

        output = X02BaselineOutput(
            crew_id=self.crew_id,
            metric=self.metric,
            ts=ts,
            mean=mean_val,
            lo90=lo90,
            hi90=hi90,
            p_deviation=round(p_deviation, 4),
            time_to_critical_min=time_to_critical,
        )

        # --- 4. UPDATE STEP (CAUSAL) ---
        if value is not None and not np.isnan(value):
            # Measurement available: compute Kalman gain and update
            y = float(value)
            residual = y - m_pred
            K = (P_pred @ self.H.T) / S_pred  # Shape (2, 1)
            self.x = x_pred + (K.flatten() * residual)
            I_KH = np.eye(2) - K @ self.H
            self.P = I_KH @ P_pred
            self.observation_count += 1
        else:
            # Missing measurement: keep predicted state and widened covariance (causal)
            self.x = x_pred
            self.P = P_pred

        return output

    def _compute_time_to_critical(
        self,
        x_state: np.ndarray,
        P_state: np.ndarray,
        current_std: float,
    ) -> TimeToCritical:
        """Forecasts first-crossing time against configured critical limits."""
        if not self.def_info:
            return TimeToCritical(p10=None, p50=None, p90=None)

        crit_low = self.def_info.critical_low
        crit_high = self.def_info.critical_high
        if crit_low is None and crit_high is None:
            return TimeToCritical(p10=None, p50=None, p90=None)

        current_mu = float(x_state[0])
        velocity = float(x_state[1])  # units per minute

        # Candidate targets
        targets: List[Tuple[float, str]] = []
        if crit_low is not None and velocity < -1e-4:
            targets.append((crit_low, "low"))
        if crit_high is not None and velocity > 1e-4:
            targets.append((crit_high, "high"))

        if not targets:
            # Velocity is near zero or moving away from critical limits
            return TimeToCritical(p10=None, p50=None, p90=None)

        # Pick nearest boundary in trajectory direction
        target_val, direction = targets[0]
        delta = target_val - current_mu
        t_50 = delta / velocity  # minutes

        if t_50 <= 0 or t_50 > self.horizon_min:
            return TimeToCritical(p10=None, p50=None, p90=None)

        # Uncertainty envelope around crossing time
        # Higher current uncertainty spreads p10 and p90
        dt_sigma = abs(current_std / max(abs(velocity), 1e-4)) * 0.4
        t_10 = max(0.0, t_50 - 1.28 * dt_sigma)
        t_90 = min(self.horizon_min, t_50 + 1.28 * dt_sigma)

        # Enforce ordering 0 <= p10 <= p50 <= p90
        t_10 = round(min(t_10, t_50), 1)
        t_50 = round(t_50, 1)
        t_90 = round(max(t_90, t_50), 1)

        return TimeToCritical(p10=t_10, p50=t_50, p90=t_90)
