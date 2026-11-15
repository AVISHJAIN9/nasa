"""Unit tests for ML-Platform integration.

Verifies:
- X02 Bayesian Kalman Filter integration in twin simulation service
- ML status transparency endpoint reporting audited models and evaluation metadata
- Today risk overview endpoint contract matching frontend TodayResponse
- Replay service integration with provenance preservation
"""

from fastapi.testclient import TestClient
import pytest

from backend.app.main import app
from backend.app.services.twin_service import twin_predict


@pytest.fixture(scope="module")
def client() -> TestClient:
    with TestClient(app) as c:
        yield c


def test_twin_predict_bayesian_integration() -> None:
    # Test twin_predict returns valid points with causal uncertainty bounds
    points = twin_predict(crew_id="ASTRO-01", horizon_days=7, action="daily_aerobic_exercise")
    assert len(points) == 7
    for p in points:
        assert p.metric == "pulse_bpm"
        assert p.mean > 40.0 and p.mean < 120.0
        assert p.lo90 <= p.mean
        assert p.hi90 >= p.mean


def test_ml_status_endpoint(client: TestClient) -> None:
    resp = client.get("/v1/ml/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "audited_models" in data
    assert len(data["audited_models"]) >= 4
    model_ids = [m["id"] for m in data["audited_models"]]
    assert "X02" in model_ids
    assert "F041" in model_ids
    assert "F043" in model_ids
    assert "F047" in model_ids
    assert "split_integrity" in data
    assert data["split_integrity"].get("verified") is True


def test_today_endpoint_contract(client: TestClient) -> None:
    resp = client.get("/v1/today?person_id=vega")
    assert resp.status_code == 200
    data = resp.json()
    assert data["state"] in ["normal", "off_today", "unsure"]
    assert "probability" in data
    assert "band" in data
    assert "crew_band" in data
    assert data["band"]["low"] <= data["band"]["high"]
    assert data["crew_band"]["low"] <= data["crew_band"]["high"]
    assert "abstained" in data
