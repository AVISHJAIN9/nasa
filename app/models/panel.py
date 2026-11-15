"""AstroCare v2 - Pydantic Models for Multi-Specialist Panel Consultation (BE-16 / M04 - Wave 3 Prototype)."""

from typing import Any
from pydantic import BaseModel, ConfigDict, Field


class SpecialistVote(BaseModel):
    specialist: str  # cardio, respiratory, mental_health
    vote: str        # e.g. "recommend_rest_and_monitor", "recommend_saline_infusion"
    rationale: str
    citations: str


class PanelConsultRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    consultation_id: str
    question: str
    context: dict[str, Any] = Field(default_factory=dict)


class PanelConsultResponse(BaseModel):
    consultation_id: str
    question: str
    votes: list[SpecialistVote]
    disagreement: bool = Field(
        ..., description="True if specialist agent recommendations diverge"
    )
    prototype: bool = True
    model_version: str = "stub"
    note: str = "prompted specialists over the same knowledge base, not independent experts"
