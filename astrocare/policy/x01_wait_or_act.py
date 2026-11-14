"""AstroCare X01: Wait-or-Act Decision Engine Under Communication Latency.

Evaluates clinical incidents against interplanetary speed-of-light delay (F070)
and Bayesian predictive trajectory forecasts (X02).

Decision Choices:
1. WAIT: Defer action to Earth flight surgeon advice.
2. ACT_SAFELY_AND_CONSULT: Execute non-invasive countermeasure and queue store-and-forward consult.
3. ACT_NOW: Immediate urgent onboard medical intervention.

Cost Table & Assumptions:
- Missed deterioration (c_missed): 100.0 (critical decompensation without intervention)
- Unnecessary action (c_false_action): 25.0 (side effects / operational cost on false alarms)
- Safe countermeasure (c_safe_action): 5.0 (posture change, fluid loading, shelter)
- Time-to-treatment penalty (c_delay_per_min): 1.0 per minute of treatment delay
- Consult package overhead (c_consult): 2.0

Benchmarked on 1,000 reproducible incidents across [0, 2, 10, 20, 44] min delays
against ALWAYS_WAIT and ALWAYS_ACT baselines.

Decision-support prototype on synthetic and public data.
"""
from dataclasses import asdict, dataclass
from enum import Enum
import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import numpy as np

from astrocare.models.registry import TimeToCritical, X02BaselineOutput
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
    c_delay_per_min: float = 1.0
    c_consult_overhead: float = 2.0


@dataclass
class SimulatedIncident:
    incident_id: str
    crew_id: str
    metric: str
    true_will_deteriorate: bool
    true_time_to_critical_min: Optional[float]
    forecast_p_dev: float
    forecast_t_crit_p50: Optional[float]
    comms_round_trip_min: float
    is_mock: bool = False


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
        p_act_threshold: float = 0.65,
        p_consult_threshold: float = 0.20,
    ):
        self.costs = cost_table or PolicyCostTable()
        self.p_act_threshold = p_act_threshold
        self.p_consult_threshold = p_consult_threshold

    def tune_thresholds_on_validation(
        self,
        val_incidents: List[SimulatedIncident],
    ) -> Tuple[float, float]:
        """Tuning policy thresholds strictly on validation incidents."""
        best_cost = float("inf")
        best_p_act = self.p_act_threshold
        best_p_consult = self.p_consult_threshold

        # Grid search over candidate threshold pairs
        for p_c in np.linspace(0.10, 0.40, 7):
            for p_a in np.linspace(p_c + 0.15, 0.85, 8):
                total_loss = 0.0
                for inc in val_incidents:
                    action = self._decide_raw(inc.forecast_p_dev, inc.forecast_t_crit_p50, inc.comms_round_trip_min, p_a, p_c)
                    loss = self.calculate_incident_cost(inc, action)
                    total_loss += loss
                if total_loss < best_cost:
                    best_cost = total_loss
                    best_p_act = float(p_a)
                    best_p_consult = float(p_c)

        self.p_act_threshold = round(best_p_act, 3)
        self.p_consult_threshold = round(best_p_consult, 3)
        return self.p_act_threshold, self.p_consult_threshold

    def _decide_raw(
        self,
        p_dev: float,
        t_crit: Optional[float],
        delay_min: float,
        p_act: float,
        p_consult: float,
    ) -> DecisionAction:
        """Internal core decision function."""
        # 1. Zero latency (ISS mode): Earth is immediately available
        if delay_min <= 0.05:
            # If critical crossing is imminent in < 2 min, act now; else consult flight surgeon
            if t_crit is not None and t_crit <= 2.0 and p_dev >= p_act:
                return DecisionAction.ACT_NOW
            return DecisionAction.WAIT

        # 2. Delay is present: compare projected crossing time against round-trip latency
        time_deficit = False
        if t_crit is not None and t_crit <= delay_min:
            time_deficit = True

        # If deterioration is expected BEFORE ground response can return: ACT NOW
        if (p_dev >= p_act) or (time_deficit and p_dev >= p_consult):
            return DecisionAction.ACT_NOW

        # Intermediate risk or moderate delay: ACT SAFELY AND CONSULT
        if p_dev >= p_consult:
            return DecisionAction.ACT_SAFELY_AND_CONSULT

        # Low risk: WAIT for ground response
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
            p_act=self.p_act_threshold,
            p_consult=self.p_consult_threshold,
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
                # Missed deterioration cost + delay waiting for ground
                return self.costs.c_missed_deterioration + (self.costs.c_delay_per_min * delay)
            else:
                # Benign situation: safe wait, zero cost
                return 0.0

        elif action == DecisionAction.ACT_SAFELY_AND_CONSULT:
            base = self.costs.c_safe_action + self.costs.c_consult_overhead
            if deteriorates:
                # Safe action mitigated acute crash, treatment started at t=0
                return base
            else:
                # Safe action applied unnecessarily (low benign cost)
                return base

        elif action == DecisionAction.ACT_NOW:
            if deteriorates:
                # High consequence action was necessary, treatment latency = 0 min
                return 0.0
            else:
                # Unnecessary invasive action on non-deteriorating patient
                return self.costs.c_false_action

        return 0.0


def generate_mock_forecast(p_dev: float = 0.72, t_crit_p50: float = 14.5) -> X02BaselineOutput:
    """Mock X02 forecast for decoupled policy testing. Labeled as mock data."""
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


def simulate_incidents_cohort(
    n_incidents: int = 1000,
    seed: int = 42,
    delay_min: float = 10.0,
) -> List[SimulatedIncident]:
    """Generates 1,000 reproducible clinical incidents under specified delay."""
    rng = np.random.RandomState(seed)
    incidents: List[SimulatedIncident] = []

    crew_ids = ["ASTRO-01", "ASTRO-02", "ASTRO-03", "ASTRO-04"]
    metrics = ["heart_rate", "glucose", "systolic_bp", "spo2", "cabin_co2"]

    for i in range(n_incidents):
        # 30% of incidents are true deteriorations; 70% are benign/transient fluctuations
        true_deteriorate = bool(rng.rand() < 0.30)
        cid = crew_ids[i % len(crew_ids)]
        met = metrics[i % len(metrics)]

        if true_deteriorate:
            # High p_dev with noise, critical time within 5 to 40 min
            p_dev = float(np.clip(rng.beta(6, 2), 0.40, 0.99))
            t_crit = float(rng.uniform(6.0, 35.0))
        else:
            # Low to moderate p_dev, no critical crossing or distant crossing
            p_dev = float(np.clip(rng.beta(1.5, 5), 0.01, 0.55))
            t_crit = float(rng.uniform(60.0, 180.0)) if rng.rand() < 0.25 else None

        incidents.append(
            SimulatedIncident(
                incident_id=f"INC-{seed}-{i:04d}",
                crew_id=cid,
                metric=met,
                true_will_deteriorate=true_deteriorate,
                true_time_to_critical_min=t_crit if true_deteriorate else None,
                forecast_p_dev=round(p_dev, 3),
                forecast_t_crit_p50=round(t_crit, 1) if t_crit else None,
                comms_round_trip_min=delay_min,
                is_mock=False,
            )
        )
    return incidents


def evaluate_policy_across_delays(
    delays: List[float] = [0.0, 2.0, 10.0, 20.0, 44.0],
    n_incidents: int = 1000,
    seed: int = 42,
) -> Dict[str, List[PolicyEvaluationResult]]:
    """Evaluates X01 against ALWAYS_WAIT and ALWAYS_ACT on 1,000 reproducible incidents per delay."""
    # Split train/val for threshold tuning
    val_incidents = simulate_incidents_cohort(n_incidents=300, seed=seed + 999, delay_min=10.0)
    engine = WaitOrActDecisionEngine()
    engine.tune_thresholds_on_validation(val_incidents)

    all_results: Dict[str, List[PolicyEvaluationResult]] = {
        "X01_OPTIMAL": [],
        "ALWAYS_WAIT": [],
        "ALWAYS_ACT": [],
    }

    for delay in delays:
        test_incidents = simulate_incidents_cohort(n_incidents=n_incidents, seed=seed, delay_min=delay)

        for pol_name in ["X01_OPTIMAL", "ALWAYS_WAIT", "ALWAYS_ACT"]:
            missed_det = 0
            unnecessary_act = 0
            safe_consult = 0
            treatment_latencies: List[float] = []
            costs: List[float] = []

            for inc in test_incidents:
                if pol_name == "ALWAYS_WAIT":
                    action = DecisionAction.WAIT
                elif pol_name == "ALWAYS_ACT":
                    action = DecisionAction.ACT_NOW
                else:
                    action = engine._decide_raw(
                        inc.forecast_p_dev,
                        inc.forecast_t_crit_p50,
                        delay,
                        engine.p_act_threshold,
                        engine.p_consult_threshold,
                    )

                # Track metrics
                if action == DecisionAction.WAIT and inc.true_will_deteriorate:
                    missed_det += 1
                if action == DecisionAction.ACT_NOW and not inc.true_will_deteriorate:
                    unnecessary_act += 1
                if action == DecisionAction.ACT_SAFELY_AND_CONSULT:
                    safe_consult += 1

                # Time to treatment
                if action in [DecisionAction.ACT_NOW, DecisionAction.ACT_SAFELY_AND_CONSULT]:
                    treatment_latencies.append(0.0)
                else:
                    # Waiting for ground reply takes full round-trip delay
                    treatment_latencies.append(delay)

                loss = engine.calculate_incident_cost(inc, action)
                costs.append(loss)

            mean_latency = float(np.mean(treatment_latencies))
            mean_cost = float(np.mean(costs))
            total_cost = float(np.sum(costs))

            all_results[pol_name].append(
                PolicyEvaluationResult(
                    policy_name=pol_name,
                    delay_minutes=delay,
                    total_incidents=n_incidents,
                    missed_deteriorations=missed_det,
                    unnecessary_actions=unnecessary_act,
                    safe_consult_actions=safe_consult,
                    mean_time_to_treatment_min=round(mean_latency, 2),
                    mean_cost_per_incident=round(mean_cost, 2),
                    total_cost=round(total_cost, 2),
                )
            )

    return all_results
