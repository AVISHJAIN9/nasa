"""AstroCare v2 - Health & Readiness Checks (/health, /metrics)."""

import datetime
import time
from typing import Any

import redis.asyncio as aioredis
from backend.app.core.config import get_settings
from backend.app.db.session import get_db
from fastapi import APIRouter, Depends, Response, status
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()
START_TIME = time.time()

# Prometheus Metrics (F140)
REQUEST_COUNT = Counter(
    "astrocare_http_requests_total",
    "Total HTTP request count",
    ["method", "endpoint", "status_code"],
)
REQUEST_LATENCY = Histogram(
    "astrocare_http_request_duration_seconds",
    "HTTP request latency in seconds",
    ["endpoint"],
)


@router.get("/health", tags=["System"], summary="System Health & Dependency Check")
async def health_check(
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Verify backend status and active connectivity to PostgreSQL/TimescaleDB and Redis."""
    settings = get_settings()
    health_status = "healthy"
    db_status = "unknown"
    redis_status = "unknown"

    # Check Database
    try:
        res = await db.execute(text("SELECT 1"))
        if res.scalar() == 1:
            db_status = "connected"
    except Exception as exc:
        db_status = f"unhealthy: {str(exc)[:60]}"
        health_status = "degraded"

    # Check Redis
    try:
        r = aioredis.from_url(
            settings.REDIS_URL,
            socket_timeout=2,
            socket_connect_timeout=2,
        )
        ping_res = await r.ping()
        await r.aclose()
        if ping_res:
            redis_status = "connected"
    except Exception as exc:
        redis_status = f"unhealthy: {str(exc)[:60]}"
        health_status = "degraded"

    uptime_seconds = int(time.time() - START_TIME)

    # Set response code based on connectivity
    if health_status != "healthy":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {
        "status": health_status,
        "timestamp": datetime.datetime.now(datetime.UTC).isoformat(),
        "uptime_seconds": uptime_seconds,
        "environment": settings.ENVIRONMENT,
        "version": "0.1.0",
        "components": {
            "database": db_status,
            "redis": redis_status,
        },
    }


@router.get("/metrics", tags=["System"], summary="Prometheus Metrics")
async def metrics() -> Response:
    """Expose Prometheus formatted metrics for scrapers."""
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
