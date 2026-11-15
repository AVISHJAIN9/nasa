"""AstroCare v2 - Face Metrics Ingestion Service (BE-09 / C02)."""

from backend.app.db.models.face_metrics import FaceMetric
from backend.app.models.face import FaceMetricRequest, FaceMetricResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


async def upsert_face_metric(
    payload: FaceMetricRequest, session: AsyncSession
) -> FaceMetricResponse:
    """Idempotently upsert face metric for (crew_id, date, metric).

    Keeps the higher-quality value; ties go to the latest.
    """
    stmt = select(FaceMetric).where(
        FaceMetric.crew_id == payload.crew_id,
        FaceMetric.date == payload.date,
        FaceMetric.metric == payload.metric,
    )
    result = await session.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        # Keep higher-quality value (ties go to latest)
        if payload.landmark_quality >= existing.landmark_quality:
            existing.value = payload.value
            existing.landmark_quality = payload.landmark_quality
            existing.provenance = payload.provenance
            await session.commit()
            await session.refresh(existing)
        return FaceMetricResponse(
            crew_id=existing.crew_id,
            date=existing.date,
            metric=existing.metric,
            value=existing.value,
            landmark_quality=existing.landmark_quality,
            provenance=existing.provenance,
            status="stored",
            note="relative change from own baseline, not a measured fluid volume",
        )

    # Insert new record
    record = FaceMetric(
        crew_id=payload.crew_id,
        date=payload.date,
        metric=payload.metric,
        value=payload.value,
        landmark_quality=payload.landmark_quality,
        provenance=payload.provenance,
    )
    session.add(record)
    await session.commit()
    await session.refresh(record)

    return FaceMetricResponse(
        crew_id=record.crew_id,
        date=record.date,
        metric=record.metric,
        value=record.value,
        landmark_quality=record.landmark_quality,
        provenance=record.provenance,
        status="stored",
        note="relative change from own baseline, not a measured fluid volume",
    )


async def get_face_metrics_history(
    crew_id: str,
    from_date: str | None,
    to_date: str | None,
    session: AsyncSession,
) -> list[FaceMetricResponse]:
    """Query face metrics history in date range."""
    stmt = select(FaceMetric).where(FaceMetric.crew_id == crew_id)
    if from_date:
        stmt = stmt.where(FaceMetric.date >= from_date)
    if to_date:
        stmt = stmt.where(FaceMetric.date <= to_date)
    stmt = stmt.order_by(FaceMetric.date)

    result = await session.execute(stmt)
    records = result.scalars().all()

    return [
        FaceMetricResponse(
            crew_id=r.crew_id,
            date=r.date,
            metric=r.metric,
            value=r.value,
            landmark_quality=r.landmark_quality,
            provenance=r.provenance,
            status="stored",
            note="relative change from own baseline, not a measured fluid volume",
        )
        for r in records
    ]
