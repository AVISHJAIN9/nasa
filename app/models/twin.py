"""AstroCare v2 - Pydantic Models for Digital Twin Simulation (BE-15 / A04 - Wave 3 Prototype)."""

from pydantic import BaseModel, ConfigDict, Field


class TrajectoryPoint(BaseModel):
    day: int
    metric: str
    mean: float
    lo90: float
    hi90: float


class TwinSimulateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    crew_id: str
    horizon_days: int = Field(default=7, ge=1, le=90)
    action: str = Field(..., description="Simulated intervention: e.g. exercise_high_intensity, fluid_loading")


class TwinSimulateResponse(BaseModel):
    crew_id: str
    action: str
    trajectories: list[TrajectoryPoint]
    prototype: bool = True
    model_version: str = "stub"
    note: str = "Prototype predictive digital twin simulation for decision support; not validated clinical prognosis."
