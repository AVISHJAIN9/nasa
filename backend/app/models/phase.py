"""AstroCare v2 - Pydantic Models for Mission Phase Thresholds (BE-14 / M05)."""

from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator

MissionPhase = Literal["launch", "transit", "landing", "return"]


class PhaseUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    phase: MissionPhase = Field(..., description="Active mission phase")


class PhaseThresholdCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    phase: MissionPhase
    metric: str
    low: float
    high: float
    unit: str
    citation: str = Field(..., min_length=1, description="Mandatory non-empty NASA/clinical evidence citation")

    @field_validator("citation")
    @classmethod
    def validate_non_empty_citation(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Citation cannot be empty or whitespace. Never invent priors.")
        return v.strip()


class PhaseThresholdResponse(BaseModel):
    metric: str
    phase: str
    low: float
    high: float
    unit: str
    citation: str | None = None
    phase_specific: bool = Field(
        ..., description="True if backed by cited phase row; False if fallback default"
    )
    note: str = "Clinical indicator bounds for decision support; not diagnostic criteria."
