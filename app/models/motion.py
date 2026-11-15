"""AstroCare v2 - Pydantic Models for Motion Readings and Nightly Restlessness (BE-12 / A03)."""

from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator


class MotionReadingRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    crew_id: str
    ts: str
    movement_magnitude_mean: float
    movement_magnitude_std: float
    stillness_flag: bool
    provenance: Literal["REAL", "SIMULATED", "REPLAYED"]

    @model_validator(mode="before")
    @classmethod
    def reject_raw_high_rate_samples(cls, data: Any):
        if isinstance(data, dict):
            # Enforce privacy & bandwidth rule: per-minute aggregates only, NEVER raw accelerometer traces
            forbidden = {"raw_samples", "accel_x", "accel_y", "accel_z", "raw_xyz", "samples"}
            found = forbidden.intersection(data.keys())
            if found:
                raise ValueError(
                    f"Raw high-rate motion samples are strictly forbidden. Send per-minute aggregates only. Found: {list(found)}"
                )
        return data


class MotionNightSummaryResponse(BaseModel):
    crew_id: str
    date: str
    sleep_window_estimate: str
    restlessness_index: float
    n_movements: int
    quality: float
    provenance: str
    is_estimate: bool = True
    note: str = "Estimated sleep and restlessness indicators from per-minute movement aggregates"
