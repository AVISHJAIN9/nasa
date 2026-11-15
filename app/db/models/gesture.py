"""AstroCare v2 - Gesture Log Model (TEMP-until-DB)."""

from backend.app.db.base import Base
from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, func


class GestureLog(Base):
    """Audit ledger of recognized hands-free gestures and mapped workflow actions.

    Safety Policy: Gestures may acknowledge non-critical notifications,
    but can never resolve or dismiss critical alerts. Usability only, never a health claim.
    """

    __tablename__ = "gesture_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    crew_id = Column(String(64), nullable=False, index=True)
    gesture = Column(String(32), nullable=False)
    confidence = Column(Float, nullable=False)
    action = Column(String(64), nullable=False)
    ts = Column(String(64), nullable=False)
    action_permitted = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
