"""Tests for AstroCare F047 / F098 / N16 Sourced Alert Explanation Pipeline."""
import pytest
from astrocare.models.f041_anomaly import create_anomaly_alert
from astrocare.models.f047_explanation import (
    explain_anomaly_alert,
    get_indicator_card_for_metric,
    AlertExplanation,
)
from astrocare.knowledge.cards import INDICATOR_CARDS


def test_heart_rate_alert_explanation():
    """Verifies heart rate alert explanation attaches CARD-01 action lines and sources."""
    alert = create_anomaly_alert(
        step_idx=45,
        ts="2026-11-14T07:45:00Z",
        crew_id="ASTRO-01",
        metric="heart_rate",
        detector="isolation_forest",
        raw_score=0.88,
        threshold=0.60,
        is_anomaly=1,
        hazard_tag="closed_environment",
    )
    explanation = explain_anomaly_alert(alert, baseline_value=64.0, observed_value=112.0)

    assert isinstance(explanation, AlertExplanation)
    assert explanation.card_id == "CARD-01"
    assert explanation.direction == "elevated"
    assert explanation.magnitude_delta == 48.0
    assert explanation.body_region == "heart"
    assert len(explanation.action_lines) > 0

    # Verify action lines match audited N13 card verbatim
    card = INDICATOR_CARDS["heart_rate"]
    assert explanation.action_lines == card.action_lines
    assert explanation.sources == card.sources
    assert "NASA Human Research Program" in explanation.sources[0]["title"]


def test_glucose_hypoglycemia_explanation():
    """Verifies glucose drop alert explanation attaches CARD-03 and 'depressed' direction."""
    alert = create_anomaly_alert(
        step_idx=20,
        ts="2026-11-14T07:20:00Z",
        crew_id="ASTRO-02",
        metric="glucose",
        detector="robust_z",
        raw_score=3.5,
        threshold=2.2,
        is_anomaly=1,
        hazard_tag="closed_environment",
    )
    explanation = explain_anomaly_alert(alert, baseline_value=90.0, observed_value=54.0)

    assert explanation.card_id == "CARD-03"
    assert explanation.direction == "depressed"
    assert explanation.magnitude_delta == 36.0
    assert explanation.body_region == "gut"

    card = INDICATOR_CARDS["blood_glucose"]
    assert explanation.action_lines == card.action_lines
    assert explanation.sources == card.sources


def test_sleep_hours_deprivation_explanation():
    """Verifies sleep deprivation alert explanation attaches CARD-05 and sleep action lines."""
    alert = create_anomaly_alert(
        step_idx=7,
        ts="2026-11-14T07:00:00Z",
        crew_id="ASTRO-04",
        metric="sleep_hours",
        detector="fixed_threshold",
        raw_score=2.9,
        threshold=1.5,
        is_anomaly=1,
        hazard_tag="isolation",
    )
    explanation = explain_anomaly_alert(alert, baseline_value=7.7, observed_value=3.2)

    assert explanation.card_id == "CARD-05"
    assert explanation.direction == "depressed"
    assert explanation.body_region == "brain"

    card = INDICATOR_CARDS["sleep"]
    assert explanation.action_lines == card.action_lines
    assert "lighting" in explanation.action_lines[0].lower() or "sleep" in explanation.action_lines[0].lower()


def test_anti_hallucination_guarantee():
    """Verifies all action lines and sources are strictly bounded to the N13 indicator cards."""
    for met in ["heart_rate", "glucose", "sleep_hours", "systolic_bp", "body_temp"]:
        card = get_indicator_card_for_metric(met)
        assert card.card_id.startswith("CARD-")
        assert len(card.action_lines) >= 1
        assert len(card.sources) >= 1
        for s in card.sources:
            assert "title" in s
            assert "organization" in s
            assert "url" in s


def test_f047_spo2_respiration_not_defaulting_to_heart():
    """Verifies Defect 48: SpO2 and respiration map to pulmonary_oxygenation card."""
    card_spo2 = get_indicator_card_for_metric("spo2")
    assert card_spo2.card_id == "CARD-09"
    assert "Pulmonary" in card_spo2.indicator_name

    card_rr = get_indicator_card_for_metric("respiration_rate")
    assert card_rr.card_id == "CARD-09"


def test_f047_direction_aware_action_lines():
    """Verifies Defect 47: Distinct action lines for elevated vs depressed vitals."""
    alert_high = create_anomaly_alert(
        step_idx=10,
        ts="2026-11-14T08:00:00Z",
        crew_id="ASTRO-01",
        metric="heart_rate",
        detector="robust_z",
        raw_score=3.5,
        threshold=2.0,
        is_anomaly=1,
    )
    exp_high = explain_anomaly_alert(alert_high, baseline_value=70.0, observed_value=120.0)

    alert_low = create_anomaly_alert(
        step_idx=11,
        ts="2026-11-14T08:01:00Z",
        crew_id="ASTRO-01",
        metric="heart_rate",
        detector="robust_z",
        raw_score=3.5,
        threshold=2.0,
        is_anomaly=1,
    )
    exp_low = explain_anomaly_alert(alert_low, baseline_value=70.0, observed_value=42.0)

    assert exp_high.direction == "elevated"
    assert exp_low.direction == "depressed"
    assert exp_high.action_lines != exp_low.action_lines


def test_f047_deterministic_id_and_api():
    """Verifies Defect 49 & 50: Deterministic explanation ID, summary, and explain_alert_api."""
    from astrocare.models.f047_explanation import explain_alert_api
    alert = create_anomaly_alert(
        step_idx=15,
        ts="2026-11-14T08:15:00Z",
        crew_id="ASTRO-02",
        metric="glucose",
        detector="isolation_forest",
        raw_score=0.9,
        threshold=0.5,
        is_anomaly=1,
    )
    res1 = explain_alert_api(alert, baseline_value=90.0, observed_value=175.0)
    res2 = explain_alert_api(alert, baseline_value=90.0, observed_value=175.0)

    assert res1["explanation_id"] == res2["explanation_id"]
    assert res1["explanation_id"].startswith("EXP-")
    assert len(res1["plain_language_summary"]) > 10
    assert len(res1["top_contributing_factors"]) >= 1
    assert 0.0 <= res1["confidence_score"] <= 1.0
