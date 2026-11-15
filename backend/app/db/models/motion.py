"""AstroCare v2 - DB-08 Motion Readings and Nightly Restlessness Summary Models."""

from backend.app.db.base import Base
from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, UniqueConstraint, func


class MotionReading(Base):
    """Per-minute aggregate movement magnitude telemetry. Raw high-rate samples are never stored."""

    __tablename__ = "motion_readings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    crew_id = Column(String(64), nullable=False, index=True)
    ts = Column(String(64), nullable=False)
    movement_magnitude_mean = Column(Float, nullable=False)
    movement_magnitude_std = Column(Float, nullable=False)
    stillness_flag = Column(Boolean, nullable=False)
    provenance = Column(String(32), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class MotionNightSummary(Base):
    """Nightly estimated sleep window and restlessness index (DB-08).

    Safety Note: This is an estimated proxy from movement telemetry, not polysomnography.
    """

    __tablename__ = "motion_night"
    __table_args__ = (
        UniqueConstraint("crew_id", "date", name="uq_motion_night_crew_date"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    crew_id = Column(String(64), nullable=False, index=True)
    date = Column(String(10), nullable=False, index=True)  # YYYY-MM-DD
    sleep_window_estimate = Column(String(32), nullable=False)  # e.g. "22:45-06:30"
    restlessness_index = Column(Float, nullable=False)
    n_movements = Column(Integer, nullable=False)
    quality = Column(Float, nullable=False)
    provenance = Column(String(32), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
