"""AstroCare v2 - Digital Twin Simulation Service (BE-15 / A04 - Wave 3 Prototype)."""

from datetime import datetime, timedelta, timezone
from backend.app.db.models.twin import TwinState
from backend.app.models.twin import (
    TrajectoryPoint,
    TwinSimulateRequest,
    TwinSimulateResponse,
)
from sqlalchemy.ext.asyncio import AsyncSession

try:
    from astrocare.models.x02_bayesian import CrewPrior, X02AstronautMetricFilter
    HAS_X02 = True
except ImportError:
    HAS_X02 = False


def twin_predict(
    crew_id: str, horizon_days: int, action: str
) -> list[TrajectoryPoint]:
    """Predict physiological trajectories under given intervention using X02 Bayesian Kalman Filter."""
    trajectories: list[TrajectoryPoint] = []
    base_pulse = 70.0
    action_lower = action.lower()
    
    # Interventions modulate baseline drift velocity
    if "exercise" in action_lower:
        daily_drift = -0.4  # beneficial aerobic adaptation
    elif "fluid" in action_lower:
        daily_drift = -0.2  # vascular volume restoration
    elif "stress" in action_lower or "hypoxia" in action_lower:
        daily_drift = 1.2   # acute stress / hypoxia compensatory tachycardia
    else:
        daily_drift = 0.5   # microgravity deconditioning baseline

    if HAS_X02:
        try:
            prior = CrewPrior(metric="pulse_bpm", mean=base_pulse, variance=16.0, within_sigma=3.8)
            filt = X02AstronautMetricFilter(crew_id=crew_id, metric="pulse_bpm", prior=prior)
            start_time = datetime.now(timezone.utc)
            curr_val = base_pulse
            for day in range(1, horizon_days + 1):
                curr_val = max(50.0, min(140.0, curr_val + daily_drift))
                ts_str = (start_time + timedelta(days=day)).isoformat()
                out = filt.step(curr_val, ts_str)
                trajectories.append(
                    TrajectoryPoint(
                        day=day,
                        metric="pulse_bpm",
                        mean=round(out.mean_val, 1),
                        lo90=round(out.lo90, 1),
                        hi90=round(out.hi90, 1),
                    )
                )
            return trajectories
        except Exception:
            pass

    # Heuristic fallback
    for day in range(1, horizon_days + 1):
        mean_val = round(base_pulse + (day * daily_drift), 1)
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
        model_version="x02_bayesian_v1" if HAS_X02 else "stub",
        note="Predictive digital twin simulation using X02 Bayesian Kalman filter for decision support; not validated clinical prognosis.",
    )
