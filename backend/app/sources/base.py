"""AstroCare External Data Sources - Shared Adapter Contract (Section 4).

Defines:
- SourceAdapter Protocol
- NormalizedRecord (F125 provenance tracking)
- SourceHealth
- Provenance & LicenseInfo
"""

from __future__ import annotations

import datetime
from enum import Enum
from typing import Any, Protocol, runtime_checkable
from pydantic import BaseModel, Field


class ProvenanceClass(str, Enum):
    LIVE_PUBLIC_FEED = "live_public_feed"
    REPLAYED_DATASET = "replayed_dataset"
    OWN_VOLUNTEER = "own_volunteer"
    SIMULATED = "simulated"
    INJECTED_SCENARIO = "injected_scenario"


class LicenseInfo(BaseModel):
    name: str
    url: str
    attribution_text: str
    commercial_ok: bool = False


class NormalizedRecord(BaseModel):
    ts: datetime.datetime = Field(
        default_factory=lambda: datetime.datetime.now(datetime.timezone.utc)
    )
    metric: str
    value: float | str | int | None
    unit: str
    quality: float | None = Field(default=None, ge=0.0, le=1.0)
    source_id: str
    provenance: ProvenanceClass
    entity: str = "space_weather"
    raw_ref: dict[str, Any] | None = None


class SourceHealth(BaseModel):
    source_id: str
    status: str = "ok"  # ok | degraded | down | stale | disabled
    last_success_at: datetime.datetime | None = None
    last_error: str | None = None
    staleness_s: float | None = None
    latency_ms: float | None = None
    rate_limit_remaining: int | None = None


@runtime_checkable
class SourceAdapter(Protocol):
    id: str
    provenance: ProvenanceClass
    license: LicenseInfo

    async def start(self) -> None: ...
    async def stop(self) -> None: ...
    async def fetch_once(self) -> list[NormalizedRecord]: ...
    def health(self) -> SourceHealth: ...
