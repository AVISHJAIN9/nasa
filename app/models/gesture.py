"""AstroCare v2 - Pydantic Models for Gesture Actions Mapping (BE-11 / C04)."""

from pydantic import BaseModel, ConfigDict, Field


class GestureRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    crew_id: str
    gesture: str = Field(..., description="Recognized gesture token, e.g. open_palm, thumbs_up, wave, fist")
    confidence: float = Field(..., ge=0.0, le=1.0)
    ts: str


class GestureResponse(BaseModel):
    crew_id: str
    gesture: str
    confidence: float
    resolved_action: str
    action_permitted: bool = Field(
        ..., description="True if action executed; false if attempting critical dismissal"
    )
    status: str = "logged"
    note: str = "Hands-free usability mapping only; never a health or diagnostic claim"
