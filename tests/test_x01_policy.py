"""Tests for AstroCare X01 Wait-or-Act Decision Policy."""
import pytest
from astrocare.policy.comms_delay import MISSION_COMMS_PRESETS
from astrocare.policy.x01_wait_or_act import (
    DecisionAction,
    WaitOrActDecisionEngine,
    generate_mock_forecast,
    simulate_incidents_trajectories,
)


def test_zero_latency_decision():
    engine = WaitOrActDecisionEngine()
    fc = generate_mock_forecast(p_dev=0.90, t_crit_p50=15.0)
    action = engine.decide(fc, comms_round_trip_min=0.0)
    assert action == DecisionAction.WAIT


def test_high_latency_urgent_action():
    engine = WaitOrActDecisionEngine()
    fc = generate_mock_forecast(p_dev=0.90, t_crit_p50=15.0)
    action = engine.decide(fc, comms_round_trip_min=44.0)
    assert action == DecisionAction.ACT_NOW


def test_reproducible_incidents_trajectories():
    inc1 = simulate_incidents_trajectories(n_incidents=50, seed=123, delay_min=10.0)
    inc2 = simulate_incidents_trajectories(n_incidents=50, seed=123, delay_min=10.0)
    assert len(inc1) == len(inc2) == 50
    for a, b in zip(inc1, inc2):
        assert a.incident_id == b.incident_id
        assert a.true_will_deteriorate == b.true_will_deteriorate
        assert len(a.trajectory_values) == len(b.trajectory_values)
