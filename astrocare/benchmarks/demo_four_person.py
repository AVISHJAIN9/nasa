"""AstroCare Four-Person Live Demonstration Script.

Demonstrates X02 Bayesian Baseline on a crew of four:
- ASTRO-01: Nominal baseline across all metrics
- ASTRO-02: Tachycardia (acute elevation in heart rate at step 30)
- ASTRO-03: Hypoglycemia (acute reduction in glucose at step 30)
- ASTRO-04: Data-thin astronaut (sparse updates) demonstrating shrinkage toward crew prior

Decision-support prototype on synthetic and public data.
Synthetic proxy demonstration; NOT clinical validation.
"""
from dataclasses import asdict
import json
from pathlib import Path
from typing import Any, Dict, List
import numpy as np

from astrocare.models.registry import X02BaselineOutput
from astrocare.models.x02_bayesian import CrewPrior, X02AstronautMetricFilter, fit_crew_prior
from astrocare.simulator.engine import VitalsSimulator


def run_four_person_demo(total_steps: int = 60, seed: int = 42) -> Dict[str, Any]:
    """Runs a live 4-person causal telemetry stream and filter demonstration."""
    sim = VitalsSimulator(seed=seed)

    # 1. Estimate Crew Prior using nominal reference data
    prior_data_hr = {
        "ASTRO-01": [64.0, 66.0, 65.0, 63.0],
        "ASTRO-02": [58.0, 59.0, 57.0, 60.0],
        "ASTRO-03": [72.0, 71.0, 73.0, 70.0],
        "ASTRO-04": [61.0, 62.0, 60.0, 61.5],
    }
    crew_prior_hr = fit_crew_prior(prior_data_hr, "heart_rate")
    crew_prior_gluc = fit_crew_prior(
        {"ASTRO-01": [92.0], "ASTRO-02": [88.0], "ASTRO-03": [98.0], "ASTRO-04": [90.0]},
        "glucose",
    )
    crew_prior_sleep = fit_crew_prior(
        {"ASTRO-01": [7.5], "ASTRO-02": [8.0], "ASTRO-03": [7.2], "ASTRO-04": [7.6]},
        "sleep_hours",
    )

    # 2. Instantiate personal filters for all 4 crew members
    filters: Dict[str, Dict[str, X02AstronautMetricFilter]] = {}
    for cid in ["ASTRO-01", "ASTRO-02", "ASTRO-03", "ASTRO-04"]:
        filters[cid] = {
            "heart_rate": X02AstronautMetricFilter(cid, "heart_rate", crew_prior_hr),
            "glucose": X02AstronautMetricFilter(cid, "glucose", crew_prior_gluc),
            "sleep_hours": X02AstronautMetricFilter(cid, "sleep_hours", crew_prior_sleep),
        }

    demo_stream_logs: List[Dict[str, Any]] = []
    invariants_passed = True
    astro02_tachycardia_detected = False
    astro03_hypoglycemia_detected = False

    # 3. Stream steps
    for step in range(total_steps):
        # Generate nominal step stream
        step_records = sim.generate_step(
            step_idx=step,
            step_seconds=60.0,
            scenario_name="nominal",
            hazard_active=False,
        )

        for rec in step_records:
            cid = rec.crew_id
            met = rec.metric

            if met not in ["heart_rate", "glucose", "sleep_hours"]:
                continue

            val = rec.value

            # ASTRO-01: Nominal baseline across all metrics (retains raw val)

            # ASTRO-02: Tachycardia deviation starting at step 25
            if cid == "ASTRO-02" and met == "heart_rate" and step >= 25 and val is not None:
                val = val + 45.0  # acute elevation to ~110-125 bpm

            # ASTRO-03: Hypoglycemia deviation starting at step 20
            if cid == "ASTRO-03" and met == "glucose" and step >= 20:
                val = 52.0  # acute drop below nominal and near critical low (54 mg/dL)

            # ASTRO-04: Data-thin astronaut (sparse updates; drops readings except steps 0 and 30)
            if cid == "ASTRO-04" and step not in [0, 30]:
                val = None  # Demonstrates shrinkage toward crew prior

            # Update X02 filter causally
            flt = filters[cid][met]
            x02_out: X02BaselineOutput = flt.step(val, rec.ts)

            # Strict Invariant 1: lo90 <= mean <= hi90
            if not (x02_out.lo90 <= x02_out.mean <= x02_out.hi90):
                invariants_passed = False

            # Strict Invariant 2: sleep_hours time_to_critical_min is strictly null
            if met == "sleep_hours":
                if not (x02_out.time_to_critical_min.p10 is None and
                        x02_out.time_to_critical_min.p50 is None and
                        x02_out.time_to_critical_min.p90 is None):
                    invariants_passed = False

            # Check deviation detection
            if cid == "ASTRO-02" and met == "heart_rate" and step >= 35:
                if x02_out.p_deviation > 0.7:
                    astro02_tachycardia_detected = True

            if cid == "ASTRO-03" and met == "glucose" and step >= 35:
                if x02_out.p_deviation > 0.7:
                    astro03_hypoglycemia_detected = True

            if step % 15 == 0 or (cid in ["ASTRO-02", "ASTRO-03"] and step in [29, 30, 35, 45]):
                demo_stream_logs.append({
                    "step": step,
                    "crew_id": cid,
                    "metric": met,
                    "observed_raw": val,
                    "x02_mean": x02_out.mean,
                    "x02_lo90": x02_out.lo90,
                    "x02_hi90": x02_out.hi90,
                    "p_deviation": x02_out.p_deviation,
                    "time_to_critical_min": x02_out.time_to_critical_min.model_dump(),
                    "obs_count": flt.observation_count,
                })

    # ASTRO-04 Shrinkage check: data-thin ASTRO-04 has wider predictive interval than ASTRO-01
    flt_a01_hr = filters["ASTRO-01"]["heart_rate"]
    flt_a04_hr = filters["ASTRO-04"]["heart_rate"]
    a04_span = flt_a04_hr.P[0, 0]
    a01_span = flt_a01_hr.P[0, 0]
    astro04_shrinkage_verified = bool(a04_span > a01_span)

    passed = (
        invariants_passed
        and astro02_tachycardia_detected
        and astro03_hypoglycemia_detected
        and astro04_shrinkage_verified
    )

    return {
        "status": "PASSED" if passed else "FAILED",
        "invariants_passed": invariants_passed,
        "astro02_tachycardia_detected": astro02_tachycardia_detected,
        "astro03_hypoglycemia_detected": astro03_hypoglycemia_detected,
        "astro04_shrinkage_verified": astro04_shrinkage_verified,
        "crew_prior_hr": asdict(crew_prior_hr),
        "total_steps": total_steps,
        "sample_logs": demo_stream_logs,
    }


if __name__ == "__main__":
    res = run_four_person_demo()
    print("Four person demonstration status:", res["status"])
    print(f"Invariants passed: {res['invariants_passed']}")
    print(f"ASTRO-02 Tachycardia detected: {res['astro02_tachycardia_detected']}")
    print(f"ASTRO-03 Hypoglycemia detected: {res['astro03_hypoglycemia_detected']}")
    print(f"ASTRO-04 Shrinkage verified: {res['astro04_shrinkage_verified']}")
    print(f"Sample logs recorded: {len(res['sample_logs'])}")
