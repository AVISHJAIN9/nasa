"""AstroCare v2 - Gesture-to-Action Mapping Service (BE-11 / C04)."""

from backend.app.core.config import get_settings
from backend.app.db.models.gesture import GestureLog
from backend.app.models.gesture import GestureRequest, GestureResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


async def resolve_and_log_gesture(
    payload: GestureRequest, session: AsyncSession
) -> GestureResponse:
    """Resolve recognized hands-free gesture to configured workflow action and log in gesture_log."""
    settings = get_settings()
    mapping = settings.GESTURE_ACTION_MAPPING

    resolved_action = mapping.get(payload.gesture, "unknown_gesture")

    # Safety constraint: Gestures can never resolve or dismiss a critical medical emergency
    action_permitted = True
    if "dismiss" in resolved_action.lower() and "critical" in resolved_action.lower():
        action_permitted = False

    log_entry = GestureLog(
        crew_id=payload.crew_id,
        gesture=payload.gesture,
        confidence=payload.confidence,
        action=resolved_action,
        ts=payload.ts,
        action_permitted=action_permitted,
    )
    session.add(log_entry)
    await session.commit()
    await session.refresh(log_entry)

    return GestureResponse(
        crew_id=log_entry.crew_id,
        gesture=log_entry.gesture,
        confidence=log_entry.confidence,
        resolved_action=log_entry.action,
        action_permitted=log_entry.action_permitted,
        status="logged",
        note="Hands-free usability mapping only; never a health or diagnostic claim",
    )


async def get_gesture_logs(
    crew_id: str, session: AsyncSession
) -> list[GestureLog]:
    """Retrieve gesture audit log for a crew member."""
    stmt = (
        select(GestureLog)
        .where(GestureLog.crew_id == crew_id)
        .order_by(GestureLog.created_at)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())
