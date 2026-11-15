"""AstroCare v2 - ML Status & Mode Toggle Demonstration (F141).

Demonstrates behavior when ML is toggled off: system gracefully defaults to
rule-based fallbacks while remaining correct and operational.
"""

from typing import Any

from backend.app.core.flags import require_flag
from backend.app.db.session import get_db
from backend.app.services.flag_service import is_flag_enabled
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/ml", tags=["Machine Learning"])


@router.get("/status", summary="Check ML engine operational mode")
async def get_ml_status(session: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """Check whether ML models are active or system is operating on rule-based fallbacks."""
    ml_active = await is_flag_enabled(session, "enable_ml")
    llm_active = await is_flag_enabled(session, "enable_local_llm")

    if ml_active:
        mode = "active_ml_inference"
        description = (
            "LightGBM + Random Forest models active for risk scoring and baseline comparison"
        )
    else:
        mode = "rule_based_fallback"
        description = "ML disabled via feature flag; system safely operating using deterministic heuristic rules"

    return {
        "ml_enabled": ml_active,
        "local_llm_enabled": llm_active,
        "operational_mode": mode,
        "description": description,
        "system_status": "CORRECT",
        "disclaimer": "Decision-support prototype on synthetic and public data. Not a medical device. No diagnosis claims.",
    }


@router.get(
    "/predict-mock",
    dependencies=[Depends(require_flag("enable_ml"))],
    summary="Guarded ML endpoint",
)
async def guarded_ml_prediction() -> dict[str, Any]:
    """Demonstrates endpoint strictly guarded by enable_ml flag; returns 403 FEATURE_DISABLED if off."""
    return {
        "status": "success",
        "model": "synthetic_vital_classifier",
        "prediction": "normal_sinus_rhythm",
        "confidence": 0.98,
        "source": "SIMULATED",
    }
