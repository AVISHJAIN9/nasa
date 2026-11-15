"""AstroCare v2 - Face Metrics Endpoints (BE-09 / C02)."""

from backend.app.db.session import get_db
from backend.app.models.face import FaceMetricRequest, FaceMetricResponse
from backend.app.services.consent_service import require_consent
from backend.app.services.face_service import get_face_metrics_history, upsert_face_metric
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(tags=["face_metrics"])


@router.post("/face-metrics", response_model=FaceMetricResponse)
async def ingest_face_metric_endpoint(
    payload: FaceMetricRequest,
    db: AsyncSession = Depends(get_db),
    _consent: bool = Depends(require_consent("camera")),
):
    """Ingest daily facial morphology relative change index (BE-09).

    Idempotent upsert keeping higher-quality landmark value.
    Never claimed as fluid volume.
    """
    return await upsert_face_metric(payload, db)


@router.get("/face-metrics", response_model=list[FaceMetricResponse])
async def query_face_metrics_endpoint(
    crew_id: str = Query(...),
    from_date: str | None = Query(default=None, alias="from"),
    to_date: str | None = Query(default=None, alias="to"),
    db: AsyncSession = Depends(get_db),
):
    """Query daily face metrics within a date range."""
    return await get_face_metrics_history(crew_id, from_date, to_date, db)
