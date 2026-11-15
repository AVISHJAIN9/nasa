"""AstroCare v2 - DB-02 Voice Features Model (No Raw Audio Stored)."""

from backend.app.db.base import Base
from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, func


class VoiceFeatures(Base):
    """Voice acoustic biomarker features extracted in memory (DB-02).

    Raw audio is never stored on disk or database.
    """

    __tablename__ = "voice_features"

    id = Column(Integer, primary_key=True, autoincrement=True)
    crew_id = Column(String(64), nullable=False, index=True)
    clip_id = Column(String(64), unique=True, nullable=False, index=True)
    task_type = Column(String(32), nullable=False)  # guided_read | ambient
    pitch = Column(Float, nullable=False)
    jitter = Column(Float, nullable=False)
    shimmer = Column(Float, nullable=False)
    rate = Column(Float, nullable=False)
    pauses = Column(Integer, nullable=False)
    quality = Column(Float, nullable=False)
    cough_detected = Column(Boolean, nullable=False, default=False)
    model_version = Column(String(32), nullable=False, default="stub")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)  # TTL purge timestamp
