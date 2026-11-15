"""AstroCare v2 - DB-01 Signal Reading Telemetry Model."""

from backend.app.db.base import Base
from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, func


class SignalReading(Base):
    """Raw signal and derived vitals storage with provenance and quality tags (DB-01)."""

    __tablename__ = "signal_reading"

    id = Column(Integer, primary_key=True, autoincrement=True)
    reading_id = Column(String(64), unique=True, nullable=False, index=True)
    crew_id = Column(String(64), nullable=False, index=True)
    sensor = Column(String(32), nullable=True)  # camera, mic, wearable, etc.
    metric = Column(String(64), nullable=False, index=True)  # pulse_bpm, resp_rpm, spo2, etc.
    value = Column(Float, nullable=False)
    unit = Column(String(32), nullable=False)
    ts = Column(String(64), nullable=False)
    quality = Column(Float, nullable=False)
    provenance = Column(String(32), nullable=False)  # REAL, SIMULATED, REPLAYED
    quality_flag = Column(String(32), nullable=True)  # nominal, low, implausible
    excluded_from_fusion = Column(Boolean, nullable=False, default=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
