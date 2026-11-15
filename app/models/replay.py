"""AstroCare v2 - Pydantic Models for Telemetry Dataset Replay (BE-18 / D03 - Wave 3 Prototype)."""

from pydantic import BaseModel, ConfigDict, Field


class ReplayStartRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    dataset_id: str
    speed: float = Field(default=1.0, gt=0.0, le=100.0)
    crew_mapping: dict[str, str] = Field(default_factory=dict)


class ReplaySeekRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    position_seconds: int = Field(..., ge=0)


class ReplayResponse(BaseModel):
    dataset_id: str
    status: str
    speed: float
    provenance: str = "REPLAYED"
    prototype: bool = True
    note: str = "Replayed synthetic/historical dataset streamed through standard ingest path. Provenance is strictly forced to REPLAYED."
