"""AstroCare v2 - Digital Twin Simulation Service (BE-15 / A04 - Wave 3 Prototype)."""

from backend.app.db.models.twin import TwinState
from backend.app.models.twin import (
    TrajectoryPoint,
    TwinSimulateRequest,
    TwinSimulateResponse,
)
from sqlalchemy.ext.asyncio import AsyncSession


def twin_predict(
    crew_id: str, horizon_days: int, action: str
) -> list[TrajectoryPoint]:
    """ML Stub: Predict physiological trajectories under given intervention.

    Labeled strictly with model_version='stub'.
    """
    trajectories: list[TrajectoryPoint] = []
    base_pulse = 70.0
    drift_factor = -0.5 if "exercise" in action.lower() else 0.8

    for day in range(1, horizon_days + 1):
        mean_val = round(base_pulse + (day * drift_factor), 1)
        trajectories.append(
            TrajectoryPoint(
                day=day,
                metric="pulse_bpm",
                mean=mean_val,
                lo90=round(mean_val - 4.5, 1),
                hi90=round(mean_val + 5.2, 1),
            )
        )
    return trajectories


async def run_twin_simulation(
    payload: TwinSimulateRequest, session: AsyncSession
) -> TwinSimulateResponse:
    """Run twin prediction and persist daily state snapshots into DB-11 twin_state."""
    points = twin_predict(payload.crew_id, payload.horizon_days, payload.action)

    # Persist daily snapshots in twin_state
    for p in points:
        record = TwinState(
            crew_id=payload.crew_id,
            day=p.day,
            metric=p.metric,
            mean=p.mean,
            lo90=p.lo90,
            hi90=p.hi90,
            action=payload.action,
        )
        session.add(record)
    await session.commit()

    return TwinSimulateResponse(
        crew_id=payload.crew_id,
        action=payload.action,
        trajectories=points,
        prototype=True,
        model_version="stub",
        note="Prototype predictive digital twin simulation for decision support; not validated clinical prognosis.",
    )
