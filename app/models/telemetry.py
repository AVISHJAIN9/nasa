"""AstroCare v2 - Pydantic Models for Telemetry & Quality Gating (BE-01, BE-02)."""

from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

ProvenanceType = Literal["REAL", "SIMULATED", "REPLAYED"]


class SignalReadingItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reading_id: str = Field(..., description="Unique client-sent reading ID for idempotency")
    crew_id: str = Field(..., description="Crew member ID (Excel person_id)")
    metric: str = Field(..., description="Metric identifier, e.g. pulse_bpm, resp_rpm")
    value: float = Field(..., description="Scalar telemetry reading value")
    unit: str = Field(..., description="Measurement unit (bpm, rpm, etc.)")
    ts: str = Field(..., description="ISO 8601 or epoch timestamp")
    quality: float | None = Field(default=None, ge=0.0, le=1.0, description="Signal quality score 0-1")
    provenance: ProvenanceType = Field(..., description="Signal source provenance tag")
    sensor: str | None = Field(default=None, description="Originating sensor, e.g. camera, mic, wearable")

    @model_validator(mode="before")
    @classmethod
    def reject_video_frames_and_raw_signals(cls, data: Any):
        if isinstance(data, dict):
            # Enforce privacy invariant: Derived values only, NEVER video frames
            forbidden = {"frame", "video", "raw_frame", "image", "raw_image", "video_frame", "pixels"}
            found = forbidden.intersection(data.keys())
            if found:
                raise ValueError(f"Raw video/image frames are strictly forbidden. Found: {list(found)}")
            
            # Camera readings requirement: camera readings must be provenance=REAL
            metric = data.get("metric")
            sensor = data.get("sensor")
            provenance = data.get("provenance")
            quality = data.get("quality")

            is_camera = (sensor == "camera")
            if is_camera:
                if provenance is not None and provenance != "REAL":
                    raise ValueError(f"Camera-derived readings for {metric} must have provenance=REAL")
                if quality is None:
                    raise ValueError(f"Quality score (0 to 1) is required on camera readings ({metric})")
        return data


class TelemetryBatchRequest(BaseModel):
    readings: list[SignalReadingItem] = Field(..., min_length=1)


class SignalReadingResponse(BaseModel):
    reading_id: str
    crew_id: str
    metric: str
    value: float
    unit: str
    ts: str
    quality: float
    provenance: str
    quality_flag: str | None = None
    excluded_from_fusion: bool = False
    status: str = "stored"


class QualityAlertEvent(BaseModel):
    event: str = "quality_alert"
    crew_id: str
    sensor: str
    reason: str = "not reliable, hold still"
    consecutive_low_count: int
    threshold: float


class QualitySummaryResponse(BaseModel):
    crew_id: str
    window: str
    total_count: int
    mean_quality: float
    excluded_count: int
    percent_excluded: float
