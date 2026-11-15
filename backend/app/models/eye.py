"""AstroCare v2 - Pydantic Models for Eye Metrics Ingest (BE-10 / C03)."""

from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

EyeMetricType = Literal["blink_rate_per_min", "eye_open_ratio", "pupil_proxy"]


class EyeMetricRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reading_id: str
    crew_id: str
    metric: EyeMetricType
    value: float
    unit: str
    ts: str
    quality: float = Field(..., ge=0.0, le=1.0)
    provenance: Literal["REAL"] = "REAL"  # Camera readings must be provenance=REAL


class EyeMetricResponse(BaseModel):
    reading_id: str
    crew_id: str
    metric: str
    value: float
    unit: str
    ts: str
    quality: float
    provenance: str
    status: str = "stored"
    proxy_notice: str | None = None
