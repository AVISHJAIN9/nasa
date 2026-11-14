# AstroCare X02 Hour-6 Schema and Contract Handoff

**To:** Backend (BE1), Decision Engine (ML2), and Frontend (FE)  
**From:** ML1 Implementation Engineer  
**Date:** 2026-11-14 (Hour 6 Milestone)  
**Status:** Frozen Contract, Usable Implementation Ready

---

## 1. Executive Summary

This document freezes the shared JSON output contract for feature **X02: Per-Astronaut Bayesian Baseline (N-of-1 Kalman Filter)**. This schema provides the foundation for downstream risk detection, decision support (X01), and UI visualization.

Contract schema definition: `astrocare/models/registry.py`  
JSON Schema reference: `artifacts/handoff/x02_contract_schema.json`  
Sample payload: `artifacts/handoff/x02_sample_payload.json`

## 2. Frozen Schema Specification

```json
{
  "crew_id": "string",
  "metric": "string",
  "ts": "ISO-8601 UTC timestamp",
  "mean": "number",
  "lo90": "number",
  "hi90": "number",
  "p_deviation": "number in [0, 1]",
  "time_to_critical_min": {
    "p10": "number or null",
    "p50": "number or null",
    "p90": "number or null"
  }
}
```

### Strict Validation Invariants
1. `lo90 <= mean <= hi90`: The nominal 90% predictive interval strictly brackets the predictive mean.
2. `time_to_critical_min` non-negative ordering: If not null, `0 <= p10 <= p50 <= p90`.
3. Native units: `mean`, `lo90`, and `hi90` are reported in the metric's native units (bpm, mg/dL, mmHg, etc.) according to `METRIC_REGISTRY`.
4. Causal: The prediction for timestamp `ts` is generated using information available *before* the measurement at `ts` is updated into the filter.
5. Missing values: Missing or dropped sensor readings (`None`) do not produce fake values or alerts; the filter advances state prediction and widens predictive uncertainty ($P$).

## 3. Metric Registry Reference

All metric units and critical limits are governed by `astrocare/config.py:METRIC_REGISTRY`. Key metrics:
- `heart_rate`: bpm (nominal 55-95, critical limits [40, 130])
- `systolic_bp`: mmHg (nominal 95-135, critical limits [80, 160])
- `diastolic_bp`: mmHg (nominal 60-85, critical limits [50, 100])
- `spo2`: % (nominal 95-100, critical low 88)
- `body_temp`: degC (nominal 36.2-37.5, critical limits [35.0, 38.5])
- `respiration_rate`: breaths/min (nominal 12-20, critical limits [8, 28])
- `hrv_rmssd`: ms (nominal 25-85, critical low 12)
- `glucose`: mg/dL [N14] (nominal 70-140, critical limits [54, 220])
- `sleep_hours`: hours [N14] (nominal 6.5-8.5, critical limits [4.0, 12.0])

## 4. Usage Note

Consumers can instantiate and run X02 filters as follows:

```python
from astrocare.models.x02_bayesian import X02AstronautMetricFilter, fit_crew_prior

# 1. Fit prior from historical or training astronauts
prior = fit_crew_prior(training_observations={"ASTRO-02": [70, 72], "ASTRO-03": [68, 71]}, metric_name="heart_rate")

# 2. Instantiate filter for astronaut
flt = X02AstronautMetricFilter(crew_id="ASTRO-01", metric="heart_rate", prior=prior)

# 3. Stream or step observations
output = flt.step(value=74.5, ts="2026-11-14T08:00:00Z")
payload = output.to_dict()
```

## 5. Known Limitations & Disclaimer
- **Prototype Status:** Decision-support prototype on synthetic and public data. Not a certified medical device.
- **Simulation Data:** Telemetry is synthetic and generated for technical evaluation; does not represent clinical ground truth.
- **Forecasting Horizon:** `time_to_critical_min` returns `null` if the state trajectory does not project a crossing within the 120-minute horizon or if drift is away from the boundary.
