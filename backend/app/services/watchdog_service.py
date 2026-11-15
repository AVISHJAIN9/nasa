"""AstroCare v2 - Watchdog Drift Events and Baseline Versioning Service (BE-13 / M03)."""

import logging
from typing import Any

from backend.app.core.errors import AppException
from backend.app.core.events import EventEnvelope, event_bus
from backend.app.db.models.baseline_history import BaselineHistory, WatchdogEvent
from backend.app.models.watchdog import (
    BaselineResponse,
    RebaselineRequest,
    WatchdogEventRequest,
    WatchdogStatusResponse,
)
from fastapi import WebSocket
from sqlalchemy import desc, select, update
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger("astrocare.watchdog")

# In-memory tracking of degraded status per (crew_id, metric)
_degraded_status: dict[tuple[str, str], bool] = {}


class AlertWebSocketManager:
    """Manages active WebSocket connections for live alert banners."""

    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast_alert(self, message: dict[str, Any]) -> None:
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                self.disconnect(connection)


alert_ws_manager = AlertWebSocketManager()


async def process_drift_event(
    event: WatchdogEventRequest, session: AsyncSession
) -> WatchdogStatusResponse:
    """Process incoming statistical drift event from watchdog.

    - Mark person and metric as degraded=True
    - Switch to rule fallback
    - Broadcast /ws/alerts banner: "Model baseline may be stale, using rules"
    - Record in watchdog_events audit log
    """
    pair = (event.crew_id, event.metric)
    _degraded_status[pair] = True

    # Persist watchdog audit record
    record = WatchdogEvent(
        crew_id=event.crew_id,
        metric=event.metric,
        statistic=event.statistic,
        ts=event.ts,
        degraded=True,
        fallback_mode="rules",
    )
    session.add(record)
    await session.commit()

    banner = {
        "event": "alert_banner",
        "level": "warning",
        "crew_id": event.crew_id,
        "metric": event.metric,
        "banner": "Model baseline may be stale, using rules",
        "fallback_mode": "rules",
    }

    # Broadcast via WebSocket and Redis Event Bus
    await alert_ws_manager.broadcast_alert(banner)
    await event_bus.publish(
        EventEnvelope(
            event_type="watchdog.drift.detected",
            source="SIMULATED",
            payload=banner,
        )
    )

    return await get_watchdog_status(event.crew_id, event.metric, session)


async def rebaseline_crew_metric(
    payload: RebaselineRequest, session: AsyncSession
) -> BaselineResponse:
    """Create a new versioned baseline record and reset degraded status."""
    # Find latest version for this crew_id and metric
    stmt = (
        select(BaselineHistory)
        .where(
            BaselineHistory.crew_id == payload.crew_id,
            BaselineHistory.metric == payload.metric,
        )
        .order_by(desc(BaselineHistory.version))
        .limit(1)
    )
    result = await session.execute(stmt)
    latest = result.scalar_one_or_none()
    new_version = (latest.version + 1) if latest else 1

    # Deactivate older active records
    await session.execute(
        update(BaselineHistory)
        .where(
            BaselineHistory.crew_id == payload.crew_id,
            BaselineHistory.metric == payload.metric,
        )
        .values(active=False)
    )

    # Insert new version
    record = BaselineHistory(
        crew_id=payload.crew_id,
        version=new_version,
        metric=payload.metric,
        baseline_value=payload.baseline_value,
        confidence=payload.confidence,
        active=True,
        reason=payload.reason,
    )
    session.add(record)
    await session.commit()
    await session.refresh(record)

    # Reset degraded status upon successful re-baseline
    _degraded_status[(payload.crew_id, payload.metric)] = False

    return BaselineResponse(
        id=record.id,
        crew_id=record.crew_id,
        version=record.version,
        metric=record.metric,
        baseline_value=record.baseline_value,
        confidence=record.confidence,
        active=record.active,
        reason=record.reason,
        created_at=record.created_at.isoformat() if record.created_at else "",
    )


async def restore_baseline_version(
    baseline_id: int, session: AsyncSession
) -> BaselineResponse:
    """Restore an earlier baseline version from history."""
    stmt = select(BaselineHistory).where(BaselineHistory.id == baseline_id)
    result = await session.execute(stmt)
    target = result.scalar_one_or_none()

    if not target:
        raise AppException(
            code="NOT_FOUND",
            message=f"Baseline record with id {baseline_id} not found",
            status_code=404,
        )

    # Deactivate others for this crew and metric
    await session.execute(
        update(BaselineHistory)
        .where(
            BaselineHistory.crew_id == target.crew_id,
            BaselineHistory.metric == target.metric,
        )
        .values(active=False)
    )

    # Mark target as active
    target.active = True
    await session.commit()
    await session.refresh(target)

    # Reset degraded status
    _degraded_status[(target.crew_id, target.metric)] = False

    return BaselineResponse(
        id=target.id,
        crew_id=target.crew_id,
        version=target.version,
        metric=target.metric,
        baseline_value=target.baseline_value,
        confidence=target.confidence,
        active=target.active,
        reason=target.reason,
        created_at=target.created_at.isoformat() if target.created_at else "",
    )


async def get_baseline_history(
    crew_id: str, session: AsyncSession
) -> list[BaselineResponse]:
    """List baseline history audit ledger for a crew member."""
    stmt = (
        select(BaselineHistory)
        .where(BaselineHistory.crew_id == crew_id)
        .order_by(desc(BaselineHistory.version))
    )
    result = await session.execute(stmt)
    records = result.scalars().all()

    return [
        BaselineResponse(
            id=r.id,
            crew_id=r.crew_id,
            version=r.version,
            metric=r.metric,
            baseline_value=r.baseline_value,
            confidence=r.confidence,
            active=r.active,
            reason=r.reason,
            created_at=r.created_at.isoformat() if r.created_at else "",
        )
        for r in records
    ]


async def get_watchdog_status(
    crew_id: str, metric: str, session: AsyncSession
) -> WatchdogStatusResponse:
    """Query current watchdog health status, degraded flag, and fallback mode."""
    pair = (crew_id, metric)
    degraded = _degraded_status.get(pair, False)
    fallback_mode = "rules" if degraded else "active_model"
    banner = "Model baseline may be stale, using rules" if degraded else None

    # Retrieve current active baseline
    stmt = (
        select(BaselineHistory)
        .where(
            BaselineHistory.crew_id == crew_id,
            BaselineHistory.metric == metric,
            BaselineHistory.active == True,
        )
        .limit(1)
    )
    result = await session.execute(stmt)
    active_b = result.scalar_one_or_none()

    active_resp = None
    if active_b:
        active_resp = BaselineResponse(
            id=active_b.id,
            crew_id=active_b.crew_id,
            version=active_b.version,
            metric=active_b.metric,
            baseline_value=active_b.baseline_value,
            confidence=active_b.confidence,
            active=active_b.active,
            reason=active_b.reason,
            created_at=active_b.created_at.isoformat() if active_b.created_at else "",
        )

    return WatchdogStatusResponse(
        crew_id=crew_id,
        metric=metric,
        degraded=degraded,
        fallback_mode=fallback_mode,
        banner_message=banner,
        active_baseline=active_resp,
    )
