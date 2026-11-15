"""AstroCare v2 - Unified Error Envelope & Exception Handling (F132).

Enforces strict JSON error envelope across all endpoints:
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description.",
    "details": {},
    "request_id": "req-..."
  }
}
No internal stack traces are leaked to clients.
"""

from typing import Any

from backend.app.core.logging import get_request_id
from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, ValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)
    request_id: str


class ErrorResponse(BaseModel):
    error: ErrorDetail


class AppException(Exception):
    """Base application exception with standardized code, status, and details."""

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        details: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        self.headers = headers or {}


# Standard HTTP Error Subclasses
class BadRequestException(AppException):
    def __init__(self, message: str = "Bad request", details: dict[str, Any] | None = None):
        super().__init__(
            code="BAD_REQUEST",
            message=message,
            status_code=status.HTTP_400_BAD_REQUEST,
            details=details,
        )


class UnauthorizedException(AppException):
    def __init__(
        self,
        message: str = "Authentication required or invalid token",
        details: dict[str, Any] | None = None,
    ):
        super().__init__(
            code="UNAUTHORIZED",
            message=message,
            status_code=status.HTTP_401_UNAUTHORIZED,
            details=details,
            headers={"WWW-Authenticate": "Bearer"},
        )


class ForbiddenException(AppException):
    def __init__(
        self,
        message: str = "Access denied for current role or identity",
        details: dict[str, Any] | None = None,
    ):
        super().__init__(
            code="FORBIDDEN",
            message=message,
            status_code=status.HTTP_403_FORBIDDEN,
            details=details,
        )


class NotFoundException(AppException):
    def __init__(self, message: str = "Resource not found", details: dict[str, Any] | None = None):
        super().__init__(
            code="NOT_FOUND",
            message=message,
            status_code=status.HTTP_404_NOT_FOUND,
            details=details,
        )


class ConflictException(AppException):
    def __init__(
        self,
        message: str = "Resource conflict or duplicate entry",
        details: dict[str, Any] | None = None,
    ):
        super().__init__(
            code="CONFLICT",
            message=message,
            status_code=status.HTTP_409_CONFLICT,
            details=details,
        )


class RateLimitExceededException(AppException):
    def __init__(
        self,
        message: str = "Rate limit exceeded. Please back off.",
        retry_after: int = 60,
        details: dict[str, Any] | None = None,
    ):
        det = details or {}
        det["retry_after"] = retry_after
        super().__init__(
            code="RATE_LIMIT_EXCEEDED",
            message=message,
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            details=det,
            headers={"Retry-After": str(retry_after)},
        )


class FeatureDisabledException(AppException):
    def __init__(self, flag_name: str, message: str | None = None):
        msg = message or f"Feature '{flag_name}' is currently disabled."
        super().__init__(
            code="FEATURE_DISABLED",
            message=msg,
            status_code=status.HTTP_403_FORBIDDEN,
            details={"flag": flag_name},
        )


class ConsentRequiredException(AppException):
    def __init__(self, sensor: str, message: str | None = None):
        msg = message or f"Consent required for sensor: {sensor}"
        super().__init__(
            code="CONSENT_REQUIRED",
            message=msg,
            status_code=status.HTTP_403_FORBIDDEN,
            details={"sensor": sensor},
        )


class InternalServerErrorException(AppException):
    def __init__(
        self,
        message: str = "An unexpected internal server error occurred",
        details: dict[str, Any] | None = None,
    ):
        super().__init__(
            code="INTERNAL_SERVER_ERROR",
            message=message,
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            details=details,
        )


class ServiceUnavailableException(AppException):
    def __init__(
        self,
        message: str = "Service or dependency temporarily unavailable",
        details: dict[str, Any] | None = None,
    ):
        super().__init__(
            code="SERVICE_UNAVAILABLE",
            message=message,
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            details=details,
        )


# Global Exception Handlers
def build_error_response(
    code: str,
    message: str,
    status_code: int,
    details: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    req_id = get_request_id()
    content = {
        "code": code,
        "message": message,
        "request_id": req_id,
        "details": details or {},
        "error": {
            "code": code,
            "message": message,
            "details": details or {},
            "request_id": req_id,
        },
    }
    return JSONResponse(status_code=status_code, content=content, headers=headers)


async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    return build_error_response(
        code=exc.code,
        message=exc.message,
        status_code=exc.status_code,
        details=exc.details,
        headers=exc.headers,
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Format Pydantic schema validation errors into unified contract."""
    clean_errors = []
    for err in exc.errors():
        clean_errors.append(
            {
                "loc": list(err.get("loc", [])),
                "msg": err.get("msg", ""),
                "type": err.get("type", ""),
            }
        )
    return build_error_response(
        code="VALIDATION_ERROR",
        message="Request payload failed schema validation",
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        details={"validation_errors": clean_errors},
    )


async def pydantic_validation_exception_handler(
    request: Request, exc: ValidationError
) -> JSONResponse:
    """Format standard Pydantic model validation errors into unified contract."""
    clean_errors = []
    for err in exc.errors():
        clean_errors.append(
            {
                "loc": list(err.get("loc", [])),
                "msg": err.get("msg", ""),
                "type": err.get("type", ""),
            }
        )
    return build_error_response(
        code="VALIDATION_ERROR",
        message="Request payload failed schema validation",
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        details={"validation_errors": clean_errors},
    )


async def starlette_http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    """Wrap Starlette / FastAPI default HTTP exceptions."""
    status_code_map = {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        405: "METHOD_NOT_ALLOWED",
        409: "CONFLICT",
        429: "RATE_LIMIT_EXCEEDED",
        500: "INTERNAL_SERVER_ERROR",
        503: "SERVICE_UNAVAILABLE",
    }
    code = status_code_map.get(exc.status_code, f"HTTP_{exc.status_code}")
    headers = getattr(exc, "headers", None)
    return build_error_response(
        code=code,
        message=str(exc.detail),
        status_code=exc.status_code,
        headers=headers,
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all for unhandled exceptions to prevent stack trace leaks."""
    import logging

    logger = logging.getLogger("astrocare.errors")
    req_id = get_request_id()
    logger.exception(
        f"Unhandled exception on {request.method} {request.url.path} [req_id={req_id}]: {exc}"
    )
    return build_error_response(
        code="INTERNAL_SERVER_ERROR",
        message="An internal server error occurred. Please contact mission control with the request_id.",
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        details={},
    )
