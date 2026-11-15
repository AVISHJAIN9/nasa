"""AstroCare Core Configuration and Metric Registry.

Decision-support prototype on synthetic and public data.
NOT a medical device. No clinical diagnosis claims.
"""
from dataclasses import dataclass
from typing import Dict, Optional, Tuple


# Global reproducible seeds and versioning
DATA_GEN_SEED: int = 42
SPLIT_SEED: int = 2026
MODEL_SEED: int = 1337
CONFIG_VERSION: str = "v2.1.0-spaceapps"


@dataclass(frozen=True)
class MetricDefinition:
    name: str
    unit: str
    nominal_min: float
    nominal_max: float
    critical_low: Optional[float]
    critical_high: Optional[float]
    typical_sigma: float
    measurement_cadence_sec: float
    body_region: str
    description: str


# Comprehensive Metric Registry for Continuous & Intermittent Monitoring
METRIC_REGISTRY: Dict[str, MetricDefinition] = {
    "heart_rate": MetricDefinition(
        name="heart_rate",
        unit="bpm",
        nominal_min=55.0,
        nominal_max=95.0,
        critical_low=40.0,
        critical_high=130.0,
        typical_sigma=2.5,
        measurement_cadence_sec=1.0,
        body_region="heart",
        description="Resting and active heart rate in beats per minute"
    ),
    "systolic_bp": MetricDefinition(
        name="systolic_bp",
        unit="mmHg",
        nominal_min=95.0,
        nominal_max=135.0,
        critical_low=80.0,
        critical_high=160.0,
        typical_sigma=3.5,
        measurement_cadence_sec=300.0,
        body_region="heart",
        description="Systolic arterial blood pressure"
    ),
    "diastolic_bp": MetricDefinition(
        name="diastolic_bp",
        unit="mmHg",
        nominal_min=60.0,
        nominal_max=85.0,
        critical_low=50.0,
        critical_high=100.0,
        typical_sigma=2.5,
        measurement_cadence_sec=300.0,
        body_region="heart",
        description="Diastolic arterial blood pressure"
    ),
    "spo2": MetricDefinition(
        name="spo2",
        unit="%",
        nominal_min=95.0,
        nominal_max=100.0,
        critical_low=88.0,
        critical_high=None,
        typical_sigma=0.5,
        measurement_cadence_sec=1.0,
        body_region="lungs",
        description="Peripheral capillary oxygen saturation"
    ),
    "body_temp": MetricDefinition(
        name="body_temp",
        unit="degC",
        nominal_min=36.2,
        nominal_max=37.5,
        critical_low=35.0,
        critical_high=38.5,
        typical_sigma=0.12,
        measurement_cadence_sec=60.0,
        body_region="whole_body",
        description="Core body temperature"
    ),
    "respiration_rate": MetricDefinition(
        name="respiration_rate",
        unit="breaths/min",
        nominal_min=12.0,
        nominal_max=20.0,
        critical_low=8.0,
        critical_high=28.0,
        typical_sigma=0.8,
        measurement_cadence_sec=5.0,
        body_region="lungs",
        description="Spontaneous breathing rate"
    ),
    "hrv_rmssd": MetricDefinition(
        name="hrv_rmssd",
        unit="ms",
        nominal_min=25.0,
        nominal_max=85.0,
        critical_low=12.0,
        critical_high=None,
        typical_sigma=5.0,
        measurement_cadence_sec=60.0,
        body_region="heart",
        description="Root mean square of successive RR interval differences"
    ),
    # N14 Simulator additions:
    "glucose": MetricDefinition(
        name="glucose",
        unit="mg/dL",
        nominal_min=70.0,
        nominal_max=140.0,
        critical_low=54.0,
        critical_high=220.0,
        typical_sigma=5.0,
        measurement_cadence_sec=300.0,
        body_region="gut",
        description="Blood glucose concentration (intermittent/CGM proxy)"
    ),
    "sleep_hours": MetricDefinition(
        name="sleep_hours",
        unit="hours",
        nominal_min=6.5,
        nominal_max=8.5,
        critical_low=4.0,
        critical_high=12.0,
        typical_sigma=0.4,
        measurement_cadence_sec=86400.0,
        body_region="brain",
        description="Daily accumulated sleep duration"
    ),
}
