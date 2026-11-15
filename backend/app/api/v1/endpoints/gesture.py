"""AstroCare v2 - Gesture-to-Action Mapping Endpoints (BE-11 / C04)."""

from backend.app.db.session import get_db
from backend.app.models.gesture import GestureRequest, GestureResponse
from backend.app.services.gesture_service import get_gesture_logs, resolve_and_log_gesture
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(tags=["gestures"])


@router.post("/gestures", response_model=GestureResponse)
async def map_and_log_gesture_endpoint(
    payload: GestureRequest,
    db: AsyncSession = Depends(get_db),
):
    """Resolve hands-free gesture to mapped action and record in gesture_log (BE-11).

    Usability only, never a health claim. Cannot dismiss critical alerts.
    """
    return await resolve_and_log_gesture(payload, db)


@router.get("/gestures/log", response_model=list[dict])
async def list_gesture_logs_endpoint(
    crew_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """List gesture action audit log for a crew member."""
    logs = await get_gesture_logs(crew_id, db)
    return [
        {
            "id": l.id,
            "crew_id": l.crew_id,
            "gesture": l.gesture,
            "confidence": l.confidence,
            "action": l.action,
            "action_permitted": l.action_permitted,
            "ts": l.ts,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in logs
    ]
