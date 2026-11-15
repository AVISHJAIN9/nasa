"""AstroCare v2 - Feature Flag Service (F141).

Provides flag evaluation, database persistence, and fallback to environment settings.
Allows live toggling of ML and LLM modes.
"""

from backend.app.core.config import get_settings
from backend.app.db.models.feature_flag import FeatureFlag
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

DEFAULT_FLAGS = [
    {
        "name": "enable_ml",
        "is_enabled": True,
        "description": "Master toggle for Machine Learning inference and risk scoring pipelines",
    },
    {
        "name": "enable_local_llm",
        "is_enabled": False,
        "description": "Toggle onboard Ollama / llama.cpp local LLM inference",
    },
    {
        "name": "enable_high_rate_telemetry",
        "is_enabled": True,
        "description": "Toggle 1 Hz high-frequency vitals telemetry stream",
    },
]


async def initialize_default_flags(session: AsyncSession) -> list[FeatureFlag]:
    """Seed initial default flags if not already present."""
    created_flags = []
    for default in DEFAULT_FLAGS:
        stmt = select(FeatureFlag).where(FeatureFlag.name == default["name"])
        result = await session.execute(stmt)
        existing = result.scalar_one_or_none()
        if not existing:
            flag = FeatureFlag(
                name=default["name"],
                is_enabled=default["is_enabled"],
                description=default["description"],
                updated_by="system",
            )
            session.add(flag)
            created_flags.append(flag)
    if created_flags:
        await session.commit()
    return created_flags


async def get_flag(session: AsyncSession, flag_name: str) -> FeatureFlag | None:
    """Retrieve flag record by name from database."""
    stmt = select(FeatureFlag).where(FeatureFlag.name == flag_name)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def is_flag_enabled(session: AsyncSession | None, flag_name: str) -> bool:
    """Evaluate whether a flag is enabled, falling back to environment settings."""
    if session is not None:
        try:
            flag = await get_flag(session, flag_name)
            if flag is not None:
                return flag.is_enabled
        except Exception:
            # Fallback to settings on DB error
            pass

    settings = get_settings()
    if flag_name == "enable_ml":
        return settings.FLAG_ENABLE_ML
    elif flag_name == "enable_local_llm":
        return settings.FLAG_ENABLE_LOCAL_LLM
    return True


async def set_flag(
    session: AsyncSession, flag_name: str, is_enabled: bool, updated_by: str = "admin"
) -> FeatureFlag:
    """Toggle or update an existing flag, or create it if not present."""
    flag = await get_flag(session, flag_name)
    if flag:
        flag.is_enabled = is_enabled
        flag.updated_by = updated_by
    else:
        flag = FeatureFlag(
            name=flag_name,
            is_enabled=is_enabled,
            description=f"Dynamically registered flag: {flag_name}",
            updated_by=updated_by,
        )
        session.add(flag)
    await session.commit()
    await session.refresh(flag)
    return flag


async def list_flags(session: AsyncSession) -> list[FeatureFlag]:
    """List all registered feature flags."""
    stmt = select(FeatureFlag).order_by(FeatureFlag.name)
    result = await session.execute(stmt)
    return list(result.scalars().all())
