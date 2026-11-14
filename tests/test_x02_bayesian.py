"""Tests for AstroCare X02 Bayesian Baseline and Schema Validation."""
import pytest
from astrocare.models.registry import TimeToCritical, X02BaselineOutput
from astrocare.models.x02_bayesian import X02AstronautMetricFilter, fit_crew_prior


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

    # After updating with an observation, sequential missing steps causally widen uncertainty
    out2 = flt.step(None, "2026-11-14T08:01:00Z")
    span2 = out2.hi90 - out2.lo90

    out3 = flt.step(None, "2026-11-14T08:02:00Z")
    span3 = out3.hi90 - out3.lo90
    assert span3 > span2 - 1e-4  # Covariance grows with process noise during dropouts
    assert out3.lo90 <= out3.mean <= out3.hi90
