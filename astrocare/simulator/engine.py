"""AstroCare F011 Vitals Simulator Engine with N14 Additions.

Generates deterministic multi-crew synthetic physiological telemetry,
including glucose (mg/dL) and sleep_hours (hours), with circadian rhythm,
intermittent cadence, realistic process noise, and hazard scenario effects.

Decision-support prototype on synthetic and public data.
Synthetic proxy data; NOT clinical ground truth.
"""
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
import json
import math
from pathlib import Path
from typing import Any, Dict, Generator, List, Optional, Tuple
import numpy as np

from astrocare.config import DATA_GEN_SEED, METRIC_REGISTRY
from astrocare.simulator.hazards import SCENARIOS, HazardProfile


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
    hazard_tag: Optional[str] = None
    body_region: str = "general"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def get_default_crew(rng: np.random.RandomState) -> List[AstronautProfile]:
    """Generates standard 4-person crew with personal baseline variation."""
    crew = [
        AstronautProfile(
            crew_id="ASTRO-01",
            name="Commander Alex Mercer",
            age=44,
            base_hr=64.0 + rng.normal(0, 2),
            base_sbp=118.0 + rng.normal(0, 3),
            base_dbp=74.0 + rng.normal(0, 2),
            base_spo2=98.5,
            base_temp=36.7 + rng.normal(0, 0.1),
            base_resp=14.5 + rng.normal(0, 0.5),
            base_hrv=52.0 + rng.normal(0, 4),
            base_glucose=92.0 + rng.normal(0, 3),   # N14
            base_sleep=7.6 + rng.normal(0, 0.2),    # N14
        ),
        AstronautProfile(
            crew_id="ASTRO-02",
            name="Pilot Sarah Jenkins",
            age=38,
            base_hr=58.0 + rng.normal(0, 2),
            base_sbp=112.0 + rng.normal(0, 3),
            base_dbp=70.0 + rng.normal(0, 2),
            base_spo2=99.0,
            base_temp=36.6 + rng.normal(0, 0.1),
            base_resp=13.0 + rng.normal(0, 0.5),
            base_hrv=64.0 + rng.normal(0, 5),
            base_glucose=88.0 + rng.normal(0, 3),   # N14
            base_sleep=7.9 + rng.normal(0, 0.2),    # N14
        ),
        AstronautProfile(
            crew_id="ASTRO-03",
            name="Medical Officer David Kim",
            age=47,
            base_hr=72.0 + rng.normal(0, 2),
            base_sbp=124.0 + rng.normal(0, 3),
            base_dbp=79.0 + rng.normal(0, 2),
            base_spo2=97.8,
            base_temp=36.9 + rng.normal(0, 0.1),
            base_resp=15.5 + rng.normal(0, 0.5),
            base_hrv=42.0 + rng.normal(0, 4),
            base_glucose=98.0 + rng.normal(0, 4),   # N14
            base_sleep=7.2 + rng.normal(0, 0.3),    # N14
        ),
        AstronautProfile(
            crew_id="ASTRO-04",
            name="Mission Specialist Elena Rostova",
            age=34,
            base_hr=61.0 + rng.normal(0, 2),
            base_sbp=115.0 + rng.normal(0, 3),
            base_dbp=72.0 + rng.normal(0, 2),
            base_spo2=98.8,
            base_temp=36.7 + rng.normal(0, 0.1),
            base_resp=14.0 + rng.normal(0, 0.5),
            base_hrv=58.0 + rng.normal(0, 4),
            base_glucose=90.0 + rng.normal(0, 3),   # N14
            base_sleep=7.7 + rng.normal(0, 0.2),    # N14
        ),
    ]
    return crew


class VitalsSimulator:
    """F011 Simulator Engine extended with N14 glucose and sleep."""

    def __init__(
        self,
        seed: int = DATA_GEN_SEED,
        crew: Optional[List[AstronautProfile]] = None,
        base_time: Optional[datetime] = None,
    ):
        self.seed = seed
        self.rng = np.random.RandomState(seed)
        self.crew = crew or get_default_crew(self.rng)
        self.base_time = base_time or datetime(2026, 11, 14, 0, 0, 0, tzinfo=timezone.utc)

    def generate_step(
        self,
        step_idx: int,
        step_seconds: float = 60.0,
        scenario_name: str = "nominal",
        hazard_active: bool = False,
    ) -> List[TelemetryRecord]:
        """Generates records for all crew members for a single time step."""
        current_time = self.base_time + timedelta(seconds=step_idx * step_seconds)
        time_iso = current_time.isoformat()
        hours_elapsed = (step_idx * step_seconds) / 3600.0
        time_of_day_hours = (hours_elapsed % 24.0)

        hazard: HazardProfile = SCENARIOS.get(scenario_name, SCENARIOS["nominal"])
        records: List[TelemetryRecord] = []

        # Circadian oscillations (24 hour period)
        # Nadir of HR and temp around 04:00 (phase shift = -4h)
        circadian_phase = 2.0 * math.pi * (time_of_day_hours - 4.0) / 24.0
        circadian_hr = 4.0 * math.cos(circadian_phase)
        circadian_temp = 0.3 * math.cos(circadian_phase)
        circadian_glucose = 5.0 * math.sin(circadian_phase)  # circadian glycemic rhythm

        for astronaut in self.crew:
            cid = astronaut.crew_id

            # Active hazard deltas (synthetic simulator assumptions)
            h_hr = hazard.hr_delta if hazard_active else 0.0
            h_sbp = hazard.sbp_delta if hazard_active else 0.0
            h_dbp = hazard.dbp_delta if hazard_active else 0.0
            h_spo2 = hazard.spo2_delta if hazard_active else 0.0
            h_temp = hazard.temp_delta if hazard_active else 0.0
            h_resp = hazard.resp_delta if hazard_active else 0.0
            h_hrv = hazard.hrv_delta if hazard_active else 0.0
            h_glucose = hazard.glucose_delta if hazard_active else 0.0
            h_sleep = hazard.sleep_delta if hazard_active else 0.0

            # Metric-specific anomaly labeling: only label 1 if this specific metric is perturbed
            def get_metric_label(delta: float) -> Tuple[int, Optional[str]]:
                if hazard_active and scenario_name != "nominal" and abs(delta) > 1e-4:
                    return 1, scenario_name
                return 0, None

            # 1. Heart rate (bpm)
            hr_val = astronaut.base_hr + circadian_hr + h_hr + self.rng.normal(0, 1.8)
            lbl_hr, tag_hr = get_metric_label(h_hr)
            records.append(
                TelemetryRecord(
                    ts=time_iso,
                    crew_id=cid,
                    metric="heart_rate",
                    value=None if self.rng.rand() < hazard.missingness_prob else round(float(hr_val), 1),
                    unit="bpm",
                    scenario=scenario_name,
                    synthetic_label=lbl_hr,
                    hazard_tag=tag_hr,
                    body_region="heart",
                )
            )

            # 2. Systolic & Diastolic BP (mmHg) - emitted intermittently (every 5 min)
            if step_idx % 5 == 0:
                sbp_val = astronaut.base_sbp + 0.5 * circadian_hr + h_sbp + self.rng.normal(0, 2.5)
                dbp_val = astronaut.base_dbp + 0.3 * circadian_hr + h_dbp + self.rng.normal(0, 1.8)
                lbl_sbp, tag_sbp = get_metric_label(h_sbp)
                lbl_dbp, tag_dbp = get_metric_label(h_dbp)
                records.append(
                    TelemetryRecord(
                        ts=time_iso,
                        crew_id=cid,
                        metric="systolic_bp",
                        value=None if self.rng.rand() < hazard.missingness_prob else round(float(sbp_val), 1),
                        unit="mmHg",
                        scenario=scenario_name,
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
                        value=None if self.rng.rand() < hazard.missingness_prob else round(float(dbp_val), 1),
                        unit="mmHg",
                        scenario=scenario_name,
                        synthetic_label=lbl_dbp,
                        hazard_tag=tag_dbp,
                        body_region="heart",
                    )
                )

            # 3. SpO2 (%)
            spo2_val = min(100.0, max(80.0, astronaut.base_spo2 + h_spo2 + self.rng.normal(0, 0.4)))
            lbl_spo2, tag_spo2 = get_metric_label(h_spo2)
            records.append(
                TelemetryRecord(
                    ts=time_iso,
                    crew_id=cid,
                    metric="spo2",
                    value=None if self.rng.rand() < hazard.missingness_prob else round(float(spo2_val), 1),
                    unit="%",
                    scenario=scenario_name,
                    synthetic_label=lbl_spo2,
                    hazard_tag=tag_spo2,
                    body_region="lungs",
                )
            )

            # 4. Body temperature (degC)
            temp_val = astronaut.base_temp + circadian_temp + h_temp + self.rng.normal(0, 0.08)
            lbl_temp, tag_temp = get_metric_label(h_temp)
            records.append(
                TelemetryRecord(
                    ts=time_iso,
                    crew_id=cid,
                    metric="body_temp",
                    value=None if self.rng.rand() < hazard.missingness_prob else round(float(temp_val), 2),
                    unit="degC",
                    scenario=scenario_name,
                    synthetic_label=lbl_temp,
                    hazard_tag=tag_temp,
                    body_region="whole_body",
                )
            )

            # 5. Respiration rate (breaths/min)
            resp_val = astronaut.base_resp + h_resp + self.rng.normal(0, 0.7)
            lbl_resp, tag_resp = get_metric_label(h_resp)
            records.append(
                TelemetryRecord(
                    ts=time_iso,
                    crew_id=cid,
                    metric="respiration_rate",
                    value=None if self.rng.rand() < hazard.missingness_prob else round(float(resp_val), 1),
                    unit="breaths/min",
                    scenario=scenario_name,
                    synthetic_label=lbl_resp,
                    hazard_tag=tag_resp,
                    body_region="lungs",
                )
            )

            # 6. HRV RMSSD (ms)
            hrv_val = max(5.0, astronaut.base_hrv + h_hrv + self.rng.normal(0, 3.5))
            lbl_hrv, tag_hrv = get_metric_label(h_hrv)
            records.append(
                TelemetryRecord(
                    ts=time_iso,
                    crew_id=cid,
                    metric="hrv_rmssd",
                    value=None if self.rng.rand() < hazard.missingness_prob else round(float(hrv_val), 1),
                    unit="ms",
                    scenario=scenario_name,
                    synthetic_label=lbl_hrv,
                    hazard_tag=tag_hrv,
                    body_region="heart",
                )
            )

            # 7. Glucose (mg/dL) [N14 requirement: 5-minute CGM cadence]
            if step_idx % 5 == 0:
                gluc_val = astronaut.base_glucose + circadian_glucose + h_glucose + self.rng.normal(0, 4.0)
                lbl_gluc, tag_gluc = get_metric_label(h_glucose)
                records.append(
                    TelemetryRecord(
                        ts=time_iso,
                        crew_id=cid,
                        metric="glucose",
                        value=None if self.rng.rand() < hazard.missingness_prob else round(float(gluc_val), 1),
                        unit="mg/dL",
                        scenario=scenario_name,
                        synthetic_label=lbl_gluc,
                        hazard_tag=tag_gluc,
                        body_region="gut",
                    )
                )

            # 8. Sleep hours (hours) [N14 requirement: Daily morning sleep-log check-in]
            # Emitted at diurnal waking step (7:00 AM or step 0 for day 1, then every 1440 min)
            if step_idx == 0 or (step_idx % 1440 == 420):
                sleep_val = max(1.0, min(14.0, astronaut.base_sleep + h_sleep + self.rng.normal(0, 0.3)))
                lbl_sleep, tag_sleep = get_metric_label(h_sleep)
                records.append(
                    TelemetryRecord(
                        ts=time_iso,
                        crew_id=cid,
                        metric="sleep_hours",
                        value=None if self.rng.rand() < hazard.missingness_prob else round(float(sleep_val), 2),
                        unit="hours",
                        scenario=scenario_name,
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
        for step in range(total_steps):
            hazard_active = (hazard_start_step is not None and step >= hazard_start_step)
            for rec in self.generate_step(
                step_idx=step,
                step_seconds=step_seconds,
                scenario_name=scenario_name,
                hazard_active=hazard_active,
            ):
                yield rec

    def generate_jsonl(
        self,
        output_path: Path,
        total_steps: int = 120,
        step_seconds: float = 60.0,
        scenario_name: str = "nominal",
        hazard_start_step: Optional[int] = None,
    ) -> int:
        """Deterministic batch generator writing to JSONL file."""
        output_path.parent.mkdir(parents=True, exist_ok=True)
        count = 0
        with open(output_path, "w", encoding="utf-8") as f:
            for rec in self.stream_records(
                total_steps=total_steps,
                step_seconds=step_seconds,
                scenario_name=scenario_name,
                hazard_start_step=hazard_start_step,
            ):
                f.write(json.dumps(rec.to_dict()) + "\n")
                count += 1
        return count
