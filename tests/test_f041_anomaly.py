"""Tests for AstroCare F041 & N15 Anomaly Detection Ensemble (Audited)."""
import numpy as np
import pytest

from astrocare.config import METRIC_REGISTRY
from astrocare.models.f041_anomaly import (
    APPROVED_BODY_REGIONS,
    NASA_HAZARDS,
    AnomalyAlert,
    F041FixedThresholdDetector,
    F041IsolationForestDetector,
    F041RobustZDetector,
    create_anomaly_alert,
    evaluate_detector_predictions,
)


def test_f041_detector_symmetry_and_calibration():
    """Verifies that all three detectors accept 1D sequences and calibrate to target FPR."""
    target_fpr = 0.05
    rng = np.random.RandomState(42)

    # 1. Independent nominal training stream
    train_hr = list(rng.normal(70.0, 3.0, size=200))

    # 2. Independent nominal validation stream (separate from train)
    val_hr = list(rng.normal(70.0, 3.0, size=200))

    # 3. Test stream: 150 nominal + 50 elevated tachycardia (115 bpm)
    test_hr = list(rng.normal(70.0, 3.0, size=150)) + list(rng.normal(115.0, 5.0, size=50))
    y_true = [0] * 150 + [1] * 50

    # Fit & Calibrate Isolation Forest
    if_det = F041IsolationForestDetector(metric_name="heart_rate", random_state=1337)
    if_det.fit(train_hr)
    if_thresh = if_det.calibrate_threshold(val_hr, target_fpr=target_fpr)
    assert if_thresh is not None

    # Calibrate Robust-Z
    rob_det = F041RobustZDetector(metric_name="heart_rate", window_size=30)
    rob_thresh = rob_det.calibrate_threshold(val_hr, target_fpr=target_fpr)
    assert rob_thresh is not None

    # Calibrate Fixed Threshold
    fix_det = F041FixedThresholdDetector(metric_name="heart_rate")
    fix_thresh = fix_det.calibrate_threshold(val_hr, target_fpr=target_fpr)
    assert fix_thresh is not None

    # Symmetrical 1D test scoring
    if_alerts, if_scores = if_det.score_sequence(test_hr)
    rob_alerts, rob_scores = rob_det.score_sequence(test_hr)
    fix_alerts, fix_scores = fix_det.score_sequence(test_hr)

    assert len(if_alerts) == len(test_hr)
    assert len(rob_alerts) == len(test_hr)
    assert len(fix_alerts) == len(test_hr)

    # Evaluate metrics
    if_metrics = evaluate_detector_predictions(np.array(y_true), if_scores, if_alerts, target_fpr=target_fpr)
    rob_metrics = evaluate_detector_predictions(np.array(y_true), rob_scores, rob_alerts, target_fpr=target_fpr)
    fix_metrics = evaluate_detector_predictions(np.array(y_true), fix_scores, fix_alerts, target_fpr=target_fpr)

    # Isolation Forest and Fixed Threshold maintain high recall across the whole sustained duration
    assert if_metrics["recall"] > 0.8
    assert fix_metrics["recall"] > 0.8

    # Robust-Z alerts immediately at onset (100% of first 15 steps), then window adapts (known rolling-baseline limitation)
    assert np.all(rob_alerts[150:165] == 1), "Robust-Z must alert immediately on all onset steps"
    assert rob_metrics["recall"] >= 0.30

    assert if_metrics["target_validation_fpr"] == target_fpr
    assert rob_metrics["target_validation_fpr"] == target_fpr
    assert fix_metrics["target_validation_fpr"] == target_fpr


def test_f041_missing_values_handling():
    """Verifies that sensor dropouts (None/NaN) do not trigger false positive anomaly alerts."""
    if_det = F041IsolationForestDetector(metric_name="heart_rate", random_state=42)
    if_det.fit([70.0, 72.0, 71.0, 69.0, 70.5])
    if_det.calibrate_threshold([70.0, 72.0, 71.0], target_fpr=0.05)

    rob_det = F041RobustZDetector(metric_name="heart_rate")
    rob_det.calibrate_threshold([70.0, 72.0, 71.0], target_fpr=0.05)

    fix_det = F041FixedThresholdDetector(metric_name="heart_rate")
    fix_det.calibrate_threshold([70.0, 72.0, 71.0], target_fpr=0.05)

    # Missing value single score
    assert if_det.score_single(None)[0] == 0
    assert rob_det.score_single(None)[0] == 0
    assert fix_det.score_single(None)[0] == 0

    # Sequence with intermittent missing values
    values_with_nones = [70.0, None, 71.0, None, None, 72.0]
    if_alerts, _ = if_det.score_sequence(values_with_nones)
    rob_alerts, _ = rob_det.score_sequence(values_with_nones)
    fix_alerts, _ = fix_det.score_sequence(values_with_nones)

    # None steps must not trigger anomaly
    assert if_alerts[1] == 0
    assert if_alerts[3] == 0
    assert rob_alerts[1] == 0
    assert fix_alerts[1] == 0


def test_f041_glucose_and_sleep_hours_support():
    """Verifies F041 evaluation on N14 metrics: glucose (mg/dL) and sleep_hours (hours)."""
    # 1. Glucose
    if_gluc = F041IsolationForestDetector(metric_name="glucose", random_state=42)
    if_gluc.fit([90.0, 95.0, 92.0, 88.0, 94.0])
    if_gluc.calibrate_threshold([91.0, 93.0, 89.0], target_fpr=0.05)

    # Nominal glucose reading
    a_nom, s_nom = if_gluc.score_single(92.0)
    assert a_nom == 0

    # Hypoglycemic anomaly reading (52 mg/dL)
    a_hypo, s_hypo = if_gluc.score_single(52.0)
    assert a_hypo == 1
    assert s_hypo > s_nom

    # 2. Sleep Hours
    rob_sleep = F041RobustZDetector(metric_name="sleep_hours", window_size=7)
    # 7 days of normal sleep (7.5 - 8.0h)
    for s in [7.5, 7.8, 8.0, 7.6, 7.7, 7.9, 7.5]:
        rob_sleep.score_single(s)

    # Acute insomnia / isolation deprivation (3.5 hours)
    a_insom, z_insom = rob_sleep.score_single(3.5)
    assert a_insom == 1
    assert z_insom > 2.5


def test_f041_alert_metadata_invariants():
    """Verifies AnomalyAlert populates non-null hazard_tag and approved body_region."""
    # Alert with explicit hazard
    alert1 = create_anomaly_alert(
        step_idx=42,
        ts="2026-11-14T08:42:00Z",
        crew_id="ASTRO-01",
        metric="heart_rate",
        detector="isolation_forest",
        raw_score=0.85,
        threshold=0.60,
        is_anomaly=1,
        hazard_tag="closed_environment",
    )
    assert alert1.is_anomaly == 1
    assert alert1.hazard_tag in NASA_HAZARDS
    assert alert1.body_region == "heart"
    assert alert1.body_region in APPROVED_BODY_REGIONS

    # Alert for glucose: body_region should automatically resolve to "gut"
    alert2 = create_anomaly_alert(
        step_idx=50,
        ts="2026-11-14T08:50:00Z",
        crew_id="ASTRO-03",
        metric="glucose",
        detector="robust_z",
        raw_score=3.2,
        threshold=2.5,
        is_anomaly=1,
        hazard_tag="radiation",
    )
    assert alert2.hazard_tag == "radiation"
    assert alert2.body_region == "gut"

    # Alert for sleep_hours: body_region should automatically resolve to "brain"
    alert3 = create_anomaly_alert(
        step_idx=60,
        ts="2026-11-14T07:00:00Z",
        crew_id="ASTRO-04",
        metric="sleep_hours",
        detector="fixed_threshold",
        raw_score=2.8,
        threshold=1.5,
        is_anomaly=1,
        hazard_tag="isolation",
    )
    assert alert3.hazard_tag == "isolation"
    assert alert3.body_region == "brain"

    # Non-anomalous reading: hazard_tag should be None
    alert_nom = create_anomaly_alert(
        step_idx=10,
        ts="2026-11-14T08:10:00Z",
        crew_id="ASTRO-01",
        metric="heart_rate",
        detector="isolation_forest",
        raw_score=0.10,
        threshold=0.60,
        is_anomaly=0,
    )
    assert alert_nom.is_anomaly == 0
    assert alert_nom.hazard_tag is None


def test_f041_isolation_forest_not_fitted_error():
    """Verifies Defect 45: NotFittedError raised if IF scored before fitting."""
    from sklearn.exceptions import NotFittedError
    det = F041IsolationForestDetector(metric_name="heart_rate")
    with pytest.raises(NotFittedError):
        det.score_single(75.0)


def test_f041_robust_z_reset_prevents_leakage():
    """Verifies Defect 37: reset() clears rolling buffer between folds."""
    det = F041RobustZDetector(metric_name="heart_rate", window_size=10)
    for _ in range(10):
        det.score_single(150.0)  # hazard state
    assert len(det.baseline.window) == 10
    det.reset()
    assert len(det.baseline.window) == 0


def test_f041_ensemble_detector():
    """Verifies Defect 40: F041EnsembleDetector combines IF and Robust-Z."""
    from astrocare.models.f041_anomaly import F041EnsembleDetector
    ens = F041EnsembleDetector(metric_name="heart_rate", random_state=42)
    train_vals = [70.0, 71.0, 69.5, 72.0, 70.5] * 20
    ens.fit(train_vals)
    ens.calibrate_threshold(train_vals[:30], target_fpr=0.05)
    
    # Nominal score
    a_nom, s_nom = ens.score_single(70.0)
    assert a_nom == 0
    
    # Severe anomaly (140 bpm tachycardia)
    a_anom, s_anom = ens.score_single(140.0)
    assert a_anom == 1
    assert s_anom > s_nom
