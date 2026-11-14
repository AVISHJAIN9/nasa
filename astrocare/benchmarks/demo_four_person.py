"""AstroCare Four-Person Live Demonstration Script.

Demonstrates X02 Bayesian Baseline on a crew of four:
- ASTRO-01: Nominal with injected hypercapnic/tachycardia deviation at step 40
- ASTRO-02: Normal diurnal variation with continuous telemetry
- ASTRO-03: Sparse and missing readings (causally handled without data fabrication)
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
    prior_data = {
        "ASTRO-01": [64.0, 66.0, 65.0, 63.0],
        "ASTRO-02": [58.0, 59.0, 57.0, 60.0],
        "ASTRO-03": [72.0, 71.0, 73.0, 70.0],
        "ASTRO-04": [61.0, 62.0, 60.0, 61.5],
    }
    crew_prior_hr = fit_crew_prior(prior_data, "heart_rate")
    crew_prior_gluc = fit_crew_prior(
        {"ASTRO-01": [92.0], "ASTRO-02": [88.0], "ASTRO-03": [98.0], "ASTRO-04": [90.0]},
        "glucose",
    )

    # 2. Instantiate personal filters for all 4 crew members
    filters: Dict[str, Dict[str, X02AstronautMetricFilter]] = {}
    for cid in ["ASTRO-01", "ASTRO-02", "ASTRO-03", "ASTRO-04"]:
        filters[cid] = {
            "heart_rate": X02AstronautMetricFilter(cid, "heart_rate", crew_prior_hr),
            "glucose": X02AstronautMetricFilter(cid, "glucose", crew_prior_gluc),
        }

    demo_stream_logs: List[Dict[str, Any]] = []
    invariants_passed = True

    # 3. Stream steps
    for step in range(total_steps):
        # Inject deviation into ASTRO-01 starting at step 35
        is_hazard = (step >= 35)
        step_records = sim.generate_step(
            step_idx=step,
            step_seconds=60.0,
            scenario_name="cabin_co2_leak" if is_hazard else "nominal",
            hazard_active=is_hazard,
        )

        for rec in step_records:
            cid = rec.crew_id
            met = rec.metric

            if met not in ["heart_rate", "glucose"]:
                continue

            # Model ASTRO-03 missingness (50% missing readings)
            val = rec.value
            if cid == "ASTRO-03" and step % 2 == 1:
                val = None  # Intermittent sensor drop

            # Model ASTRO-04 as data-thin (only measures once every 10 steps)
            if cid == "ASTRO-04" and step % 10 != 0:
                val = None  # Data-thin, remains shrunk to crew prior

            # Update X02 filter causally
            flt = filters[cid][met]
            x02_out: X02BaselineOutput = flt.step(val, rec.ts)

            # Strict Invariant Verification: lo90 <= mean <= hi90
            if not (x02_out.lo90 <= x02_out.mean <= x02_out.hi90):
                invariants_passed = False

            if step % 15 == 0 or (cid == "ASTRO-01" and step in [34, 35, 40, 50]):
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

    return {
        "status": "PASSED" if invariants_passed else "FAILED",
        "invariants_passed": invariants_passed,
        "crew_prior_hr": asdict(crew_prior_hr),
        "total_steps": total_steps,
        "sample_logs": demo_stream_logs,
    }


if __name__ == "__main__":
    res = run_four_person_demo()
    print("Four person demonstration status:", res["status"])
    print(f"Sample logs recorded: {len(res['sample_logs'])}")
