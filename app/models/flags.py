"""AstroCare v2 - Feature Flag Pydantic Schemas (F141)."""

import datetime

from pydantic import BaseModel, ConfigDict, Field


class FeatureFlagBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=64, description="Flag identifier")
    is_enabled: bool = Field(default=True, description="Whether the flag is active")
    description: str | None = Field(default=None, max_length=255)


class FeatureFlagCreate(FeatureFlagBase):
    pass


class FeatureFlagUpdate(BaseModel):
    is_enabled: bool = Field(..., description="Target active state")
    updated_by: str = Field(default="admin", max_length=64)


class FeatureFlagResponse(FeatureFlagBase):
    id: int
    updated_at: datetime.datetime
    updated_by: str

    model_config = ConfigDict(from_attributes=True)
