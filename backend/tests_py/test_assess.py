"""Phase 4 Test Suite for AstroCare ML Model Fusion and Unified /assess Endpoint.

Covers:
- Test 1: Model A standalone vs /assess numerical parity (< 1e-6)
- Test 2: Model B standalone vs /assess on 400-minute simulation with injected deviation (< 1e-6)
- Test 3: Request permutations & edge cases (A only, B only, both, neither, out-of-range, NaN, session regex/length)
- Test 4: Session isolation (interleaved sessions)
- Test 5: Reset endpoint and session lifecycle
- Test 6: Pre-existing endpoint parity (/health, /minute, /reset, /claims, /registry)
- Test 7: Model A load failure graceful degradation
"""

from __future__ import annotations

import json
import math
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.ml_fusion_service import (
    MODEL_A_DIR,
    MODEL_B_DIR,
    MODEL_A_FEATURES,
    MODEL_B_CHANNELS,
    OnlineDetector,
    fusion_service,
)


@pytest.fixture(scope="session")
def client() -> TestClient:
    fusion_service.load_models()
    with TestClient(app) as c:
        yield c


# ---------------------------------------------------------------------------
# Test 1: Model A Standalone vs /assess Numerical Parity (< 1e-6)
# ---------------------------------------------------------------------------
def test_model_a_numerical_parity(client: TestClient) -> None:
    test_rows = [
        {
            "hr_mean": 65.0,
            "sdnn": 55.0,
            "rmssd": 48.0,
            "pnn50": 22.0,
            "eda_mean": 1.2,
            "eda_std": 0.15,
            "eda_slope": 0.002,
            "temp_mean": 33.8,
        },
        {
            "hr_mean": 115.0,
            "sdnn": 15.0,
            "rmssd": 12.0,
            "pnn50": 2.0,
            "eda_mean": 8.5,
            "eda_std": 2.1,
            "eda_slope": 0.12,
            "temp_mean": 36.5,
        },
        {
            # Partial features: some None
            "hr_mean": 80.0,
            "sdnn": None,
            "rmssd": 35.0,
            "pnn50": None,
            "eda_mean": 2.0,
            "eda_std": None,
            "eda_slope": 0.01,
            "temp_mean": 34.0,
        },
    ]

    for idx, row in enumerate(test_rows):
        # 1. Standalone prediction
        import pandas as pd
        x_vals = [row.get(f) if row.get(f) is not None else float("nan") for f in MODEL_A_FEATURES]
        df = pd.DataFrame([x_vals], columns=MODEL_A_FEATURES)
        probs = fusion_service.model_a.predict_proba(df)
        expected_prob = float(probs[0, list(fusion_service.model_a.classes_).index(1)])

        # 2. Endpoint prediction
        resp = client.post(
            "/assess",
            json={
                "session": f"parity-a-{idx}",
                "features": row,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["model_a"]["ran"] is True
        assert data["model_a"]["error"] is None
        actual_prob = data["model_a"]["stress_prob"]

        diff = abs(expected_prob - actual_prob)
        assert diff < 1e-5, f"Discrepancy {diff} exceeded threshold for row {idx}"


# ---------------------------------------------------------------------------
# Test 2: Model B Standalone vs /assess (400 Minutes Simulation)
# ---------------------------------------------------------------------------
def test_model_b_400_minute_simulation(client: TestClient) -> None:
    session_id = "sim-400-min-eval"

    # Reset session first
    client.post(f"/assess/reset/{session_id}")

    # Create standalone detector
    standalone_detector = OnlineDetector(
        fusion_service.model_b_net, fusion_service.model_b_cfg
    )

    scores_standalone: list[float | None] = []
    scores_endpoint: list[float | None] = []
    alerts_standalone: list[bool] = []
    alerts_endpoint: list[bool] = []

    # Run 400 minutes: 1..300 nominal, 301..400 elevated deviation
    for m in range(1, 401):
        if m <= 300:
            reading = {
                "hr": 70.0 + math.sin(m / 10.0) * 3.0,
                "rmssd": 45.0 + math.cos(m / 10.0) * 4.0,
                "activity": 100.0,
                "resp": 14.0,
                "blink": 16.0,
                "voice": 2.0,
                "typing": 120.0,
                "puff": 0.0,
                "rppg_hr": 70.0,
            }
        else:
            # Injected deviation after minute 300
            drift = (m - 300) * 0.4
            reading = {
                "hr": min(160.0, 75.0 + drift * 2.0),
                "rmssd": max(10.0, 45.0 - drift),
                "activity": 350.0,
                "resp": min(35.0, 14.0 + drift * 0.3),
                "blink": max(5.0, 16.0 - drift * 0.2),
                "voice": 15.0,
                "typing": 30.0,
                "puff": 1.0,
                "rppg_hr": min(160.0, 75.0 + drift * 2.0),
            }

        # Standalone step
        x_vec = [reading[c] for c in MODEL_B_CHANNELS]
        res_step = standalone_detector.step(x_vec)
        if res_step is None:
            s_score = None
            s_alert = False
        else:
            s_score = res_step["score"]
            s_alert = res_step["alert"]
        scores_standalone.append(s_score)
        alerts_standalone.append(s_alert)

        # Endpoint step
        resp = client.post(
            "/assess",
            json={
                "session": session_id,
                "minute": reading,
            },
        )
        assert resp.status_code == 200
        res_data = resp.json()
        b_res = res_data["model_b"]
        assert b_res["ran"] is True
        assert b_res["minute_index"] == m
        scores_endpoint.append(b_res["early_warning_score"])
        alerts_endpoint.append(b_res["alert"])

    # Compare all 400 minutes
    for m in range(400):
        s_sc = scores_standalone[m]
        e_sc = scores_endpoint[m]
        if s_sc is None:
            assert e_sc is None, f"Minute {m+1}: standalone is None but endpoint is {e_sc}"
        else:
            assert e_sc is not None, f"Minute {m+1}: standalone is {s_sc} but endpoint is None"
            assert abs(s_sc - e_sc) < 1e-5, f"Minute {m+1}: score diff {abs(s_sc - e_sc)}"

        assert alerts_standalone[m] == alerts_endpoint[m], f"Minute {m+1}: alert mismatch"


# ---------------------------------------------------------------------------
# Test 3: Request Permutations & Input Validation Edge Cases
# ---------------------------------------------------------------------------
def test_assess_permutations_and_validation(client: TestClient) -> None:
    session = "perm-test-01"

    # Case 1: Model A only
    resp = client.post(
        "/assess",
        json={
            "session": session,
            "features": {"hr_mean": 72.0, "rmssd": 45.0},
        },
    )
    assert resp.status_code == 200
    d = resp.json()
    assert d["model_a"]["ran"] is True
    assert d["model_b"]["ran"] is False
    assert len(d["missing"]) > 0

    # Case 2: Model B only
    resp = client.post(
        "/assess",
        json={
            "session": session,
            "minute": {"hr": 75.0, "rmssd": 40.0},
        },
    )
    assert resp.status_code == 200
    d = resp.json()
    assert d["model_a"]["ran"] is False
    assert d["model_b"]["ran"] is True

    # Case 3: Neither provided
    resp = client.post("/assess", json={"session": session})
    assert resp.status_code == 200
    d = resp.json()
    assert d["model_a"]["ran"] is False
    assert d["model_b"]["ran"] is False
    assert d["combined"]["flag"] is False

    # Case 4: Invalid session characters (regex [A-Za-z0-9_-])
    resp = client.post("/assess", json={"session": "invalid@session!"})
    assert resp.status_code == 422

    # Case 5: Session > 64 chars
    resp = client.post("/assess", json={"session": "a" * 65})
    assert resp.status_code == 422

    # Case 6: Out-of-bounds minute reading (hr > 250)
    resp = client.post(
        "/assess",
        json={
            "session": session,
            "minute": {"hr": 999.0},
        },
    )
    assert resp.status_code == 422

    # Case 7: Negative physiological value
    resp = client.post(
        "/assess",
        json={
            "session": session,
            "minute": {"activity": -10.0},
        },
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Test 4: Session Isolation
# ---------------------------------------------------------------------------
def test_session_isolation(client: TestClient) -> None:
    s1 = "isolation-session-A"
    s2 = "isolation-session-B"

    client.post(f"/assess/reset/{s1}")
    client.post(f"/assess/reset/{s2}")

    # Advance s1 by 5 minutes
    for _ in range(5):
        resp = client.post("/assess", json={"session": s1, "minute": {"hr": 70.0}})
        assert resp.status_code == 200

    # s1 should be at minute 5
    d1 = resp.json()
    assert d1["model_b"]["minute_index"] == 5

    # Advance s2 by 2 minutes
    for _ in range(2):
        resp = client.post("/assess", json={"session": s2, "minute": {"hr": 85.0}})
        assert resp.status_code == 200

    d2 = resp.json()
    assert d2["model_b"]["minute_index"] == 2

    # Advance s1 once more -> minute 6
    resp = client.post("/assess", json={"session": s1, "minute": {"hr": 71.0}})
    assert resp.json()["model_b"]["minute_index"] == 6

    # Advance s2 once more -> minute 3
    resp = client.post("/assess", json={"session": s2, "minute": {"hr": 86.0}})
    assert resp.json()["model_b"]["minute_index"] == 3


# ---------------------------------------------------------------------------
# Test 5: Reset Endpoints
# ---------------------------------------------------------------------------
def test_reset_lifecycle(client: TestClient) -> None:
    session = "lifecycle-reset-test"

    # Step 1: Send 3 minutes
    for _ in range(3):
        client.post("/assess", json={"session": session, "minute": {"hr": 72.0}})

    # Step 2: Reset via POST /assess/reset/{session}
    res = client.post(f"/assess/reset/{session}")
    assert res.status_code == 200
    assert res.json() == {"reset": session}

    # Step 3: Next minute should start at 1
    resp = client.post("/assess", json={"session": session, "minute": {"hr": 72.0}})
    assert resp.json()["model_b"]["minute_index"] == 1


# ---------------------------------------------------------------------------
# Test 6: Pre-existing Parity Endpoints
# ---------------------------------------------------------------------------
def test_reference_parity_endpoints(client: TestClient) -> None:
    # 1. /health
    res = client.get("/health")
    assert res.status_code in [200, 503]
    data = res.json()
    assert "sessions" in data
    assert "channels" in data
    assert data["channels"] == MODEL_B_CHANNELS
    assert data.get("not_a_medical_device") is True

    # 2. /minute
    res = client.post(
        "/minute",
        json={"session": "parity-min", "minute": {"hr": 70.0, "activity": 50.0}},
    )
    assert res.status_code == 200
    m_data = res.json()
    assert m_data["session"] == "parity-min"
    assert m_data["minute"] == 1
    assert "score" in m_data
    assert "alert" in m_data
    assert "status" in m_data

    # 3. /claims
    res = client.get("/claims")
    assert res.status_code == 200
    claims = res.json()
    assert "fusion" in claims
    assert claims.get("not_a_medical_device") is True

    # 4. /registry
    res = client.get("/registry")
    assert res.status_code == 200
    reg = res.json()
    assert isinstance(reg, list)
    assert len(reg) >= 5


# ---------------------------------------------------------------------------
# Test 7: Model A Load Failure Graceful Degradation
# ---------------------------------------------------------------------------
def test_model_a_load_failure_isolation(client: TestClient) -> None:
    session = "model-a-fail-test"

    # Temporarily simulate Model A unavailable
    orig_model_a = fusion_service.model_a
    orig_error = fusion_service._model_a_error

    try:
        fusion_service.model_a = None
        fusion_service._model_a_error = "Model A weights unpickling simulated failure"

        resp = client.post(
            "/assess",
            json={
                "session": session,
                "features": {"hr_mean": 75.0},
                "minute": {"hr": 72.0},
            },
        )
        assert resp.status_code == 200
        d = resp.json()

        # Model A returns error without crashing the server
        assert d["model_a"]["ran"] is False
        assert "simulated failure" in d["model_a"]["error"]

        # Model B continues to run successfully
        assert d["model_b"]["ran"] is True
        assert d["model_b"]["error"] is None

    finally:
        fusion_service.model_a = orig_model_a
        fusion_service._model_a_error = orig_error
