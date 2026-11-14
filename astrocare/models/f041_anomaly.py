"""AstroCare F041: Unsupervised Anomaly Detection Ensemble.

Implements three comparative anomaly detectors:
1. Isolation Forest (multivariate / per-metric feature space)
2. Robust Z-score (Rolling Median + MAD)
3. Simple Fixed-threshold baseline

Evaluates models at equal false-alarm rates (FAR) calibrated strictly on validation data.
Includes N14/N15 metrics: glucose and sleep_hours, tagged with hazard and body_region.

Decision-support prototype on synthetic and public data.
Synthetic proxy labels; NOT clinical ground truth.
"""
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.metrics import average_precision_score, roc_auc_score

from astrocare.config import METRIC_REGISTRY
from astrocare.models.baselines import F018RollingRobustBaseline, FixedThresholdBaseline


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


class F041IsolationForestDetector:
    """Isolation Forest anomaly detector fitted on nominal training vitals."""

    def __init__(self, random_state: int = 42, contamination: float = 0.03):
        self.random_state = random_state
        self.contamination = contamination
        self.model = IsolationForest(
            contamination=contamination,
            random_state=random_state,
            n_estimators=100,
        )
        self.threshold: float = 0.0
        self.is_fitted = False

    def fit(self, X_train: np.ndarray) -> "F041IsolationForestDetector":
        """Fits on training nominal feature vectors."""
        # Clean NaNs
        clean_X = np.nan_to_num(X_train, nan=0.0)
        self.model.fit(clean_X)
        self.is_fitted = True
        return self

    def calibrate_threshold(self, X_val_nominal: np.ndarray, target_fpr: float = 0.05) -> float:
        """Calibrates score threshold strictly on nominal validation set for target FPR."""
        scores = self.score_samples(X_val_nominal)
        # Higher score = more anomalous
        self.threshold = float(np.percentile(scores, (1.0 - target_fpr) * 100.0))
        return self.threshold

    def score_samples(self, X: np.ndarray) -> np.ndarray:
        """Returns anomaly score where higher values denote greater anomaly."""
        clean_X = np.nan_to_num(X, nan=0.0)
        if not self.is_fitted:
            # Fallback if not fitted yet
            return np.zeros(len(clean_X))
        # IsolationForest decision_function: lower means more anomalous. Invert for standard score.
        return -self.model.decision_function(clean_X)

    def predict(self, X: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        scores = self.score_samples(X)
        alerts = (scores >= self.threshold).astype(int)
        return alerts, scores


class F041RobustZDetector:
    """Robust Z-Score detector using Median + MAD."""

    def __init__(self, metric_name: str, window_size: int = 30):
        self.metric_name = metric_name
        self.baseline = F018RollingRobustBaseline(metric_name, window_size=window_size)
        self.threshold: float = 2.5

    def calibrate_threshold(self, values_val_nominal: List[float], target_fpr: float = 0.05) -> float:
        scores: List[float] = []
        temp_flt = F018RollingRobustBaseline(self.metric_name, window_size=30)
        for v in values_val_nominal:
            if v is not None:
                res = temp_flt.update_and_predict(v)
                scores.append(res["z_score"])
        if scores:
            self.threshold = float(np.percentile(scores, (1.0 - target_fpr) * 100.0))
        return self.threshold

    def score_single(self, value: Optional[float]) -> Tuple[int, float]:
        res = self.baseline.update_and_predict(value)
        z = res["z_score"]
        is_alert = 1 if z >= self.threshold else 0
        return is_alert, z


class F041FixedThresholdDetector:
    """Fixed-threshold baseline detector."""

    def __init__(self, metric_name: str):
        self.metric_name = metric_name
        self.baseline = FixedThresholdBaseline(metric_name)
        self.threshold: float = 1.0  # Normalized distance >= 1.0 means outside nominal

    def calibrate_threshold(self, values_val_nominal: List[float], target_fpr: float = 0.05) -> float:
        scores: List[float] = []
        for v in values_val_nominal:
            if v is not None:
                scores.append(self.baseline.predict(v)["score"])
        if scores:
            self.threshold = float(np.percentile(scores, (1.0 - target_fpr) * 100.0))
        return self.threshold

    def score_single(self, value: Optional[float]) -> Tuple[int, float]:
        res = self.baseline.predict(value)
        score = res["score"]
        is_alert = 1 if score >= self.threshold else 0
        return is_alert, score


def evaluate_detector_predictions(
    y_true: np.ndarray,
    scores: np.ndarray,
    alerts: np.ndarray,
    steps_per_day: float = 1440.0,
    anomaly_start_indices: Optional[List[int]] = None,
) -> Dict[str, Any]:
    """Calculates evaluation metrics at frozen calibrated threshold."""
    y_true = np.array(y_true).astype(int)
    scores = np.array(scores)
    alerts = np.array(alerts).astype(int)

    total_samples = len(y_true)
    num_pos = int(np.sum(y_true))
    num_neg = total_samples - num_pos

    # True positives, False positives, False alarms
    tp = int(np.sum((alerts == 1) & (y_true == 1)))
    fp = int(np.sum((alerts == 1) & (y_true == 0)))
    fn = int(np.sum((alerts == 0) & (y_true == 1)))
    tn = int(np.sum((alerts == 0) & (y_true == 0)))

    recall = float(tp / num_pos) if num_pos > 0 else 0.0
    precision = float(tp / (tp + fp)) if (tp + fp) > 0 else 0.0
    fpr = float(fp / num_neg) if num_neg > 0 else 0.0

    # False alarms per crew-day (assuming steps_per_day observations)
    days_evaluated = max(total_samples / steps_per_day, 0.01)
    fa_per_crew_day = float(fp / days_evaluated)

    # AUROC & PR AUC
    auroc = None
    pr_auc = None
    if num_pos > 0 and num_neg > 0 and len(np.unique(y_true)) > 1:
        try:
            auroc = float(roc_auc_score(y_true, scores))
            pr_auc = float(average_precision_score(y_true, scores))
        except Exception:
            pass

    # Detection latency: steps from anomaly injection until first alert
    latencies: List[int] = []
    if anomaly_start_indices:
        for start_idx in anomaly_start_indices:
            # Look ahead for first alert
            found = False
            for step in range(start_idx, min(start_idx + 120, total_samples)):
                if alerts[step] == 1 and y_true[step] == 1:
                    latencies.append(step - start_idx)
                    found = True
                    break
            if not found:
                latencies.append(120)  # Max penalty latency
    mean_latency = float(np.mean(latencies)) if latencies else None

    return {
        "total_samples": total_samples,
        "true_positives": tp,
        "false_positives": fp,
        "recall": round(recall, 4),
        "precision": round(precision, 4),
        "false_positive_rate": round(fpr, 4),
        "false_alarms_per_crew_day": round(fa_per_crew_day, 3),
        "detection_latency_steps": round(mean_latency, 2) if mean_latency is not None else None,
        "auroc": round(auroc, 4) if auroc is not None else None,
        "pr_auc": round(pr_auc, 4) if pr_auc is not None else None,
    }
