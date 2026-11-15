"""AstroCare ML Fusion Service (In-Process Integration of Model A & Model B).

Connects Model A (ml1_stress WESAD wrist classifier) and Model B (FusionNet early-warning model)
in-process at startup, thread-safe, with session isolation, LRU eviction, and robust input validation.
"""

from __future__ import annotations

import asyncio
import json
import logging
import math
import re
import time
from pathlib import Path
from typing import Any, Mapping

import numpy as np

logger = logging.getLogger("astrocare.ml_fusion")

# Model paths
MODELS_ROOT = Path(__file__).resolve().parents[2] / "models"
MODEL_A_DIR = MODELS_ROOT / "model_a"
MODEL_B_DIR = MODELS_ROOT / "model_b"

# Model A contract: 8 features in strict order
MODEL_A_FEATURES = [
    "hr_mean",
    "sdnn",
    "rmssd",
    "pnn50",
    "eda_mean",
    "eda_std",
    "eda_slope",
    "temp_mean",
]

# Model B contract: 9 channels in strict order
MODEL_B_CHANNELS = [
    "hr",
    "rmssd",
    "activity",
    "resp",
    "blink",
    "voice",
    "typing",
    "puff",
    "rppg_hr",
]

# Plausible physiological and derived feature ranges
CHANNEL_RANGES: dict[str, tuple[float, float]] = {
    "hr": (20.0, 250.0),
    "rmssd": (1.0, 300.0),
    "activity": (0.0, 5000.0),
    "resp": (4.0, 60.0),
    "blink": (0.0, 120.0),
    "voice": (0.0, 100.0),
    "typing": (0.0, 2000.0),
    "puff": (0.0, 10.0),
    "rppg_hr": (20.0, 250.0),
}

# Session ID pattern: 1-64 chars [A-Za-z0-9_-]
SESSION_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,64}$")

# Session management constants
SESSION_TTL_SECONDS = 6 * 3600  # 6 hours
MAX_SESSIONS = 1000


class FusionNetArchitecture:
    """Dynamically instantiated PyTorch FusionNet model."""

    @staticmethod
    def create_model():
        import torch
        import torch.nn as nn

        class FusionNet(nn.Module):
            def __init__(self, d=48, h=64):
                super().__init__()
                self.enc = nn.Sequential(
                    nn.Linear(1, d), nn.GELU(), nn.Linear(d, d), nn.GELU()
                )
                self.gru = nn.GRU(2 * d, h, batch_first=True)
                self.head = nn.Sequential(
                    nn.Linear(h, h), nn.GELU(), nn.Linear(h, 1)
                )

        return FusionNet()


class OnlineDetector:
    """Thread-safe stateful per-session online baseline and early warning detector."""

    def __init__(self, model, cfg: dict):
        import torch

        self.m = model.eval()
        self.c = cfg
        self.o = np.array(cfg["orient"], dtype=np.float32)
        self.a = float(cfg["alpha"])
        self.burn = int(cfg["burn_min"])
        self.buf: list[np.ndarray] = []
        self.mu: np.ndarray | None = None
        self.sd0: np.ndarray | None = None
        self.var: np.ndarray | None = None
        self.valid: np.ndarray | None = None
        self.h: torch.Tensor | None = None
        self.run = 0
        self.last = -(10**9)
        self.t = 0

    def step(self, x: list[float | None]) -> dict | None:
        import torch

        x_arr = np.asarray(
            [np.nan if v is None else float(v) for v in x], dtype=np.float32
        )
        self.t += 1

        if self.mu is None:
            self.buf.append(x_arr)
            if len(self.buf) < self.burn:
                return None
            stacked = np.stack(self.buf)
            self.valid = (~np.isnan(stacked)).sum(0) >= 30
            self.mu = np.nan_to_num(np.nanmean(stacked, 0))
            self.sd0 = np.maximum(
                np.nan_to_num(np.nanstd(stacked, 0)), 1e-3
            )
            self.var = self.sd0**2
            return None

        with torch.no_grad():
            ok = (~np.isnan(x_arr)) & self.valid
            sd = np.maximum(np.sqrt(self.var), 0.3 * self.sd0)
            z = np.where(
                ok,
                np.clip(
                    (np.nan_to_num(x_arr) - self.mu) / sd * self.o, -8.0, 8.0
                ),
                0.0,
            ).astype(np.float32)

            self.var = np.where(
                ok,
                self.a * (np.nan_to_num(x_arr) - self.mu) ** 2
                + (1 - self.a) * self.var,
                self.var,
            )
            self.mu = np.where(
                ok,
                self.a * np.nan_to_num(x_arr) + (1 - self.a) * self.mu,
                self.mu,
            )

            zt = torch.tensor(z, dtype=torch.float32)[None, None, :]
            mt = torch.tensor(ok.astype(np.float32), dtype=torch.float32)[
                None, None, :
            ]

            f = self.m.enc(zt.unsqueeze(-1))
            mk = mt.unsqueeze(-1)
            mean = (f * mk).sum(2) / mk.sum(2).clamp(min=1.0)
            mx = f.masked_fill(mk == 0, -1e4).max(2).values
            mx = torch.where(
                mt.sum(2, keepdim=True) > 0, mx, torch.zeros_like(mx)
            )

            features = torch.cat([mean, mx], -1)
            out, self.h = self.m.gru(features, self.h)
            prob = float(torch.sigmoid(self.m.head(out)).squeeze().item())

            self.run = self.run + 1 if prob > self.c["thr_model"] else 0
            alert = (
                self.run >= self.c["persistence_min"]
                and (self.t - self.last) >= self.c["refractory_min"]
            )
            if alert:
                self.last = self.t

            q = float(self.c["conformal_q"])
            abstain = ((1.0 - prob) <= q) == (prob <= q)

            return dict(score=prob, alert=bool(alert), abstain=bool(abstain))


class SessionState:
    """State wrapper for an active Model B session."""

    def __init__(self, detector: OnlineDetector):
        self.detector = detector
        self.minute_count = 0
        self.last_active = time.time()
        self.lock = asyncio.Lock()


class MLFusionService:
    """Singleton service managing in-process Model A and Model B inference."""

    def __init__(self):
        self.model_a = None
        self.model_a_features = MODEL_A_FEATURES
        self.model_b_net = None
        self.model_b_cfg = None
        self._sessions: dict[str, SessionState] = {}
        self._global_lock = asyncio.Lock()
        self._loaded = False
        self._model_a_error: str | None = None
        self._model_b_error: str | None = None

    def load_models(self) -> None:
        """Load Model A and Model B weights and configuration ONCE at startup."""
        if self._loaded:
            return

        # 1. Load Model A
        model_a_path = MODEL_A_DIR / "stress_model.joblib"
        try:
            import joblib

            if model_a_path.exists():
                self.model_a = joblib.load(model_a_path)
                # Ensure compatibility across scikit-learn versions
                if hasattr(self.model_a, "steps") and len(self.model_a.steps) > 0:
                    lr_step = self.model_a.steps[-1][1]
                    if not hasattr(lr_step, "multi_class"):
                        lr_step.multi_class = "auto"
                logger.info("Model A (ml1_stress) loaded successfully.")
            else:
                self._model_a_error = f"Model A file not found at {model_a_path}"
                logger.warning(self._model_a_error)
        except Exception as exc:
            self._model_a_error = f"Model A load failure: {exc}"
            logger.error(self._model_a_error)

        # 2. Load Model B
        model_b_weights = MODEL_B_DIR / "fusionnet.pt"
        model_b_cfg_path = MODEL_B_DIR / "config.json"
        try:
            import torch

            if model_b_weights.exists() and model_b_cfg_path.exists():
                with open(model_b_cfg_path, "r", encoding="utf-8") as f:
                    self.model_b_cfg = json.load(f)

                self.model_b_net = FusionNetArchitecture.create_model()
                state_dict = torch.load(model_b_weights, map_location="cpu")
                self.model_b_net.load_state_dict(state_dict)
                self.model_b_net.eval()
                logger.info("Model B (FusionNet) loaded successfully.")

                # Warmup forward pass
                dummy_x = [75.0, 45.0, 120.0, 16.0, 15.0, 0.2, 250.0, 1.0, 75.0]
                dummy_det = OnlineDetector(self.model_b_net, self.model_b_cfg)
                dummy_det.step(dummy_x)
                logger.info("Model B warmup complete.")
            else:
                self._model_b_error = f"Model B files missing at {MODEL_B_DIR}"
                logger.warning(self._model_b_error)
        except Exception as exc:
            self._model_b_error = f"Model B load failure: {exc}"
            logger.error(self._model_b_error)

        self._loaded = True

    async def _prune_expired_sessions(self) -> None:
        """Prune sessions older than TTL and enforce MAX_SESSIONS limit."""
        now = time.time()
        expired_keys = [
            k
            for k, s in self._sessions.items()
            if (now - s.last_active) > SESSION_TTL_SECONDS
        ]
        for k in expired_keys:
            self._sessions.pop(k, None)

        if len(self._sessions) > MAX_SESSIONS:
            # Evict oldest sessions by last_active
            sorted_keys = sorted(
                self._sessions.keys(),
                key=lambda k: self._sessions[k].last_active,
            )
            excess = len(self._sessions) - MAX_SESSIONS
            for k in sorted_keys[:excess]:
                self._sessions.pop(k, None)

    async def get_or_create_session(self, session_id: str) -> SessionState:
        """Thread-safe retrieval or creation of a per-session OnlineDetector."""
        async with self._global_lock:
            await self._prune_expired_sessions()
            if session_id not in self._sessions:
                if self.model_b_net is None or self.model_b_cfg is None:
                    raise RuntimeError("Model B is not loaded")
                detector = OnlineDetector(self.model_b_net, self.model_b_cfg)
                self._sessions[session_id] = SessionState(detector)
            session = self._sessions[session_id]
            session.last_active = time.time()
            return session

    async def reset_session(self, session_id: str) -> bool:
        """Reset and evict session state."""
        async with self._global_lock:
            if session_id in self._sessions:
                self._sessions.pop(session_id, None)
                return True
            return False

    def predict_model_a(
        self, features: Mapping[str, Any] | None
    ) -> tuple[dict, list[str]]:
        """Run Model A inference using exact preprocessing pipeline."""
        if features is None:
            return (
                {
                    "ran": False,
                    "stress_prob": None,
                    "label": None,
                    "error": None,
                },
                [],
            )

        if self.model_a is None:
            return (
                {
                    "ran": False,
                    "stress_prob": None,
                    "label": None,
                    "error": self._model_a_error or "Model A not loaded",
                },
                [],
            )

        missing: list[str] = []
        row_values: list[float] = []

        for feat in MODEL_A_FEATURES:
            val = features.get(feat)
            if val is None or (isinstance(val, (float, int)) and (math.isnan(val) or math.isinf(val))):
                missing.append(feat)
                row_values.append(np.nan)
            else:
                try:
                    row_values.append(float(val))
                except (ValueError, TypeError):
                    missing.append(feat)
                    row_values.append(np.nan)

        # If all features are missing, do not run
        if len(missing) == len(MODEL_A_FEATURES):
            return (
                {
                    "ran": False,
                    "stress_prob": None,
                    "label": None,
                    "error": None,
                },
                missing,
            )

        try:
            import pandas as pd

            # Format as DataFrame with exact feature names matching training
            x_df = pd.DataFrame([row_values], columns=MODEL_A_FEATURES)
            probabilities = self.model_a.predict_proba(x_df)
            class_ids = list(self.model_a.classes_)
            stress_col = class_ids.index(1)
            stress_prob = float(probabilities[0, stress_col])
            pred_class = class_ids[int(np.argmax(probabilities, axis=1)[0])]
            label = "stressed" if pred_class == 1 else "not_stressed"

            return (
                {
                    "ran": True,
                    "stress_prob": round(stress_prob, 6),
                    "label": label,
                    "error": None,
                },
                missing,
            )
        except Exception as exc:
            return (
                {
                    "ran": False,
                    "stress_prob": None,
                    "label": None,
                    "error": str(exc),
                },
                missing,
            )

    async def predict_model_b(
        self, session_id: str, minute: Mapping[str, Any] | None
    ) -> tuple[dict, list[str]]:
        """Run Model B inference with session state isolation and range checks."""
        if minute is None:
            return (
                {
                    "ran": False,
                    "minute_index": None,
                    "early_warning_score": None,
                    "alert": False,
                    "status": None,
                    "error": None,
                },
                [],
            )

        if self.model_b_net is None or self.model_b_cfg is None:
            return (
                {
                    "ran": False,
                    "minute_index": None,
                    "early_warning_score": None,
                    "alert": False,
                    "status": None,
                    "error": self._model_b_error or "Model B not loaded",
                },
                [],
            )

        # Validate range and values
        warnings_or_missing: list[str] = []
        row: list[float | None] = []

        for ch in MODEL_B_CHANNELS:
            val = minute.get(ch)
            if val is None:
                warnings_or_missing.append(f"missing_{ch}")
                row.append(None)
                continue

            # Reject NaN and Infinity
            if isinstance(val, (float, int)) and (math.isnan(val) or math.isinf(val)):
                raise ValueError(f"Channel '{ch}' contains NaN or Infinity")

            try:
                num_val = float(val)
            except (ValueError, TypeError):
                raise ValueError(f"Channel '{ch}' is not a valid number")

            # Validate plausible ranges
            min_bound, max_bound = CHANNEL_RANGES[ch]
            if num_val < min_bound or num_val > max_bound:
                raise ValueError(
                    f"Channel '{ch}' value {num_val} out of plausible range [{min_bound}, {max_bound}]"
                )

            row.append(num_val)

        # Check for unknown channels
        for k in minute.keys():
            if k not in MODEL_B_CHANNELS:
                warnings_or_missing.append(f"unknown_channel_{k}")

        session = await self.get_or_create_session(session_id)
        async with session.lock:
            try:
                session.minute_count += 1
                result = session.detector.step(row)
                if result is None:
                    # Baseline learning burn period
                    return (
                        {
                            "ran": True,
                            "minute_index": session.minute_count,
                            "early_warning_score": None,
                            "alert": False,
                            "status": "baseline_learning",
                            "error": None,
                        },
                        warnings_or_missing,
                    )

                status = "abstain" if result["abstain"] else "ok"
                score = round(float(result["score"]), 6) if result["score"] is not None else None
                return (
                    {
                        "ran": True,
                        "minute_index": session.minute_count,
                        "early_warning_score": score,
                        "alert": bool(result["alert"]),
                        "status": status,
                        "error": None,
                    },
                    warnings_or_missing,
                )
            except Exception as exc:
                return (
                    {
                        "ran": False,
                        "minute_index": session.minute_count,
                        "early_warning_score": None,
                        "alert": False,
                        "status": None,
                        "error": str(exc),
                    },
                    warnings_or_missing,
                )

    async def assess(
        self,
        session_id: str,
        features: Mapping[str, Any] | None,
        minute: Mapping[str, Any] | None,
        threshold: float = 0.5,
    ) -> dict[str, Any]:
        """Produce unified /assess output combining Model A and Model B results."""
        if not SESSION_ID_PATTERN.match(session_id):
            raise ValueError(
                "Invalid session id. Must be 1-64 characters matching [A-Za-z0-9_-]."
            )

        # Execute Model A
        model_a_res, a_missing = self.predict_model_a(features)

        # Execute Model B
        model_b_res, b_missing = await self.predict_model_b(session_id, minute)

        # Combine missing / warning signals
        missing_all = sorted(list(set(a_missing + b_missing)))

        # Combined Decision Rule: alert_B OR stress_prob_A >= threshold
        reasons: list[str] = []
        flag = False

        if model_b_res["alert"]:
            flag = True
            reasons.append("Model B early warning threshold exceeded")

        stress_prob_a = model_a_res["stress_prob"]
        if stress_prob_a is not None and stress_prob_a >= threshold:
            flag = True
            reasons.append(
                f"Model A stress probability ({stress_prob_a:.3f}) >= threshold ({threshold})"
            )

        combined = {
            "flag": flag,
            "reasons": reasons,
            "rule": "alert_B OR stress_prob_A >= threshold",
            "threshold": threshold,
            "validated": False,
        }

        return {
            "session": session_id,
            "model_a": model_a_res,
            "model_b": model_b_res,
            "combined": combined,
            "missing": missing_all,
            "disclaimer": "Research prototype, not a medical device. Combined rule not validated.",
        }


# Global singleton instance
fusion_service = MLFusionService()


def get_fusion_service() -> MLFusionService:
    """Dependency provider for MLFusionService."""
    if not fusion_service._loaded:
        fusion_service.load_models()
    return fusion_service
