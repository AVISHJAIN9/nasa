"""AstroCare v2 - Eye Metrics Ingest Service (BE-10 / C03)."""

from backend.app.core.errors import AppException
from backend.app.db.models.telemetry import SignalReading
from backend.app.models.eye import EyeMetricRequest, EyeMetricResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

VALID_EYE_METRICS = {"blink_rate_per_min", "eye_open_ratio", "pupil_proxy"}


async def ingest_eye_metric(
    payload: EyeMetricRequest, session: AsyncSession
) -> EyeMetricResponse:
    """Ingest camera-derived eye metric and persist in signal_reading (DB-01)."""
    if payload.metric not in VALID_EYE_METRICS:
        raise AppException(
            code="VALIDATION_ERROR",
            message=f"Invalid eye metric '{payload.metric}'. Valid eye metrics: {list(VALID_EYE_METRICS)}",
            status_code=422,
        )

    # Check idempotency: duplicate reading_id is ignored
    stmt = select(SignalReading).where(SignalReading.reading_id == payload.reading_id)
    result = await session.execute(stmt)
    existing = result.scalar_one_or_none()
    if existing:
        proxy_notice = (
            "Proxy indicator: 2D pupil diameter proxy, not an absolute infrared pupillometry measurement"
            if existing.metric == "pupil_proxy"
            else None
        )
        return EyeMetricResponse(
            reading_id=existing.reading_id,
            crew_id=existing.crew_id,
            metric=existing.metric,
            value=existing.value,
            unit=existing.unit,
            ts=existing.ts,
            quality=existing.quality,
            provenance=existing.provenance,
            status="ignored_duplicate",
            proxy_notice=proxy_notice,
        )

    record = SignalReading(
        reading_id=payload.reading_id,
        crew_id=payload.crew_id,
        sensor="camera",
        metric=payload.metric,
        value=payload.value,
        unit=payload.unit,
        ts=payload.ts,
        quality=payload.quality,
        provenance=payload.provenance,
        quality_flag="nominal",
        excluded_from_fusion=False,
    )
    session.add(record)
    await session.commit()
    await session.refresh(record)

    proxy_notice = (
        "Proxy indicator: 2D pupil diameter proxy, not an absolute infrared pupillometry measurement"
        if record.metric == "pupil_proxy"
        else None
    )

    return EyeMetricResponse(
        reading_id=record.reading_id,
        crew_id=record.crew_id,
        metric=record.metric,
        value=record.value,
        unit=record.unit,
        ts=record.ts,
        quality=record.quality,
        provenance=record.provenance,
        status="stored",
        proxy_notice=proxy_notice,
    )


async def query_eye_metrics(
    crew_id: str,
    metric: str | None,
    from_ts: str | None,
    to_ts: str | None,
    session: AsyncSession,
) -> list[EyeMetricResponse]:
    """Query eye metrics from signal_reading table."""
    stmt = select(SignalReading).where(
        SignalReading.crew_id == crew_id,
        SignalReading.metric.in_(list(VALID_EYE_METRICS)),
    )
    if metric:
        stmt = stmt.where(SignalReading.metric == metric)
    if from_ts:
        stmt = stmt.where(SignalReading.ts >= from_ts)
    if to_ts:
        stmt = stmt.where(SignalReading.ts <= to_ts)
    stmt = stmt.order_by(SignalReading.ts)

    result = await session.execute(stmt)
    records = result.scalars().all()

    return [
        EyeMetricResponse(
            reading_id=r.reading_id,
            crew_id=r.crew_id,
            metric=r.metric,
            value=r.value,
            unit=r.unit,
            ts=r.ts,
            quality=r.quality,
            provenance=r.provenance,
            status="stored",
            proxy_notice=(
                "Proxy indicator: 2D pupil diameter proxy, not an absolute infrared pupillometry measurement"
                if r.metric == "pupil_proxy"
                else None
            ),
        )
        for r in records
    ]
