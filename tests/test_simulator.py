"""Tests for AstroCare F011 Simulator and N14 Additions (Audited)."""
from datetime import datetime, timezone
import hashlib
from pathlib import Path
import tempfile
import numpy as np
import pytest

from astrocare.config import METRIC_REGISTRY
from astrocare.simulator.engine import VitalsSimulator, get_default_crew
from astrocare.simulator.hazards import SCENARIOS

NASA_HAZARDS = {"radiation", "isolation", "distance", "gravity", "closed_environment", None}
APPROVED_REGIONS = {"heart", "lungs", "brain", "bones_muscle", "eyes", "gut", "whole_body", "general"}


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


def test_simulator_byte_identical_jsonl():
    """Verifies that the same seed and configuration produce byte-identical JSONL files."""
    with tempfile.TemporaryDirectory() as tmpdir:
        p1 = Path(tmpdir) / "stream1.jsonl"
        p2 = Path(tmpdir) / "stream2.jsonl"

        sim1 = VitalsSimulator(seed=42)
        sim1.generate_jsonl(p1, total_steps=30, step_seconds=60.0)

        sim2 = VitalsSimulator(seed=42)
        sim2.generate_jsonl(p2, total_steps=30, step_seconds=60.0)

        h1 = hashlib.sha256(p1.read_bytes()).hexdigest()
        h2 = hashlib.sha256(p2.read_bytes()).hexdigest()
        assert h1 == h2, f"JSONL serialization is not byte-identical! {h1} != {h2}"


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


def test_metric_units_and_cadence():
    """Verifies glucose (mg/dL) cadence and sleep_hours (hours) units against registry."""
    sim = VitalsSimulator(seed=42)
    recs = list(sim.stream_records(total_steps=30, step_seconds=60.0))

    for r in recs:
        assert r.metric in METRIC_REGISTRY
        assert r.unit == METRIC_REGISTRY[r.metric].unit
        assert r.body_region in APPROVED_REGIONS
        assert r.hazard_tag in NASA_HAZARDS

    # Check glucose 5-min cadence: at 60s step_seconds, glucose should emit every 5 steps
    astro1_glucose = [r for r in recs if r.crew_id == "ASTRO-01" and r.metric == "glucose"]
    # In 30 steps (0 to 29): steps 0, 5, 10, 15, 20, 25 = 6 emissions
    assert len(astro1_glucose) == 6


def test_daily_sleep_output_documented_wake():
    """Verifies sleep_hours is emitted at documented wake time (07:00 UTC) and never at midnight."""
    # Run 1: starting at midnight (00:00:00 UTC)
    sim_midnight = VitalsSimulator(seed=42, base_time=datetime(2026, 11, 14, 0, 0, 0, tzinfo=timezone.utc))
    # Step 0 is at 00:00:00 UTC -> should NOT emit sleep_hours
    step0_recs = sim_midnight.generate_step(0, step_seconds=60.0)
    sleep_at_midnight = [r for r in step0_recs if r.metric == "sleep_hours"]
    assert len(sleep_at_midnight) == 0, "Sleep must not be emitted as an unexplained value at midnight!"

    # Step 420 is at 07:00:00 UTC (420 minutes = 7 hours) -> MUST emit daily sleep_hours
    step420_recs = sim_midnight.generate_step(420, step_seconds=60.0)
    sleep_at_wake = [r for r in step420_recs if r.metric == "sleep_hours"]
    assert len(sleep_at_wake) == 4, "Sleep must be emitted for all 4 crew members at documented 07:00 UTC wake time!"
    for s in sleep_at_wake:
        assert s.unit == "hours"
        if s.value is not None:
            assert 1.0 <= s.value <= 14.0
        assert s.body_region == "brain"

    # Step 421 (07:01:00 UTC) -> must NOT re-emit sleep
    step421_recs = sim_midnight.generate_step(421, step_seconds=60.0)
    assert len([r for r in step421_recs if r.metric == "sleep_hours"]) == 0


def test_step_seconds_bounds_enforced():
    """Verifies that simulator strictly enforces supported step_seconds bounds [0.1, 300.0]."""
    sim = VitalsSimulator(seed=42)

    # Below minimum supported step size (0.1s)
    with pytest.raises(ValueError, match="Unsupported step_seconds"):
        sim.generate_step(0, step_seconds=0.05)

    # Above maximum supported step size (300.0s)
    with pytest.raises(ValueError, match="Unsupported step_seconds"):
        sim.generate_step(0, step_seconds=301.0)

    with pytest.raises(ValueError, match="Unsupported step_seconds"):
        sim.generate_step(0, step_seconds=600.0)

    # Boundary valid values must succeed
    recs_min = sim.generate_step(0, step_seconds=0.1)
    assert len(recs_min) > 0
    recs_max = sim.generate_step(0, step_seconds=300.0)
    assert len(recs_max) > 0


def test_non_divisible_step_cadence():
    """Verifies that non-divisible step sizes (45s, 75s) correctly trigger 300s CGM cadence."""
    # Test 45-second steps across 700 seconds (16 steps: step 0 to step 15)
    sim_45 = VitalsSimulator(seed=42)
    recs_45 = list(sim_45.stream_records(total_steps=16, step_seconds=45.0))
    a1_g45 = [r for r in recs_45 if r.crew_id == "ASTRO-01" and r.metric == "glucose"]
    # Boundary crossings for 45s steps:
    # step 0 (t=0s), step 7 (t=315s, crosses 300s), step 14 (t=630s, crosses 600s) -> exactly 3 emissions
    assert len(a1_g45) == 3

    # Test 75-second steps across 650 seconds (9 steps: step 0 to step 8)
    sim_75 = VitalsSimulator(seed=42)
    recs_75 = list(sim_75.stream_records(total_steps=9, step_seconds=75.0))
    a1_g75 = [r for r in recs_75 if r.crew_id == "ASTRO-01" and r.metric == "glucose"]
    # Boundary crossings for 75s steps:
    # step 0 (t=0s), step 4 (t=300s, crosses 300s), step 8 (t=600s, crosses 600s) -> exactly 3 emissions
    assert len(a1_g75) == 3


def test_arbitrary_step_seconds_support():
    """Verifies glucose cadence and sleep output across arbitrary step_seconds (e.g. 300s, 1s)."""
    # 5-minute step_seconds (300s)
    sim_5min = VitalsSimulator(seed=42, base_time=datetime(2026, 11, 14, 7, 0, 0, tzinfo=timezone.utc))
    recs_5min = list(sim_5min.stream_records(total_steps=12, step_seconds=300.0))
    astro1_gluc_5min = [r for r in recs_5min if r.crew_id == "ASTRO-01" and r.metric == "glucose"]
    # Every 300s step should emit glucose
    assert len(astro1_gluc_5min) == 12

    # Sleep check-in emitted at step 0 (which is 07:00:00 UTC)
    astro1_sleep_5min = [r for r in recs_5min if r.crew_id == "ASTRO-01" and r.metric == "sleep_hours"]
    assert len(astro1_sleep_5min) == 1


def test_missing_values_and_tags():
    """Verifies metadata remains intact even when sensor values are missing."""
    sim = VitalsSimulator(seed=42)
    # Force high missingness
    hazard_high_miss = SCENARIOS["isolation_confinement"]
    recs = list(sim.stream_records(total_steps=30, scenario_name="isolation_confinement", hazard_start_step=0))

    missing_recs = [r for r in recs if r.value is None]
    assert len(missing_recs) > 0, "Missing values should occur under simulated sensor dropouts"
    for r in missing_recs:
        assert r.unit != ""
        assert r.metric in METRIC_REGISTRY
        assert r.body_region in APPROVED_REGIONS
        if r.synthetic_label == 1:
            assert r.hazard_tag == "isolation"


def test_hazard_tags_enum():
    """Verifies all hazard scenarios map strictly to the 5 official NASA hazards or None."""
    sim = VitalsSimulator(seed=42)
    for s_name in SCENARIOS.keys():
        recs = list(sim.stream_records(total_steps=10, scenario_name=s_name, hazard_start_step=0))
        for r in recs:
            assert r.hazard_tag in NASA_HAZARDS, f"Scenario {s_name} emitted invalid hazard tag {r.hazard_tag}"
            if s_name == "nominal":
                assert r.hazard_tag is None
            elif r.synthetic_label == 1:
                assert r.hazard_tag is not None


def test_no_mood_sensor_stream():
    """Verifies that ML1 does not invent a mood sensor telemetry stream."""
    sim = VitalsSimulator(seed=42)
    recs = list(sim.stream_records(total_steps=50))
    metrics = set(r.metric for r in recs)
    assert "mood" not in metrics, "Mood is a check-in / questionnaire scale, not a sensor stream!"


def test_hazard_injection():
    sim = VitalsSimulator(seed=42)
    recs_nom = list(sim.stream_records(total_steps=20, scenario_name="nominal"))
    recs_co2 = list(sim.stream_records(total_steps=20, scenario_name="cabin_co2_leak", hazard_start_step=0))

    hr_nom = [r.value for r in recs_nom if r.metric == "heart_rate" and r.value is not None]
    hr_co2 = [r.value for r in recs_co2 if r.metric == "heart_rate" and r.value is not None]

    # CO2 leak causes elevated heart rate
    assert np.mean(hr_co2) > np.mean(hr_nom)


def test_crew_of_six_initialization():
    """Verifies that get_default_crew supports expanded 6-person crew (ASTRO-01 to ASTRO-06)."""
    crew6 = get_default_crew(np.random.RandomState(42), crew_size=6)
    assert len(crew6) == 6
    expected_ids = [f"ASTRO-0{i}" for i in range(1, 7)]
    assert [c.crew_id for c in crew6] == expected_ids
    for c in crew6:
        assert 50.0 <= c.base_hr <= 85.0
        assert 70.0 <= c.base_glucose <= 110.0
        assert 6.0 <= c.base_sleep <= 9.0


def test_non_divisible_13s_step_cadence():
    """Verifies 13-second steps with one-sided lateness [0, step_seconds)."""
    # 13s steps across 650s (50 steps: step 0 to step 49)
    # CGM cadence is 300s:
    # step 0: t=0s -> emitted (0s)
    # step 23: t = 23 * 13s = 299s (not crossed 300s)
    # step 24: t = 24 * 13s = 312s -> crossed 300s, emitted (12s one-sided lateness < 13s)
    # step 46: t = 46 * 13s = 598s
    # step 47: t = 47 * 13s = 611s -> crossed 600s, emitted (11s one-sided lateness < 13s)
    sim_13 = VitalsSimulator(seed=42)
    recs_13 = list(sim_13.stream_records(total_steps=50, step_seconds=13.0))
    a1_g13 = [r for r in recs_13 if r.crew_id == "ASTRO-01" and r.metric == "glucose"]
    assert len(a1_g13) == 3, f"Expected 3 CGM emissions at 13s steps, got {len(a1_g13)}"


def test_f011_six_crew_one_hour_one_hz_load():
    """F011 Load Verification: 6-crew 1-hour 1Hz streaming simulation (3600 steps)."""
    sim_load = VitalsSimulator(seed=42, crew_size=6)
    # Stream 3600 steps at step_seconds=1.0 (1 Hz)
    step_count = 0
    record_count = 0
    for step_recs in sim_load.stream_records(total_steps=3600, step_seconds=1.0):
        record_count += 1
    # 3600 steps * 6 crew * 4 continuous metrics (HR, SpO2, Temp, Resp) + intermittent records
    assert record_count > 3600 * 6 * 4


def test_reused_instance_reproducibility():
    """Defect 1 verification: Reused simulator instance yields byte-identical output on repeated runs."""
    sim = VitalsSimulator(seed=42)
    run1 = [r.value for r in sim.stream_records(total_steps=50)]
    run2 = [r.value for r in sim.stream_records(total_steps=50)]
    assert run1 == run2, "Reused simulator instance must yield identical output across runs"


def test_astronaut_baselines_constant_across_seeds():
    """Defect 2 verification: Astronaut baseline is a fixed personal constant, not drawn from seeds."""
    sim_42 = VitalsSimulator(seed=42)
    sim_1337 = VitalsSimulator(seed=1337)
    astro1_42 = sim_42.crew[0]
    astro1_1337 = sim_1337.crew[0]
    assert astro1_42.base_hr == astro1_1337.base_hr == 64.0
    assert astro1_42.base_glucose == astro1_1337.base_glucose == 92.0


def test_pre_hazard_records_have_nominal_scenario():
    """Defect 5 verification: Pre-hazard records must carry scenario='nominal' to prevent leakage."""
    sim = VitalsSimulator(seed=42)
    records = list(sim.stream_records(total_steps=30, scenario_name="cabin_co2_leak", hazard_start_step=15))
    pre_hazard = [r for r in records if r.ts < records[15 * 4].ts or r.synthetic_label == 0]
    for r in pre_hazard[:60]:
        assert r.scenario == "nominal", "Pre-hazard records must not leak hazard scenario identity"


def test_unknown_scenario_raises_error():
    """Defect 6 verification: Unknown or misspelled scenario raises ValueError."""
    sim = VitalsSimulator(seed=42)
    with pytest.raises(ValueError, match="Unknown scenario"):
        list(sim.stream_records(total_steps=5, scenario_name="misspelled_hazard"))


def test_sleep_not_emitted_at_afternoon_start():
    """Defect 7 verification: Step 0 at 15:00 UTC must not emit morning wake sleep."""
    sim_afternoon = VitalsSimulator(seed=42, base_time=datetime(2026, 11, 14, 15, 0, 0, tzinfo=timezone.utc))
    step0_recs = sim_afternoon.generate_step(0)
    sleep_recs = [r for r in step0_recs if r.metric == "sleep_hours"]
    assert len(sleep_recs) == 0, "Sleep must not emit at step 0 when starting in the afternoon"

