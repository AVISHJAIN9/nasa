"""AstroCare v2 - Pydantic Models for Sensor Consent & State (BE-06 / M01)."""

from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

SensorType = Literal["camera", "mic", "keyboard", "pointer", "motion"]


class ConsentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    crew_id: str = Field(..., description="Crew member ID (Excel person_id)")
    sensor: SensorType = Field(..., description="Sensor modality")
    granted: bool = Field(..., description="Consent status grant or revoke")
    consent_version: int = Field(default=1, ge=1, description="Consent agreement version")


class SensorStateItem(BaseModel):
    sensor: SensorType
    granted: bool
    consent_version: int
    updated_at: str | None = None


class SensorStateResponse(BaseModel):
    crew_id: str
    sensors: dict[str, SensorStateItem]


class PassiveMetricsResponse(BaseModel):
    passive_signals_share: float = Field(
        ..., description="Fraction of signals accessible with zero user action (camera, mic, motion)"
    )
    time_to_first_estimate: float | None = Field(
        default=None, description="Time to first clinical estimate; null until fusion exists"
    )
    total_passive_signals: int = 3
    active_signals: list[str] = Field(default=["keyboard", "pointer"])
    passive_signals: list[str] = Field(default=["camera", "mic", "motion"])
