"""Tests for AstroCare F011 Simulator and N14 Additions."""
import numpy as np
import pytest
from astrocare.simulator.engine import VitalsSimulator, get_default_crew
from astrocare.simulator.hazards import SCENARIOS


def test_crew_initialization():
    crew = get_default_crew(np.random.RandomState(42))
    assert len(crew) == 4
    for c in crew:
        assert c.crew_id.startswith("ASTRO-")
        assert 50.0 <= c.base_hr <= 85.0
        assert 70.0 <= c.base_glucose <= 110.0
        assert 6.0 <= c.base_sleep <= 9.0


def test_simulator_determinism():
    sim1 = VitalsSimulator(seed=123)
    recs1 = list(sim1.stream_records(total_steps=10))

    sim2 = VitalsSimulator(seed=123)
    recs2 = list(sim2.stream_records(total_steps=10))

    assert len(recs1) == len(recs2)
    for r1, r2 in zip(recs1, recs2):
        assert r1.metric == r2.metric
        assert r1.value == r2.value
        assert r1.ts == r2.ts


def test_n14_metrics_emitted():
    sim = VitalsSimulator(seed=42)
    recs = list(sim.stream_records(total_steps=65))
    metrics = set(r.metric for r in recs)

    assert "glucose" in metrics, "N14 glucose metric missing"
    assert "sleep_hours" in metrics, "N14 sleep_hours metric missing"

    glucose_vals = [r.value for r in recs if r.metric == "glucose" and r.value is not None]
    assert len(glucose_vals) > 0
    for g in glucose_vals:
        assert 50.0 <= g <= 200.0


def test_hazard_injection():
    sim = VitalsSimulator(seed=42)
    recs_nom = list(sim.stream_records(total_steps=20, scenario_name="nominal"))
    recs_co2 = list(sim.stream_records(total_steps=20, scenario_name="cabin_co2_leak", hazard_start_step=0))

    hr_nom = [r.value for r in recs_nom if r.metric == "heart_rate" and r.value is not None]
    hr_co2 = [r.value for r in recs_co2 if r.metric == "heart_rate" and r.value is not None]

    # CO2 leak causes elevated heart rate and respiratory rate
    assert np.mean(hr_co2) > np.mean(hr_nom)
