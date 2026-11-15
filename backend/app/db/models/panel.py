"""AstroCare v2 - DB-12 Specialist Panel Consultations & Votes Model (Wave 3 Prototype)."""

from backend.app.db.base import Base
from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, func


class PanelVote(Base):
    """Concurrent multi-specialist consultative agent votes (DB-12).

    Safety Note: Prompted specialist agent personas querying the onboard medical knowledge base,
    not independent licensed human physicians.
    """

    __tablename__ = "panel_votes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    consultation_id = Column(String(64), nullable=False, index=True)
    question = Column(Text, nullable=False)
    specialist = Column(String(64), nullable=False)  # cardio, respiratory, mental_health
    vote = Column(String(64), nullable=False)
    rationale = Column(Text, nullable=False)
    citations = Column(String(255), nullable=False)
    disagreement = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
