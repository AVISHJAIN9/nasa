"""AstroCare v2 - Federated Learning FedAvg Endpoints (BE-17 / M02 - Wave 3 Prototype)."""

from backend.app.db.session import get_db
from backend.app.models.fed import (
    FedGlobalResponse,
    FedRoundStartRequest,
    FedUpdateRequest,
)
from backend.app.services.fed_service import (
    accumulate_client_update,
    get_global_weights_state,
    start_new_round,
)
from fastapi import APIRouter, Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(tags=["federated_learning"])


@router.post("/fed/rounds", response_model=dict)
async def start_round_endpoint(payload: FedRoundStartRequest):
    """Start a new federated aggregation round (BE-17)."""
    rid = start_new_round(payload.round_id)
    return {
        "status": "round_started",
        "round_id": rid,
        "prototype": True,
        "note": "Federated learning coordinator prototype.",
    }


@router.get("/fed/global", response_model=FedGlobalResponse)
async def get_global_weights_endpoint():
    """Retrieve current global averaged model weights (BE-17)."""
    return get_global_weights_state()


@router.post("/fed/update", response_model=dict)
async def submit_update_endpoint(
    payload: FedUpdateRequest,
    x_fed_token: str = Header(..., alias="X-Fed-Client-Token"),
    db: AsyncSession = Depends(get_db),
):
    """Submit local client model update with per-client token verification (BE-17).

    Strict privacy: Rejects any field resembling raw clinical data.
    """
    return await accumulate_client_update(payload, x_fed_token, db)
