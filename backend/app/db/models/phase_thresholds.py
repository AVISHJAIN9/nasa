"""AstroCare v2 - DB-10 Mission Phase Thresholds Model."""

from backend.app.db.base import Base
from sqlalchemy import CheckConstraint, Column, DateTime, Float, Integer, String, func


class PhaseThreshold(Base):
    """Mission phase threshold profiles with mandatory clinical/NASA citations (DB-10)."""

    __tablename__ = "phase_thresholds"
    __table_args__ = (
        CheckConstraint("length(trim(citation)) > 0", name="ck_phase_citation_nonempty"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    phase = Column(String(32), nullable=False, index=True)  # launch, transit, landing, return
    metric = Column(String(64), nullable=False, index=True)
    low = Column(Float, nullable=False)
    high = Column(Float, nullable=False)
    unit = Column(String(32), nullable=False)
    citation = Column(String(255), nullable=False)  # Non-empty citation required
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
