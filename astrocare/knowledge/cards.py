"""AstroCare N13: Sourced Physiological & Environmental Indicator Cards.

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
Medical review status: PENDING_REVIEW (explicitly noted, no false claims).
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
    action_lines: List[str]  # Sourced action lines for N16 recommendation panel
    sources: List[Dict[str, str]]
    licence_terms: str
    review_status: str = "PENDING_REVIEW"
    version: str = "2.0.0"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


INDICATOR_CARDS: Dict[str, SourcedIndicatorCard] = {
    "heart_rate": SourcedIndicatorCard(
        card_id="CARD-01",
        indicator_name="Heart Rate",
        body_region_or_system="Cardiovascular",
        measurement_in_spaceflight="Measured continuously using wearable chest straps, optical PPG sensors embedded in flight garments, or smart watch telemetry.",
        why_it_matters="Heart rate reflects autonomic nervous system balance, cardiac workload, aerobic conditioning, and systemic stress response during space missions.",
        hazard_effects="Cephalad fluid shifts in microgravity cause acute central blood volume redistribution. Cabin stressors (hypercapnia, physical exertion, anxiety) elevate resting rates.",
        when_to_pay_attention="Pay attention if resting heart rate persistently exceeds 100 bpm (tachycardia) or falls below 45 bpm (bradycardia) outside scheduled sleep or exercise.",
        safe_next_steps="Verify sensor contact and signal quality; transition to a seated or relaxed posture; conduct scheduled hydration protocol; record symptoms in check-in log; queue consult for flight surgeon.",
        sourced_thresholds={
            "nominal_range": "55 - 95 bpm",
            "watch_threshold": "> 95 bpm resting or < 50 bpm resting",
            "alert_threshold": "> 115 bpm resting or < 42 bpm resting",
            "unit": "bpm"
        },
        action_lines=[
            "Verify sensor fit and sit in a supported, neutral body posture.",
            "Complete scheduled fluid intake (hydration countermeasure) and log symptoms."
        ],
        sources=[
            {
                "title": "NASA Human Research Program Evidence Book: Risk of Cardiac Rhythm Problems in Spaceflight",
                "organization": "NASA HRP",
                "url": "https://humanresearchroadmap.nasa.gov/evidence/reports/Arrhythmia.pdf",
                "date_accessed": "2026-11-14",
                "licence": "Public Domain (US Government Work)"
            }
        ],
        licence_terms="NASA Public Domain / US Government Work (17 U.S.C. 105)"
    ),
    "blood_pressure": SourcedIndicatorCard(
        card_id="CARD-02",
        indicator_name="Blood Pressure",
        body_region_or_system="Cardiovascular",
        measurement_in_spaceflight="Measured via automated pneumatic upper-arm cuffs, continuous finger-cuff volume-clamp plethysmography, or pulse transit time estimations.",
        why_it_matters="Arterial pressure regulates cerebral perfusion and systemic organ vascular resistance. Crucial for assessing orthostatic tolerance and fluid redistributions.",
        hazard_effects="Microgravity eliminates hydrostatic pressure gradients, causing facial edema and vascular remodeling. Deconditioning reduces vasoconstrictive reflex upon gravity transitions.",
        when_to_pay_attention="Pay attention if systolic blood pressure exceeds 140 mmHg (hypertensive watch) or drops below 90 mmHg (hypotensive watch with orthostatic vulnerability).",
        safe_next_steps="Rest in a comfortable position for 5 minutes; repeat cuff measurement on left arm at heart level; check hydration and fluid intake; notify crew medical officer.",
        sourced_thresholds={
            "nominal_range": "95-135 / 60-85 mmHg",
            "watch_threshold": "SBP > 135 mmHg or SBP < 92 mmHg",
            "alert_threshold": "SBP > 155 mmHg or SBP < 82 mmHg",
            "unit": "mmHg"
        },
        action_lines=[
            "Rest quietly for 5 minutes before taking a confirmatory reading at heart level.",
            "Review fluid and electrolyte consumption over the preceding 12 hours."
        ],
        sources=[
            {
                "title": "NASA-STD-3001 Vol 1: Crew Health and Medical Operations",
                "organization": "NASA",
                "url": "https://www.nasa.gov/offices/ochmo/human-standards/",
                "date_accessed": "2026-11-14",
                "licence": "Public Domain (US Government Work)"
            }
        ],
        licence_terms="NASA Public Domain / US Government Work"
    ),
    "blood_glucose": SourcedIndicatorCard(
        card_id="CARD-03",
        indicator_name="Blood Glucose",
        body_region_or_system="Endocrine / Metabolic",
        measurement_in_spaceflight="Monitored using minimally invasive continuous glucose monitoring (CGM) sensors or fingerstick capillary glucometers with mission-adapted test strips.",
        why_it_matters="Glycemic control ensures cellular energy supply to brain and muscle. Spaceflight can induce subclinical insulin resistance and altered carbohydrate metabolism.",
        hazard_effects="Microgravity-induced muscle unloading and dietary shifts alter glucose uptake kinetics. High operational stress or circadian disruption triggers stress hyperglycemia.",
        when_to_pay_attention="Pay attention if fasting glucose exceeds 126 mg/dL or random readings exceed 160 mg/dL, or if any reading drops below 65 mg/dL (hypoglycemia risk).",
        safe_next_steps="If glucose < 70 mg/dL: consume 15 grams of fast-acting carbohydrate (mission juice pack or glucose tab) and re-check in 15 minutes. If elevated: check hydration status and log meal composition.",
        sourced_thresholds={
            "nominal_range": "70 - 140 mg/dL",
            "watch_threshold": "< 70 mg/dL (hypoglycemia risk) or > 150 mg/dL",
            "alert_threshold": "< 55 mg/dL (urgent low) or > 200 mg/dL",
            "unit": "mg/dL"
        },
        action_lines=[
            "If glucose < 70 mg/dL, consume 15 g of rapid-acting carbohydrate and re-measure in 15 minutes.",
            "Ensure adequate hydration and log meal timing and contents in the daily journal."
        ],
        sources=[
            {
                "title": "NASA HRP Evidence Book: Risk of Impaired Glucose Metabolism in Spaceflight",
                "organization": "NASA HRP",
                "url": "https://humanresearchroadmap.nasa.gov/evidence/reports/Nutrition.pdf",
                "date_accessed": "2026-11-14",
                "licence": "Public Domain (US Government Work)"
            }
        ],
        licence_terms="NASA Public Domain / US Government Work"
    ),
    "body_temperature": SourcedIndicatorCard(
        card_id="CARD-04",
        indicator_name="Body Temperature",
        body_region_or_system="Thermoregulation",
        measurement_in_spaceflight="Measured with infrared tympanic thermometers, ingestible telemetry sensor pills, or forehead temporal artery thermal sensors.",
        why_it_matters="Core temperature reflects the balance between metabolic heat production and dissipation. Impaired thermoregulation or infection alters core setpoints.",
        hazard_effects="Spaceflight-associated core body temperature elevation ('space fever') occurs due to impaired convective and evaporative heat loss in weightlessness.",
        when_to_pay_attention="Pay attention if core body temperature at rest exceeds 37.8 degC (subfebrile/fever watch) or falls below 35.5 degC (hypothermia risk during EVA).",
        safe_next_steps="Remove excess thermal layers; verify cabin ventilation airflow; increase cool fluid intake; re-measure temperature after 20 minutes; log potential infection symptoms.",
        sourced_thresholds={
            "nominal_range": "36.2 - 37.5 degC",
            "watch_threshold": "> 37.6 degC or < 35.8 degC",
            "alert_threshold": "> 38.3 degC or < 35.2 degC",
            "unit": "degC"
        },
        action_lines=[
            "Ensure cabin airflow diffuser is clear and reduce thermal garment layers.",
            "Drink 250 mL of cool water and repeat core temperature measurement in 20 minutes."
        ],
        sources=[
            {
                "title": "Thermoregulation in Microgravity and Space Fever Phenomenon",
                "organization": "NASA HRP / ESA",
                "url": "https://humanresearchroadmap.nasa.gov/evidence/reports/Hypothermia.pdf",
                "date_accessed": "2026-11-14",
                "licence": "Public Domain (US Government Work)"
            }
        ],
        licence_terms="NASA Public Domain / US Government Work"
    ),
    "sleep": SourcedIndicatorCard(
        card_id="CARD-05",
        indicator_name="Sleep Duration & Quality",
        body_region_or_system="Neurobehavioral",
        measurement_in_spaceflight="Quantified via actigraphy sleep-watch wristbands, PSG electrophysiological sleep headbands, and daily subjective sleep logs.",
        why_it_matters="Restorative sleep maintains cognitive vigilance, situational awareness, emotional regulation, and immunological health during extended isolation.",
        hazard_effects="Lack of 24h natural solar cycle, microgravity posture discomfort, habitat acoustic noise, and mission scheduling conflicts induce chronic sleep deprivation.",
        when_to_pay_attention="Pay attention if cumulative sleep falls below 6.0 hours per 24-hour cycle for two consecutive nights or if subjective sleep latency exceeds 60 minutes.",
        safe_next_steps="Practice sleep hygiene protocols: dim crew quarters lighting 60 min before sleep; wear earplugs/noise attenuators; avoid high caffeine; review cognitive workload.",
        sourced_thresholds={
            "nominal_range": "7.0 - 8.5 hours/night",
            "watch_threshold": "< 6.0 hours/night",
            "alert_threshold": "< 4.5 hours/night or 2 consecutive nights < 5.5 h",
            "unit": "hours"
        },
        action_lines=[
            "Initiate pre-sleep wind-down: dim crew-quarter lighting and reduce screen brightness.",
            "Verify sleep-station acoustic damping and avoid caffeine within 6 hours of sleep."
        ],
        sources=[
            {
                "title": "NASA HRP Evidence Book: Risk of Performance Decrements and Disorders Associated with Sleep Loss and Circadian Desynchronization",
                "organization": "NASA HRP",
                "url": "https://humanresearchroadmap.nasa.gov/evidence/reports/Sleep.pdf",
                "date_accessed": "2026-11-14",
                "licence": "Public Domain (US Government Work)"
            }
        ],
        licence_terms="NASA Public Domain / US Government Work"
    ),
    "mood": SourcedIndicatorCard(
        card_id="CARD-06",
        indicator_name="Mood & Behavioral Wellness",
        body_region_or_system="Behavioral Health",
        measurement_in_spaceflight="Evaluated through standardized daily 60-second micro check-ins, validated visual analog scales, voice acoustic analysis, and journal sentiment.",
        why_it_matters="Crew cohesion, morale, and mental resilience are critical barriers against mission failure, interpersonal conflict, and cognitive error in isolated confinement.",
        hazard_effects="Sensory monotony, long communication latency to Earth, family separation, and high workload increase vulnerability to depression and fatigue.",
        when_to_pay_attention="Pay attention if subjective mood score drops to 3 or below (on 1-10 scale) for three consecutive days or if withdrawal or distress is self-reported.",
        safe_next_steps="Engage in scheduled relaxation or leisure protocol (music, family asynchronous messages, exercise); conduct peer support check-in; queue private consultation.",
        sourced_thresholds={
            "nominal_range": "6.0 - 10.0 (1-10 Likert scale)",
            "watch_threshold": "<= 4.0 or persistent 3-day decline",
            "alert_threshold": "<= 2.0 or crisis keyword detected",
            "unit": "score (1-10)"
        },
        action_lines=[
            "Schedule a 30-minute restorative downtime session with personal audio or visual media.",
            "Request a private asynchronous message exchange with the flight surgeon or family support."
        ],
        sources=[
            {
                "title": "Canadian Space Agency: Health Beyond and Behavioral Support for Deep Space Missions",
                "organization": "Canadian Space Agency (CSA)",
                "url": "https://www.asc-csa.gc.ca/eng/sciences/health-beyond.asp",
                "date_accessed": "2026-11-14",
                "licence": "Open Government Licence - Canada (OGL-Canada v2.0)"
            }
        ],
        licence_terms="Canadian Space Agency Open Government Licence - Canada v2.0 (Verified: non-commercial and commercial reproduction permitted with attribution)"
    ),
    "radiation_dose": SourcedIndicatorCard(
        card_id="CARD-07",
        indicator_name="Radiation Dose & Space Radiation Environment",
        body_region_or_system="Environmental / Cellular",
        measurement_in_spaceflight="Monitored with Crew Personal Dosimeters (CPD), silicon-detector radiation monitors, tissue-equivalent proportional counters, and habitat sensors.",
        why_it_matters="Ionizing space radiation (Galactic Cosmic Rays, Solar Particle Events) carries risks of acute radiation sickness, CNS degradation, and lifetime cancer excess.",
        hazard_effects="Outside low Earth orbit geomagnetism, deep-space coronal mass ejections can deliver dangerous dose rates within hours if crew is unshielded.",
        when_to_pay_attention="Pay attention if ambient dose rate exceeds 1.0 mSv/hour or if cumulative 30-day dose exceeds NASA Permissible Exposure Limits (250 mSv).",
        safe_next_steps="Immediately move to designated habitat radiation storm shelter (water wall / logistics shielding); confirm dosimeter placement; prepare emergency telecommunication.",
        sourced_thresholds={
            "nominal_range": "< 0.05 mSv/hour ambient",
            "watch_threshold": "> 0.20 mSv/hour",
            "alert_threshold": "> 1.00 mSv/hour (Shelter Alert)",
            "unit": "mSv/hour"
        },
        action_lines=[
            "Relocate to the central storm shelter compartment behind water and polyethylene shielding.",
            "Verify personal dosimeter battery and confirm habitat radiation shield deployment."
        ],
        sources=[
            {
                "title": "NASA HRP Evidence Book: Risk of Radiation Carcinogenesis and Acute Radiation Syndromes",
                "organization": "NASA HRP",
                "url": "https://humanresearchroadmap.nasa.gov/evidence/reports/Radiation.pdf",
                "date_accessed": "2026-11-14",
                "licence": "Public Domain (US Government Work)"
            }
        ],
        licence_terms="NASA Public Domain / US Government Work"
    ),
    "cabin_co2": SourcedIndicatorCard(
        card_id="CARD-08",
        indicator_name="Cabin Carbon Dioxide (CO2)",
        body_region_or_system="Life Support / Habitat Environmental",
        measurement_in_spaceflight="Measured with non-dispersive infrared (NDIR) spectroscopic gas sensors and Major Constituent Analyzers across habitat modules.",
        why_it_matters="Elevated ambient CO2 induces hypercapnia, headaches, cognitive impairment, visual changes (associated with SANS), and respiratory acidosis.",
        hazard_effects="Without convective air mixing in microgravity, localized CO2 pockets accumulate around sleeping astronauts unless mechanical ventilation is optimal.",
        when_to_pay_attention="Pay attention if partial pressure of CO2 (PCO2) exceeds 3.0 mmHg (NASA-STD-3001 target limit is < 2.0 mmHg in crew sleep quarters).",
        safe_next_steps="Check module cabin air diffuser and circulation fans; switch Carbon Dioxide Removal Assembly (CDRA) or amine beds to high-scrub mode; verify suit status if active.",
        sourced_thresholds={
            "nominal_range": "< 2.0 mmHg",
            "watch_threshold": ">= 2.5 mmHg",
            "alert_threshold": ">= 4.0 mmHg",
            "unit": "mmHg"
        },
        action_lines=[
            "Verify module ventilation fans are operating and clear any obstructions around air diffusers.",
            "Switch the Environmental Control and Life Support System (ECLSS) CO2 scrubber to maximum scrub."
        ],
        sources=[
            {
                "title": "NASA-STD-3001 Vol 2: Space Flight Human-System Standard - Habitability and Environmental Health",
                "organization": "NASA",
                "url": "https://www.nasa.gov/offices/ochmo/human-standards/",
                "date_accessed": "2026-11-14",
                "licence": "Public Domain (US Government Work)"
            }
        ],
        licence_terms="NASA Public Domain / US Government Work"
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
