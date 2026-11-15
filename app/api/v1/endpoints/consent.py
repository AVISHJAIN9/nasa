"""AstroCare v2 - Consent and Passive Metrics API Endpoints (BE-06 / M01)."""

from backend.app.core.config import get_settings
from backend.app.db.session import get_db
from backend.app.models.consent import (
    ConsentRequest,
    PassiveMetricsResponse,
    SensorStateResponse,
)
from backend.app.services.consent_service import (
    get_passive_metrics,
    get_sensors_state,
    record_consent,
)
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(tags=["consent"])


@router.post("/consent", response_model=dict)
async def submit_consent(
    payload: ConsentRequest,
    db: AsyncSession = Depends(get_db),
):
    """Log an append-only consent grant or revocation for a multimodal sensor."""
    entry = await record_consent(payload, db)
    return {
        "status": "recorded",
        "crew_id": entry.crew_id,
        "sensor": entry.sensor,
        "granted": entry.granted,
        "consent_version": entry.consent_version,
        "created_at": entry.created_at.isoformat() if entry.created_at else None,
    }


@router.get("/sensors/state", response_model=SensorStateResponse)
async def query_sensor_state(
    crew_id: str = Query(..., description="Crew member identifier"),
    db: AsyncSession = Depends(get_db),
):
    """Query current active consent states for all sensors for a crew member."""
    return await get_sensors_state(crew_id, db)


@router.get("/passive/metrics", response_model=PassiveMetricsResponse)
async def query_passive_metrics():
    """Return share of signals available with zero user action and time-to-first-estimate (M01 proof)."""
    return get_passive_metrics()


@router.post("/consent/bump-version", response_model=dict)
async def bump_consent_version(new_version: int = Query(..., ge=1)):
    """Helper to simulate consent_version bump, invalidating older grants."""
    settings = get_settings()
    old_version = settings.CONSENT_VERSION
    settings.CONSENT_VERSION = new_version
    return {
        "status": "version_bumped",
        "previous_version": old_version,
        "current_consent_version": new_version,
    }
