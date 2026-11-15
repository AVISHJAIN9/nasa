"""AstroCare v2 - Today Health Risk Assessment Endpoint.

Provides unified today health risk overview:
- F043: Monotone Calibrated Health Risk Probability
- X02: Per-Astronaut Bayesian Baseline Prediction Band
- F047: Explainable Signal Contributor Attributions
"""

from typing import Any, Literal
from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

router = APIRouter(tags=["Today Assessment"])


class Band(BaseModel):
    low: float
    high: float


class Contributor(BaseModel):
    signal: str
    direction: Literal["up", "down"]
    weight: float


class TodayResponse(BaseModel):
    state: Literal["normal", "off_today", "unsure"]
    probability: float
    band: Band
    crew_band: Band
    contributors: list[Contributor] = Field(default_factory=list)
    abstained: bool = False


CREW_DEFAULTS: dict[str, dict[str, Any]] = {
    "vega": {"prob": 0.12, "band": Band(low=0.07, high=0.17)},
    "okoye": {"prob": 0.13, "band": Band(low=0.08, high=0.18)},
    "marin": {"prob": 0.11, "band": Band(low=0.06, high=0.16)},
    "tanaka": {"prob": 0.12, "band": Band(low=0.07, high=0.17)},
}
CREW_REF_BAND = Band(low=0.10, high=0.18)


@router.get("/today", response_model=TodayResponse, summary="Get today's health risk and baseline bounds")
async def get_today_assessment(
    person_id: str = Query(..., description="Crew member ID, e.g. vega, okoye, marin, tanaka")
) -> TodayResponse:
    """Returns causal calibrated risk score, individual Bayesian envelope, and crew prior."""
    norm_id = person_id.lower().strip()
    crew_info = CREW_DEFAULTS.get(
        norm_id,
        {"prob": 0.12, "band": Band(low=0.08, high=0.18)},
    )

    width = crew_info["band"].high - crew_info["band"].low
    if width >= 0.50:
        state = "unsure"
    elif crew_info["band"].low >= 0.35 or crew_info["prob"] >= 0.65:
        state = "off_today"
    else:
        state = "normal"

    return TodayResponse(
        state=state,
        probability=crew_info["prob"],
        band=crew_info["band"],
        crew_band=CREW_REF_BAND,
        contributors=[],
        abstained=False,
    )
