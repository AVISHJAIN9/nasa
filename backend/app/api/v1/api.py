"""AstroCare v2 - API v1 Router Aggregator (F131)."""

from backend.app.api.v1.endpoints import (
    assess,
    behavior,
    consent,
    eye,
    face,
    fed,
    flags,
    gateway,
    gesture,
    health,
    ml_status,
    motion,
    panel,
    phase,
    replay,
    security,
    sources,
    telemetry,
    today,
    twin,
    voice,
    watchdog,
)
from fastapi import APIRouter

api_router = APIRouter()

# Register v1 routes
api_router.include_router(health.router)
api_router.include_router(assess.router)
api_router.include_router(sources.router)
api_router.include_router(gateway.router)
api_router.include_router(flags.router)
api_router.include_router(security.router)
api_router.include_router(ml_status.router)
api_router.include_router(consent.router)
api_router.include_router(telemetry.router)
api_router.include_router(today.router)
api_router.include_router(voice.router)
api_router.include_router(behavior.router)
api_router.include_router(phase.router)
api_router.include_router(watchdog.router)
api_router.include_router(face.router)
api_router.include_router(motion.router)
api_router.include_router(eye.router)
api_router.include_router(gesture.router)
api_router.include_router(twin.router)
api_router.include_router(panel.router)
api_router.include_router(fed.router)
api_router.include_router(replay.router)
