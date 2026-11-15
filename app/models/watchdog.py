"""AstroCare v2 - Pydantic Models for Drift Events, Watchdog, and Baseline History (BE-13 / M03)."""

from pydantic import BaseModel, ConfigDict, Field


class WatchdogEventRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    crew_id: str
    metric: str
    statistic: str
    ts: str


class RebaselineRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    crew_id: str
    metric: str
    baseline_value: float
    confidence: float = Field(default=0.95, ge=0.0, le=1.0)
    reason: str = Field(..., description="Documented reason for re-baseline to audit false re-baseline rate")


class BaselineResponse(BaseModel):
    id: int
    crew_id: str
    version: int
    metric: str
    baseline_value: float
    confidence: float
    active: bool
    reason: str | None = None
    created_at: str


class WatchdogStatusResponse(BaseModel):
    crew_id: str
    metric: str
    degraded: bool
    fallback_mode: str  # "rules" | "active_model"
    banner_message: str | None = None
    active_baseline: BaselineResponse | None = None
