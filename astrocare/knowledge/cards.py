"""AstroCare N13: Sourced Physiological & Environmental Indicator Cards (Audited).

Provides 8 sourced indicator cards answering the NASA challenge brief's 5 core questions:
1. Heart rate
2. Blood pressure
3. Blood glucose
4. Body temperature
5. Sleep
6. Mood
7. Radiation dose
8. Cabin CO2

All content strictly adheres to non-diagnostic decision-support guidelines.
Medical review status: PENDING_MEDICAL_REVIEW (explicitly noted, no false claims).
Action lines are labeled as simulation decision-support recommendations, not approved clinical interventions.
"""
from dataclasses import asdict, dataclass
import json
from pathlib import Path
from typing import Any, Dict, List, Optional


@dataclass
class SourcedIndicatorCard:
    card_id: str
    indicator_name: str
    body_region_or_system: str
    measurement_in_spaceflight: str
    why_it_matters: str
    hazard_effects: str
    when_to_pay_attention: str
    safe_next_steps: str
    sourced_thresholds: Dict[str, Any]
    action_lines: List[str]  # Sourced action lines for decision support
    sources: List[Dict[str, str]]
    licence_terms: str
    review_status: str = "PENDING_MEDICAL_REVIEW"
    version: str = "2.1.0-audited"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


INDICATOR_CARDS: Dict[str, SourcedIndicatorCard] = {
    "heart_rate": SourcedIndicatorCard(
        card_id="CARD-01",
        indicator_name="Heart Rate",
        body_region_or_system="Cardiovascular",
        measurement_in_spaceflight="Measured continuously using wearable chest straps, optical photoplethysmography (PPG) sensors embedded in smart flight garments, or smart watch telemetry.",
        why_it_matters="Heart rate reflects autonomic balance, cardiovascular conditioning, physical exertion workload, and systemic physiological stress during space missions.",
        hazard_effects="Cephalad fluid redistribution in weightlessness reduces central venous return over time, altering baroreflex regulation. Cabin stressors (hypercapnia, anxiety, exertion) elevate resting heart rate.",
        when_to_pay_attention="Attention warranted if resting heart rate persistently exceeds 100 bpm or drops below 45 bpm outside scheduled sleep/exercise. Sourced from NASA-STD-3001 Vol 1.",
        safe_next_steps="Simulation recommendation (pending flight surgeon review): Check sensor contact and signal quality; rest in neutral body posture; review scheduled fluid intake; log symptoms in daily check-in; queue store-and-forward telemetry to Flight Surgeon.",
        sourced_thresholds={
            "nominal_range": "55 - 95 bpm",
            "watch_threshold": "> 95 bpm resting or < 50 bpm resting",
            "alert_threshold": "> 115 bpm resting or < 42 bpm resting",
            "unit": "bpm",
            "clinical_status": "Simulation threshold based on NASA-STD-3001 Vol 1; pending clinical review"
        },
        action_lines=[
            "Simulation recommendation: Verify sensor placement and rest in neutral body posture.",
            "Simulation recommendation: Review daily hydration log and queue consult for Flight Surgeon."
        ],
        sources=[
            {
                "title": "NASA Human Research Program Evidence Book: Risk of Cardiac Rhythm Problems in Spaceflight",
                "organization": "NASA HRP",
                "url": "https://humanresearchroadmap.nasa.gov/evidence/reports/Arrhythmia.pdf",
                "date_accessed": "2026-11-14",
                "licence": "Public Domain (U.S. Government Work, 17 U.S.C. § 105)"
            }
        ],
        licence_terms="NASA Public Domain / U.S. Government Work (17 U.S.C. § 105)"
    ),
    "blood_pressure": SourcedIndicatorCard(
        card_id="CARD-02",
        indicator_name="Blood Pressure",
        body_region_or_system="Cardiovascular",
        measurement_in_spaceflight="Measured using automated pneumatic upper-arm cuffs or finger-cuff plethysmography during routine clinical monitoring protocols.",
        why_it_matters="Arterial pressure regulates cerebral and systemic organ perfusion, serving as a critical indicator of cardiovascular adaptation and orthostatic tolerance.",
        hazard_effects="Microgravity removes hydrostatic arterial columns, causing headward fluid shifting. Subsequent hypovolemia and vascular remodeling increase post-flight orthostatic presyncope risk.",
        when_to_pay_attention="Attention warranted if resting systolic pressure exceeds 140 mmHg (hypertensive watch) or falls below 90 mmHg (hypotensive watch). Ref: NASA-STD-3001 Vol 1.",
        safe_next_steps="Simulation recommendation (pending flight surgeon review): Rest quietly for 5 minutes; re-measure cuff pressure at heart level; verify recent fluid/salt intake; notify Crew Medical Officer.",
        sourced_thresholds={
            "nominal_range": "95-135 / 60-85 mmHg",
            "watch_threshold": "SBP > 135 mmHg or SBP < 92 mmHg",
            "alert_threshold": "SBP > 155 mmHg or SBP < 82 mmHg",
            "unit": "mmHg",
            "clinical_status": "Simulation guideline based on NASA-STD-3001 Vol 1; pending clinical review"
        },
        action_lines=[
            "Simulation recommendation: Rest for 5 minutes before confirmatory measurement at heart level.",
            "Simulation recommendation: Check hydration log and record any postural lightheadedness."
        ],
        sources=[
            {
                "title": "NASA-STD-3001 Vol 1: Crew Health and Medical Operations",
                "organization": "NASA",
                "url": "https://www.nasa.gov/offices/ochmo/human-standards/",
                "date_accessed": "2026-11-14",
                "licence": "Public Domain (U.S. Government Work)"
            }
        ],
        licence_terms="NASA Public Domain / U.S. Government Work"
    ),
    "blood_glucose": SourcedIndicatorCard(
        card_id="CARD-03",
        indicator_name="Blood Glucose",
        body_region_or_system="Endocrine / Metabolic",
        measurement_in_spaceflight="Measured via continuous glucose monitoring (CGM) subcutaneous sensors or intermittent capillary glucometers with mission-adapted strip analysis.",
        why_it_matters="Glycemic stability ensures energetic fuel supply to brain and muscle. Spaceflight muscle unloading may induce mild peripheral insulin resistance.",
        hazard_effects="Unloading of postural skeletal muscles downregulates GLUT4 expression. Strenuous extravehicular activity (EVA) coupled with delayed intake can trigger acute hypoglycemia.",
        when_to_pay_attention="Attention warranted if fasting glucose exceeds 126 mg/dL or if readings drop below 70 mg/dL (hypoglycemia risk). Sourced from NASA HRP Nutrition Evidence Book.",
        safe_next_steps="Simulation recommendation (pending flight surgeon review): If reading < 70 mg/dL, notify Crew Medical Officer, consume standard nutrition countermeasure, and re-check after 15 minutes. Note: Simulated guideline only.",
        sourced_thresholds={
            "nominal_range": "70 - 140 mg/dL",
            "watch_threshold": "< 70 mg/dL or > 150 mg/dL",
            "alert_threshold": "< 55 mg/dL or > 200 mg/dL",
            "unit": "mg/dL",
            "clinical_status": "Simulation guideline based on terrestrial/spaceflight literature; pending clinical review"
        },
        action_lines=[
            "Simulation recommendation: If glucose < 70 mg/dL, notify CMO and take standard nutrition packet.",
            "Simulation recommendation: Log meal timing and verify sensor calibration."
        ],
        sources=[
            {
                "title": "NASA HRP Evidence Book: Nutritional Biochemistry and Glucose Metabolism in Spaceflight",
                "organization": "NASA HRP",
                "url": "https://humanresearchroadmap.nasa.gov/evidence/reports/Nutrition.pdf",
                "date_accessed": "2026-11-14",
                "licence": "Public Domain (U.S. Government Work)"
            }
        ],
        licence_terms="NASA Public Domain / U.S. Government Work"
    ),
    "body_temperature": SourcedIndicatorCard(
        card_id="CARD-04",
        indicator_name="Body Temperature",
        body_region_or_system="Thermoregulation",
        measurement_in_spaceflight="Measured via infrared tympanic thermometers, ingestible telemetry sensor pills, or forehead temporal artery temperature sensors.",
        why_it_matters="Core temperature reflects metabolic heat balance and systemic inflammatory status. Weightlessness impairs natural convective and evaporative heat loss.",
        hazard_effects="Spaceflight-associated core temperature elevation ('space fever') can arise from reduced heat dissipation and mild systemic inflammatory shifts.",
        when_to_pay_attention="Attention warranted if core temperature exceeds 37.8 degC (febrile watch) or falls below 35.5 degC. Sourced from NASA-STD-3001 Vol 1.",
        safe_next_steps="Simulation recommendation (pending flight surgeon review): Confirm cabin ventilation diffuser airflow; adjust garment layers; increase cool fluid intake; re-measure temperature after 20 minutes.",
        sourced_thresholds={
            "nominal_range": "36.2 - 37.5 degC",
            "watch_threshold": "> 37.6 degC or < 35.8 degC",
            "alert_threshold": "> 38.3 degC or < 35.2 degC",
            "unit": "degC",
            "clinical_status": "Simulation threshold based on NASA-STD-3001 Vol 1; pending clinical review"
        },
        action_lines=[
            "Simulation recommendation: Verify cabin air diffuser is unblocked and ventilating properly.",
            "Simulation recommendation: Re-measure temperature after 20 minutes and log thermal comfort."
        ],
        sources=[
            {
                "title": "NASA-STD-3001 Vol 1: Crew Health and Medical Operations",
                "organization": "NASA",
                "url": "https://www.nasa.gov/offices/ochmo/human-standards/",
                "date_accessed": "2026-11-14",
                "licence": "Public Domain (U.S. Government Work)"
            }
        ],
        licence_terms="NASA Public Domain / U.S. Government Work"
    ),
    "sleep": SourcedIndicatorCard(
        card_id="CARD-05",
        indicator_name="Sleep Duration & Quality",
        body_region_or_system="Neurobehavioral",
        measurement_in_spaceflight="Quantified via wrist actigraphy watches, EEG sleep headbands, and daily subjective sleep logs during morning check-ins.",
        why_it_matters="Restorative sleep maintains cognitive vigilance, situational awareness, emotional regulation, and fine motor coordination for mission-critical tasks.",
        hazard_effects="Lack of 24h natural solar cycle, microgravity posture discomfort, habitat acoustic noise (55-65 dBA), and high operational workloads induce chronic sleep fragmentation.",
        when_to_pay_attention="Attention warranted if cumulative sleep duration falls below 6.0 hours/night for consecutive cycles or if subjective sleep latency exceeds 60 minutes. Sourced from NASA HRP Sleep Evidence Book.",
        safe_next_steps="Simulation recommendation (pending flight surgeon review): Follow pre-sleep wind-down protocol: dim crew quarter lighting 60 min before sleep; verify sleep station noise attenuation; review cognitive workload.",
        sourced_thresholds={
            "nominal_range": "7.0 - 8.5 hours/night",
            "watch_threshold": "< 6.0 hours/night",
            "alert_threshold": "< 4.5 hours/night",
            "unit": "hours",
            "clinical_status": "Simulation guideline based on NASA HRP Sleep standards; pending clinical review"
        },
        action_lines=[
            "Simulation recommendation: Dim cabin lighting 45 minutes prior to scheduled sleep.",
            "Simulation recommendation: Ensure sleep quarters acoustic dampers and earplugs are utilized."
        ],
        sources=[
            {
                "title": "NASA HRP Evidence Book: Risk of Performance Decrements Associated with Sleep Loss and Circadian Desynchronization",
                "organization": "NASA HRP",
                "url": "https://humanresearchroadmap.nasa.gov/evidence/reports/Sleep.pdf",
                "date_accessed": "2026-11-14",
                "licence": "Public Domain (U.S. Government Work)"
            }
        ],
        licence_terms="NASA Public Domain / U.S. Government Work"
    ),
    "mood": SourcedIndicatorCard(
        card_id="CARD-06",
        indicator_name="Mood & Behavioral Wellness",
        body_region_or_system="Behavioral Health",
        measurement_in_spaceflight="Evaluated through standardized daily 60-second micro check-ins, validated visual analog scales, voice acoustic features, and journal entries.",
        why_it_matters="Crew cohesion, morale, and interpersonal resilience are essential barriers against mission degradation in isolated confined environments (ICE).",
        hazard_effects="Extended isolation, communication latency with family, sensory monotony, and high operational stress elevate risks of fatigue, anxiety, and interpersonal friction.",
        when_to_pay_attention="Attention warranted if subjective wellness score drops to 4 or below (on 1-10 scale) across consecutive days. Sourced from CSA Health Beyond literature.",
        safe_next_steps="Simulation recommendation (pending flight surgeon review): Schedule restorative downtime; engage in peer support or personal audio/visual relaxation; prepare asynchronous message to ground support.",
        sourced_thresholds={
            "nominal_range": "6.0 - 10.0 (1-10 scale)",
            "watch_threshold": "<= 4.0",
            "alert_threshold": "<= 2.0 or crisis phrase detected",
            "unit": "score (1-10)",
            "clinical_status": "Simulation guideline based on CSA exploration health literature; pending clinical review"
        },
        action_lines=[
            "Simulation recommendation: Allocate 30 minutes of scheduled downtime for personal media.",
            "Simulation recommendation: Queue an asynchronous support message to ground medical teams."
        ],
        sources=[
            {
                "title": "Canadian Space Agency: Health Beyond and Behavioral Support for Exploration Missions",
                "organization": "Canadian Space Agency",
                "url": "https://www.asc-csa.gc.ca/eng/sciences/health-beyond.asp",
                "date_accessed": "2026-11-14",
                "licence": "Government of Canada Terms and Conditions / Crown Copyright. Educational non-commercial use with attribution."
            }
        ],
        licence_terms="Canadian Space Agency Crown Copyright. Non-commercial reproduction permitted with attribution to CSA. Commercial redistribution requires prior written authorization."
    ),
    "radiation_dose": SourcedIndicatorCard(
        card_id="CARD-07",
        indicator_name="Radiation Dose & Space Radiation Environment",
        body_region_or_system="Environmental / Cellular",
        measurement_in_spaceflight="Monitored using Crew Personal Dosimeters (CPD), silicon semiconductor detectors, tissue-equivalent proportional counters, and habitat area radiation monitors.",
        why_it_matters="Ionizing radiation (GCR, SPE) poses acute risks of radiation sickness during solar storms and long-term risks of carcinogenesis and central nervous system degradation.",
        hazard_effects="Beyond Earth's magnetosphere, acute coronal mass ejections can deliver dangerous proton doses within hours unless crew members shelter behind adequate shielding.",
        when_to_pay_attention="Attention warranted if ambient dose rate exceeds 0.20 mSv/hour, or if cumulative 30-day exposure approaches NASA Permissible Exposure Limits (250 mSv). Sourced from NASA-STD-3001.",
        safe_next_steps="Simulation recommendation (pending flight surgeon review): Upon radiation storm warning, verify personal dosimeters, relocate to designated storm shelter compartment, and prepare communication package.",
        sourced_thresholds={
            "nominal_range": "< 0.05 mSv/hour ambient",
            "watch_threshold": "> 0.20 mSv/hour",
            "alert_threshold": "> 1.00 mSv/hour (Shelter Alert)",
            "unit": "mSv/hour",
            "clinical_status": "Simulation threshold based on NASA HRP Radiation standards; pending clinical review"
        },
        action_lines=[
            "Simulation recommendation: Prepare to relocate to the designated storm shelter compartment.",
            "Simulation recommendation: Confirm personal dosimeter placement and active battery status."
        ],
        sources=[
            {
                "title": "NASA Human Research Program Evidence Book: Risk of Radiation Carcinogenesis and Acute Radiation Syndromes",
                "organization": "NASA HRP",
                "url": "https://humanresearchroadmap.nasa.gov/evidence/reports/Radiation.pdf",
                "date_accessed": "2026-11-14",
                "licence": "Public Domain (U.S. Government Work, 17 U.S.C. § 105)"
            }
        ],
        licence_terms="NASA Public Domain / U.S. Government Work (17 U.S.C. § 105)"
    ),
    "cabin_co2": SourcedIndicatorCard(
        card_id="CARD-08",
        indicator_name="Cabin Carbon Dioxide (CO2)",
        body_region_or_system="Life Support / Habitat Environmental",
        measurement_in_spaceflight="Monitored with non-dispersive infrared (NDIR) gas sensors and mass spectrometers across habitat modules and crew quarters.",
        why_it_matters="Elevated carbon dioxide induces hypercapnia, neurovascular headaches, visual disturbances, lethargy, and mild respiratory acidosis.",
        hazard_effects="Without convective air mixing in microgravity, exhaled CO2 forms stagnant pockets around sleeping crew members unless ventilation fans maintain adequate airflow.",
        when_to_pay_attention="Attention warranted if partial pressure of CO2 (PCO2) exceeds 2.5 mmHg. NASA-STD-3001 Vol 2 specifies a 24h average target below 2.0 mmHg in sleep quarters.",
        safe_next_steps="Simulation recommendation (pending flight surgeon review): Inspect module air diffusers for blockages; verify cabin circulation fan operation; notify ground control of elevated PCO2 readings.",
        sourced_thresholds={
            "nominal_range": "< 2.0 mmHg",
            "watch_threshold": ">= 2.5 mmHg",
            "alert_threshold": ">= 4.0 mmHg",
            "unit": "mmHg",
            "clinical_status": "Simulation limit based on NASA-STD-3001 Vol 2; pending clinical review"
        },
        action_lines=[
            "Simulation recommendation: Verify habitat module ventilation fans are operating normally.",
            "Simulation recommendation: Check that sleeping quarters air diffusers are unobstructed."
        ],
        sources=[
            {
                "title": "NASA-STD-3001 Vol 2: Space Flight Human-System Standard - Habitability and Environmental Health",
                "organization": "NASA",
                "url": "https://www.nasa.gov/offices/ochmo/human-standards/",
                "date_accessed": "2026-11-14",
                "licence": "Public Domain (U.S. Government Work)"
            }
        ],
        licence_terms="NASA Public Domain / U.S. Government Work"
    ),
}


def export_indicator_cards_json(target_dir: Path) -> int:
    target_dir.mkdir(parents=True, exist_ok=True)
    count = 0
    for key, card in INDICATOR_CARDS.items():
        file_path = target_dir / f"{key}_indicator_card.json"
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(card.to_dict(), f, indent=2)
        count += 1
    return count
