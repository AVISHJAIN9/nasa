"""AstroCare v2 - Motion Ingest and Night Summary Endpoints (BE-12 / A03)."""

from backend.app.db.session import get_db
from backend.app.models.motion import MotionNightSummaryResponse, MotionReadingRequest
from backend.app.services.consent_service import require_consent
from backend.app.services.motion_service import (
    get_or_create_night_summary,
    record_motion_reading,
)
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(tags=["motion"])


@router.post("/motion", response_model=dict)
async def ingest_motion_reading_endpoint(
    payload: MotionReadingRequest,
    db: AsyncSession = Depends(get_db),
    _consent: bool = Depends(require_consent("motion")),
):
    """Ingest per-minute aggregate movement magnitude telemetry.

    Privacy & bandwidth guarantee: Raw high-rate samples are strictly forbidden.
    """
    record = await record_motion_reading(payload, db)
    return {
        "status": "stored",
        "crew_id": record.crew_id,
        "ts": record.ts,
        "movement_magnitude_mean": record.movement_magnitude_mean,
        "movement_magnitude_std": record.movement_magnitude_std,
        "stillness_flag": record.stillness_flag,
        "provenance": record.provenance,
    }


@router.get("/motion/night-summary", response_model=MotionNightSummaryResponse)
async def query_motion_night_summary_endpoint(
    crew_id: str = Query(...),
    date: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve estimated sleep window and restlessness index from motion aggregates (DB-08)."""
    return await get_or_create_night_summary(crew_id, date, db)
