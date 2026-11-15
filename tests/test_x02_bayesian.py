"""Tests for AstroCare X02 Bayesian Baseline and Schema Validation (Audited)."""
import pytest
from astrocare.benchmarks.demo_four_person import run_four_person_demo
from astrocare.models.registry import TimeToCritical, X02BaselineOutput
from astrocare.models.x02_bayesian import (
    CrewPrior,
    X02AstronautMetricFilter,
    fit_crew_prior,
    SUPPORTED_METRICS,
)


def test_x02_schema_invariants():
    # Valid output
    valid = X02BaselineOutput(
        crew_id="ASTRO-01",
        metric="heart_rate",
        ts="2026-11-14T08:00:00Z",
        mean=72.0,
        lo90=65.0,
        hi90=79.0,
        p_deviation=0.01,
        time_to_critical_min=TimeToCritical(p10=10.0, p50=20.0, p90=30.0),
    )
    assert valid.lo90 <= valid.mean <= valid.hi90

    # Invariant violation: lo90 > mean
    with pytest.raises(ValueError):
        X02BaselineOutput(
            crew_id="ASTRO-01",
            metric="heart_rate",
            ts="2026-11-14T08:00:00Z",
            mean=70.0,
            lo90=75.0,
            hi90=80.0,
            p_deviation=0.01,
        )

    # Invariant violation: unordered time-to-critical quantiles
    with pytest.raises(ValueError):
        TimeToCritical(p10=30.0, p50=20.0, p90=10.0)


def test_x02_kalman_filter_causal():
    prior = fit_crew_prior({"ASTRO-02": [70.0, 72.0], "ASTRO-03": [68.0, 70.0]}, "heart_rate")
    flt = X02AstronautMetricFilter("ASTRO-01", "heart_rate", prior)

    # Normal step
    out1 = flt.step(71.0, "2026-11-14T08:00:00Z")
    assert out1.lo90 <= out1.mean <= out1.hi90
    assert 0.0 <= out1.p_deviation <= 1.0

    # Sequential missing steps causally widen uncertainty
    out2 = flt.step(None, "2026-11-14T08:01:00Z")
    span2 = out2.hi90 - out2.lo90

    out3 = flt.step(None, "2026-11-14T08:02:00Z")
    span3 = out3.hi90 - out3.lo90
    assert span3 > span2 - 1e-4  # Covariance grows with process noise during dropouts
    assert out3.lo90 <= out3.mean <= out3.hi90


def test_x02_timestamp_validation_and_out_of_order_rejection():
    """Verifies malformed or out-of-order timestamps are strictly rejected."""
    prior = fit_crew_prior({"ASTRO-02": [70.0]}, "heart_rate")
    flt = X02AstronautMetricFilter("ASTRO-01", "heart_rate", prior)

    # Step 1: Valid timestamp
    flt.step(70.0, "2026-11-14T08:00:00Z")

    # Step 2: Out of order timestamp (earlier than step 1) -> must raise ValueError
    with pytest.raises(ValueError, match="Out-of-order timestamp"):
        flt.step(71.0, "2026-11-14T07:59:00Z")

    # Step 3: Identical timestamp (not advanced) -> must raise ValueError
    with pytest.raises(ValueError, match="Out-of-order timestamp"):
        flt.step(71.0, "2026-11-14T08:00:00Z")

    # Step 4: Malformed timestamp -> must raise ValueError
    with pytest.raises(ValueError, match="Malformed ISO-8601"):
        flt.step(71.0, "invalid-timestamp")


def test_x02_sleep_hours_time_to_critical_is_null():
    """Verifies that daily sleep_hours returns null time_to_critical."""
    prior = fit_crew_prior({"ASTRO-02": [7.5], "ASTRO-03": [8.0]}, "sleep_hours")
    flt = X02AstronautMetricFilter("ASTRO-01", "sleep_hours", prior)

    out = flt.step(7.8, "2026-11-14T07:00:00Z")
    assert out.time_to_critical_min.p10 is None
    assert out.time_to_critical_min.p50 is None
    assert out.time_to_critical_min.p90 is None


def test_x02_supported_metrics_and_glucose():
    """Verifies glucose is fully supported and unsupported metrics are rejected."""
    assert "glucose" in SUPPORTED_METRICS
    assert "sleep_hours" in SUPPORTED_METRICS

    # Unsupported metric raises ValueError
    with pytest.raises(ValueError, match="is not supported"):
        X02AstronautMetricFilter(
            "ASTRO-01",
            "unsupported_metric_xyz",
            CrewPrior("unsupported_metric_xyz", 100.0, 10.0),
        )

    # Glucose filter
    prior = fit_crew_prior({"ASTRO-02": [90.0, 95.0]}, "glucose")
    flt = X02AstronautMetricFilter("ASTRO-01", "glucose", prior)
    out = flt.step(92.0, "2026-11-14T07:00:00Z")
    assert out.metric == "glucose"
    assert out.lo90 <= out.mean <= out.hi90


def test_x02_anomaly_does_not_hide_itself():
    """Verifies that a sustained anomaly does not immediately drag the baseline to hide itself."""
    prior = fit_crew_prior({"ASTRO-02": [70.0], "ASTRO-03": [72.0]}, "heart_rate")
    flt = X02AstronautMetricFilter("ASTRO-01", "heart_rate", prior)

    # Establish baseline on 10 nominal readings (71.0)
    for i in range(10):
        flt.step(71.0, f"2026-11-14T08:{i:02d}:00Z")

    baseline_before_shock = flt.personal_baseline_level
    assert 70.0 <= baseline_before_shock <= 72.0

    # Inject sustained acute tachycardia anomaly (HR = 135 bpm)
    outputs = []
    for i in range(10, 16):
        out = flt.step(135.0, f"2026-11-14T08:{i:02d}:00Z")
        outputs.append(out)

    # After initial observation is absorbed, subsequent predictions show sustained high p_deviation
    assert outputs[2].p_deviation > 0.7, "p_deviation must elevate as anomaly is absorbed"
    assert outputs[3].p_deviation > 0.9, "Sustained anomaly must trigger near 1.0 p_deviation"
    assert outputs[4].p_deviation > 0.95, "Sustained anomaly must continue alerting"

    # Crucial property: The sustained anomaly does NOT drag personal baseline to 135 bpm
    assert flt.personal_baseline_level < 75.0, f"Personal baseline leaked to {flt.personal_baseline_level}"


def test_x02_partial_pooling_shrinkage():
    """Demonstrates partial pooling shrinkage toward crew prior for data-thin astronaut."""
    crew_prior = CrewPrior(metric="glucose", mean=90.0, variance=16.0)

    # Astronaut A: data-thin (only 1 measurement of 115.0)
    flt_thin = X02AstronautMetricFilter("ASTRO-THIN", "glucose", crew_prior)
    out_thin = flt_thin.step(115.0, "2026-11-14T07:00:00Z")

    # Predictive mean before update was the crew prior (90.0)
    assert out_thin.mean == 90.0
    # After update, state is shrunk between 90 and 115
    assert 90.0 < flt_thin.x[0] < 115.0
    span_thin = out_thin.hi90 - out_thin.lo90

    # Astronaut B: data-rich (10 measurements of 115.0)
    flt_rich = X02AstronautMetricFilter("ASTRO-RICH", "glucose", crew_prior)
    for i in range(10):
        flt_rich.step(115.0, f"2026-11-14T07:{i*5:02d}:00Z")

    out_rich = flt_rich.step(115.0, "2026-11-14T07:50:00Z")
    # Data-rich astronaut has state close to 115.0 with tighter predictive span
    assert flt_rich.x[0] > 110.0
    span_rich = out_rich.hi90 - out_rich.lo90
    assert span_rich < span_thin, "Data-rich astronaut must have tighter predictive uncertainty than data-thin"


def test_four_person_demo_execution():
    """Verifies that the audited 4-person crew demonstration runs and satisfies all invariants."""
    res = run_four_person_demo(total_steps=45)
    assert res["status"] == "PASSED"
    assert res["invariants_passed"] is True
    assert res["astro02_tachycardia_detected"] is True
    assert res["astro03_hypoglycemia_detected"] is True
    assert res["astro04_shrinkage_verified"] is True
    assert len(res["sample_logs"]) > 0


def test_x02_sleep_hours_not_exploding():
    """Defect 13 verification: Daily sleep does not explode velocity covariance."""
    prior = fit_crew_prior({"ASTRO-02": [7.6, 7.8], "ASTRO-03": [7.5, 7.7]}, "sleep_hours")
    flt = X02AstronautMetricFilter("ASTRO-01", "sleep_hours", prior)

    # 10 daily sleep check-ins (1 reading per 24 hours)
    for day in range(10):
        out = flt.step(7.6, f"2026-11-{14+day:02d}T07:00:00Z")
        # 90% band must remain within reasonable bounds [4.0, 11.0] hours, not [-160, +175]!
        assert 4.0 <= out.lo90 <= 7.6
        assert 7.6 <= out.hi90 <= 11.0
        # p_deviation on normal sleep is well bounded (< 0.20 cold start, < 0.10 warmed up; previously exploded to 0.98)
        assert out.p_deviation < 0.20, f"p_deviation on normal sleep must be low, got {out.p_deviation}"
        if day >= 2:
            assert out.p_deviation < 0.10, f"warmed up sleep p_deviation must be < 0.10, got {out.p_deviation}"


def test_x02_already_critical_returns_zero_time_to_critical():
    """Defect 15 verification: Already-critical states return 0.0 time_to_critical, not null."""
    # 1. Glucose already hypoglycemic (44 mg/dL < 54 critical low)
    prior_gluc = fit_crew_prior({"ASTRO-02": [90.0]}, "glucose")
    flt_gluc = X02AstronautMetricFilter("ASTRO-01", "glucose", prior_gluc)
    flt_gluc.x[0] = 44.0  # Force critical state
    out_gluc = flt_gluc.step(44.0, "2026-11-14T07:00:00Z")
    assert out_gluc.time_to_critical_min.p50 == 0.0, "Already-critical glucose must return 0.0 min to critical"

    # 2. Heart rate already tachycardia (150 bpm > 130 critical high)
    prior_hr = fit_crew_prior({"ASTRO-02": [70.0]}, "heart_rate")
    flt_hr = X02AstronautMetricFilter("ASTRO-01", "heart_rate", prior_hr)
    flt_hr.x[0] = 150.0  # Force critical state
    out_hr = flt_hr.step(150.0, "2026-11-14T07:00:00Z")
    assert out_hr.time_to_critical_min.p50 == 0.0, "Already-critical HR must return 0.0 min to critical"
