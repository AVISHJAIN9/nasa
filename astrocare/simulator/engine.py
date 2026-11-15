"""AstroCare F011 Vitals Simulator Engine with N14 Additions.

Generates deterministic multi-crew synthetic physiological telemetry,
including glucose (mg/dL) and sleep_hours (hours), with circadian rhythm,
intermittent cadence, realistic process noise, and hazard scenario effects.

Decision-support prototype on synthetic and public data.
Synthetic proxy data; NOT clinical ground truth.

DISCLAIMER & SIMULATOR ASSUMPTIONS:
All delta parameters (hr_delta, glucose_delta, sleep_delta, etc.) are synthetic simulator
assumptions designed to stress-test anomaly detection and decision algorithms under controlled
conditions. They are NOT clinically validated medical effects and must not be interpreted as
clinical findings. NASA reference documentation describes operational contexts, not numeric
clinical dose-response coefficients.
"""
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
import json
import math
from pathlib import Path
import time
from typing import Any, Dict, Generator, List, Optional, Tuple
import numpy as np

from astrocare.config import DATA_GEN_SEED, METRIC_REGISTRY
from astrocare.simulator.hazards import SCENARIOS, HazardProfile


SUPPORTED_STEP_SECONDS_MIN: float = 0.1
SUPPORTED_STEP_SECONDS_MAX: float = 300.0  # Constrained to metric cadence to prevent CGM sub-sampling


@dataclass
class AstronautProfile:
    crew_id: str
    name: str
    age: int
    base_hr: float
    base_sbp: float
    base_dbp: float
    base_spo2: float
    base_temp: float
    base_resp: float
    base_hrv: float
    base_glucose: float
    base_sleep: float
    vulnerability_factor: float = 1.0


@dataclass
class TelemetryRecord:
    ts: str  # ISO-8601 UTC
    crew_id: str
    metric: str
    value: Optional[float]
    unit: str
    scenario: str
    is_simulated: bool = True
    synthetic_label: int = 0  # 0 = nominal, 1 = anomalous/hazard
    hazard_tag: Optional[str] = None  # Official NASA Hazard Enum: radiation, isolation, distance, gravity, closed_environment
    body_region: str = "general"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def get_default_crew(rng: Optional[np.random.RandomState] = None, crew_size: int = 4) -> List[AstronautProfile]:
    """Generates standard 4-person or expanded 6-person crew with personal baseline variation.
    
    Astronaut baselines are fixed physiological constants to ensure the same individual
    has an identical baseline across train, validation, and test splits (no silent baseline shifts).
    """
    crew = [
        AstronautProfile(
            crew_id="ASTRO-01",
            name="Commander Alex Mercer",
            age=44,
            base_hr=64.0,
            base_sbp=118.0,
            base_dbp=74.0,
            base_spo2=98.5,
            base_temp=36.7,
            base_resp=14.5,
            base_hrv=52.0,
            base_glucose=92.0,
            base_sleep=7.6,
            vulnerability_factor=1.00,
        ),
        AstronautProfile(
            crew_id="ASTRO-02",
            name="Pilot Sarah Jenkins",
            age=38,
            base_hr=58.0,
            base_sbp=112.0,
            base_dbp=70.0,
            base_spo2=99.0,
            base_temp=36.6,
            base_resp=13.0,
            base_hrv=64.0,
            base_glucose=88.0,
            base_sleep=7.9,
            vulnerability_factor=0.92,
        ),
        AstronautProfile(
            crew_id="ASTRO-03",
            name="Medical Officer David Kim",
            age=47,
            base_hr=72.0,
            base_sbp=124.0,
            base_dbp=79.0,
            base_spo2=97.8,
            base_temp=36.9,
            base_resp=15.5,
            base_hrv=42.0,
            base_glucose=98.0,
            base_sleep=7.2,
            vulnerability_factor=1.15,
        ),
        AstronautProfile(
            crew_id="ASTRO-04",
            name="Mission Specialist Elena Rostova",
            age=34,
            base_hr=61.0,
            base_sbp=115.0,
            base_dbp=72.0,
            base_spo2=98.8,
            base_temp=36.7,
            base_resp=14.0,
            base_hrv=58.0,
            base_glucose=90.0,
            base_sleep=7.7,
            vulnerability_factor=0.95,
        ),
    ]
    if crew_size >= 5:
        crew.append(
            AstronautProfile(
                crew_id="ASTRO-05",
                name="Flight Engineer Chen Wei",
                age=39,
                base_hr=66.0,
                base_sbp=116.0,
                base_dbp=73.0,
                base_spo2=98.4,
                base_temp=36.8,
                base_resp=14.2,
                base_hrv=50.0,
                base_glucose=94.0,
                base_sleep=7.4,
                vulnerability_factor=1.05,
            )
        )
    if crew_size >= 6:
        crew.append(
            AstronautProfile(
                crew_id="ASTRO-06",
                name="Payload Specialist Maya Patel",
                age=42,
                base_hr=63.0,
                base_sbp=114.0,
                base_dbp=71.0,
                base_spo2=99.1,
                base_temp=36.6,
                base_resp=13.5,
                base_hrv=60.0,
                base_glucose=89.0,
                base_sleep=7.8,
                vulnerability_factor=0.90,
            )
        )
    return crew[:crew_size]


class VitalsSimulator:
    """F011 Simulator Engine extended with N14 glucose and sleep."""

    def __init__(
        self,
        seed: int = DATA_GEN_SEED,
        crew: Optional[List[AstronautProfile]] = None,
        base_time: Optional[datetime] = None,
        wake_hour_utc: int = 7,
        crew_size: int = 4,
    ):
        self.seed = seed
        self.rng = np.random.RandomState(seed)
        self.crew = crew or get_default_crew(self.rng, crew_size=crew_size)
        # Default start at 07:00:00 UTC (documented astronaut wake time)
        self.base_time = base_time or datetime(2026, 11, 14, 7, 0, 0, tzinfo=timezone.utc)
        self.wake_hour_utc = wake_hour_utc

    def generate_step(
        self,
        step_idx: int,
        step_seconds: float = 60.0,
        scenario_name: str = "nominal",
        hazard_active: bool = False,
        hazard_start_step: int = 0,
    ) -> List[TelemetryRecord]:
        """Generates records for all crew members for a single time step."""
        if not (SUPPORTED_STEP_SECONDS_MIN <= step_seconds <= SUPPORTED_STEP_SECONDS_MAX):
            raise ValueError(
                f"Unsupported step_seconds={step_seconds}. Simulator engine constrains operational step sizes "
                f"to [{SUPPORTED_STEP_SECONDS_MIN}, {SUPPORTED_STEP_SECONDS_MAX}] seconds to prevent multi-cadence "
                f"sub-sampling of 300s CGM glucose and blood pressure streams."
            )

        if scenario_name not in SCENARIOS:
            raise ValueError(
                f"Unknown scenario '{scenario_name}'. Supported scenarios: {list(SCENARIOS.keys())}"
            )

        # Deterministic per-step RNG: eliminates instance-reuse divergence
        step_rng = np.random.RandomState(self.seed + step_idx * 10007)

        current_time = self.base_time + timedelta(seconds=step_idx * step_seconds)
        time_iso = current_time.isoformat()
        hours_elapsed = (step_idx * step_seconds) / 3600.0
        time_of_day_hours = (current_time.hour + current_time.minute / 60.0 + current_time.second / 3600.0)

        hazard: HazardProfile = SCENARIOS[scenario_name]
        records: List[TelemetryRecord] = []

        # Circadian oscillations (24 hour period)
        # Nadir of HR and temp around 04:00 (phase shift = -4h)
        circadian_phase = 2.0 * math.pi * (time_of_day_hours - 4.0) / 24.0
        circadian_hr = 4.0 * math.cos(circadian_phase)
        circadian_temp = 0.3 * math.cos(circadian_phase)
        circadian_glucose = 5.0 * math.sin(circadian_phase)

        # Mission-phase effect (subtle long-duration cumulative fatigue across vital signs)
        fatigue_hr = min(hours_elapsed * 0.015, 2.0)
        fatigue_sbp = min(hours_elapsed * 0.01, 1.5)
        fatigue_hrv = -min(hours_elapsed * 0.03, 3.0)

        # Timing checks for cadence supporting operational sub-cadence step_seconds (<= 300s)
        elapsed_sec = step_idx * step_seconds
        prev_elapsed_sec = (step_idx - 1) * step_seconds if step_idx > 0 else -step_seconds
        prev_time = self.base_time + timedelta(seconds=prev_elapsed_sec) if step_idx > 0 else None

        # Glucose: 5-minute (300s) CGM cadence
        emit_glucose = (step_idx == 0) or (int(elapsed_sec // 300.0) > int(prev_elapsed_sec // 300.0))

        # Systolic / Diastolic BP: 5-minute (300s) intermittent cuff cadence
        emit_bp = (step_idx == 0) or (int(elapsed_sec // 300.0) > int(prev_elapsed_sec // 300.0))

        # Sleep hours: Daily morning check-in at documented wake time (07:00:00 UTC)
        # Emitted once per 24 hours at morning wake boundary; does not emit if starting at afternoon
        if step_idx == 0:
            emit_sleep = (current_time.hour == self.wake_hour_utc and current_time.minute == 0 and current_time.second == 0)
        else:
            emit_sleep = (
                (prev_time.date() == current_time.date() and prev_time.hour < self.wake_hour_utc <= current_time.hour)
                or (prev_time.date() < current_time.date() and current_time.hour >= self.wake_hour_utc)
            )

        # Elapsed hazard time in minutes (Defect 4: ramp in minutes, not steps)
        elapsed_hazard_min = (step_idx - hazard_start_step) * (step_seconds / 60.0) if (hazard_active and hazard_start_step is not None) else 0.0

        for astronaut in self.crew:
            cid = astronaut.crew_id
            vuln = astronaut.vulnerability_factor

            # Per-person onset delay and duration scaling based on individual vulnerability (Defect 11)
            onset_delay_min = max(0.0, (1.0 - vuln) * 5.0)
            astro_elapsed_min = elapsed_hazard_min - onset_delay_min
            astro_hazard_active = hazard_active and (astro_elapsed_min >= 0.0)
            record_scenario = scenario_name if (astro_hazard_active and scenario_name != "nominal") else "nominal"

            # Individual ramp duration scaled by vulnerability in minutes
            ramp_duration_min = max(5.0, 15.0 / max(vuln, 0.1))
            astro_ramp = min(1.0, max(0.2, (astro_elapsed_min + (step_seconds / 60.0)) / ramp_duration_min)) if astro_hazard_active else 0.0

            # Active hazard deltas modulated by ramp and individual vulnerability
            h_hr = hazard.hr_delta * astro_ramp * vuln if astro_hazard_active else 0.0
            h_sbp = hazard.sbp_delta * astro_ramp * vuln if astro_hazard_active else 0.0
            h_dbp = hazard.dbp_delta * astro_ramp * vuln if astro_hazard_active else 0.0
            h_spo2 = hazard.spo2_delta * astro_ramp * vuln if astro_hazard_active else 0.0
            h_temp = hazard.temp_delta * astro_ramp * vuln if astro_hazard_active else 0.0
            h_resp = hazard.resp_delta * astro_ramp * vuln if astro_hazard_active else 0.0
            h_hrv = hazard.hrv_delta * astro_ramp * vuln if astro_hazard_active else 0.0
            h_glucose = hazard.glucose_delta * astro_ramp * vuln if astro_hazard_active else 0.0

            # Metric-specific anomaly labeling
            def get_metric_label(delta: float) -> Tuple[int, Optional[str]]:
                if astro_hazard_active and scenario_name != "nominal" and abs(delta) > 1e-4:
                    return 1, hazard.hazard_tag
                return 0, None

            # 1. Heart rate (bpm) - noise matches METRIC_REGISTRY typical_sigma (2.5 bpm)
            hr_val = astronaut.base_hr + circadian_hr + fatigue_hr + h_hr + step_rng.normal(0, METRIC_REGISTRY["heart_rate"].typical_sigma)
            lbl_hr, tag_hr = get_metric_label(h_hr)
            records.append(
                TelemetryRecord(
                    ts=time_iso,
                    crew_id=cid,
                    metric="heart_rate",
                    value=None if step_rng.rand() < hazard.missingness_prob else round(float(hr_val), 1),
                    unit="bpm",
                    scenario=record_scenario,
                    synthetic_label=lbl_hr,
                    hazard_tag=tag_hr,
                    body_region="heart",
                )
            )

            # 2. Systolic & Diastolic BP (mmHg)
            if emit_bp:
                sbp_val = astronaut.base_sbp + 0.5 * circadian_hr + fatigue_sbp + h_sbp + step_rng.normal(0, METRIC_REGISTRY["systolic_bp"].typical_sigma)
                dbp_val = astronaut.base_dbp + 0.3 * circadian_hr + h_dbp + step_rng.normal(0, METRIC_REGISTRY["diastolic_bp"].typical_sigma)
                lbl_sbp, tag_sbp = get_metric_label(h_sbp)
                lbl_dbp, tag_dbp = get_metric_label(h_dbp)
                records.append(
                    TelemetryRecord(
                        ts=time_iso,
                        crew_id=cid,
                        metric="systolic_bp",
                        value=None if step_rng.rand() < hazard.missingness_prob else round(float(sbp_val), 1),
                        unit="mmHg",
                        scenario=record_scenario,
                        synthetic_label=lbl_sbp,
                        hazard_tag=tag_sbp,
                        body_region="heart",
                    )
                )
                records.append(
                    TelemetryRecord(
                        ts=time_iso,
                        crew_id=cid,
                        metric="diastolic_bp",
                        value=None if step_rng.rand() < hazard.missingness_prob else round(float(dbp_val), 1),
                        unit="mmHg",
                        scenario=record_scenario,
                        synthetic_label=lbl_dbp,
                        hazard_tag=tag_dbp,
                        body_region="heart",
                    )
                )

            # 3. SpO2 (%)
            spo2_val = min(100.0, max(80.0, astronaut.base_spo2 + h_spo2 + step_rng.normal(0, METRIC_REGISTRY["spo2"].typical_sigma)))
            lbl_spo2, tag_spo2 = get_metric_label(h_spo2)
            records.append(
                TelemetryRecord(
                    ts=time_iso,
                    crew_id=cid,
                    metric="spo2",
                    value=None if step_rng.rand() < hazard.missingness_prob else round(float(spo2_val), 1),
                    unit="%",
                    scenario=record_scenario,
                    synthetic_label=lbl_spo2,
                    hazard_tag=tag_spo2,
                    body_region="lungs",
                )
            )

            # 4. Body temperature (degC)
            temp_val = astronaut.base_temp + circadian_temp + h_temp + step_rng.normal(0, METRIC_REGISTRY["body_temp"].typical_sigma)
            lbl_temp, tag_temp = get_metric_label(h_temp)
            records.append(
                TelemetryRecord(
                    ts=time_iso,
                    crew_id=cid,
                    metric="body_temp",
                    value=None if step_rng.rand() < hazard.missingness_prob else round(float(temp_val), 2),
                    unit="degC",
                    scenario=record_scenario,
                    synthetic_label=lbl_temp,
                    hazard_tag=tag_temp,
                    body_region="whole_body",
                )
            )

            # 5. Respiration rate (breaths/min)
            resp_val = astronaut.base_resp + h_resp + step_rng.normal(0, METRIC_REGISTRY["respiration_rate"].typical_sigma)
            lbl_resp, tag_resp = get_metric_label(h_resp)
            records.append(
                TelemetryRecord(
                    ts=time_iso,
                    crew_id=cid,
                    metric="respiration_rate",
                    value=None if step_rng.rand() < hazard.missingness_prob else round(float(resp_val), 1),
                    unit="breaths/min",
                    scenario=record_scenario,
                    synthetic_label=lbl_resp,
                    hazard_tag=tag_resp,
                    body_region="lungs",
                )
            )

            # 6. HRV RMSSD (ms)
            hrv_val = max(5.0, astronaut.base_hrv + fatigue_hrv + h_hrv + step_rng.normal(0, METRIC_REGISTRY["hrv_rmssd"].typical_sigma))
            lbl_hrv, tag_hrv = get_metric_label(h_hrv)
            records.append(
                TelemetryRecord(
                    ts=time_iso,
                    crew_id=cid,
                    metric="hrv_rmssd",
                    value=None if step_rng.rand() < hazard.missingness_prob else round(float(hrv_val), 1),
                    unit="ms",
                    scenario=record_scenario,
                    synthetic_label=lbl_hrv,
                    hazard_tag=tag_hrv,
                    body_region="heart",
                )
            )

            # 7. Glucose (mg/dL) [N14 requirement: 5-minute CGM cadence]
            if emit_glucose:
                gluc_val = astronaut.base_glucose + circadian_glucose + h_glucose + step_rng.normal(0, METRIC_REGISTRY["glucose"].typical_sigma)
                lbl_gluc, tag_gluc = get_metric_label(h_glucose)
                records.append(
                    TelemetryRecord(
                        ts=time_iso,
                        crew_id=cid,
                        metric="glucose",
                        value=None if step_rng.rand() < hazard.missingness_prob else round(float(gluc_val), 1),
                        unit="mg/dL",
                        scenario=record_scenario,
                        synthetic_label=lbl_gluc,
                        hazard_tag=tag_gluc,
                        body_region="gut",
                    )
                )

            # 8. Sleep hours (hours) [N14 requirement: Daily morning check-in at wake time (07:00:00 UTC)]
            if emit_sleep:
                # Sleep delta applies only if hazard was active during preceding night (Defect 8)
                # Sleep period is 23:00 to 07:00 (8h). Hazard must have started >= 4 hours before wake
                if hazard_active and scenario_name != "nominal" and hazard_start_step is not None:
                    hazard_start_dt = self.base_time + timedelta(seconds=hazard_start_step * step_seconds)
                    active_hours_prior_to_wake = (current_time - hazard_start_dt).total_seconds() / 3600.0
                    night_affected = active_hours_prior_to_wake >= 4.0
                else:
                    night_affected = False

                h_sleep = hazard.sleep_delta * vuln if (astro_hazard_active and night_affected) else 0.0
                sleep_val = max(1.0, min(14.0, astronaut.base_sleep + h_sleep + step_rng.normal(0, METRIC_REGISTRY["sleep_hours"].typical_sigma)))
                lbl_sleep, tag_sleep = get_metric_label(h_sleep)
                records.append(
                    TelemetryRecord(
                        ts=time_iso,
                        crew_id=cid,
                        metric="sleep_hours",
                        value=None if step_rng.rand() < hazard.missingness_prob else round(float(sleep_val), 2),
                        unit="hours",
                        scenario=record_scenario,
                        synthetic_label=lbl_sleep,
                        hazard_tag=tag_sleep,
                        body_region="brain",
                    )
                )

        return records

    def stream_records(
        self,
        total_steps: int = 120,
        step_seconds: float = 60.0,
        scenario_name: str = "nominal",
        hazard_start_step: Optional[int] = None,
    ) -> Generator[TelemetryRecord, None, None]:
        """Live telemetry streaming generator."""
        self.rng = np.random.RandomState(self.seed)
        for step in range(total_steps):
            hazard_active = (hazard_start_step is not None and step >= hazard_start_step)
            for rec in self.generate_step(
                step_idx=step,
                step_seconds=step_seconds,
                scenario_name=scenario_name,
                hazard_active=hazard_active,
                hazard_start_step=hazard_start_step if hazard_start_step is not None else 0,
            ):
                yield rec

    def stream_live(
        self,
        total_steps: int = 120,
        step_seconds: float = 1.0,
        scenario_name: str = "nominal",
        hazard_start_step: Optional[int] = None,
        callback: Optional[Any] = None,
        pace_hz: float = 1.0,
        speedup: float = 0.0,
    ) -> Generator[TelemetryRecord, None, None]:
        """Yields live telemetry records and publishes to callback / subscriber, paced at pace_hz when speedup > 0."""
        step_delay = (1.0 / (pace_hz * speedup)) if (speedup > 0.0 and pace_hz > 0.0) else 0.0
        for step in range(total_steps):
            hazard_active = (hazard_start_step is not None and step >= hazard_start_step)
            for rec in self.generate_step(
                step_idx=step,
                step_seconds=step_seconds,
                scenario_name=scenario_name,
                hazard_active=hazard_active,
                hazard_start_step=hazard_start_step if hazard_start_step is not None else 0,
            ):
                if callback is not None:
                    callback(rec)
                yield rec
            if step_delay > 0.0:
                time.sleep(step_delay)

    def generate_jsonl(
        self,
        output_path: Path,
        total_steps: int = 120,
        step_seconds: float = 60.0,
        scenario_name: str = "nominal",
        hazard_start_step: Optional[int] = None,
    ) -> int:
        """Deterministic batch generator writing to JSONL file with byte-identical output across runs."""
        output_path.parent.mkdir(parents=True, exist_ok=True)
        count = 0
        with open(output_path, "w", encoding="utf-8") as f:
            for rec in self.stream_records(
                total_steps=total_steps,
                step_seconds=step_seconds,
                scenario_name=scenario_name,
                hazard_start_step=hazard_start_step,
            ):
                line = json.dumps(rec.to_dict(), sort_keys=True)
                f.write(line + "\n")
                count += 1
        return count

