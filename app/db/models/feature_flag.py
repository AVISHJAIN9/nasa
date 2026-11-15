"""AstroCare v2 - Feature Flag ORM Model (F141)."""

import datetime

from backend.app.db.base import Base
from sqlalchemy import Boolean, Column, DateTime, Integer, String


class FeatureFlag(Base):
    __tablename__ = "feature_flags"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(64), unique=True, index=True, nullable=False)
    is_enabled = Column(Boolean, default=True, nullable=False)
    description = Column(String(255), nullable=True)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.UTC),
        onupdate=lambda: datetime.datetime.now(datetime.UTC),
        nullable=False,
    )
    updated_by = Column(String(64), default="system", nullable=False)
