"""AstroCare v2 - DB-03 Behaviour Windows Model."""

from backend.app.db.base import Base
from sqlalchemy import Column, DateTime, Float, Integer, String, UniqueConstraint, func


class BehaviorWindow(Base):
    """Aggregated 5-minute typing and pointer motor behavioral features (DB-03).

    No raw keystrokes or text contents are ever recorded.
    """

    __tablename__ = "behavior_windows"
    __table_args__ = (
        UniqueConstraint("crew_id", "window_start", name="uq_crew_window"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    crew_id = Column(String(64), nullable=False, index=True)
    window_start = Column(Integer, nullable=False, index=True)  # epoch ms timestamp
    window_end = Column(Integer, nullable=False, index=True)    # epoch ms timestamp
    event_count = Column(Integer, nullable=False, default=0)
    dwell_mean = Column(Float, nullable=False, default=0.0)
    dwell_median = Column(Float, nullable=False, default=0.0)
    dwell_std = Column(Float, nullable=False, default=0.0)
    dwell_p90 = Column(Float, nullable=False, default=0.0)
    flight_mean = Column(Float, nullable=False, default=0.0)
    flight_median = Column(Float, nullable=False, default=0.0)
    flight_std = Column(Float, nullable=False, default=0.0)
    flight_p90 = Column(Float, nullable=False, default=0.0)
    idle_ratio = Column(Float, nullable=False, default=0.0)
    pointer_speed_mean = Column(Float, nullable=False, default=0.0)
    pointer_speed_std = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
