"""AstroCare v2 - Federated Learning FedAvg Aggregator Service (BE-17 / M02 - Wave 3 Prototype)."""

import json
import logging
from typing import Any

from backend.app.core.errors import AppException
from backend.app.db.models.fed import FedRound
from backend.app.models.fed import FedGlobalResponse, FedUpdateRequest
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger("astrocare.fed")

# Valid authorized federated client tokens
AUTHORIZED_CLIENT_TOKENS: dict[str, str] = {
    "client_1": "fed-token-client-1-secret",
    "client_2": "fed-token-client-2-secret",
    "client_3": "fed-token-client-3-secret",
}

# In-memory accumulator for active federated rounds
_active_round_id: int = 1
_current_global_weights: dict[str, float] = {
    "layer1.weight_mean": 0.45,
    "layer1.bias": 0.12,
    "layer2.weight_mean": -0.22,
    "layer2.bias": 0.05,
}
_round_updates: dict[int, list[FedUpdateRequest]] = {}
_round_bytes: dict[int, int] = {}


def verify_client_token(client_id: str, token: str | None) -> None:
    """Verify pre-shared secret token for federated client node."""
    expected = AUTHORIZED_CLIENT_TOKENS.get(client_id)
    if not expected or token != expected:
        raise AppException(
            code="UNAUTHORIZED",
            message=f"Invalid or missing federated authorization token for client '{client_id}'",
            status_code=401,
        )


def start_new_round(round_id: int) -> int:
    """Initialize a new federated training round."""
    global _active_round_id
    _active_round_id = round_id
    _round_updates[round_id] = []
    _round_bytes[round_id] = 0
    return round_id


def get_global_weights_state() -> FedGlobalResponse:
    """Retrieve active global model weights."""
    return FedGlobalResponse(
        round_id=_active_round_id,
        global_weights=_current_global_weights,
        model_version="stub",
        prototype=True,
        note="Prototype Federated Averaging (FedAvg) aggregator; communicates mathematical weights only, zero patient data exchanged.",
    )


async def accumulate_client_update(
    update: FedUpdateRequest, token: str | None, session: AsyncSession
) -> dict[str, Any]:
    """Receive client local weights update, log bytes received, and trigger FedAvg if 3 clients reported."""
    global _current_global_weights
    verify_client_token(update.client_id, token)

    # Estimate received payload bytes
    payload_bytes = len(json.dumps(update.model_dump()).encode("utf-8"))
    _round_bytes[_active_round_id] = _round_bytes.get(_active_round_id, 0) + payload_bytes

    if _active_round_id not in _round_updates:
        _round_updates[_active_round_id] = []

    _round_updates[_active_round_id].append(update)
    current_count = len(_round_updates[_active_round_id])

    # If all 3 clients reported, compute weighted average FedAvg
    round_completed = False
    if current_count >= 3:
        total_samples = sum(u.n_samples for u in _round_updates[_active_round_id])
        if total_samples > 0:
            averaged: dict[str, float] = {}
            keys = _round_updates[_active_round_id][0].weights.keys()
            for k in keys:
                weighted_sum = sum(
                    u.n_samples * u.weights.get(k, 0.0)
                    for u in _round_updates[_active_round_id]
                )
                averaged[k] = round(weighted_sum / total_samples, 6)
            _current_global_weights = averaged
            round_completed = True

        # Persist round log into DB-13 fed_rounds
        fed_log = FedRound(
            round_id=_active_round_id,
            client_id=update.client_id,
            n_samples=update.n_samples,
            bytes_received=_round_bytes[_active_round_id],
            model_version="stub",
            global_weights=json.dumps(_current_global_weights),
            status="completed" if round_completed else "aggregating",
        )
        session.add(fed_log)
        await session.commit()

    return {
        "status": "update_accepted",
        "round_id": _active_round_id,
        "client_id": update.client_id,
        "bytes_received": payload_bytes,
        "clients_accumulated": current_count,
        "round_completed": round_completed,
        "prototype": True,
        "note": "Mathematical parameter weights only; zero raw telemetry stored or communicated.",
    }
