"""AstroCare v2 - DB-09 Baseline History and Watchdog Events Models."""

from backend.app.db.base import Base
from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, func


class BaselineHistory(Base):
    """Versioned personal baseline tracking and audit ledger (DB-09)."""

    __tablename__ = "baseline_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    crew_id = Column(String(64), nullable=False, index=True)
    version = Column(Integer, nullable=False, default=1)
    metric = Column(String(64), nullable=False, index=True)
    baseline_value = Column(Float, nullable=False)
    confidence = Column(Float, nullable=False, default=0.95)
    active = Column(Boolean, nullable=False, default=True)
    reason = Column(String(255), nullable=True)
    restored_from_id = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class WatchdogEvent(Base):
    """Audit ledger of statistical drift events and rule fallback decisions."""

    __tablename__ = "watchdog_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    crew_id = Column(String(64), nullable=False, index=True)
    metric = Column(String(64), nullable=False, index=True)
    statistic = Column(String(64), nullable=False)
    ts = Column(String(64), nullable=False)
    degraded = Column(Boolean, nullable=False, default=True)
    fallback_mode = Column(String(32), nullable=False, default="rules")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
