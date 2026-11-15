"""AstroCare X02: Per-Astronaut Bayesian Baseline (Audited N-of-1 Kalman Filter).

State-Space Formulation:
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
  personal baseline tolerance envelope [mu_personal - 2.0*sigma_personal, mu_personal + 2.0*sigma_personal].
  DISCLAIMER: Tolerance envelope (+/- 2 sigma) is a prototype decision-support assumption, NOT a validated medical standard.
- Robust baseline adaptation: Anomalous observations (p_deviation >= 0.5) are prevented from immediately
  shifting the personal baseline to hide future anomalies. Residuals are Huber-clipped during update.
- time_to_critical_min: trajectory uncertainty-propagated quantiles (p10, p50, p90) against configured limits.
  For daily sleep_hours, time_to_critical is explicitly null (daily total cannot project minute-scale crossing).
"""
from dataclasses import dataclass
from datetime import datetime, timezone
import json
import math
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
from scipy.stats import norm

from astrocare.config import METRIC_REGISTRY, MetricDefinition
from astrocare.models.registry import TimeToCritical, X02BaselineOutput

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SUPPORTED_METRICS: Tuple[str, ...] = tuple(METRIC_REGISTRY.keys())


@dataclass
class CrewPrior:
    metric: str
    mean: float
    variance: float
    within_sigma: float = 2.0
    trend_prior: float = 0.0
    trend_variance: float = 0.01
    circ_cos_coef: float = 0.0
    circ_sin_coef: float = 0.0


def fit_crew_prior(
    training_observations: Dict[str, Any],
    metric_name: str,
    training_timestamps: Optional[Dict[str, List[str]]] = None,
) -> CrewPrior:
    """Estimates crew prior, residual within-astronaut standard deviation, and learns circadian coefficients (N2, N3)."""
    if metric_name not in SUPPORTED_METRICS:
        raise ValueError(f"Metric '{metric_name}' is not in SUPPORTED_METRICS: {SUPPORTED_METRICS}")

    def_info = METRIC_REGISTRY.get(metric_name)
    all_vals: List[float] = []
    all_hours: List[float] = []
    astronaut_means: List[float] = []
    diff_residuals: List[float] = []
    within_residuals: List[float] = []

    for cid, vals in training_observations.items():
        valid_v: List[float] = []
        valid_h: List[float] = []
        ts_list = training_timestamps.get(cid, []) if training_timestamps else []

        for idx, item in enumerate(vals):
            if isinstance(item, tuple) and len(item) == 2:
                v, t_str = item
            else:
                v = item
                t_str = ts_list[idx] if idx < len(ts_list) else None

            if v is not None and not np.isnan(v):
                valid_v.append(float(v))
                if t_str:
                    try:
                        clean_ts = t_str.replace("Z", "+00:00")
                        dt = datetime.fromisoformat(clean_ts)
                        valid_h.append(dt.hour + dt.minute / 60.0 + dt.second / 3600.0)
                    except Exception:
                        pass

        if valid_v:
            all_vals.extend(valid_v)
            if len(valid_h) == len(valid_v):
                all_hours.extend(valid_h)
            m = float(np.mean(valid_v))
            astronaut_means.append(m)
            if len(valid_v) >= 2:
                within_residuals.extend([v - m for v in valid_v])
                # Successive squared difference method removes slow circadian drift without inflating R (Defect 12, N2)
                diffs = [((valid_v[i + 1] - valid_v[i]) ** 2) / 2.0 for i in range(len(valid_v) - 1)]
                diff_residuals.extend(diffs)

    if def_info:
        default_sigma = def_info.typical_sigma
    else:
        default_sigma = 2.0

    if len(astronaut_means) >= 2:
        prior_mean = float(np.mean(astronaut_means))
        prior_var = max(float(np.var(astronaut_means, ddof=1)), 0.1 * (default_sigma ** 2))
    elif len(all_vals) > 0:
        prior_mean = float(np.mean(all_vals))
        prior_var = max(float(np.var(all_vals)), 0.1 * (default_sigma ** 2))
    elif def_info:
        prior_mean = 0.5 * (def_info.nominal_min + def_info.nominal_max)
        prior_var = float(default_sigma ** 2)
    else:
        prior_mean = 100.0
        prior_var = 25.0

    if diff_residuals and len(diff_residuals) >= 2:
        diff_rms = math.sqrt(float(np.mean(diff_residuals)))
        within_sigma = max(diff_rms, 0.4 * default_sigma)
    elif within_residuals and len(within_residuals) >= 2:
        within_sigma = max(float(np.std(within_residuals, ddof=1)), 0.4 * default_sigma)
    elif def_info:
        within_sigma = float(def_info.typical_sigma)
    else:
        within_sigma = 2.0

    # Learn 24h harmonic regression circadian coefficients from data without oracle hardcoding (Defect N3)
    circ_cos_coef = 0.0
    circ_sin_coef = 0.0
    if len(all_hours) >= 48 and metric_name != "sleep_hours":
        try:
            omega = 2.0 * math.pi / 24.0
            cos_terms = np.cos(omega * np.array(all_hours))
            sin_terms = np.sin(omega * np.array(all_hours))
            A_mat = np.column_stack([cos_terms, sin_terms])
            y_detrend = np.array(all_vals) - prior_mean
            coefs, _, _, _ = np.linalg.lstsq(A_mat, y_detrend, rcond=None)
            circ_cos_coef = float(coefs[0])
            circ_sin_coef = float(coefs[1])
        except Exception:
            circ_cos_coef = 0.0
            circ_sin_coef = 0.0

    # Scale trend variance by within_sigma squared (unit consistent across temp, HR, glucose)
    trend_var = 0.001 * (within_sigma ** 2)

    return CrewPrior(
        metric=metric_name,
        mean=prior_mean,
        variance=prior_var,
        within_sigma=max(within_sigma, 1e-4),
        trend_prior=0.0,
        trend_variance=max(trend_var, 1e-6),
        circ_cos_coef=circ_cos_coef,
        circ_sin_coef=circ_sin_coef,
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
        if metric not in SUPPORTED_METRICS:
            raise ValueError(f"Metric '{metric}' is not supported. Supported metrics: {SUPPORTED_METRICS}")

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

        # Observation noise R and process drift q_scale estimated from data
        # For sleep_hours, cadence is daily (1 reading per day)
        self.is_daily = (metric == "sleep_hours")
        sigma_est = prior.within_sigma
        self.R = float((sigma_est * 0.6) ** 2)
        self.q_scale = float((sigma_est * 0.05) ** 2)

        # Personalized baseline tracking
        self.personal_sigma = float(sigma_est)
        self.personal_baseline_level = prior.mean
        self.last_dt_ts: Optional[datetime] = None
        self.observation_count = 0
        self.running_obs_sum = 0.0

    def _parse_ts(self, ts: str) -> datetime:
        """Parses and strictly validates ISO-8601 timestamp string with timezone, normalized to UTC."""
        if not isinstance(ts, str):
            raise ValueError(f"Timestamp must be an ISO-8601 string, got {type(ts)}")
        try:
            parsed = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        except Exception as exc:
            raise ValueError(f"Malformed ISO-8601 timestamp string '{ts}': {exc}") from exc
        if parsed.tzinfo is None:
            raise ValueError(f"Timestamp string '{ts}' must include timezone specification (e.g. 'Z' or '+00:00')")
        return parsed.astimezone(timezone.utc)

    def step(self, value: Optional[float], ts: str) -> X02BaselineOutput:
        """Causal one-step-ahead prediction with dynamic dt, followed by state update."""
        current_dt = self._parse_ts(ts)

        # Calculate dynamic dt in minutes from previous observation, rejecting out-of-order timestamps
        if self.last_dt_ts is not None:
            if current_dt <= self.last_dt_ts:
                raise ValueError(
                    f"Out-of-order timestamp for {self.crew_id}:{self.metric}. "
                    f"Current timestamp '{ts}' ({current_dt}) <= previous timestamp ({self.last_dt_ts})"
                )
            delta_sec = (current_dt - self.last_dt_ts).total_seconds()
            dt_min = delta_sec / 60.0
        else:
            cadence_sec = self.def_info.measurement_cadence_sec if self.def_info else 60.0
            dt_min = cadence_sec / 60.0

        self.last_dt_ts = current_dt

        # Scale dt appropriately for daily vs minute-cadence metrics
        if self.is_daily:
            # Measure time step in days (1440 min = 1 day) to prevent covariance explosion
            eff_dt = max(dt_min / 1440.0, 0.01)
            F = np.array([[1.0, 0.0], [0.0, 1.0]], dtype=float)
            Q = np.array([[self.q_scale * eff_dt, 0.0], [0.0, 0.0001 * self.q_scale * eff_dt]], dtype=float)
        else:
            eff_dt = dt_min
            F = np.array(
                [
                    [1.0, eff_dt],
                    [0.0, 1.0],
                ],
                dtype=float,
            )
            Q = np.array(
                [
                    [self.q_scale * eff_dt, 0.0],
                    [0.0, 0.001 * self.q_scale * eff_dt],
                ],
                dtype=float,
            )

        # --- 1. PREDICT STEP ---
        x_pred = F @ self.x
        P_pred = F @ self.P @ F.T + Q

        # Circadian phase modulation learned from training data (Defect N3)
        time_of_day_hours = (current_dt.hour + current_dt.minute / 60.0 + current_dt.second / 3600.0)
        omega = 2.0 * math.pi / 24.0
        if self.prior.circ_cos_coef != 0.0 or self.prior.circ_sin_coef != 0.0:
            c_circ = self.prior.circ_cos_coef * math.cos(omega * time_of_day_hours) + self.prior.circ_sin_coef * math.sin(omega * time_of_day_hours)
        else:
            c_circ = 0.0

        # Warm start personal baseline on initial observation if present (Defect 17)
        if self.observation_count == 0 and value is not None and not np.isnan(value):
            self.x[0] = float(value)
            self.personal_baseline_level = float(value)

        # Predictive observation distribution: y_hat ~ N(m_pred, S_pred)
        m_pred = float((self.H @ x_pred)[0]) + c_circ
        S_pred = float((self.H @ P_pred @ self.H.T)[0, 0] + self.R)
        std_pred = max(math.sqrt(max(S_pred, 1e-8)), 1e-4)

        # 90% Predictive Interval (z = 1.64485) centered on predictive observation mean (Defect N4)
        z90 = 1.64485
        mean_val = round(m_pred, 3)
        lo90 = round(mean_val - z90 * std_pred, 3)
        hi90 = round(mean_val + z90 * std_pred, 3)

        if lo90 > mean_val:
            lo90 = mean_val
        if hi90 < mean_val:
            hi90 = mean_val

        # --- 2. COMPUTE PERSONALIZED p_deviation ---
        # Tolerance envelope centered on time-of-day expected baseline (Defect N5)
        expected_nominal = self.personal_baseline_level + c_circ
        bound_low = expected_nominal - (2.0 * self.personal_sigma)
        bound_high = expected_nominal + (2.0 * self.personal_sigma)

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

        # --- 4. UPDATE STEP (CAUSAL & HUBER-ROBUST) ---
        if value is not None and not np.isnan(value):
            y = float(value)
            residual = y - m_pred

            # Relative Huber clipping bound: 8 * personal_sigma (clips +30 bpm shift, no absolute 35.0 floor, Defect 16)
            huber_bound = 8.0 * self.personal_sigma
            clipped_residual = float(np.clip(residual, -huber_bound, huber_bound))

            K = (P_pred @ self.H.T) / S_pred
            self.x = x_pred + (K.flatten() * clipped_residual)
            I_KH = np.eye(2) - K @ self.H
            self.P = I_KH @ P_pred

            # Exclude gated anomalies from running sum (Defect 20)
            if p_deviation < 0.5:
                self.observation_count += 1
                self.running_obs_sum += y

                # Partial pooling empirical Bayes shrinkage over observation count:
                # When N is small (< 15), mean is shrunk toward crew prior; smoothly shifts to individual data
                n_obs = float(self.observation_count)
                n_prior_weight = 15.0
                shrunk_mean = (n_prior_weight * self.prior.mean + self.running_obs_sum) / (n_prior_weight + n_obs)

                # Robust baseline adaptation: adapt only on observations within nominal tolerance
                if abs(y - self.personal_baseline_level) <= 2.0 * self.personal_sigma:
                    alpha = 0.05
                    self.personal_baseline_level = (1.0 - alpha) * self.personal_baseline_level + alpha * shrunk_mean
                    # Update personal sigma dynamically (Defect 14)
                    dev = abs(y - self.personal_baseline_level)
                    self.personal_sigma = 0.95 * self.personal_sigma + 0.05 * max(dev, 0.5 * self.prior.within_sigma)
        else:
            self.x = x_pred
            self.P = P_pred

        return output

    def _compute_time_to_critical(
        self,
        x_state: np.ndarray,
        P_state: np.ndarray,
    ) -> TimeToCritical:
        """Forecasts first-crossing time using uncertainty propagation.
        
        Returns null for sleep_hours, as daily totals cannot project minute-scale crossings.
        Returns 0.0 if the state is already at or past the critical threshold.
        """
        if self.is_daily:
            return TimeToCritical(p10=None, p50=None, p90=None)

        if not self.def_info:
            return TimeToCritical(p10=None, p50=None, p90=None)

        crit_low = self.def_info.critical_low
        crit_high = self.def_info.critical_high
        if crit_low is None and crit_high is None:
            return TimeToCritical(p10=None, p50=None, p90=None)

        current_mu = float(x_state[0])
        velocity = float(x_state[1])  # units per minute

        # Immediate critical check: if already at or past limit, TTC is 0.0 minutes
        if crit_low is not None and current_mu <= crit_low:
            return TimeToCritical(p10=0.0, p50=0.0, p90=0.0)
        if crit_high is not None and current_mu >= crit_high:
            return TimeToCritical(p10=0.0, p50=0.0, p90=0.0)

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
        p00 = P_state[0, 0]
        p01 = P_state[0, 1]
        p11 = P_state[1, 1]
        var_at_t50 = max(1e-6, p00 + 2.0 * t_50 * p01 + (t_50 ** 2) * p11 + self.R)
        sigma_at_t50 = math.sqrt(var_at_t50)

        # Delta method for crossing uncertainty without arbitrary artificial clamping (Defect 21)
        sigma_t = sigma_at_t50 / max(abs(velocity), 1e-4)

        t_10 = max(0.0, t_50 - 1.28 * sigma_t)
        t_90 = min(self.horizon_min, t_50 + 1.28 * sigma_t)

        t_10 = round(min(t_10, t_50), 1)
        t_50 = round(t_50, 1)
        t_90 = round(max(t_90, t_50), 1)

        return TimeToCritical(p10=t_10, p50=t_50, p90=t_90)


class X02MultiCrewRunner:
    """Multi-crew, multi-metric runner executing X02 Kalman filters across all streams.
    
    Provides file-backed output generation and streaming endpoints for consumer integration.
    """

    def __init__(self, training_history: Dict[str, Dict[str, List[float]]]):
        self.priors: Dict[str, CrewPrior] = {}
        for met in SUPPORTED_METRICS:
            met_obs = {cid: training_history[cid].get(met, []) for cid in training_history}
            self.priors[met] = fit_crew_prior(met_obs, met)

        self.filters: Dict[Tuple[str, str], X02AstronautMetricFilter] = {}

    def get_filter(self, crew_id: str, metric: str) -> X02AstronautMetricFilter:
        key = (crew_id, metric)
        if key not in self.filters:
            prior = self.priors.get(metric) or fit_crew_prior({}, metric)
            self.filters[key] = X02AstronautMetricFilter(crew_id, metric, prior)
        return self.filters[key]

    def process_record(self, record: Any, strict: bool = False) -> Optional[X02BaselineOutput]:
        if record.metric not in METRIC_REGISTRY:
            return None
        flt = self.get_filter(record.crew_id, record.metric)
        try:
            return flt.step(record.value, record.ts)
        except ValueError:
            if strict:
                raise
            return None

    def process_stream_to_file(self, records: List[Any], output_file: Path) -> int:
        output_file.parent.mkdir(parents=True, exist_ok=True)
        count = 0
        with open(output_file, "w", encoding="utf-8") as f:
            for rec in records:
                out = self.process_record(rec)
                if out is not None:
                    f.write(json.dumps(out.to_dict()) + "\n")
                    count += 1
        return count


def generate_hour6_handoff_artifact(
    output_path: Optional[Path] = None,
    total_hours: float = 6.0,
    seed: int = 42,
) -> Path:
    """Generates file-backed Hour-6 multi-crew telemetry handoff stream (Defect 23).
    
    Streams 6 hours of causal telemetry across all astronauts through X02MultiCrewRunner
    and writes structured X02BaselineOutput records to a JSONL handoff artifact.
    """
    from astrocare.simulator.engine import VitalsSimulator
    target = output_path or (REPO_ROOT / "artifacts" / "handoff" / "x02_hour6_handoff.jsonl")
    target.parent.mkdir(parents=True, exist_ok=True)

    sim = VitalsSimulator(seed=seed)
    total_steps = int(total_hours * 60)
    records = list(sim.stream_records(total_steps=total_steps, step_seconds=60.0))

    # Train priors on initial reference data
    train_history: Dict[str, Dict[str, List[float]]] = {
        cid: {m: [] for m in SUPPORTED_METRICS} for cid in ["ASTRO-01", "ASTRO-02", "ASTRO-03", "ASTRO-04"]
    }
    for r in records[:120]:
        if r.value is not None:
            train_history[r.crew_id][r.metric].append(r.value)

    runner = X02MultiCrewRunner(train_history)
    runner.process_stream_to_file(records, target)
    return target


def read_hour6_handoff_endpoint(
    crew_id: Optional[str] = None,
    metric: Optional[str] = None,
    limit: int = 50,
    artifact_path: Optional[Path] = None,
) -> List[Dict[str, Any]]:
    """Serving endpoint querying the file-backed Hour-6 handoff stream."""
    target = artifact_path or (REPO_ROOT / "artifacts" / "handoff" / "x02_hour6_handoff.jsonl")
    if not target.exists():
        generate_hour6_handoff_artifact(target)

    results: List[Dict[str, Any]] = []
    with open(target, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            entry = json.loads(line)
            if crew_id and entry.get("crew_id") != crew_id:
                continue
            if metric and entry.get("metric") != metric:
                continue
            results.append(entry)
            if len(results) >= limit:
                break
    return results


if __name__ == "__main__":
    out_file = generate_hour6_handoff_artifact()
    print(f"Generated Hour-6 multi-crew telemetry handoff artifact at: {out_file}")
