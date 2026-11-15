"""AstroCare v2 - Feature Flag FastApi Dependency & Guard (F141)."""

from collections.abc import Callable

from backend.app.core.errors import FeatureDisabledException
from backend.app.db.session import get_db
from backend.app.services.flag_service import is_flag_enabled
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession


def require_flag(flag_name: str) -> Callable:
    """FastAPI dependency factory guarding endpoints behind dynamic feature flags."""

    async def _guard(session: AsyncSession = Depends(get_db)) -> bool:
        enabled = await is_flag_enabled(session, flag_name)
        if not enabled:
            raise FeatureDisabledException(flag_name=flag_name)
        return True

    return _guard
