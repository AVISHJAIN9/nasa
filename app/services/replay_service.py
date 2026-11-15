"""AstroCare v2 - Telemetry Dataset Replay Service (BE-18 / D03 - Wave 3 Prototype)."""

from typing import Any

from backend.app.models.replay import ReplayResponse, ReplayStartRequest
from backend.app.models.telemetry import SignalReadingItem
from backend.app.services.telemetry_service import ingest_single_reading
from sqlalchemy.ext.asyncio import AsyncSession

# Active replay engine state
_replay_state: dict[str, Any] = {
    "active_dataset": None,
    "status": "idle",
    "speed": 1.0,
    "position_seconds": 0,
    "crew_mapping": {},
}


async def start_dataset_replay(
    payload: ReplayStartRequest, session: AsyncSession
) -> ReplayResponse:
    """Start streaming historical/synthetic dataset rows through the SAME live ingest handler.

    Strict Invariant: Provenance is ALWAYS forced to REPLAYED.
    """
    _replay_state["active_dataset"] = payload.dataset_id
    _replay_state["status"] = "streaming"
    _replay_state["speed"] = payload.speed
    _replay_state["crew_mapping"] = payload.crew_mapping
    _replay_state["position_seconds"] = 0

    # Stream sample simulated batch of rows through the EXACT same ingest handler
    sample_crew = payload.crew_mapping.get("subject_01", "crew-01")
    sample_items = [
        SignalReadingItem(
            reading_id=f"replay-{payload.dataset_id}-001",
            crew_id=sample_crew,
            metric="pulse_bpm",
            value=76.0,
            unit="bpm",
            ts="2026-11-14T20:50:00Z",
            quality=0.91,
            provenance="REPLAYED",  # Strictly forced to REPLAYED
            sensor="wearable",
        ),
        SignalReadingItem(
            reading_id=f"replay-{payload.dataset_id}-002",
            crew_id=sample_crew,
            metric="resp_rpm",
            value=15.5,
            unit="rpm",
            ts="2026-11-14T20:50:00Z",
            quality=0.89,
            provenance="REPLAYED",  # Strictly forced to REPLAYED
            sensor="wearable",
        ),
    ]

    for item in sample_items:
        await ingest_single_reading(item, session)

    return ReplayResponse(
        dataset_id=payload.dataset_id,
        status="streaming",
        speed=payload.speed,
        provenance="REPLAYED",
        prototype=True,
        note="Replayed dataset streamed through standard ingest path. Provenance is strictly forced to REPLAYED.",
    )


def control_replay(action: str, position_seconds: int = 0) -> dict[str, Any]:
    """Control replay execution state: pause, resume, stop, seek."""
    if action == "pause":
        _replay_state["status"] = "paused"
    elif action == "resume":
        _replay_state["status"] = "streaming"
    elif action == "stop":
        _replay_state["status"] = "stopped"
        _replay_state["position_seconds"] = 0
    elif action == "seek":
        _replay_state["position_seconds"] = position_seconds

    return {
        "status": _replay_state["status"],
        "action": action,
        "position_seconds": _replay_state["position_seconds"],
        "speed": _replay_state["speed"],
        "provenance": "REPLAYED",
        "prototype": True,
        "note": "Replay controller prototype.",
    }
