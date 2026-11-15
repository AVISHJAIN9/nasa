"""AstroCare v2 - Pydantic Models for Face Metrics (BE-09 / C02)."""

from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class FaceMetricRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    crew_id: str
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$", description="Calendar date YYYY-MM-DD")
    metric: Literal["relative_change_index"] = Field(
        default="relative_change_index",
        description="Relative change index metric; never named or claimed as fluid volume",
    )
    value: float
    landmark_quality: float = Field(..., ge=0.0, le=1.0)
    provenance: Literal["REAL", "SIMULATED", "REPLAYED"]


class FaceMetricResponse(BaseModel):
    crew_id: str
    date: str
    metric: str
    value: float
    landmark_quality: float
    provenance: str
    status: str = "stored"
    note: str = "relative change from own baseline, not a measured fluid volume"
