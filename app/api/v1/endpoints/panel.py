"""AstroCare v2 - Specialist Panel Consultation Endpoints (BE-16 / M04 - Wave 3 Prototype)."""

from backend.app.db.session import get_db
from backend.app.models.panel import PanelConsultRequest, PanelConsultResponse
from backend.app.services.panel_service import consult_specialist_panel
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(tags=["specialist_panel"])


@router.post("/panel/consult", response_model=PanelConsultResponse)
async def consult_panel_endpoint(
    payload: PanelConsultRequest,
    db: AsyncSession = Depends(get_db),
):
    """Consult concurrent specialist agent personas (cardio, respiratory, mental_health) (BE-16).

    Prototype decision support: prompted agents over shared knowledge base, not independent physicians.
    """
    return await consult_specialist_panel(payload, db)
