"""AstroCare v2 - Pydantic Models for Voice Features (BE-03 / A01)."""

from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class VoiceFeaturesResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    clip_id: str
    crew_id: str
    task_type: Literal["guided_read", "ambient"]
    pitch: float = Field(..., description="Mean fundamental frequency F0 (Hz)")
    jitter: float = Field(..., description="Cycle-to-cycle frequency variation")
    shimmer: float = Field(..., description="Cycle-to-cycle amplitude variation")
    rate: float = Field(..., description="Syllables per second")
    pauses: int = Field(..., description="Count of silent pauses (>250ms)")
    quality: float = Field(..., ge=0.0, le=1.0, description="Acoustic signal quality score 0-1")
    cough_detected: bool = Field(default=False, description="Indicator of detected cough event")
    model_version: str = Field(default="stub", description="ML model identifier; must be 'stub' for stubs")
    status: str = "stored"
