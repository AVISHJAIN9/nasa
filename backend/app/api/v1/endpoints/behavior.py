"""AstroCare v2 - Behaviour Events and 5-Minute Windows Endpoints (BE-04 / A02)."""

from typing import Any

from backend.app.core.errors import AppException, ConsentRequiredException
from backend.app.db.session import get_db
from backend.app.models.behavior import BehaviorEventItem, BehaviorWindowResponse
from backend.app.services.behavior_service import (
    get_behavior_windows,
    ingest_and_aggregate_behavior_events,
)
from backend.app.services.consent_service import check_sensor_consent
from fastapi import APIRouter, Body, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(tags=["behavior"])


@router.post("/behavior/events", response_model=dict)
async def ingest_behavior_events(
    payload: Any = Body(...),
    db: AsyncSession = Depends(get_db),
):
    """Ingest keystroke/pointer timing kinematics events and aggregate into 5-minute windows.

    Privacy Invariant: Extra fields forbidden. Strict rejection of text or keystroke values.
    """
    raw_list: list[dict[str, Any]] = []
    if isinstance(payload, dict):
        if "events" in payload and isinstance(payload["events"], list):
            raw_list = payload["events"]
        else:
            raw_list = [payload]
    elif isinstance(payload, list):
        raw_list = payload
    else:
        raise AppException(
            code="VALIDATION_ERROR",
            message="Invalid behavior events payload shape",
            status_code=422,
        )

    # Validate against Pydantic model (forbids key/char/text/code/value)
    validated_events: list[BehaviorEventItem] = [
        BehaviorEventItem.model_validate(e) for e in raw_list
    ]

    # Consent validation: keyboard for key events, pointer for pointer events
    for event in validated_events:
        sensor = "keyboard" if event.kind in ("key_down", "key_up") else "pointer"
        has_consent = await check_sensor_consent(crew_id=event.crew_id, sensor=sensor, session=db)
        if not has_consent:
            raise ConsentRequiredException(sensor=sensor)

    windows = await ingest_and_aggregate_behavior_events(validated_events, db)

    return {
        "status": "success",
        "events_processed": len(validated_events),
        "windows_updated": len(windows),
        "windows": [w.model_dump() for w in windows],
    }


@router.get("/behavior/windows", response_model=list[BehaviorWindowResponse])
async def query_behavior_windows(
    crew_id: str = Query(..., description="Crew member ID"),
    from_ts: int = Query(..., alias="from", description="Range start timestamp in ms"),
    to_ts: int = Query(..., alias="to", description="Range end timestamp in ms"),
    db: AsyncSession = Depends(get_db),
):
    """Query 5-minute behavior summary windows. Consent for keyboard and pointer required."""
    has_kb = await check_sensor_consent(crew_id=crew_id, sensor="keyboard", session=db)
    if not has_kb:
        raise ConsentRequiredException(sensor="keyboard")

    has_ptr = await check_sensor_consent(crew_id=crew_id, sensor="pointer", session=db)
    if not has_ptr:
        raise ConsentRequiredException(sensor="pointer")

    return await get_behavior_windows(crew_id, from_ts, to_ts, db)
