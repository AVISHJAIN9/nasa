"""Inference interface for the shipped WESAD stress classifier."""
from __future__ import annotations
import json
from pathlib import Path
from typing import Mapping
import joblib
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
FEATURES = json.loads((ROOT / "models" / "stress_features.json").read_text(encoding="utf-8"))["features"]
MODEL = joblib.load(ROOT / "models" / "stress_model.joblib")

def predict(inputs: pd.DataFrame | Mapping[str, float]) -> pd.DataFrame:
    """Return stress probability and argmax label for DataFrame or feature dict input."""
    if isinstance(inputs, pd.DataFrame):
        missing = [name for name in FEATURES if name not in inputs.columns]
        if missing:
            raise ValueError(f"Missing required features: {missing}")
        x = inputs.loc[:, FEATURES]
    elif isinstance(inputs, Mapping):
        missing = [name for name in FEATURES if name not in inputs]
        if missing:
            raise ValueError(f"Missing required features: {missing}")
        x = pd.DataFrame([[inputs[name] for name in FEATURES]], columns=FEATURES)
    else:
        raise TypeError("inputs must be a pandas DataFrame or a feature dict")
    probabilities = MODEL.predict_proba(x)
    class_ids = list(MODEL.classes_)
    stress_col = class_ids.index(1)
    labels = ["stressed" if class_ids[i] == 1 else "not_stressed" for i in np.argmax(probabilities, axis=1)]
    return pd.DataFrame({"stress_probability": probabilities[:, stress_col], "label": labels})
