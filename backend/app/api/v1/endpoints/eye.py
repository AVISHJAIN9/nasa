"""AstroCare v2 - Eye Metrics Endpoints (BE-10 / C03)."""

from backend.app.db.session import get_db
from backend.app.models.eye import EyeMetricRequest, EyeMetricResponse
from backend.app.services.consent_service import require_consent
from backend.app.services.eye_service import ingest_eye_metric, query_eye_metrics
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(tags=["eye_metrics"])


@router.post("/eye-metrics", response_model=EyeMetricResponse)
async def ingest_eye_metric_endpoint(
    payload: EyeMetricRequest,
    db: AsyncSession = Depends(get_db),
    _consent: bool = Depends(require_consent("camera")),
):
    """Ingest camera-derived eye metrics: blink_rate_per_min, eye_open_ratio, pupil_proxy (BE-10).

    Stored in signal_reading table. Camera readings must have provenance=REAL.
    """
    return await ingest_eye_metric(payload, db)


@router.get("/eye-metrics", response_model=list[EyeMetricResponse])
async def query_eye_metrics_endpoint(
    crew_id: str = Query(...),
    metric: str | None = Query(default=None),
    from_ts: str | None = Query(default=None, alias="from"),
    to_ts: str | None = Query(default=None, alias="to"),
    db: AsyncSession = Depends(get_db),
):
    """Query eye metrics for a crew member."""
    return await query_eye_metrics(crew_id, metric, from_ts, to_ts, db)
