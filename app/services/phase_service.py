"""AstroCare v2 - Mission Phase Thresholds Service (BE-14 / M05)."""

from backend.app.core.config import get_settings
from backend.app.core.errors import AppException
from backend.app.db.models.phase_thresholds import PhaseThreshold
from backend.app.models.phase import PhaseThresholdCreateRequest, PhaseThresholdResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# Baseline fallback thresholds if no cited phase-specific row exists
DEFAULT_THRESHOLDS: dict[str, tuple[float, float, str]] = {
    "pulse_bpm": (50.0, 100.0, "bpm"),
    "resp_rpm": (10.0, 24.0, "rpm"),
    "spo2": (90.0, 100.0, "%"),
    "eye_open_ratio": (0.40, 1.0, "ratio"),
    "blink_rate_per_min": (8.0, 30.0, "cpm"),
}


def set_mission_phase(new_phase: str) -> str:
    """Update active mission phase (launch, transit, landing, return)."""
    settings = get_settings()
    if new_phase not in settings.VALID_MISSION_PHASES:
        raise AppException(
            code="VALIDATION_ERROR",
            message=f"Invalid mission phase '{new_phase}'. Valid phases: {settings.VALID_MISSION_PHASES}",
            status_code=422,
            details={"phase": new_phase, "valid_phases": settings.VALID_MISSION_PHASES},
        )
    settings.MISSION_PHASE = new_phase
    return new_phase


def get_current_mission_phase() -> str:
    """Retrieve current active mission phase."""
    return get_settings().MISSION_PHASE


async def create_phase_threshold_record(
    payload: PhaseThresholdCreateRequest, session: AsyncSession
) -> PhaseThreshold:
    """Create a new phase-specific threshold with mandatory clinical/NASA citation."""
    if not payload.citation or not payload.citation.strip():
        raise AppException(
            code="VALIDATION_ERROR",
            message="Every phase_thresholds row requires a non-empty citation. Never invent priors.",
            status_code=422,
            details={"metric": payload.metric, "phase": payload.phase},
        )

    record = PhaseThreshold(
        phase=payload.phase,
        metric=payload.metric,
        low=payload.low,
        high=payload.high,
        unit=payload.unit,
        citation=payload.citation.strip(),
    )
    session.add(record)
    await session.commit()
    await session.refresh(record)
    return record


async def resolve_thresholds(
    crew_id: str,
    metric: str,
    phase: str | None = None,
    session: AsyncSession | None = None,
) -> PhaseThresholdResponse:
    """Resolve active thresholds for a metric and mission phase.

    Returns the citation with the thresholds. If no cited row exists, returns default
    thresholds with phase_specific=false. Never invents priors.
    """
    active_phase = phase or get_current_mission_phase()

    if session is not None:
        stmt = (
            select(PhaseThreshold)
            .where(PhaseThreshold.phase == active_phase, PhaseThreshold.metric == metric)
            .limit(1)
        )
        result = await session.execute(stmt)
        record = result.scalar_one_or_none()

        if record and record.citation and record.citation.strip():
            return PhaseThresholdResponse(
                metric=record.metric,
                phase=record.phase,
                low=record.low,
                high=record.high,
                unit=record.unit,
                citation=record.citation,
                phase_specific=True,
            )

    # Fallback default: phase_specific = False, citation = None
    default = DEFAULT_THRESHOLDS.get(metric, (40.0, 140.0, "units"))
    return PhaseThresholdResponse(
        metric=metric,
        phase=active_phase,
        low=default[0],
        high=default[1],
        unit=default[2],
        citation=None,
        phase_specific=False,
    )
