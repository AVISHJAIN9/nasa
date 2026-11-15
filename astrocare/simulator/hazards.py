"""AstroCare Hazard Models and Scenario Injection Definitions.

Decision-support prototype on synthetic and public data.
Synthetic proxy labels; NOT clinical ground truth.

DISCLAIMER & SIMULATOR ASSUMPTIONS:
All delta parameters (hr_delta, glucose_delta, sleep_delta, etc.) are synthetic simulator
assumptions designed to stress-test anomaly detection and decision algorithms under controlled
conditions. They are NOT clinically validated medical effects and must not be interpreted as
clinical findings. NASA reference documentation describes operational contexts, not numeric
clinical dose-response coefficients.
"""
from dataclasses import dataclass
from typing import Dict, Optional


@dataclass(frozen=True)
class HazardProfile:
    name: str
    description: str
    # Official NASA Hazard Enum: radiation, isolation, distance, gravity, closed_environment (or None)
    hazard_tag: Optional[str] = None
    hr_delta: float = 0.0
    sbp_delta: float = 0.0
    dbp_delta: float = 0.0
    spo2_delta: float = 0.0
    temp_delta: float = 0.0
    resp_delta: float = 0.0
    hrv_delta: float = 0.0
    glucose_delta: float = 0.0
    sleep_delta: float = 0.0
    missingness_prob: float = 0.02


SCENARIOS: Dict[str, HazardProfile] = {
    "nominal": HazardProfile(
        name="nominal",
        description="Standard mission operations under nominal life-support conditions.",
        hazard_tag=None,
        missingness_prob=0.01,
    ),
    "isolation_confinement": HazardProfile(
        name="isolation_confinement",
        description="Prolonged deep-space confinement causing chronic sleep reduction and autonomic stress.",
        hazard_tag="isolation",
        hr_delta=4.0,
        sbp_delta=3.0,
        hrv_delta=-12.0,
        glucose_delta=8.0,
        sleep_delta=-2.2,  # Synthetic assumption: reduced sleep under confinement
        missingness_prob=0.03,
    ),
    "cabin_co2_leak": HazardProfile(
        name="cabin_co2_leak",
        description="Elevated ambient partial pressure of carbon dioxide (PCO2 > 4 mmHg) triggering tachypnea and vasodilation.",
        hazard_tag="closed_environment",
        hr_delta=14.0,
        sbp_delta=16.0,
        dbp_delta=8.0,
        spo2_delta=-2.5,
        resp_delta=7.0,
        hrv_delta=-15.0,
        glucose_delta=10.0,
        sleep_delta=-1.0,
        missingness_prob=0.02,
    ),
    "radiation_solar_event": HazardProfile(
        name="radiation_solar_event",
        description="Acute SPE solar particle storm shelter condition with elevated thermal/inflammatory response.",
        hazard_tag="radiation",
        hr_delta=10.0,
        temp_delta=0.45,
        resp_delta=3.0,
        hrv_delta=-18.0,
        glucose_delta=14.0,
        sleep_delta=-1.5,
        missingness_prob=0.05,
    ),
    "metabolic_hypoglycemia": HazardProfile(
        name="metabolic_hypoglycemia",
        description="Nutritional or metabolic drop causing acute symptomatic hypoglycemia (glucose < 60 mg/dL).",
        hazard_tag="closed_environment",  # Life-support nutrition/countermeasure disruption
        hr_delta=18.0,
        sbp_delta=8.0,
        hrv_delta=-20.0,
        glucose_delta=-48.0,  # Synthetic assumption: glucose drop below 60 mg/dL
        sleep_delta=-0.5,
        missingness_prob=0.02,
    ),
    "metabolic_hyperglycemia": HazardProfile(
        name="metabolic_hyperglycemia",
        description="Postprandial glycemic surge or countermeasure disruption exceeding 160 mg/dL.",
        hazard_tag="closed_environment",  # Life-support nutrition/countermeasure disruption in closed environment
        glucose_delta=82.0,  # Synthetic assumption: glucose surge exceeding 160 mg/dL for all crew members (ASTRO-02 steady state reaches 163.4 mg/dL > 160 mg/dL; ASTRO-01 reaches 174 mg/dL)
        missingness_prob=0.02,
    ),
    "microgravity_adaptation": HazardProfile(
        name="microgravity_adaptation",
        description="Early mission space adaptation syndrome with cephalad fluid shift and autonomic resetting.",
        hazard_tag="gravity",
        hr_delta=6.0,
        sbp_delta=-4.0,
        dbp_delta=-3.0,
        hrv_delta=-8.0,
        sleep_delta=-1.2,
        missingness_prob=0.02,
    )
}

