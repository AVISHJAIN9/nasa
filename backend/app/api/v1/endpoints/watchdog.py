"""AstroCare v2 - Watchdog and Baseline History Endpoints (BE-13 / M03)."""

from backend.app.db.session import get_db
from backend.app.models.watchdog import (
    BaselineResponse,
    RebaselineRequest,
    WatchdogEventRequest,
    WatchdogStatusResponse,
)
from backend.app.services.watchdog_service import (
    alert_ws_manager,
    get_baseline_history,
    get_watchdog_status,
    process_drift_event,
    rebaseline_crew_metric,
    restore_baseline_version,
)
from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(tags=["watchdog"])


@router.post("/watchdog/events", response_model=WatchdogStatusResponse)
async def submit_watchdog_drift_event(
    payload: WatchdogEventRequest,
    db: AsyncSession = Depends(get_db),
):
    """Receive statistical drift event, set degraded=True, switch to rule fallback, broadcast alert."""
    return await process_drift_event(payload, db)


@router.get("/watchdog/status", response_model=WatchdogStatusResponse)
async def query_watchdog_status(
    crew_id: str = Query(...),
    metric: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Query current degradation status and operational fallback mode."""
    return await get_watchdog_status(crew_id, metric, db)


@router.post("/baselines/rebaseline", response_model=BaselineResponse)
async def create_new_baseline_version(
    payload: RebaselineRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create a new versioned baseline record in baseline_history (DB-09) and reset degraded status."""
    return await rebaseline_crew_metric(payload, db)


@router.get("/baselines/{crew_id}/history", response_model=list[BaselineResponse])
async def list_baselines_history(
    crew_id: str,
    db: AsyncSession = Depends(get_db),
):
    """List baseline history audit ledger for crew member."""
    return await get_baseline_history(crew_id, db)


@router.post("/baselines/{baseline_id}/restore", response_model=BaselineResponse)
async def restore_old_baseline(
    baseline_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Restore an earlier baseline version from history."""
    return await restore_baseline_version(baseline_id, db)


@router.websocket("/ws/alerts")
async def alert_banner_websocket_endpoint(websocket: WebSocket):
    """Live WebSocket alert banner broadcaster (e.g. Model baseline may be stale, using rules)."""
    await alert_ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        alert_ws_manager.disconnect(websocket)
    except Exception:
        alert_ws_manager.disconnect(websocket)
