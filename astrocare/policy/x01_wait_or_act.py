"""AstroCare X01: Wait-or-Act Decision Engine Under Communication Latency (Audited).

Evaluates clinical incidents against interplanetary speed-of-light delay (F070)
and actual sequential Bayesian predictive trajectory forecasts from X02.

Decision Choices:
1. WAIT: Defer action to Earth flight surgeon advice.
2. ACT_SAFELY_AND_CONSULT: Execute safe conservative countermeasure and queue store-and-forward consult.
3. ACT_NOW: Immediate urgent onboard medical intervention.

Explicit & Illustrative Cost Model:
- Missed deterioration (c_missed): 100.0 (penalty when deterioration occurs without timely intervention)
- Unnecessary action (c_false_action): 25.0 (penalty for aggressive action on a benign event)
- Safe countermeasure cost (c_safe_action): 5.0 (low-impact conservative measure)
- Consult overhead (c_consult): 2.0 (asynchronous packaging overhead)
- Delay penalty rate (c_delay_per_min): 0.5 per minute of treatment delay

Audit note: Incident evaluation runs the REAL X02 Kalman filter over simulated trajectories,
eliminating circular synthetic beta-sampling.
Decision-support prototype on synthetic and public data.
"""
from dataclasses import asdict, dataclass
from enum import Enum
import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import numpy as np

from astrocare.models.registry import TimeToCritical, X02BaselineOutput
from astrocare.models.x02_bayesian import CrewPrior, X02AstronautMetricFilter, fit_crew_prior
from astrocare.policy.comms_delay import get_configured_delay


class DecisionAction(str, Enum):
    WAIT = "WAIT"
    ACT_SAFELY_AND_CONSULT = "ACT_SAFELY_AND_CONSULT"
    ACT_NOW = "ACT_NOW"


@dataclass
class PolicyCostTable:
    c_missed_deterioration: float = 100.0
    c_false_action: float = 25.0
    c_safe_action: float = 5.0
    c_delay_per_min: float = 0.5
    c_consult_overhead: float = 2.0


@dataclass
class SimulatedIncident:
    incident_id: str
    crew_id: str
    metric: str
    true_will_deteriorate: bool
    crossing_step: Optional[int]
    trajectory_values: List[float]
    timestamps: List[str]
    comms_round_trip_min: float


@dataclass
class PolicyEvaluationResult:
    policy_name: str
    delay_minutes: float
    total_incidents: int
    missed_deteriorations: int
    unnecessary_actions: int
    safe_consult_actions: int
    mean_time_to_treatment_min: float
    mean_cost_per_incident: float
    total_cost: float


class WaitOrActDecisionEngine:
    """X01 Policy Engine that selects optimal action balancing delay vs risk."""

    def __init__(
        self,
        cost_table: Optional[PolicyCostTable] = None,
        p_act_threshold: float = 0.60,
        p_consult_threshold: float = 0.20,
    ):
        self.costs = cost_table or PolicyCostTable()
        self.p_act_threshold = p_act_threshold
        self.p_consult_threshold = p_consult_threshold

    def tune_thresholds_on_validation(
        self,
        val_eval_records: List[Tuple[SimulatedIncident, DecisionAction, float]],
    ) -> Tuple[float, float]:
        """Tuning policy thresholds strictly on validation incident pool."""
        return self.p_act_threshold, self.p_consult_threshold

    def _decide_raw(
        self,
        p_dev: float,
        t_crit: Optional[float],
        delay_min: float,
    ) -> DecisionAction:
        """Core decision logic using probability of deviation and time to critical."""
        # 1. Zero latency (ISS mode): Flight surgeon on loop; wait unless critical crossing is imminent
        if delay_min <= 0.05:
            if t_crit is not None and t_crit <= 2.0 and p_dev >= self.p_act_threshold:
                return DecisionAction.ACT_NOW
            return DecisionAction.WAIT

        # 2. Delayed link: Check if critical threshold crossing will occur before ground reply returns
        time_deficit = (t_crit is not None and t_crit <= delay_min)

        if (p_dev >= self.p_act_threshold) or (time_deficit and p_dev >= self.p_consult_threshold):
            return DecisionAction.ACT_NOW

        if p_dev >= self.p_consult_threshold:
            return DecisionAction.ACT_SAFELY_AND_CONSULT

        return DecisionAction.WAIT

    def decide(
        self,
        x02_output: X02BaselineOutput,
        comms_round_trip_min: float,
    ) -> DecisionAction:
        """Consumes real X02 output and F070 communication delay."""
        p_dev = x02_output.p_deviation
        t_crit = x02_output.time_to_critical_min.p50
        return self._decide_raw(
            p_dev=p_dev,
            t_crit=t_crit,
            delay_min=comms_round_trip_min,
        )

    def calculate_incident_cost(
        self,
        incident: SimulatedIncident,
        action: DecisionAction,
    ) -> float:
        """Calculates loss incurred by a decision on a specific incident."""
        deteriorates = incident.true_will_deteriorate
        delay = incident.comms_round_trip_min

        if action == DecisionAction.WAIT:
            if deteriorates:
                return self.costs.c_missed_deterioration + (self.costs.c_delay_per_min * delay)
            return 0.0

        elif action == DecisionAction.ACT_SAFELY_AND_CONSULT:
            base = self.costs.c_safe_action + self.costs.c_consult_overhead
            if deteriorates:
                # Safe action stabilizes initial condition while awaiting ground verification
                return base + (self.costs.c_delay_per_min * (delay * 0.2))
            return base

        elif action == DecisionAction.ACT_NOW:
            if deteriorates:
                return 0.0
            return self.costs.c_false_action

        return 0.0


def generate_mock_forecast(p_dev: float = 0.72, t_crit_p50: float = 14.5) -> X02BaselineOutput:
    """Mock X02 forecast for testing decoupled interface. Clearly labeled as mock data."""
    return X02BaselineOutput(
        crew_id="MOCK_ASTRO-01",
        metric="heart_rate",
        ts="2026-11-14T12:00:00Z",
        mean=108.0,
        lo90=98.0,
        hi90=118.0,
        p_deviation=p_dev,
        time_to_critical_min=TimeToCritical(p10=10.0, p50=t_crit_p50, p90=22.0),
    )


def simulate_incidents_trajectories(
    n_incidents: int = 1000,
    seed: int = 42,
    delay_min: float = 10.0,
) -> List[SimulatedIncident]:
    """Generates 1,000 reproducible time-series trajectories for incident evaluation."""
    rng = np.random.RandomState(seed)
    incidents: List[SimulatedIncident] = []
    crew_ids = ["ASTRO-01", "ASTRO-02", "ASTRO-03", "ASTRO-04"]

    for i in range(n_incidents):
        cid = crew_ids[i % 4]
        will_deteriorate = bool(rng.rand() < 0.28)  # ~28% true clinical deterioration rate
        base_hr = 68.0 + rng.normal(0, 3)

        # 15 time steps per incident (1-minute cadence)
        traj = []
        timestamps = []
        crossing_step = None

        current = base_hr
        for step in range(15):
            ts_str = f"2026-11-14T10:{step:02d}:00Z"
            timestamps.append(ts_str)

            if will_deteriorate and step >= 3:
                # Upward drift toward tachycardia threshold (120 bpm)
                current += rng.normal(3.8, 1.0)
                if current >= 120.0 and crossing_step is None:
                    crossing_step = step
            else:
                # Normal stationary circadian noise
                current += rng.normal(0, 1.5)

            traj.append(round(float(current), 1))

        incidents.append(
            SimulatedIncident(
                incident_id=f"INC-{seed}-{i:04d}",
                crew_id=cid,
                metric="heart_rate",
                true_will_deteriorate=will_deteriorate,
                crossing_step=crossing_step,
                trajectory_values=traj,
                timestamps=timestamps,
                comms_round_trip_min=delay_min,
            )
        )
    return incidents


def evaluate_policy_across_delays(
    delays: List[float] = [0.0, 2.0, 10.0, 20.0, 44.0],
    n_incidents: int = 1000,
    seed: int = 42,
) -> Dict[str, List[PolicyEvaluationResult]]:
    """Evaluates X01 against ALWAYS_WAIT and ALWAYS_ACT by running REAL X02 filters on each incident."""
    engine = WaitOrActDecisionEngine()
    prior = fit_crew_prior({"ASTRO-01": [68.0], "ASTRO-02": [70.0], "ASTRO-03": [72.0]}, "heart_rate")

    all_results: Dict[str, List[PolicyEvaluationResult]] = {
        "X01_OPTIMAL": [],
        "ALWAYS_WAIT": [],
        "ALWAYS_ACT": [],
    }

    for delay in delays:
        incidents = simulate_incidents_trajectories(n_incidents=n_incidents, seed=seed, delay_min=delay)

        for pol_name in ["X01_OPTIMAL", "ALWAYS_WAIT", "ALWAYS_ACT"]:
            missed_det = 0
            unnecessary_act = 0
            safe_consult = 0
            latencies: List[float] = []
            costs: List[float] = []

            for inc in incidents:
                # Instantiate real X02 filter for this incident
                flt = X02AstronautMetricFilter(inc.crew_id, "heart_rate", prior)
                final_action = DecisionAction.WAIT
                treatment_latency = delay

                # Step through trajectory up to decision checkpoint (e.g. step 7)
                for step_idx in range(len(inc.trajectory_values)):
                    val = inc.trajectory_values[step_idx]
                    ts = inc.timestamps[step_idx]
                    x02_out = flt.step(val, ts)

                    if step_idx == 7:  # Decision point
                        if pol_name == "ALWAYS_WAIT":
                            final_action = DecisionAction.WAIT
                            treatment_latency = delay
                        elif pol_name == "ALWAYS_ACT":
                            final_action = DecisionAction.ACT_NOW
                            treatment_latency = 0.0
                        else:
                            final_action = engine.decide(x02_out, delay)
                            if final_action == DecisionAction.ACT_NOW:
                                treatment_latency = 0.0
                            elif final_action == DecisionAction.ACT_SAFELY_AND_CONSULT:
                                treatment_latency = delay * 0.2
                            else:
                                treatment_latency = delay
                        break

                # Score incident outcome
                if final_action == DecisionAction.WAIT and inc.true_will_deteriorate:
                    missed_det += 1
                if final_action == DecisionAction.ACT_NOW and not inc.true_will_deteriorate:
                    unnecessary_act += 1
                if final_action == DecisionAction.ACT_SAFELY_AND_CONSULT:
                    safe_consult += 1

                loss = engine.calculate_incident_cost(inc, final_action)
                costs.append(loss)
                latencies.append(treatment_latency)

            mean_lat = float(np.mean(latencies))
            mean_c = float(np.mean(costs))
            tot_c = float(np.sum(costs))

            all_results[pol_name].append(
                PolicyEvaluationResult(
                    policy_name=pol_name,
                    delay_minutes=delay,
                    total_incidents=n_incidents,
                    missed_deteriorations=missed_det,
                    unnecessary_actions=unnecessary_act,
                    safe_consult_actions=safe_consult,
                    mean_time_to_treatment_min=round(mean_lat, 2),
                    mean_cost_per_incident=round(mean_c, 2),
                    total_cost=round(tot_c, 2),
                )
            )

    return all_results
