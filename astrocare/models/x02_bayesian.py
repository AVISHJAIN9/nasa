"""AstroCare X02: Per-Astronaut Bayesian Baseline (Audited N-of-1 Kalman Filter).

State-space formulation:
- State: x_t = [mu_t, v_t]^T (personal baseline physiological level mu_t, drift velocity v_t)
- Dynamic time step: dt is calculated from consecutive observation timestamps ts
- Transition: x_t = F(dt) x_{t-1} + w_t, where F(dt) = [[1, dt], [0, 1]], w_t ~ N(0, Q(dt))
- Observation: y_t = H x_t + v_t, where H = [[1, 0]], v_t ~ N(0, R)
- Process noise Q(dt): q_mu and q_v scaled dynamically by dt
- Observation noise R: from sensor precision in METRIC_REGISTRY
- Partial pooling: Prior (mu_crew, sigma_crew^2) estimated strictly from training-fold astronauts.
  A data-thin astronaut initializes shrunk toward the crew prior; personal evidence shifts weights.
- Causal missing data: when y_t is None, filter performs predict step only (P grows, uncertainty widens).
- One-step-ahead prediction: calculates predictive distribution before measurement update.
- Personalized p_deviation: analytic predictive probability of falling outside the astronaut's
  personal baseline tolerance range [mu_personal - 2.0*sigma_personal, mu_personal + 2.0*sigma_personal].
- time_to_critical_min: trajectory uncertainty-propagated quantiles (p10, p50, p90) against configured limits.
"""
from dataclasses import dataclass
from datetime import datetime, timezone
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
    """Estimates crew prior using training-fold astronauts only."""
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
        prior_var = float(np.var(astronaut_means, ddof=1) + 1.0)
    elif len(all_vals) > 0:
        prior_mean = float(np.mean(all_vals))
        prior_var = float(np.var(all_vals) + 1.0)
    elif def_info:
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
        forecast_horizon_min: float = 120.0,
    ):
        self.crew_id = crew_id
        self.metric = metric
        self.prior = prior
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

        # Observation matrix H
        self.H = np.array([[1.0, 0.0]], dtype=float)

        # Baseline noise scaling
        self.q_scale = (self.def_info.typical_sigma * 0.05) ** 2 if self.def_info else 0.05
        self.R = float((self.def_info.typical_sigma * 0.5) ** 2) if self.def_info else 1.0

        # Personalized baseline tracking
        self.personal_sigma = self.def_info.typical_sigma if self.def_info else math.sqrt(prior.variance)
        self.personal_baseline_level = prior.mean
        self.last_dt_ts: Optional[datetime] = None
        self.observation_count = 0

    def _parse_ts(self, ts: str) -> datetime:
        try:
            return datetime.fromisoformat(ts.replace("Z", "+00:00"))
        except Exception:
            return datetime.now(timezone.utc)

    def step(self, value: Optional[float], ts: str) -> X02BaselineOutput:
        """Causal one-step-ahead prediction with dynamic dt, followed by state update."""
        current_dt = self._parse_ts(ts)

        # Calculate dynamic dt in minutes from previous observation
        if self.last_dt_ts is not None:
            delta_sec = max(0.1, (current_dt - self.last_dt_ts).total_seconds())
            dt_min = delta_sec / 60.0
        else:
            cadence_sec = self.def_info.measurement_cadence_sec if self.def_info else 60.0
            dt_min = cadence_sec / 60.0

        self.last_dt_ts = current_dt

        # Dynamic transition matrix F(dt) and process noise Q(dt)
        F = np.array(
            [
                [1.0, dt_min],
                [0.0, 1.0],
            ],
            dtype=float,
        )
        Q = np.array(
            [
                [self.q_scale * dt_min, 0.0],
                [0.0, 0.001 * self.q_scale * dt_min],
            ],
            dtype=float,
        )

        # --- 1. PREDICT STEP ---
        x_pred = F @ self.x
        P_pred = F @ self.P @ F.T + Q

        # Predictive observation distribution: y_hat ~ N(m_pred, S_pred)
        m_pred = float((self.H @ x_pred)[0])
        S_pred = float((self.H @ P_pred @ self.H.T)[0, 0] + self.R)
        std_pred = max(math.sqrt(max(S_pred, 1e-8)), 1e-4)

        # 90% Predictive Interval (z = 1.64485)
        z90 = 1.64485
        lo90 = round(m_pred - z90 * std_pred, 3)
        hi90 = round(m_pred + z90 * std_pred, 3)
        mean_val = round(m_pred, 3)

        if lo90 > mean_val:
            lo90 = mean_val
        if hi90 < mean_val:
            hi90 = mean_val

        # --- 2. COMPUTE PERSONALIZED p_deviation (Frozen Definition) ---
        # Predictive probability outside the astronaut's personal baseline tolerance envelope:
        # Range: [personal_baseline - 2.0 * personal_sigma, personal_baseline + 2.0 * personal_sigma]
        bound_low = self.personal_baseline_level - (2.0 * self.personal_sigma)
        bound_high = self.personal_baseline_level + (2.0 * self.personal_sigma)

        prob_below = norm.cdf((bound_low - m_pred) / std_pred)
        prob_above = 1.0 - norm.cdf((bound_high - m_pred) / std_pred)
        p_deviation = float(min(1.0, max(0.0, prob_below + prob_above)))

        # --- 3. COMPUTE time_to_critical_min WITH UNCERTAINTY PROPAGATION ---
        time_to_critical = self._compute_time_to_critical(x_pred, P_pred)

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
            y = float(value)
            residual = y - m_pred
            K = (P_pred @ self.H.T) / S_pred
            self.x = x_pred + (K.flatten() * residual)
            I_KH = np.eye(2) - K @ self.H
            self.P = I_KH @ P_pred
            self.observation_count += 1
            # Adapt personal baseline level as personal evidence accumulates
            self.personal_baseline_level = float(self.x[0])
        else:
            self.x = x_pred
            self.P = P_pred

        return output

    def _compute_time_to_critical(
        self,
        x_state: np.ndarray,
        P_state: np.ndarray,
    ) -> TimeToCritical:
        """Forecasts first-crossing time using uncertainty propagation."""
        if not self.def_info:
            return TimeToCritical(p10=None, p50=None, p90=None)

        crit_low = self.def_info.critical_low
        crit_high = self.def_info.critical_high
        if crit_low is None and crit_high is None:
            return TimeToCritical(p10=None, p50=None, p90=None)

        current_mu = float(x_state[0])
        velocity = float(x_state[1])  # units per minute

        targets: List[Tuple[float, str]] = []
        if crit_low is not None and velocity < -1e-4:
            targets.append((crit_low, "low"))
        if crit_high is not None and velocity > 1e-4:
            targets.append((crit_high, "high"))

        if not targets:
            return TimeToCritical(p10=None, p50=None, p90=None)

        target_val, _ = targets[0]
        delta = target_val - current_mu
        t_50 = delta / velocity

        if t_50 <= 0 or t_50 > self.horizon_min:
            return TimeToCritical(p10=None, p50=None, p90=None)

        # Propagate state uncertainty to crossing time
        # sigma(tau)^2 = P_00 + 2*tau*P_01 + tau^2*P_11 + R
        p00 = P_state[0, 0]
        p01 = P_state[0, 1]
        p11 = P_state[1, 1]
        var_at_t50 = max(1e-6, p00 + 2.0 * t_50 * p01 + (t_50 ** 2) * p11 + self.R)
        sigma_at_t50 = math.sqrt(var_at_t50)

        # First-order delta method: sigma_t = sigma_obs / |velocity|
        sigma_t = min(sigma_at_t50 / max(abs(velocity), 1e-4), t_50 * 0.5)

        t_10 = max(0.0, t_50 - 1.28 * sigma_t)
        t_90 = min(self.horizon_min, t_50 + 1.28 * sigma_t)

        t_10 = round(min(t_10, t_50), 1)
        t_50 = round(t_50, 1)
        t_90 = round(max(t_90, t_50), 1)

        return TimeToCritical(p10=t_10, p50=t_50, p90=t_90)
