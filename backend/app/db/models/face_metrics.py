"""AstroCare v2 - DB-07 Face Metrics (Relative Change Index) Model."""

from backend.app.db.base import Base
from sqlalchemy import Column, DateTime, Float, Integer, String, UniqueConstraint, func


class FaceMetric(Base):
    """Daily facial morphology relative change index (DB-07).

    Safety Note: This is an indicator of relative change from personal baseline,
    never a measured fluid volume.
    """

    __tablename__ = "face_metrics"
    __table_args__ = (
        UniqueConstraint("crew_id", "date", "metric", name="uq_face_crew_date_metric"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    crew_id = Column(String(64), nullable=False, index=True)
    date = Column(String(10), nullable=False, index=True)  # YYYY-MM-DD
    metric = Column(String(64), nullable=False, default="relative_change_index")
    value = Column(Float, nullable=False)
    landmark_quality = Column(Float, nullable=False)
    provenance = Column(String(32), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
