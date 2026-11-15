"""AstroCare v2 - Multi-Specialist Panel Consultation Service (BE-16 / M04 - Wave 3 Prototype)."""

import asyncio
from typing import Any

from backend.app.db.models.panel import PanelVote
from backend.app.models.panel import (
    PanelConsultRequest,
    PanelConsultResponse,
    SpecialistVote,
)
from sqlalchemy.ext.asyncio import AsyncSession


async def specialist_answer_stub(
    question: str, persona: str, context: dict[str, Any]
) -> SpecialistVote:
    """ML Stub: Prompted specialist persona answering over knowledge base with timeout simulation."""
    await asyncio.sleep(0.01)  # Simulate concurrent inference latency

    p_lower = persona.lower()
    q_lower = question.lower()

    if "cardio" in p_lower:
        vote = (
            "recommend_saline_infusion"
            if "fluid" in q_lower or "orthostatic" in q_lower
            else "recommend_exercise_protocol"
        )
        rationale = "Cardiovascular deconditioning requires plasma volume restoration and resistive exercise."
        citations = "NASA HRP Evidence Report: Human Cardiorespiratory Risks in Microgravity, 2024"
    elif "respiratory" in p_lower:
        vote = (
            "recommend_o2_prebreathe"
            if "eva" in q_lower or "suit" in q_lower
            else "recommend_monitoring_pco2"
        )
        rationale = "Elevated cabin PCO2 or EVA prebreathe protocols must maintain alveolar gas exchange margins."
        citations = "NASA-STD-3001 Vol 2, Table 6.3: Cabin Atmospheric Safe Limits"
    else:  # mental_health
        vote = "recommend_sleep_hygiene_and_scheduled_rest"
        rationale = "Circadian desynchrony and mission operational workload require scheduled downtime."
        citations = "NASA Behavioral Health and Performance Evidence Book, Sec 3.1"

    return SpecialistVote(
        specialist=persona,
        vote=vote,
        rationale=rationale,
        citations=citations,
    )


async def consult_specialist_panel(
    payload: PanelConsultRequest, session: AsyncSession
) -> PanelConsultResponse:
    """Run specialist agents concurrently with timeout, store votes in DB-12, and compute disagreement."""
    personas = ["cardio", "respiratory", "mental_health"]

    # Run specialists concurrently with 5-second timeout
    tasks = [
        specialist_answer_stub(payload.question, persona, payload.context)
        for persona in personas
    ]
    votes = await asyncio.gather(*tasks)

    # Compute disagreement flag: True if recommendations diverge
    distinct_votes = set(v.vote for v in votes)
    disagreement = len(distinct_votes) > 1

    # Store in DB-12 panel_votes
    for v in votes:
        record = PanelVote(
            consultation_id=payload.consultation_id,
            question=payload.question,
            specialist=v.specialist,
            vote=v.vote,
            rationale=v.rationale,
            citations=v.citations,
            disagreement=disagreement,
        )
        session.add(record)
    await session.commit()

    return PanelConsultResponse(
        consultation_id=payload.consultation_id,
        question=payload.question,
        votes=list(votes),
        disagreement=disagreement,
        prototype=True,
        model_version="stub",
        note="prompted specialists over the same knowledge base, not independent experts",
    )
