"""AstroCare v2 - Mission Phase API Endpoints (BE-14 / M05)."""

from backend.app.db.session import get_db
from backend.app.models.phase import (
    PhaseThresholdCreateRequest,
    PhaseThresholdResponse,
    PhaseUpdateRequest,
)
from backend.app.services.phase_service import (
    create_phase_threshold_record,
    get_current_mission_phase,
    resolve_thresholds,
    set_mission_phase,
)
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(tags=["mission_phase"])


@router.put("/mission/phase", response_model=dict)
async def update_mission_phase_endpoint(payload: PhaseUpdateRequest):
    """Set active mission phase (launch, transit, landing, return)."""
    phase = set_mission_phase(payload.phase)
    return {"status": "updated", "phase": phase}


@router.get("/mission/phase", response_model=dict)
async def get_mission_phase_endpoint():
    """Retrieve current mission phase."""
    return {"phase": get_current_mission_phase()}


@router.post("/mission/thresholds", response_model=dict)
async def add_phase_threshold_endpoint(
    payload: PhaseThresholdCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Add a phase-specific threshold with mandatory NASA/clinical citation."""
    record = await create_phase_threshold_record(payload, db)
    return {
        "status": "created",
        "id": record.id,
        "phase": record.phase,
        "metric": record.metric,
        "low": record.low,
        "high": record.high,
        "citation": record.citation,
    }


@router.get("/mission/thresholds", response_model=PhaseThresholdResponse)
async def get_resolved_thresholds_endpoint(
    crew_id: str = Query(..., description="Crew member ID"),
    metric: str = Query(..., description="Target telemetry metric"),
    phase: str | None = Query(default=None, description="Optional mission phase override"),
    db: AsyncSession = Depends(get_db),
):
    """Resolve thresholds reading phase_thresholds (DB-10)."""
    return await resolve_thresholds(crew_id=crew_id, metric=metric, phase=phase, session=db)
