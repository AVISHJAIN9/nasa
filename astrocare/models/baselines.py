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
    """Fixed population-level clinical limit rule baseline (Defect 46).
    
    Evaluates violation distance beyond nominal clinical limits:
    - If value is inside [nominal_min, nominal_max], violation is 0.0.
    - If value exceeds boundaries, score = boundary_distance / typical_sigma.
    """

    def __init__(self, metric_name: str):
        self.metric_name = metric_name
        self.def_info = METRIC_REGISTRY.get(metric_name)

    def predict(self, value: Optional[float]) -> Dict[str, float]:
        if value is None or self.def_info is None:
            return {"is_alert": 0, "score": 0.0}

        sigma = self.def_info.typical_sigma or 1.0

        if value < self.def_info.nominal_min:
            violation = self.def_info.nominal_min - value
            is_outside = True
        elif value > self.def_info.nominal_max:
            violation = value - self.def_info.nominal_max
            is_outside = True
        else:
            violation = 0.0
            is_outside = False

        score = violation / max(sigma, 1e-4)
        return {
            "is_alert": 1 if is_outside else 0,
            "score": float(score),
        }


class F018RollingRobustBaseline:
    """F018 Personal baseline calculator: Rolling Median + MAD (Robust Z-Score).

    Uses a sliding window of recent personal observations to compute median and MAD,
    producing an adaptive robust z-score: z = (x - median) / (1.4826 * MAD).
    Floor on MAD prevents division by zero or explosive z-scores on near-constant signals.
    """

    def __init__(self, metric_name: str, window_size: int = 30, astronaut_baseline: Optional[float] = None):
        self.metric_name = metric_name
        self.window_size = window_size
        self.astronaut_baseline = astronaut_baseline
        self.window: deque = deque(maxlen=window_size)
        self.def_info = METRIC_REGISTRY.get(metric_name)
        self.reset()

    def reset(self) -> None:
        """Clears the rolling buffer to prevent fold-to-fold or astronaut-to-astronaut leakage."""
        self.window.clear()

    def update_and_predict(self, value: Optional[float]) -> Dict[str, float]:
        if value is None:
            return {"is_alert": 0, "z_score": 0.0, "p_dev": 0.0}

        # Defect 41: Robust cold-start using astronaut baseline or early observations
        typical_sigma = self.def_info.typical_sigma if self.def_info else 1.0
        mad_floor = max(0.2 * typical_sigma, 1e-4)

        # Calculate prediction BEFORE appending current value (causal one-step-ahead)
        if len(self.window) < 5:
            if self.astronaut_baseline is not None:
                center = self.astronaut_baseline
            elif len(self.window) > 0:
                center = float(np.mean(self.window))
            else:
                center = value
            z = abs(value - center) / max(typical_sigma, 1e-6)
        else:
            arr = np.array(self.window)
            med = float(np.median(arr))
            mad = float(np.median(np.abs(arr - med)))
            sigma_robust = max(1.4826 * mad, mad_floor)
            z = abs(value - med) / sigma_robust

        # Causal update with observation
        self.window.append(value)

        # Alert if |z| > 2.5 (prototype default)
        is_alert = 1 if z > 2.5 else 0
        # Map z-score to pseudo-probability in [0, 1] via sigmoid-like transformation
        p_dev = float(1.0 - np.exp(-0.5 * (z ** 2)))

        return {
            "is_alert": is_alert,
            "z_score": float(z),
            "p_dev": float(min(1.0, max(0.0, p_dev))),
        }
