"""AstroCare /assess and Reference API Parity Endpoints.

Implements:
- POST /assess: Unified Model A (ml1_stress) + Model B (FusionNet) evaluation
- POST /assess/reset/{session}: Reset Model B baseline state
- POST /minute: Reference API minute ingest
- POST /reset/{session}: Reference API reset
- GET /claims: Claims sheet reference
- GET /registry: Component registry reference
- POST /ask: NASA retrieval assistant
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any, Mapping

from backend.app.core.config import get_settings
from backend.app.services.ml_fusion_service import (
    MODEL_B_CHANNELS,
    get_fusion_service,
)
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

logger = logging.getLogger("astrocare.assess_api")

router = APIRouter(tags=["ML Assessment & Early Warning"])

MODEL_B_DIR = Path(__file__).resolve().parents[4] / "models" / "model_b"


# --- Schemas ---

class AssessRequest(BaseModel):
    session: str = Field(
        ...,
        min_length=1,
        max_length=64,
        pattern=r"^[A-Za-z0-9_-]+$",
        description="Session identifier, 1-64 chars [A-Za-z0-9_-]",
    )
    features: dict[str, float | None] | None = Field(
        default=None, description="Optional Model A stress features"
    )
    minute: dict[str, float | None] | None = Field(
        default=None, description="Optional Model B minute channels"
    )


class ModelAResponse(BaseModel):
    ran: bool
    stress_prob: float | None = None
    label: str | None = None
    error: str | None = None


class ModelBResponse(BaseModel):
    ran: bool
    minute_index: int | None = None
    early_warning_score: float | None = None
    alert: bool = False
    status: str | None = None
    error: str | None = None


class CombinedRuleResponse(BaseModel):
    flag: bool
    reasons: list[str]
    rule: str = "alert_B OR stress_prob_A >= threshold"
    threshold: float
    validated: bool = False


class AssessResponse(BaseModel):
    session: str
    model_a: ModelAResponse
    model_b: ModelBResponse
    combined: CombinedRuleResponse
    missing: list[str]
    disclaimer: str = (
        "Research prototype, not a medical device. Combined rule not validated."
    )


class MinuteRequest(BaseModel):
    session: str = "default"
    hr: float | None = None
    rmssd: float | None = None
    activity: float | None = None
    resp: float | None = None
    blink: float | None = None
    voice: float | None = None
    typing: float | None = None
    puff: float | None = None
    rppg_hr: float | None = None


class AskBody(BaseModel):
    q: str
    k: int = 3
    min_sim: float = 0.15


# --- Endpoints ---

@router.post("/assess", response_model=AssessResponse)
async def assess(req: AssessRequest) -> AssessResponse:
    """Unified assessment endpoint evaluating Model A and Model B in-process."""
    settings = get_settings()
    threshold = getattr(settings, "ASTROCARE_STRESS_THRESHOLD", 0.5)

    service = get_fusion_service()
    try:
        result = await service.assess(
            session_id=req.session,
            features=req.features,
            minute=req.minute,
            threshold=threshold,
        )
        return AssessResponse(**result)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        )
    except Exception as exc:
        logger.error(f"Error during assessment for session: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal assessment error",
        )


@router.post("/assess/reset/{session}")
async def assess_reset(session: str) -> dict[str, str]:
    """Reset session state for Model B."""
    service = get_fusion_service()
    await service.reset_session(session)
    return {"reset": session}


# --- Reference API Parity Endpoints ---

@router.post("/minute")
async def process_minute(m: MinuteRequest) -> dict[str, Any]:
    """Reference API minute ingest endpoint."""
    service = get_fusion_service()
    minute_dict = m.model_dump(exclude={"session"})

    try:
        res, _ = await service.predict_model_b(m.session, minute_dict)
        return {
            "session": m.session,
            "minute": res["minute_index"],
            "score": res["early_warning_score"],
            "alert": res["alert"],
            "abstain": res["status"] == "abstain" if res["status"] else None,
            "status": res["status"],
        }
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        )


@router.post("/reset/{session}")
async def reset_session_ref(session: str) -> dict[str, str]:
    """Reference API reset session endpoint."""
    service = get_fusion_service()
    await service.reset_session(session)
    return {"reset": session}


@router.get("/claims")
async def get_claims() -> dict[str, Any]:
    """Reference API claims sheet endpoint."""
    claims_path = MODEL_B_DIR / "claims_sheet.json"
    if claims_path.exists():
        with open(claims_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"note": "claims sheet not bundled"}


@router.get("/registry")
async def get_registry() -> list[dict[str, Any]]:
    """Reference API component registry endpoint."""
    csv_path = MODEL_B_DIR / "component_registry.csv"
    if csv_path.exists():
        import pandas as pd

        return pd.read_csv(csv_path).to_dict("records")
    return []


# Cached retriever state for /ask
_ASK_RETRIEVER: dict[str, Any] = {}


@router.post("/ask")
async def ask_nasa(b: AskBody) -> dict[str, Any]:
    """Reference API NASA extractive retrieval question answering."""
    emb_path = MODEL_B_DIR / "nasa_emb.npy"
    chunks_path = MODEL_B_DIR / "nasa_chunks.json"

    if not (emb_path.exists() and chunks_path.exists()):
        return {"answer": None, "note": "knowledge index not bundled"}

    import numpy as np

    if "enc" not in _ASK_RETRIEVER:
        try:
            from sentence_transformers import SentenceTransformer

            _ASK_RETRIEVER["enc"] = SentenceTransformer(
                "sentence-transformers/all-MiniLM-L6-v2", device="cpu"
            )
            _ASK_RETRIEVER["E"] = np.load(emb_path)
            with open(chunks_path, "r", encoding="utf-8") as f:
                _ASK_RETRIEVER["C"] = json.load(f)
        except Exception as exc:
            logger.warning(f"Retriever initialization failure: {exc}")
            return {"answer": None, "note": "retriever failed to initialize"}

    q_emb = _ASK_RETRIEVER["enc"].encode([b.q], normalize_embeddings=True)[0]
    sims = _ASK_RETRIEVER["E"] @ q_emb
    boost = {
        "hrp_hazards.txt": 0.06,
        "hrp_risks.txt": 0.06,
        "hrp_overview.txt": 0.04,
    }
    src_list = _ASK_RETRIEVER["C"]["src"]
    sims = sims + np.array(
        [boost.get(x, 0.0) for x in src_list], dtype=np.float32
    )

    top_indices: list[int] = []
    seen: dict[str, int] = {}
    for i in np.argsort(-sims)[:60]:
        idx = int(i)
        if sims[idx] < b.min_sim or len(top_indices) >= b.k:
            break
        src = src_list[idx]
        if seen.get(src, 0) >= 2:
            continue
        seen[src] = seen.get(src, 0) + 1
        top_indices.append(idx)

    if not top_indices:
        return {"answer": None, "note": "Not covered by the loaded NASA/CSA pages."}

    return {
        "answer": [
            {
                "source": src_list[i],
                "sim": round(float(sims[i]), 2),
                "text": _ASK_RETRIEVER["C"]["text"][i],
            }
            for i in top_indices
        ]
    }
