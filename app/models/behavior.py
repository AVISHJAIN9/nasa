"""AstroCare v2 - Pydantic Models for Behaviour Events and 5-Minute Windows (BE-04 / A02)."""

from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

BehaviorKind = Literal["key_down", "key_up", "pointer_move", "pointer_click"]


class BehaviorEventItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event_id: str = Field(..., description="Unique client-sent event ID for idempotency")
    crew_id: str = Field(..., description="Crew member ID (Excel person_id)")
    ts_ms: int = Field(..., ge=0, description="Epoch timestamp in milliseconds")
    kind: BehaviorKind = Field(..., description="Motor action kind")
    dwell_ms: float = Field(default=0.0, ge=0.0, description="Key press duration or click hold duration")
    flight_ms: float = Field(default=0.0, ge=0.0, description="Inter-key flight time interval")
    speed_px_s: float = Field(default=0.0, ge=0.0, description="Pointer movement speed in pixels/sec")
    click_latency_ms: float = Field(default=0.0, ge=0.0, description="Time from target hover to click")

    @model_validator(mode="before")
    @classmethod
    def reject_keystroke_and_text_content(cls, data: Any):
        if isinstance(data, dict):
            # Strict Privacy Rule: Reject any field containing typed text, letters, or codes
            forbidden = {"key", "code", "char", "text", "value", "content", "string"}
            found = forbidden.intersection(data.keys())
            if found:
                raise ValueError(
                    f"Forbidden typed content fields detected. Only timing and kinematics allowed. Found: {list(found)}"
                )
        return data


class BehaviorEventsBatch(BaseModel):
    events: list[BehaviorEventItem] = Field(..., min_length=1)


class BehaviorWindowResponse(BaseModel):
    crew_id: str
    window_start: int
    window_end: int
    event_count: int
    dwell_mean: float
    dwell_median: float
    dwell_std: float
    dwell_p90: float
    flight_mean: float
    flight_median: float
    flight_std: float
    flight_p90: float
    idle_ratio: float
    pointer_speed_mean: float
    pointer_speed_std: float
