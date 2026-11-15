"""AstroCare v2 - Telemetry Ingestion and Quality Endpoints (BE-01, BE-02)."""

from typing import Any

from backend.app.core.errors import AppException, ConsentRequiredException
from backend.app.db.session import get_db
from backend.app.models.telemetry import (
    QualitySummaryResponse,
    SignalReadingItem,
    SignalReadingResponse,
)
from backend.app.services.consent_service import check_sensor_consent
from backend.app.services.telemetry_service import (
    get_quality_summary,
    ingest_single_reading,
    ws_manager,
)
from fastapi import APIRouter, Body, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(tags=["telemetry"])


@router.post("/telemetry", response_model=Any)
async def ingest_telemetry(
    payload: Any = Body(...),
    db: AsyncSession = Depends(get_db),
):
    """Ingest single or batch telemetry readings with provenance and quality gating (BE-01, BE-02).

    Accepts:
      - Single reading: {reading_id, crew_id, metric, value, unit, ts, quality, provenance}
      - Batch readings: {"readings": [...]} or list of readings: [...]
    """
    items_to_process: list[SignalReadingItem] = []

    if isinstance(payload, dict):
        if "readings" in payload and isinstance(payload["readings"], list):
            items_to_process = [SignalReadingItem.model_validate(r) for r in payload["readings"]]
        else:
            items_to_process = [SignalReadingItem.model_validate(payload)]
    elif isinstance(payload, list):
        items_to_process = [SignalReadingItem.model_validate(r) for r in payload]
    else:
        raise AppException(
            code="VALIDATION_ERROR",
            message="Invalid telemetry payload shape",
            status_code=422,
        )

    # Validate consent for each item's sensor
    for item in items_to_process:
        sensor = item.sensor or ("camera" if item.metric in ("pulse_bpm", "resp_rpm") else "generic")
        if sensor in ("camera", "mic", "keyboard", "pointer", "motion"):
            has_consent = await check_sensor_consent(crew_id=item.crew_id, sensor=sensor, session=db)
            if not has_consent:
                raise ConsentRequiredException(sensor=sensor)

    # Ingest and gate each reading
    results: list[SignalReadingResponse] = []
    for item in items_to_process:
        res = await ingest_single_reading(item, db)
        results.append(res)

    if len(results) == 1 and not (isinstance(payload, dict) and "readings" in payload):
        return results[0]

    return {"status": "success", "processed_count": len(results), "readings": results}


@router.get("/readings/quality-summary", response_model=QualitySummaryResponse)
async def query_quality_summary(
    crew_id: str = Query(..., description="Crew member ID"),
    window: str = Query(default="24h", description="Time window identifier"),
    db: AsyncSession = Depends(get_db),
):
    """Return quality summary including counts, mean quality score, and excluded percentage."""
    return await get_quality_summary(crew_id, window, db)


@router.websocket("/ws/telemetry")
async def telemetry_websocket_endpoint(websocket: WebSocket):
    """Live WebSocket telemetry stream broadcaster (BE-01 / BE-02)."""
    await ws_manager.connect(websocket)
    try:
        while True:
            # Keep-alive receive loop
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)
