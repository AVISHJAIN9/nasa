"""AstroCare v2 - Main FastAPI Application Entrypoint.

Platform Foundation:
- F131: API gateway, OpenAPI docs, versioning, CORS
- F132: Standard error envelope, Pydantic validation
- F140: Structured logging, request_id correlation, Prometheus metrics
- F141: Dynamic feature flags
"""

import logging
from contextlib import asynccontextmanager

from backend.app.api.v1.api import api_router
from backend.app.api.v1.endpoints.health import router as health_router
from backend.app.core.config import get_settings
from backend.app.core.errors import (
    AppException,
    app_exception_handler,
    pydantic_validation_exception_handler,
    starlette_http_exception_handler,
    unhandled_exception_handler,
    validation_exception_handler,
)
from backend.app.core.events import event_bus
from backend.app.core.logging import RequestLoggingMiddleware, setup_logging
from backend.app.db.session import AsyncSessionLocal, engine
from backend.app.services.flag_service import initialize_default_flags
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("astrocare.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager: initialize logging, connections, and defaults."""
    setup_logging()
    logger.info("Starting AstroCare v2 Platform Foundation...")

    # Initialize default feature flags if database is available
    try:
        async with AsyncSessionLocal() as session:
            created = await initialize_default_flags(session)
            if created:
                logger.info(f"Initialized {len(created)} default feature flags.")
    except Exception as exc:
        logger.warning(f"Database not immediately reachable during startup: {exc}")

    yield

    # Clean shutdown
    logger.info("Shutting down AstroCare v2...")
    await event_bus.close()
    await engine.dispose()


def create_application() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.PROJECT_NAME,
        description=(
            "Autonomous Medical Decision Support Platform (NASA Space Apps Challenge Prototype).\n\n"
            "**Medical Safety Policy:** Decision-support prototype on synthetic and public data. "
            "**NOT a medical device.** No diagnosis claims."
        ),
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    # Middleware
    app.add_middleware(RequestLoggingMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"],
    )

    # Global Exception Handlers (F132 unified contract)
    app.add_exception_handler(AppException, app_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(ValidationError, pydantic_validation_exception_handler)
    app.add_exception_handler(StarletteHTTPException, starlette_http_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)

    # Root Level System Endpoints (/health and /metrics)
    app.include_router(health_router)

    # Root Level WebSocket Broadcasts (/ws/telemetry and /ws/alerts)
    from backend.app.api.v1.endpoints.telemetry import telemetry_websocket_endpoint
    from backend.app.api.v1.endpoints.watchdog import alert_banner_websocket_endpoint
    app.add_api_websocket_route("/ws/telemetry", telemetry_websocket_endpoint)
    app.add_api_websocket_route("/ws/alerts", alert_banner_websocket_endpoint)

    # Versioned API Routers (/v1 and /api/v1)
    app.include_router(api_router, prefix="/v1")
    if settings.API_V1_STR != "/v1":
        app.include_router(api_router, prefix=settings.API_V1_STR)

    return app


app = create_application()
