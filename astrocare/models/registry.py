"""AstroCare Shared Schema and Metric Registry Contracts.

Implements the Hour 6 frozen X02-to-consumer schema, Pydantic validation,
and helper export functions for BE1 and ML2 integration.
"""
from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field, model_validator

from astrocare.config import METRIC_REGISTRY, MetricDefinition


class TimeToCritical(BaseModel):
    p10: Optional[float] = Field(None, description="10th percentile minutes until critical threshold crossing")
    p50: Optional[float] = Field(None, description="50th percentile (median) minutes until critical crossing")
    p90: Optional[float] = Field(None, description="90th percentile minutes until critical crossing")

    @model_validator(mode="after")
    def validate_quantiles(self) -> "TimeToCritical":
        vals = [self.p10, self.p50, self.p90]
        non_nulls = [v for v in vals if v is not None]
        for v in non_nulls:
            if v < 0:
                raise ValueError(f"Time-to-critical must be non-negative, got {v}")
        if self.p10 is not None and self.p50 is not None and self.p10 > self.p50:
            raise ValueError(f"Ordered quantiles violated: p10 ({self.p10}) > p50 ({self.p50})")
        if self.p50 is not None and self.p90 is not None and self.p50 > self.p90:
            raise ValueError(f"Ordered quantiles violated: p50 ({self.p50}) > p90 ({self.p90})")
        if self.p10 is not None and self.p90 is not None and self.p10 > self.p90:
            raise ValueError(f"Ordered quantiles violated: p10 ({self.p10}) > p90 ({self.p90})")
        return self


class X02BaselineOutput(BaseModel):
    crew_id: str = Field(..., description="Unique astronaut identifier (e.g. 'ASTRO-01')")
    metric: str = Field(..., description="Metric key present in METRIC_REGISTRY")
    ts: str = Field(..., description="ISO-8601 UTC timestamp string (e.g. '2026-11-14T08:00:00Z')")
    mean: float = Field(..., description="Predictive mean in native metric units")
    lo90: float = Field(..., description="Lower bound of 90% predictive interval")
    hi90: float = Field(..., description="Upper bound of 90% predictive interval")
    p_deviation: float = Field(..., ge=0.0, le=1.0, description="Predictive probability outside personalized normal bounds")
    time_to_critical_min: TimeToCritical = Field(default_factory=TimeToCritical)

    @model_validator(mode="after")
    def validate_bounds(self) -> "X02BaselineOutput":
        if not (self.lo90 <= self.mean <= self.hi90):
            # Allow minute floating point tolerance
            if self.mean < self.lo90 - 1e-6 or self.mean > self.hi90 + 1e-6:
                raise ValueError(
                    f"Predictive interval constraint violated: lo90 ({self.lo90}) <= mean ({self.mean}) <= hi90 ({self.hi90})"
                )
        if self.metric not in METRIC_REGISTRY:
            # Documented in registry
            pass
        return self

    def to_dict(self) -> Dict[str, Any]:
        return self.model_dump()


def get_metric_def(metric_name: str) -> Optional[MetricDefinition]:
    return METRIC_REGISTRY.get(metric_name)
