"""AstroCare v2 - Feature Flags Management API (F141)."""

from backend.app.core.errors import NotFoundException
from backend.app.db.session import get_db
from backend.app.models.flags import FeatureFlagResponse, FeatureFlagUpdate
from backend.app.services.flag_service import get_flag, list_flags, set_flag
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/flags", tags=["Feature Flags"])


@router.get("", response_model=list[FeatureFlagResponse], summary="List all feature flags")
async def get_all_flags(session: AsyncSession = Depends(get_db)):
    """Retrieve all system feature flags and their current toggle states."""
    return await list_flags(session)


@router.get("/{name}", response_model=FeatureFlagResponse, summary="Get single flag status")
async def get_single_flag(name: str, session: AsyncSession = Depends(get_db)):
    """Retrieve status of an individual feature flag."""
    flag = await get_flag(session, name)
    if not flag:
        raise NotFoundException(message=f"Feature flag '{name}' not found")
    return flag


@router.patch("/{name}", response_model=FeatureFlagResponse, summary="Toggle feature flag state")
async def update_flag_state(
    name: str,
    update_data: FeatureFlagUpdate,
    session: AsyncSession = Depends(get_db),
):
    """Toggle a feature flag on or off live without restarting the backend."""
    return await set_flag(
        session=session,
        flag_name=name,
        is_enabled=update_data.is_enabled,
        updated_by=update_data.updated_by,
    )
