"""AstroCare v2 - Structured JSON Logging & Request ID Middleware (F140).

Guarantees request_id correlation in every log entry and outgoing HTTP header.
"""

import contextvars
import json
import logging
import sys
import time
import uuid
from typing import Any

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

# Context variable for request correlation ID
request_id_ctx: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="")


def get_request_id() -> str:
    """Retrieve current request ID from context or generate fallback."""
    val = request_id_ctx.get()
    if not val:
        val = f"req-{uuid.uuid4().hex[:12]}"
        request_id_ctx.set(val)
    return val


class JSONLogFormatter(logging.Formatter):
    """Formats log records as structured single-line JSON with request_id."""

    def format(self, record: logging.LogRecord) -> str:
        log_obj: dict[str, Any] = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": get_request_id(),
        }
        if record.exc_info:
            log_obj["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_obj)


def setup_logging(level: str = "INFO") -> None:
    """Configure structured JSON logging across standard and application loggers."""
    root_logger = logging.getLogger()
    root_logger.setLevel(level)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONLogFormatter())

    # Clear existing handlers
    root_logger.handlers = [handler]

    # Silence noisy third-party loggers
    logging.getLogger("uvicorn.access").handlers = [handler]
    logging.getLogger("uvicorn.access").propagate = False


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware capturing request duration, status code, and stamping request_id."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Check client header or generate new
        incoming_id = request.headers.get("X-Request-ID")
        req_id = incoming_id if incoming_id else f"req-{uuid.uuid4().hex[:12]}"
        token = request_id_ctx.set(req_id)

        logger = logging.getLogger("astrocare.access")
        start_time = time.perf_counter()

        try:
            response = await call_next(request)
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.info(
                f"{request.method} {request.url.path} -> {response.status_code} ({duration_ms}ms)"
            )
            response.headers["X-Request-ID"] = req_id
            return response
        except Exception as exc:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.error(f"{request.method} {request.url.path} -> ERROR: {exc} ({duration_ms}ms)")
            from backend.app.core.errors import unhandled_exception_handler

            response = await unhandled_exception_handler(request, exc)
            response.headers["X-Request-ID"] = req_id
            return response
        finally:
            request_id_ctx.reset(token)
