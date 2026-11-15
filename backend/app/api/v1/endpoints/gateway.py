"""AstroCare v2 - API Gateway, Versioning & Contract Verification (F131 & F132)."""

from typing import Any

from backend.app.core.config import get_settings
from backend.app.core.errors import (
    BadRequestException,
    ConflictException,
    FeatureDisabledException,
    ForbiddenException,
    InternalServerErrorException,
    NotFoundException,
    RateLimitExceededException,
    ServiceUnavailableException,
    UnauthorizedException,
)
from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/gateway", tags=["Gateway & Contracts"])


class GatewayInfoResponse(BaseModel):
    project_name: str
    api_version: str
    environment: str
    docs_url: str
    openapi_url: str
    contracts_file: str
    supported_error_codes: list[str]


@router.get("/info", response_model=GatewayInfoResponse, summary="Gateway metadata and contracts")
async def get_gateway_info() -> GatewayInfoResponse:
    """Return versioning, active environment, and contracts information."""
    settings = get_settings()
    return GatewayInfoResponse(
        project_name=settings.PROJECT_NAME,
        api_version="v1",
        environment=settings.ENVIRONMENT,
        docs_url="/docs",
        openapi_url="/openapi.json",
        contracts_file="build/CONTRACTS.md",
        supported_error_codes=[
            "VALIDATION_ERROR",
            "BAD_REQUEST",
            "UNAUTHORIZED",
            "FORBIDDEN",
            "NOT_FOUND",
            "CONFLICT",
            "RATE_LIMIT_EXCEEDED",
            "FEATURE_DISABLED",
            "INTERNAL_SERVER_ERROR",
            "SERVICE_UNAVAILABLE",
        ],
    )


class ValidationTestRequest(BaseModel):
    age: int = Field(..., ge=18, le=120, description="Astronaut age (18-120)")
    crew_id: str = Field(..., min_length=4, max_length=16, description="Astronaut ID code")


@router.post("/test-validation", summary="Trigger validation error for schema verification")
async def trigger_validation_test(payload: ValidationTestRequest) -> dict[str, Any]:
    """Test endpoint demonstrating Pydantic schema validation handling."""
    return {"message": "Payload is valid", "data": payload.model_dump()}


@router.get("/test-error/{code}", summary="Trigger standard error for contract verification")
async def trigger_test_error(code: str) -> None:
    """Explicit endpoint to trigger each standard error code, verifying contract shape."""
    code_upper = code.upper()
    if code_upper == "BAD_REQUEST":
        raise BadRequestException(message="Simulated bad request error")
    elif code_upper == "UNAUTHORIZED":
        raise UnauthorizedException(message="Simulated unauthorized error")
    elif code_upper == "FORBIDDEN":
        raise ForbiddenException(message="Simulated forbidden error")
    elif code_upper == "NOT_FOUND":
        raise NotFoundException(message="Simulated resource not found")
    elif code_upper == "CONFLICT":
        raise ConflictException(message="Simulated resource conflict")
    elif code_upper == "RATE_LIMIT_EXCEEDED":
        raise RateLimitExceededException(message="Simulated rate limit exceeded", retry_after=30)
    elif code_upper == "FEATURE_DISABLED":
        raise FeatureDisabledException(flag_name="test_flag", message="Simulated feature disabled")
    elif code_upper == "SERVICE_UNAVAILABLE":
        raise ServiceUnavailableException(message="Simulated service unavailable")
    elif code_upper == "INTERNAL_SERVER_ERROR":
        raise InternalServerErrorException(message="Simulated internal server error")
    elif code_upper == "UNHANDLED":
        # Raw unhandled exception to prove global exception handler catches it and hides trace
        raise RuntimeError("Raw unhandled server exception!")
    else:
        raise BadRequestException(message=f"Unknown test error code: {code}")
