"""AstroCare Baselines: Fixed Thresholds and F018 Rolling Median + MAD (Robust-Z).

Provides comparison models evaluated under identical LOPO/LOSO protocols.
Decision-support prototype on synthetic and public data.
"""
from collections import deque
from dataclasses import dataclass
from typing import Dict, List, Optional
import numpy as np

from astrocare.config import METRIC_REGISTRY, MetricDefinition


class FixedThresholdBaseline:
    """Fixed population-level threshold baseline."""

    def __init__(self, metric_name: str):
        self.metric_name = metric_name
        self.def_info = METRIC_REGISTRY.get(metric_name)

    def predict(self, value: Optional[float]) -> Dict[str, float]:
        if value is None or self.def_info is None:
            return {"is_alert": 0, "score": 0.0}
        
        # Deviation if outside nominal min/max
        is_outside = (value < self.def_info.nominal_min) or (value > self.def_info.nominal_max)
        
        # Continuous score: normalized distance from midpoint
        mid = 0.5 * (self.def_info.nominal_min + self.def_info.nominal_max)
        half_range = 0.5 * (self.def_info.nominal_max - self.def_info.nominal_min)
        score = abs(value - mid) / max(half_range, 1e-6)
        return {
            "is_alert": 1 if is_outside else 0,
            "score": float(score),
        }


class F018RollingRobustBaseline:
    """F018 Personal baseline calculator: Rolling Median + MAD (Robust Z-Score).

    Uses a sliding window of recent personal observations to compute median and MAD,
    producing an adaptive robust z-score: z = (x - median) / (1.4826 * MAD).
    """

    def __init__(self, metric_name: str, window_size: int = 30):
        self.metric_name = metric_name
        self.window_size = window_size
        self.window = deque(maxlen=window_size)
        self.def_info = METRIC_REGISTRY.get(metric_name)

    def update_and_predict(self, value: Optional[float]) -> Dict[str, float]:
        if value is None:
            return {"is_alert": 0, "z_score": 0.0, "p_dev": 0.0}

        # Calculate prediction BEFORE appending current value (causal one-step-ahead)
        if len(self.window) < 5:
            # Cold start fallback to registry typical sigma and mid
            if self.def_info:
                mid = 0.5 * (self.def_info.nominal_min + self.def_info.nominal_max)
                sigma = self.def_info.typical_sigma
            else:
                mid = value
                sigma = 1.0
            z = abs(value - mid) / max(sigma, 1e-6)
        else:
            arr = np.array(self.window)
            med = float(np.median(arr))
            mad = float(np.median(np.abs(arr - med)))
            sigma_robust = max(1.4826 * mad, 1e-4)
            z = abs(value - med) / sigma_robust

        # Causal update with observation
        self.window.append(value)

        # Alert if |z| > 2.5
        is_alert = 1 if z > 2.5 else 0
        # Map z-score to pseudo-probability in [0, 1] via sigmoid-like transformation
        p_dev = float(1.0 - np.exp(-0.5 * (z ** 2)))

        return {
            "is_alert": is_alert,
            "z_score": float(z),
            "p_dev": float(min(1.0, max(0.0, p_dev))),
        }
