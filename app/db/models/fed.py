"""AstroCare v2 - DB-13 Federated Learning Rounds Model (Wave 3 Prototype)."""

from backend.app.db.base import Base
from sqlalchemy import Column, DateTime, Integer, String, Text, func


class FedRound(Base):
    """Federated learning aggregation rounds ledger (DB-13).

    Safety Note: Only mathematical model weights / gradients are communicated.
    Raw patient vitals and sensor telemetry are strictly rejected from federated payloads.
    """

    __tablename__ = "fed_rounds"

    id = Column(Integer, primary_key=True, autoincrement=True)
    round_id = Column(Integer, nullable=False, index=True)
    client_id = Column(String(64), nullable=False)
    n_samples = Column(Integer, nullable=False)
    bytes_received = Column(Integer, nullable=False)
    model_version = Column(String(32), nullable=False, default="stub")
    global_weights = Column(Text, nullable=True)  # JSON-serialized averaged weight vector
    status = Column(String(32), nullable=False, default="completed")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
