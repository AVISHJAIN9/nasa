"""AstroCare v2 - DB-11 Digital Twin Daily State Model (Wave 3 Prototype)."""

from backend.app.db.base import Base
from sqlalchemy import Column, DateTime, Float, Integer, String, func


class TwinState(Base):
    """Daily projected physiological trajectory state snapshots (DB-11). Prototype only."""

    __tablename__ = "twin_state"

    id = Column(Integer, primary_key=True, autoincrement=True)
    crew_id = Column(String(64), nullable=False, index=True)
    day = Column(Integer, nullable=False)
    metric = Column(String(64), nullable=False)
    mean = Column(Float, nullable=False)
    lo90 = Column(Float, nullable=False)
    hi90 = Column(Float, nullable=False)
    action = Column(String(64), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
