"""AstroCare v2 - Digital Twin Endpoints (BE-15 / A04 - Wave 3 Prototype)."""

from backend.app.db.session import get_db
from backend.app.models.twin import TwinSimulateRequest, TwinSimulateResponse
from backend.app.services.twin_service import run_twin_simulation
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(tags=["digital_twin"])


@router.post("/twin/simulate", response_model=TwinSimulateResponse)
async def simulate_digital_twin_endpoint(
    payload: TwinSimulateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Simulate projected physiological trajectories for an intervention action (BE-15).

    Prototype decision support only. Trajectory snapshots stored in DB-11.
    """
    return await run_twin_simulation(payload, db)
