"""Tests for AstroCare F043 Monotone LightGBM Health Risk Score (Audited)."""
from pathlib import Path
import tempfile
import pytest

from astrocare.models.f043_risk_score import (
    FEATURE_NAMES,
    MONOTONE_CONSTRAINTS,
    SCRIPTED_20_TEST_CASES,
    F043RiskScoreModel,
    PhysiologicalSnapshot,
    check_f041_gating,
    generate_f043_calibration_plot,
)


def test_f043_monotone_constraints_definition():
    """Verifies feature names and two-sided monotone distress constraints (Defect N13)."""
    assert len(FEATURE_NAMES) == 8
    assert len(MONOTONE_CONSTRAINTS) == 8
    # All distress/deficit features are non-negative and positively monotonic with clinical risk
    assert all(c == 1 for c in MONOTONE_CONSTRAINTS)
    assert "hr_distress" in FEATURE_NAMES
    assert "spo2_deficit" in FEATURE_NAMES
    assert "glucose_distress" in FEATURE_NAMES


def test_f043_gating_check():
    """Verifies F041 gating check fails closed unless equal-FAR criteria met (Defect 6, N12)."""
    # Fails closed when summary is None or unverified
    assert check_f041_gating() is False
    assert check_f041_gating({"equal_far_test_status": "FAIL / NOT MET"}) is False
    # Passes when verified
    assert check_f041_gating({"equal_far_test_status": "PASS / MET"}) is True
    # Explicit bypass flag permits progression
    assert check_f041_gating(None, allow_ungated=True) is True


def test_f043_model_fit_and_monotonicity():
    """Verifies model trains and strictly respects two-sided monotonicity."""
    model = F043RiskScoreModel(random_state=42)
    model.fit_synthetic_cohort()
    assert model.is_fitted is True

    # 1. Monotonicity in Heart Rate Elevation (tachycardia)
    s_hr70 = PhysiologicalSnapshot(heart_rate=70.0, systolic_bp=118.0, body_temp=36.8, spo2=98.0, respiration_rate=14.0, glucose=90.0, sleep_hours=7.5, p_deviation=0.05)
    s_hr100 = PhysiologicalSnapshot(heart_rate=100.0, systolic_bp=118.0, body_temp=36.8, spo2=98.0, respiration_rate=14.0, glucose=90.0, sleep_hours=7.5, p_deviation=0.05)
    s_hr140 = PhysiologicalSnapshot(heart_rate=140.0, systolic_bp=118.0, body_temp=36.8, spo2=98.0, respiration_rate=14.0, glucose=90.0, sleep_hours=7.5, p_deviation=0.05)

    r70 = model.predict_risk(s_hr70)
    r100 = model.predict_risk(s_hr100)
    r140 = model.predict_risk(s_hr140)
    assert r70 <= r100 <= r140, f"HR Tachycardia Monotonicity violated: {r70} <= {r100} <= {r140}"

    # 2. Monotonicity in Heart Rate Depression (bradycardia, Defect N13)
    s_hr50 = PhysiologicalSnapshot(heart_rate=50.0, systolic_bp=118.0, body_temp=36.8, spo2=98.0, respiration_rate=14.0, glucose=90.0, sleep_hours=7.5, p_deviation=0.05)
    s_hr35 = PhysiologicalSnapshot(heart_rate=35.0, systolic_bp=118.0, body_temp=36.8, spo2=98.0, respiration_rate=14.0, glucose=90.0, sleep_hours=7.5, p_deviation=0.05)

    r50 = model.predict_risk(s_hr50)
    r35 = model.predict_risk(s_hr35)
    assert r70 <= r50 <= r35, f"HR Bradycardia Monotonicity violated: {r70} <= {r50} <= {r35}"

    # 3. Monotonicity in SpO2 (hypoxia)
    s_spo2_98 = PhysiologicalSnapshot(heart_rate=70.0, systolic_bp=118.0, body_temp=36.8, spo2=98.0, respiration_rate=14.0, glucose=90.0, sleep_hours=7.5, p_deviation=0.05)
    s_spo2_92 = PhysiologicalSnapshot(heart_rate=70.0, systolic_bp=118.0, body_temp=36.8, spo2=92.0, respiration_rate=14.0, glucose=90.0, sleep_hours=7.5, p_deviation=0.05)
    s_spo2_85 = PhysiologicalSnapshot(heart_rate=70.0, systolic_bp=118.0, body_temp=36.8, spo2=85.0, respiration_rate=14.0, glucose=90.0, sleep_hours=7.5, p_deviation=0.05)

    r_sp98 = model.predict_risk(s_spo2_98)
    r_sp92 = model.predict_risk(s_spo2_92)
    r_sp85 = model.predict_risk(s_spo2_85)
    assert r_sp98 <= r_sp92 <= r_sp85, f"SpO2 Monotonicity violated: {r_sp98} <= {r_sp92} <= {r_sp85}"


def test_f043_scripted_20_cases():
    """Verifies all 20 scripted test cases produce bounded, non-saturating risk scores (Defect N13)."""
    model = F043RiskScoreModel(random_state=42)
    model.fit_synthetic_cohort()

    assert len(SCRIPTED_20_TEST_CASES) == 20
    risks = []
    for i, case in enumerate(SCRIPTED_20_TEST_CASES):
        risk = model.predict_risk(case)
        assert 0.0 <= risk <= 1.0, f"Case {i+1} risk {risk} not in [0, 1]"
        risks.append(risk)

    # Case 1 (healthy resting) must have low risk (< 0.20)
    assert risks[0] < 0.20, f"Baseline healthy risk unexpectedly high: {risks[0]}"
    # Case 2 (mild workload) must NOT saturate (Defect N13: was 0.98, must be <= 0.35)
    assert risks[1] <= 0.35, f"Case 2 saturated early: {risks[1]}"
    # Case 14 (severe bradycardia HR 38) must produce high risk (> 0.60, was 0.03)
    assert risks[13] > 0.60, f"Severe bradycardia risk unexpectedly low: {risks[13]}"
    # Case 20 (catastrophic multi-organ failure) must have high risk (> 0.90)
    assert risks[19] > 0.90, f"Catastrophic crisis risk unexpectedly low: {risks[19]}"
    # Overall trend: crisis case > healthy baseline
    assert risks[19] > risks[0]


def test_f043_calibration_plot_generation():
    """Verifies F043 calibration reliability curve plot generation."""
    model = F043RiskScoreModel(random_state=42)
    model.fit_synthetic_cohort()

    with tempfile.TemporaryDirectory() as tmpdir:
        out_path = generate_f043_calibration_plot(model, run_id="TEST-RUN-F043", output_dir=Path(tmpdir))
        assert out_path.exists()
        assert out_path.stat().st_size > 1000
