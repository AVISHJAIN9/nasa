"""AstroCare v2 - Pydantic Models for Federated Learning FedAvg (BE-17 / M02 - Wave 3 Prototype)."""

from typing import Any
from pydantic import BaseModel, ConfigDict, Field, model_validator


class FedRoundStartRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    round_id: int = Field(..., ge=1)


class FedUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    client_id: str
    n_samples: int = Field(..., ge=1)
    weights: dict[str, float] = Field(..., description="Weight parameter tensor map")

    @model_validator(mode="before")
    @classmethod
    def reject_raw_data_in_federated_update(cls, data: Any):
        if isinstance(data, dict):
            # Strict Privacy Rule: Reject any field that looks like raw vitals or telemetry data
            forbidden = {"vitals", "readings", "telemetry", "raw_data", "samples_data", "audio", "frames", "patient"}
            found = forbidden.intersection(data.keys())
            if found:
                raise ValueError(
                    f"Raw clinical data is strictly forbidden in federated model updates. Found: {list(found)}"
                )
        return data


class FedGlobalResponse(BaseModel):
    round_id: int
    global_weights: dict[str, float]
    model_version: str = "stub"
    prototype: bool = True
    note: str = "Prototype Federated Averaging (FedAvg) aggregator; communicates mathematical weights only, zero patient data exchanged."
