"""AstroCare Hazard Models and Scenario Injection Definitions.

Decision-support prototype on synthetic and public data.
Synthetic proxy labels; NOT clinical ground truth.
"""
from dataclasses import dataclass
from typing import Dict, Optional


@dataclass(frozen=True)
class HazardProfile:
    name: str
    description: str
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
        missingness_prob=0.01,
    ),
    "isolation_confinement": HazardProfile(
        name="isolation_confinement",
        description="Prolonged deep-space confinement causing chronic sleep reduction and autonomic stress.",
        hr_delta=4.0,
        sbp_delta=3.0,
        hrv_delta=-12.0,
        glucose_delta=8.0,
        sleep_delta=-2.2,  # Intentional, documented N14 effect
        missingness_prob=0.03,
    ),
    "cabin_co2_leak": HazardProfile(
        name="cabin_co2_leak",
        description="Elevated ambient partial pressure of carbon dioxide (PCO2 > 4 mmHg) triggering tachypnea and vasodilation.",
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
        description="Nutritional or metabolic drop causing acute symptomatic hypoglycemia.",
        hr_delta=18.0,
        sbp_delta=8.0,
        hrv_delta=-20.0,
        glucose_delta=-48.0,  # Intentional, documented N14 effect: drops below 60 mg/dL
        sleep_delta=-0.5,
        missingness_prob=0.02,
    ),
    "metabolic_hyperglycemia": HazardProfile(
        name="metabolic_hyperglycemia",
        description="Postprandial glycemic surge or countermeasure disruption.",
        glucose_delta=65.0,  # Intentional, documented N14 effect: spikes above 160 mg/dL
        missingness_prob=0.02,
    ),
    "microgravity_adaptation": HazardProfile(
        name="microgravity_adaptation",
        description="Early mission space adaptation syndrome with cephalad fluid shift and autonomic resetting.",
        hr_delta=6.0,
        sbp_delta=-4.0,
        dbp_delta=-3.0,
        hrv_delta=-8.0,
        sleep_delta=-1.2,
        missingness_prob=0.02,
    )
}
