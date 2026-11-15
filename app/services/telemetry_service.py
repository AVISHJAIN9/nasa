"""AstroCare v2 - Telemetry Ingestion, Quality Gating and Plausibility Service (BE-01, BE-02)."""

import logging
from typing import Any

from backend.app.core.config import get_settings
from backend.app.core.events import EventEnvelope, event_bus
from backend.app.db.models.telemetry import SignalReading
from backend.app.models.telemetry import (
    QualityAlertEvent,
    QualitySummaryResponse,
    SignalReadingItem,
    SignalReadingResponse,
)
from fastapi import WebSocket
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger("astrocare.telemetry")

# In-memory tracking of consecutive low-quality readings per (crew_id, sensor)
_consecutive_low_quality: dict[tuple[str, str], int] = {}


class WebSocketManager:
    """Manages active WebSocket connections for live telemetry fanout."""

    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket client connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket client disconnected. Total: {len(self.active_connections)}")

    async def broadcast_json(self, data: dict[str, Any]) -> None:
        for connection in list(self.active_connections):
            try:
                await connection.send_json(data)
            except Exception as exc:
                logger.warning(f"Error broadcasting to WebSocket client: {exc}")
                self.disconnect(connection)


ws_manager = WebSocketManager()


def check_plausibility(metric: str, value: float) -> bool:
    """Check whether a reading value lies within placeholder physiological bounds."""
    settings = get_settings()
    bounds = settings.PLAUSIBILITY_BOUNDS.get(metric)
    if bounds is None:
        return True
    low, high = bounds
    return low <= value <= high


def evaluate_quality_and_plausibility(
    item: SignalReadingItem,
) -> tuple[bool, str | None]:
    """Evaluate reading for plausibility and quality threshold.

    Returns:
        (excluded_from_fusion, quality_flag)
    """
    settings = get_settings()
    is_plausible = check_plausibility(item.metric, item.value)

    if not is_plausible:
        return True, "implausible"

    # Quality check
    sensor_key = item.sensor or "default"
    threshold = settings.SENSOR_QUALITY_THRESHOLDS.get(
        sensor_key, settings.SENSOR_QUALITY_THRESHOLDS.get("default", 0.50)
    )

    quality = item.quality if item.quality is not None else 1.0
    if quality < threshold:
        return True, "low"

    return False, "nominal"


async def ingest_single_reading(
    item: SignalReadingItem, session: AsyncSession
) -> SignalReadingResponse:
    """Ingest a single telemetry reading with idempotency, plausibility, and quality gating."""
    settings = get_settings()

    # 1. Idempotency check: duplicate reading_id is ignored
    stmt = select(SignalReading).where(SignalReading.reading_id == item.reading_id)
    result = await session.execute(stmt)
    existing = result.scalar_one_or_none()
    if existing:
        return SignalReadingResponse(
            reading_id=existing.reading_id,
            crew_id=existing.crew_id,
            metric=existing.metric,
            value=existing.value,
            unit=existing.unit,
            ts=existing.ts,
            quality=existing.quality,
            provenance=existing.provenance,
            quality_flag=existing.quality_flag,
            excluded_from_fusion=existing.excluded_from_fusion,
            status="ignored_duplicate",
        )

    # 2. Plausibility and quality checks
    excluded, quality_flag = evaluate_quality_and_plausibility(item)

    # 3. Consecutive low-quality alert tracking
    sensor_name = item.sensor or ("camera" if item.metric in ("pulse_bpm", "resp_rpm") else "generic")
    pair_key = (item.crew_id, sensor_name)

    quality_val = item.quality if item.quality is not None else 1.0
    threshold = settings.SENSOR_QUALITY_THRESHOLDS.get(
        sensor_name, settings.SENSOR_QUALITY_THRESHOLDS.get("default", 0.50)
    )

    if quality_flag == "low" or quality_val < threshold:
        _consecutive_low_quality[pair_key] = _consecutive_low_quality.get(pair_key, 0) + 1
        consec = _consecutive_low_quality[pair_key]
        if consec >= settings.N_CONSECUTIVE_LOW_QUALITY:
            # Emit WS event quality_alert
            alert_data = QualityAlertEvent(
                crew_id=item.crew_id,
                sensor=sensor_name,
                reason="not reliable, hold still",
                consecutive_low_count=consec,
                threshold=threshold,
            ).model_dump()

            await ws_manager.broadcast_json(alert_data)
            await event_bus.publish(
                EventEnvelope(
                    event_type="telemetry.sensor.quality_alert",
                    source=item.provenance,
                    payload=alert_data,
                )
            )
    else:
        # Reset counter on nominal reading
        _consecutive_low_quality[pair_key] = 0

    # 4. Store in DB-01 signal_reading
    record = SignalReading(
        reading_id=item.reading_id,
        crew_id=item.crew_id,
        sensor=sensor_name,
        metric=item.metric,
        value=item.value,
        unit=item.unit,
        ts=item.ts,
        quality=quality_val,
        provenance=item.provenance,
        quality_flag=quality_flag,
        excluded_from_fusion=excluded,
    )
    session.add(record)
    await session.commit()
    await session.refresh(record)

    # 5. Broadcast reading on /ws/telemetry and event bus
    reading_dict = {
        "event": "telemetry_reading",
        "reading_id": record.reading_id,
        "crew_id": record.crew_id,
        "metric": record.metric,
        "value": record.value,
        "unit": record.unit,
        "ts": record.ts,
        "quality": record.quality,
        "provenance": record.provenance,
        "quality_flag": record.quality_flag,
        "excluded_from_fusion": record.excluded_from_fusion,
    }
    await ws_manager.broadcast_json(reading_dict)
    await event_bus.publish(
        EventEnvelope(
            event_type="telemetry.reading.received",
            source=item.provenance,
            payload=reading_dict,
        )
    )

    return SignalReadingResponse(
        reading_id=record.reading_id,
        crew_id=record.crew_id,
        metric=record.metric,
        value=record.value,
        unit=record.unit,
        ts=record.ts,
        quality=record.quality,
        provenance=record.provenance,
        quality_flag=record.quality_flag,
        excluded_from_fusion=record.excluded_from_fusion,
        status="stored",
    )


async def get_quality_summary(
    crew_id: str, window: str, session: AsyncSession
) -> QualitySummaryResponse:
    """Calculate total counts, mean quality score, and excluded percentage for a crew member."""
    stmt = select(
        func.count(SignalReading.id).label("total"),
        func.avg(SignalReading.quality).label("mean_quality"),
        func.sum(
            case((SignalReading.excluded_from_fusion == True, 1), else_=0)
        ).label("excluded"),
    ).where(SignalReading.crew_id == crew_id)

    result = await session.execute(stmt)
    row = result.first()

    total = row.total if row and row.total else 0
    mean_q = float(row.mean_quality) if row and row.mean_quality is not None else 0.0
    excluded = row.excluded if row and row.excluded else 0
    pct_excluded = round((excluded / total) * 100.0, 2) if total > 0 else 0.0

    return QualitySummaryResponse(
        crew_id=crew_id,
        window=window,
        total_count=total,
        mean_quality=round(mean_q, 3),
        excluded_count=excluded,
        percent_excluded=pct_excluded,
    )


async def reliable_readings(
    crew_id: str,
    metric: str,
    window: str | int | None = None,
    session: AsyncSession | None = None,
) -> list[SignalReading]:
    """ONE function as the only way fusion reads signals.

    Strictly filters out any reading where excluded_from_fusion=True
    (e.g., implausible readings or readings below sensor quality threshold).
    """
    if session is None:
        return []

    stmt = select(SignalReading).where(
        SignalReading.crew_id == crew_id,
        SignalReading.metric == metric,
        SignalReading.excluded_from_fusion == False,
    ).order_by(SignalReading.ts)

    result = await session.execute(stmt)
    return list(result.scalars().all())
