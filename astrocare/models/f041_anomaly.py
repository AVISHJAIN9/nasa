"""AstroCare F041: Unsupervised Anomaly Detection Ensemble (Audited).

Implements three comparative anomaly detectors evaluated on IDENTICAL input features:
1. Isolation Forest (per-metric or multivariate)
2. Robust Z-score (Rolling Median + MAD)
3. Simple Fixed-threshold baseline

Calibration & Evaluation Protocol:
- Thresholds are calibrated strictly on independent validation nominal streams for a target false positive rate (FAR).
- Comparison models receive IDENTICAL feature representations on held-out LOSO scenario test folds.
- Reports empirical test FAR alongside recall, precision, AUROC, and PR-AUC.
- Anomaly labels are evaluated at the metric-specific level.

Decision-support prototype on synthetic and public data.
Synthetic proxy labels; NOT clinical ground truth.
"""
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.exceptions import NotFittedError
from sklearn.metrics import average_precision_score, roc_auc_score

from astrocare.config import METRIC_REGISTRY
from astrocare.models.baselines import F018RollingRobustBaseline, FixedThresholdBaseline


# Official NASA Human Spaceflight Hazards (RIDGE):
# Radiation, Isolation, Distance, Gravity, Hostile/Closed Environment
NASA_HAZARDS = {"radiation", "isolation", "distance", "gravity", "closed_environment", "hostile_closed_environment"}
APPROVED_BODY_REGIONS = {"heart", "lungs", "brain", "bones_muscle", "eyes", "gut", "whole_body", "general"}

METRIC_BODY_REGION_MAP = {
    "heart_rate": "heart",
    "systolic_bp": "heart",
    "diastolic_bp": "heart",
    "hrv_rmssd": "heart",
    "spo2": "lungs",
    "respiration_rate": "lungs",
    "body_temp": "whole_body",
    "glucose": "gut",
    "sleep_hours": "brain",
}


@dataclass
class AnomalyAlert:
    step_idx: int
    ts: str
    crew_id: str
    metric: str
    detector: str
    raw_score: float
    is_anomaly: int
    threshold: float
    hazard_tag: Optional[str] = None
    body_region: str = "general"


def create_anomaly_alert(
    step_idx: int,
    ts: str,
    crew_id: str,
    metric: str,
    detector: str,
    raw_score: float,
    threshold: float,
    is_anomaly: int,
    hazard_tag: Optional[str] = None,
    body_region: Optional[str] = None,
) -> AnomalyAlert:
    """Constructs a validated AnomalyAlert with mandatory metadata invariants."""
    reg_entry = METRIC_REGISTRY.get(metric)
    if body_region and body_region in APPROVED_BODY_REGIONS:
        resolved_region = body_region
    elif reg_entry and reg_entry.body_region in APPROVED_BODY_REGIONS:
        resolved_region = reg_entry.body_region
    elif metric in METRIC_BODY_REGION_MAP:
        resolved_region = METRIC_BODY_REGION_MAP[metric]
    else:
        resolved_region = "general"

    # Invariant: If is_anomaly == 1, map to valid NASA hazard without inventing tags (Defect 43)
    resolved_hazard = None
    if is_anomaly and hazard_tag:
        if hazard_tag in NASA_HAZARDS:
            resolved_hazard = hazard_tag
        else:
            resolved_hazard = None

    return AnomalyAlert(
        step_idx=step_idx,
        ts=ts,
        crew_id=crew_id,
        metric=metric,
        detector=detector,
        raw_score=round(float(raw_score), 4),
        is_anomaly=int(is_anomaly),
        threshold=round(float(threshold), 4),
        hazard_tag=resolved_hazard,
        body_region=resolved_region,
    )


class F041IsolationForestDetector:
    """Isolation Forest anomaly detector fitted on relative baseline deviations (Defects 2, 39, N6).
    
    Using relative deviations z = (value - baseline) / typical_sigma allows a model fit
    on one astronaut or crew cohort to generalize across all crew members without
    suffering from personal resting baseline differences.
    """

    def __init__(
        self,
        metric_name: str = "heart_rate",
        random_state: int = 42,
        contamination: float = 0.05,
        astronaut_baseline: Optional[float] = None,
    ):
        self.metric_name = metric_name
        self.random_state = random_state
        self.contamination = contamination
        self.astronaut_baseline = astronaut_baseline
        self.def_info = METRIC_REGISTRY.get(metric_name)
        self.typical_sigma = self.def_info.typical_sigma if self.def_info else 1.0
        self.nominal_mid = (
            0.5 * (self.def_info.nominal_min + self.def_info.nominal_max)
            if self.def_info else 0.0
        )
        self.baseline_val = astronaut_baseline if astronaut_baseline is not None else self.nominal_mid
        self.model = IsolationForest(
            contamination=contamination,
            random_state=random_state,
            n_estimators=100,
        )
        self.threshold: float = 0.0
        self.is_fitted = False

    def set_astronaut_baseline(self, baseline: float) -> None:
        """Adapts the baseline reference to a specific astronaut."""
        self.astronaut_baseline = baseline
        self.baseline_val = baseline

    def reset(self) -> None:
        """Resets detector state."""
        self.model = IsolationForest(
            contamination=self.contamination,
            random_state=self.random_state,
            n_estimators=100,
        )
        self.is_fitted = False
        self.threshold = 0.0

    def _to_relative_features(self, X: Any) -> np.ndarray:
        arr = np.array(X, dtype=float)
        # Person-relative centering
        dev = (arr - self.baseline_val) / max(self.typical_sigma, 1e-4)
        if dev.ndim == 1:
            dev = dev.reshape(-1, 1)
        return np.nan_to_num(dev, nan=0.0)

    def fit(self, X_train: Any) -> "F041IsolationForestDetector":
        clean_arr = np.array(X_train, dtype=float)
        if self.astronaut_baseline is None and len(clean_arr) > 0:
            self.baseline_val = float(np.nanmedian(clean_arr))
        clean_X = self._to_relative_features(clean_arr)
        self.model.fit(clean_X)
        self.is_fitted = True
        return self

    def calibrate_threshold(self, X_val_nominal: Any, target_fpr: float = 0.05) -> float:
        if not self.is_fitted:
            raise NotFittedError("F041IsolationForestDetector must be fitted before calibration.")
        scores = self.score_samples(X_val_nominal)
        self.threshold = float(np.percentile(scores, (1.0 - target_fpr) * 100.0))
        return self.threshold

    def score_samples(self, X: Any) -> np.ndarray:
        if not self.is_fitted:
            raise NotFittedError("F041IsolationForestDetector is not fitted yet. Call fit() first.")
        clean_X = self._to_relative_features(X)
        # IsolationForest decision_function: lower means more anomalous; invert for continuous anomaly score
        return -self.model.decision_function(clean_X)

    def score_single(self, value: Optional[float]) -> Tuple[int, float]:
        """Causal single-observation scoring. Missing readings (None) do not alert."""
        if not self.is_fitted:
            raise NotFittedError("F041IsolationForestDetector is not fitted yet. Call fit() first.")
        if value is None or np.isnan(value):
            return 0, 0.0
        score = float(self.score_samples(np.array([value]))[0])
        is_alert = 1 if score >= self.threshold else 0
        return is_alert, score

    def score_sequence(self, values: List[Optional[float]]) -> Tuple[np.ndarray, np.ndarray]:
        """Scores an observation sequence symmetrically with baseline detectors."""
        if not self.is_fitted:
            raise NotFittedError("F041IsolationForestDetector is not fitted yet. Call fit() first.")
        n = len(values)
        scores = np.zeros(n, dtype=float)
        alerts = np.zeros(n, dtype=int)
        valid_indices = [i for i, v in enumerate(values) if v is not None and not np.isnan(v)]
        if valid_indices:
            valid_vals = np.array([values[i] for i in valid_indices], dtype=float)
            valid_scores = self.score_samples(valid_vals)
            for idx, s in zip(valid_indices, valid_scores):
                scores[idx] = s
                alerts[idx] = 1 if s >= self.threshold else 0
        return alerts, scores

    def predict(self, X: Any) -> Tuple[np.ndarray, np.ndarray]:
        scores = self.score_samples(X)
        alerts = (scores >= self.threshold).astype(int)
        return alerts, scores


class F041RobustZDetector:
    """Robust Z-Score detector using Median + MAD over a sliding window."""

    def __init__(self, metric_name: str, window_size: int = 30, astronaut_baseline: Optional[float] = None):
        self.metric_name = metric_name
        self.window_size = window_size
        self.astronaut_baseline = astronaut_baseline
        self.baseline = F018RollingRobustBaseline(metric_name, window_size=window_size, astronaut_baseline=astronaut_baseline)
        self.threshold: float = 2.5

    def reset(self) -> None:
        """Clears rolling window state to prevent fold-to-fold leakage."""
        self.baseline.reset()

    def calibrate_threshold(self, values_val_nominal: List[float], target_fpr: float = 0.05) -> float:
        scores: List[float] = []
        temp_flt = F018RollingRobustBaseline(
            self.metric_name,
            window_size=self.window_size,
            astronaut_baseline=self.astronaut_baseline,
        )
        for v in values_val_nominal:
            if v is not None:
                res = temp_flt.update_and_predict(v)
                scores.append(res["z_score"])
        if scores:
            self.threshold = float(np.percentile(scores, (1.0 - target_fpr) * 100.0))
        return self.threshold

    def score_single(self, value: Optional[float]) -> Tuple[int, float]:
        if value is None:
            return 0, 0.0
        res = self.baseline.update_and_predict(value)
        z = res["z_score"]
        is_alert = 1 if z >= self.threshold else 0
        return is_alert, z

    def score_sequence(self, values: List[Optional[float]]) -> Tuple[np.ndarray, np.ndarray]:
        alerts: List[int] = []
        scores: List[float] = []
        for v in values:
            a, s = self.score_single(v)
            alerts.append(a)
            scores.append(s)
        return np.array(alerts), np.array(scores)


class F041FixedThresholdDetector:
    """Fixed-threshold baseline detector."""

    def __init__(self, metric_name: str):
        self.metric_name = metric_name
        self.baseline = FixedThresholdBaseline(metric_name)
        self.threshold: float = 1.0

    def reset(self) -> None:
        """No internal state, but provided for interface symmetry."""
        pass

    def calibrate_threshold(self, values_val_nominal: List[float], target_fpr: float = 0.05) -> float:
        scores: List[float] = []
        for v in values_val_nominal:
            if v is not None:
                scores.append(self.baseline.predict(v)["score"])
        if scores:
            self.threshold = max(float(np.percentile(scores, (1.0 - target_fpr) * 100.0)), 1e-4)
        return self.threshold

    def score_single(self, value: Optional[float]) -> Tuple[int, float]:
        if value is None:
            return 0, 0.0
        res = self.baseline.predict(value)
        score = res["score"]
        is_alert = 1 if score >= self.threshold else 0
        return is_alert, score

    def score_sequence(self, values: List[Optional[float]]) -> Tuple[np.ndarray, np.ndarray]:
        alerts: List[int] = []
        scores: List[float] = []
        for v in values:
            a, s = self.score_single(v)
            alerts.append(a)
            scores.append(s)
        return np.array(alerts), np.array(scores)


class F041EnsembleDetector:
    """F041 Ensemble Anomaly Detector combining Isolation Forest and Robust-Z.

    Combines complementary inductive biases:
    - Isolation Forest captures non-parametric density sparsity.
    - Robust-Z captures sudden local deviations from personal rolling median.
    Normalized continuous scores are fused via max or weighted combination,
    and alert decisions use calibrated thresholding or consensus voting.
    """

    def __init__(
        self,
        metric_name: str = "heart_rate",
        random_state: int = 42,
        window_size: int = 30,
        astronaut_baseline: Optional[float] = None,
        fusion_method: str = "max",
    ):
        self.metric_name = metric_name
        self.fusion_method = fusion_method
        self.if_detector = F041IsolationForestDetector(metric_name=metric_name, random_state=random_state)
        self.rob_detector = F041RobustZDetector(metric_name=metric_name, window_size=window_size, astronaut_baseline=astronaut_baseline)
        self.fix_detector = F041FixedThresholdDetector(metric_name=metric_name)
        self.threshold: float = 0.5
        self.is_fitted: bool = False

    def reset(self) -> None:
        self.rob_detector.reset()
        self.fix_detector.reset()

    def fit(self, X_train: Any) -> "F041EnsembleDetector":
        self.if_detector.fit(X_train)
        self.is_fitted = True
        return self

    def calibrate_threshold(self, X_val_nominal: Any, target_fpr: float = 0.05) -> float:
        self.if_detector.calibrate_threshold(X_val_nominal, target_fpr=target_fpr)
        self.rob_detector.calibrate_threshold(list(X_val_nominal), target_fpr=target_fpr)
        self.fix_detector.calibrate_threshold(list(X_val_nominal), target_fpr=target_fpr)

        # Calibrate ensemble threshold on validation sequence
        _, scores = self.score_sequence(list(X_val_nominal))
        if len(scores) > 0:
            self.threshold = float(np.percentile(scores, (1.0 - target_fpr) * 100.0))
        return self.threshold

    def score_single(self, value: Optional[float]) -> Tuple[int, float]:
        if value is None or np.isnan(value):
            return 0, 0.0

        if_alert, if_score = self.if_detector.score_single(value)
        rob_alert, rob_score = self.rob_detector.score_single(value)
        fix_alert, fix_score = self.fix_detector.score_single(value)

        # Normalize scores to pseudo-probabilities [0, 1]
        norm_if = 1.0 / (1.0 + np.exp(-if_score))
        norm_rob = float(1.0 - np.exp(-0.5 * (max(rob_score, 0.0) ** 2)))
        norm_fix = float(min(1.0, max(0.0, fix_score / 2.0)))

        if self.fusion_method == "max":
            ens_score = max(norm_if, norm_rob)
        else:
            ens_score = 0.6 * norm_rob + 0.4 * norm_if

        # Calibrated decision strictly from continuous ensemble score (Defect N6 / F041 FAR)
        is_alert = 1 if ens_score >= self.threshold else 0
        return is_alert, float(ens_score)

    def score_sequence(self, values: List[Optional[float]]) -> Tuple[np.ndarray, np.ndarray]:
        n = len(values)
        alerts = np.zeros(n, dtype=int)
        scores = np.zeros(n, dtype=float)
        # Fast bulk scoring for IF (vectorized)
        _, if_scores = self.if_detector.score_sequence(values)
        for i, v in enumerate(values):
            if v is None or np.isnan(v):
                continue
            rob_alert, rob_score = self.rob_detector.score_single(v)
            fix_alert, fix_score = self.fix_detector.score_single(v)
            if_score = if_scores[i]

            norm_if = 1.0 / (1.0 + np.exp(-if_score))
            norm_rob = float(1.0 - np.exp(-0.5 * (max(rob_score, 0.0) ** 2)))
            norm_fix = float(min(1.0, max(0.0, fix_score / 2.0)))

            if self.fusion_method == "max":
                ens_score = max(norm_if, norm_rob)
            else:
                ens_score = 0.6 * norm_rob + 0.4 * norm_if

            is_alert = 1 if ens_score >= self.threshold else 0
            alerts[i] = is_alert
            scores[i] = float(ens_score)
        return alerts, scores


def evaluate_detector_predictions(
    y_true: np.ndarray,
    scores: np.ndarray,
    alerts: np.ndarray,
    target_fpr: float = 0.05,
    metric_name: Optional[str] = None,
    cadence_sec: Optional[float] = None,
    anomaly_start_indices: Optional[List[int]] = None,
) -> Dict[str, Any]:
    """Calculates objective evaluation metrics at the calibrated threshold, accounting for metric cadence."""
    y_true = np.array(y_true).astype(int)
    scores = np.array(scores)
    alerts = np.array(alerts).astype(int)

    total_samples = len(y_true)
    num_pos = int(np.sum(y_true))
    num_neg = total_samples - num_pos

    tp = int(np.sum((alerts == 1) & (y_true == 1)))
    fp = int(np.sum((alerts == 1) & (y_true == 0)))
    fn = int(np.sum((alerts == 0) & (y_true == 1)))
    tn = int(np.sum((alerts == 0) & (y_true == 0)))

    recall = float(tp / num_pos) if num_pos > 0 else None
    precision = float(tp / (tp + fp)) if (tp + fp) > 0 else (None if num_pos == 0 else 0.0)
    fpr = float(fp / num_neg) if num_neg > 0 else 0.0

    # Determine metric cadence to correctly compute days evaluated and false alarms per crew-day
    if cadence_sec is not None:
        eff_cadence_sec = float(cadence_sec)
    elif metric_name == "sleep_hours":
        eff_cadence_sec = 86400.0  # Daily cadence (1 sample per crew-day)
    elif metric_name == "glucose":
        eff_cadence_sec = 300.0    # 5-minute CGM cadence (288 samples per crew-day)
    elif metric_name == "heart_rate":
        eff_cadence_sec = 60.0     # 1-minute telemetry cadence (1440 samples per crew-day)
    elif metric_name and metric_name in METRIC_REGISTRY:
        eff_cadence_sec = float(METRIC_REGISTRY[metric_name].measurement_cadence_sec)
    else:
        eff_cadence_sec = 60.0

    samples_per_day = max(86400.0 / eff_cadence_sec, 1.0)
    days_evaluated = max(total_samples / samples_per_day, 0.01)
    fa_per_crew_day = float(fp / days_evaluated)

    auroc = None
    pr_auc = None
    if num_pos > 0 and num_neg > 0 and len(np.unique(y_true)) > 1:
        try:
            auroc = float(roc_auc_score(y_true, scores))
            pr_auc = float(average_precision_score(y_true, scores))
        except Exception:
            pass

    latencies: List[int] = []
    censored_count = 0
    if anomaly_start_indices:
        for start_idx in anomaly_start_indices:
            found = False
            for step in range(start_idx, total_samples):
                if alerts[step] == 1 and y_true[step] == 1:
                    latencies.append(step - start_idx)
                    found = True
                    break
            if not found:
                censored_count += 1

    mean_latency_steps = float(np.mean(latencies)) if latencies else None
    latency_time_min = (
        round(mean_latency_steps * (eff_cadence_sec / 60.0), 2)
        if mean_latency_steps is not None else None
    )

    return {
        "total_samples": total_samples,
        "true_positives": tp,
        "false_positives": fp,
        "target_validation_fpr": round(target_fpr, 4),
        "empirical_test_fpr": round(fpr, 4),
        "recall": round(recall, 4) if recall is not None else None,
        "precision": round(precision, 4) if precision is not None else None,
        "false_alarms_per_crew_day": round(fa_per_crew_day, 3),
        "detection_latency_steps": round(mean_latency_steps, 2) if mean_latency_steps is not None else None,
        "detection_latency_min": latency_time_min,
        "censored": bool(censored_count > 0 or (bool(anomaly_start_indices) and len(latencies) == 0)),
        "max_test_duration_observed_steps": int(total_samples - min(anomaly_start_indices)) if anomaly_start_indices else total_samples,
        "cadence_sec": eff_cadence_sec,
        "samples_per_day": samples_per_day,
        "auroc": round(auroc, 4) if auroc is not None else None,
        "pr_auc": round(pr_auc, 4) if pr_auc is not None else None,
    }
