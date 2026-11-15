"""AstroCare v2 - Sensor Registry and Consent Gating Service (BE-06 / M01)."""

import datetime
from collections.abc import Callable

from backend.app.core.config import get_settings
from backend.app.core.errors import AppException, ConsentRequiredException
from backend.app.db.models.consent import ConsentLog
from backend.app.db.session import get_db
from backend.app.models.consent import ConsentRequest, SensorStateItem, SensorStateResponse
from fastapi import Depends, Request
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession


async def record_consent(payload: ConsentRequest, session: AsyncSession) -> ConsentLog:
    """Append a new consent decision to the consent log (append-only)."""
    settings = get_settings()
    if payload.sensor not in settings.VALID_SENSORS:
        raise AppException(
            code="VALIDATION_ERROR",
            message=f"Invalid sensor '{payload.sensor}'. Must be one of: {settings.VALID_SENSORS}",
            status_code=422,
            details={"sensor": payload.sensor, "valid_sensors": settings.VALID_SENSORS},
        )

    entry = ConsentLog(
        crew_id=payload.crew_id,
        sensor=payload.sensor,
        granted=payload.granted,
        consent_version=payload.consent_version,
    )
    session.add(entry)
    await session.commit()
    await session.refresh(entry)
    return entry


async def get_latest_sensor_entry(
    crew_id: str, sensor: str, session: AsyncSession
) -> ConsentLog | None:
    """Retrieve the most recent consent record for (crew_id, sensor) without caching."""
    stmt = (
        select(ConsentLog)
        .where(ConsentLog.crew_id == crew_id, ConsentLog.sensor == sensor)
        .order_by(desc(ConsentLog.created_at), desc(ConsentLog.id))
        .limit(1)
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def check_sensor_consent(crew_id: str, sensor: str, session: AsyncSession) -> bool:
    """Evaluate whether consent is active, not revoked, and matches current consent version.

    Applies immediately on the very next request (no stale cache).
    A consent_version bump invalidates older grants and requires re-consent.
    """
    settings = get_settings()
    entry = await get_latest_sensor_entry(crew_id, sensor, session)
    if not entry:
        return False

    # Check if explicitly granted
    if not entry.granted:
        return False

    # Check if consent version meets current required version
    if entry.consent_version < settings.CONSENT_VERSION:
        return False

    return True


async def get_sensors_state(crew_id: str, session: AsyncSession) -> SensorStateResponse:
    """Return the current consent state for all multimodal sensors for a crew member."""
    settings = get_settings()
    states: dict[str, SensorStateItem] = {}

    for sensor in settings.VALID_SENSORS:
        entry = await get_latest_sensor_entry(crew_id, sensor, session)
        if entry:
            # Active only if granted and version matches current
            is_active = entry.granted and (entry.consent_version >= settings.CONSENT_VERSION)
            states[sensor] = SensorStateItem(
                sensor=sensor,  # type: ignore[arg-type]
                granted=is_active,
                consent_version=entry.consent_version,
                updated_at=entry.created_at.isoformat() if entry.created_at else None,
            )
        else:
            states[sensor] = SensorStateItem(
                sensor=sensor,  # type: ignore[arg-type]
                granted=False,
                consent_version=0,
                updated_at=None,
            )

    return SensorStateResponse(crew_id=crew_id, sensors=states)


def get_passive_metrics() -> dict:
    """M01 proof metric: share of signals available with zero user action.

    Passive signals: camera, mic, motion (3).
    Active signals: keyboard, pointer (2).
    time-to-first-estimate: return null until fusion exists.
    """
    settings = get_settings()
    passive_count = len(settings.PASSIVE_SENSORS)
    total_count = len(settings.VALID_SENSORS)
    share = round(passive_count / total_count, 3) if total_count > 0 else 0.0

    return {
        "passive_signals_share": share,
        "time_to_first_estimate": None,  # Strictly null until fusion engine is active
        "total_passive_signals": passive_count,
        "active_signals": settings.ACTIVE_SENSORS,
        "passive_signals": settings.PASSIVE_SENSORS,
    }


def require_consent(sensor: str) -> Callable:
    """FastAPI dependency factory: verifies active consent on EVERY ingest route.

    Missing or revoked consent returns 403 CONSENT_REQUIRED naming the sensor.
    """

    async def dependency(
        request: Request,
        db: AsyncSession = Depends(get_db),
    ) -> bool:
        # 1. Resolve crew_id from query parameters or headers
        crew_id = request.query_params.get("crew_id") or request.headers.get("X-Crew-ID")

        # 2. If not in query/headers, inspect JSON body if present
        if not crew_id and request.headers.get("content-type", "").startswith("application/json"):
            try:
                body_bytes = await request.body()
                if body_bytes:
                    import json

                    parsed = json.loads(body_bytes)
                    if isinstance(parsed, dict):
                        crew_id = parsed.get("crew_id")
                        if not crew_id and "readings" in parsed and isinstance(parsed["readings"], list) and len(parsed["readings"]) > 0:
                            crew_id = parsed["readings"][0].get("crew_id")
                        elif not crew_id and "events" in parsed and isinstance(parsed["events"], list) and len(parsed["events"]) > 0:
                            crew_id = parsed["events"][0].get("crew_id")
                    elif isinstance(parsed, list) and len(parsed) > 0 and isinstance(parsed[0], dict):
                        crew_id = parsed[0].get("crew_id")
            except Exception:
                pass

        if not crew_id:
            raise AppException(
                code="BAD_REQUEST",
                message="crew_id is required to verify sensor consent",
                status_code=400,
                details={"sensor": sensor},
            )

        has_consent = await check_sensor_consent(crew_id=crew_id, sensor=sensor, session=db)
        if not has_consent:
            raise ConsentRequiredException(sensor=sensor)

        return True

    return dependency
