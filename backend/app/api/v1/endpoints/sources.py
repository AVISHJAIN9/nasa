"""API routes for external sources, space weather, ISS telemetry, and AI decision assistant."""

from __future__ import annotations

from typing import Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from backend.app.sources.noaa_swpc import NOAASWPCAdapter
from backend.app.sources.donki import NASADONKIAdapter
from backend.app.sources.iss_live import ISSLiveAdapter
from backend.app.sources.llm_router import llm_router, LLMResponse

router = APIRouter()

# Singletons for source adapters
swpc_adapter = NOAASWPCAdapter()
donki_adapter = NASADONKIAdapter()
iss_adapter = ISSLiveAdapter()


class AskRequest(BaseModel):
    prompt: str
    context: str | None = None


@router.get("/space-weather/current")
async def get_current_space_weather(
    refresh: bool = Query(default=False, description="Force refresh upstream feeds")
) -> dict[str, Any]:
    records = await swpc_adapter.fetch_once(force_refresh=refresh)
    health = swpc_adapter.health()
    return {
        "status": health.status,
        "provenance": records[0].provenance if records else "simulated",
        "last_success_at": health.last_success_at,
        "records": [r.model_dump() for r in records],
        "attribution": swpc_adapter.license.attribution_text,
        "disclaimer": "Research prototype, not a medical device. For informational decision support only.",
    }


@router.get("/space-weather/events")
async def get_space_weather_events(
    refresh: bool = Query(default=False, description="Force refresh upstream feeds")
) -> dict[str, Any]:
    records = await donki_adapter.fetch_once(force_refresh=refresh)
    events = donki_adapter.get_cached_events()
    health = donki_adapter.health()
    return {
        "status": health.status,
        "provenance": records[0].provenance if records else "simulated",
        "events": events,
        "records": [r.model_dump() for r in records],
        "attribution": donki_adapter.license.attribution_text,
        "disclaimer": "Research prototype, not a medical device. For informational decision support only.",
    }


@router.get("/iss/cabin/latest")
async def get_iss_cabin_telemetry(
    refresh: bool = Query(default=False, description="Force refresh coordinates")
) -> dict[str, Any]:
    records = await iss_adapter.fetch_once(force_refresh=refresh)
    health = iss_adapter.health()
    return {
        "status": health.status,
        "records": [r.model_dump() for r in records],
        "attribution": iss_adapter.license.attribution_text,
        "disclaimer": "Research prototype, not a medical device. For informational decision support only.",
    }


@router.get("/sources/health")
async def get_sources_health() -> dict[str, Any]:
    return {
        "sources": [
            swpc_adapter.health().model_dump(),
            donki_adapter.health().model_dump(),
            iss_adapter.health().model_dump(),
        ],
        "llm": llm_router.get_status(),
        "disclaimer": "Research prototype, not a medical device.",
    }


@router.get("/llm/status")
async def get_llm_status() -> dict[str, Any]:
    return llm_router.get_status()


@router.post("/assistant/ask", response_model=LLMResponse)
async def ask_assistant(payload: AskRequest) -> LLMResponse:
    if not payload.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt must not be empty")
    return await llm_router.ask(payload.prompt, payload.context)
