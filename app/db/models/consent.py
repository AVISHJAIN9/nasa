"""AstroCare v2 - DB-05 Sensor Consent & State Model."""

from backend.app.db.base import Base
from sqlalchemy import Boolean, Column, DateTime, Integer, String, func


class ConsentLog(Base):
    """Append-only consent log for all multimodal sensors (DB-05)."""

    __tablename__ = "consent_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    crew_id = Column(String(64), nullable=False, index=True)
    sensor = Column(String(32), nullable=False, index=True)  # camera, mic, keyboard, pointer, motion
    granted = Column(Boolean, nullable=False)
    consent_version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
