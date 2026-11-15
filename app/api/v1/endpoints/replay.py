"""AstroCare v2 - Telemetry Dataset Replay Endpoints (BE-18 / D03 - Wave 3 Prototype)."""

from backend.app.db.session import get_db
from backend.app.models.replay import (
    ReplayResponse,
    ReplaySeekRequest,
    ReplayStartRequest,
)
from backend.app.services.replay_service import control_replay, start_dataset_replay
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(tags=["telemetry_replay"])


@router.post("/replay/start", response_model=ReplayResponse)
async def start_replay_endpoint(
    payload: ReplayStartRequest,
    db: AsyncSession = Depends(get_db),
):
    """Start streaming historical dataset through the same live telemetry ingest pipeline (BE-18).

    Forces provenance=REPLAYED so replay readings can never be confused with live telemetry.
    """
    return await start_dataset_replay(payload, db)


@router.post("/replay/pause", response_model=dict)
async def pause_replay_endpoint():
    """Pause active replay stream."""
    return control_replay("pause")


@router.post("/replay/resume", response_model=dict)
async def resume_replay_endpoint():
    """Resume paused replay stream."""
    return control_replay("resume")


@router.post("/replay/stop", response_model=dict)
async def stop_replay_endpoint():
    """Stop active replay stream."""
    return control_replay("stop")


@router.post("/replay/seek", response_model=dict)
async def seek_replay_endpoint(payload: ReplaySeekRequest):
    """Seek to time offset in active replay stream."""
    return control_replay("seek", payload.position_seconds)
