# AstroCare ML1 Build Specification and Source Inventory

**Document Version:** 1.0.0-ML1  
**Project:** AstroCare Decision-Support Prototype (NASA Space Apps Challenge)  
**Scope:** Machine Learning Track 1 (ML1) — Simulator Extensions, Evaluation Protocol, Bayesian State-Space Baseline (X02), and Unsupervised Anomaly Detection (F041).  
**Explicit Protection:** F043 (LightGBM Risk Score) and ML2 features are decoupled and out of scope for ML1 model fitting.  
**Ethics & Medical Disclaimer:** AstroCare is a decision-support prototype built on synthetic telemetry and permitted public reference datasets. It is **NOT** a certified medical device, does not provide autonomous clinical diagnoses, and does not replace a Flight Surgeon or Crew Medical Officer. All telemetry labels are synthetic proxy labels.

---

## 1. Executive Summary & Build Order

The ML1 track implements the core telemetry generation, personalized Bayesian physiological tracking, and unsupervised anomaly detection for AstroCare. To prevent circular evaluation—where simulator-generated labels artificially inflate performance metrics on identical test distributions—the build order strictly separates data generation, split freezing, and baseline calibration.

### Phased Build Order
1. **Prompt 0 — System Inspection & Data Source Inventory:**
   - Catalog all authoritative spaceflight reference documentation and prospective public measurement datasets.
   - Establish strict boundaries: reference literature provides domain context, never raw measurement values.
2. **Prompt 1 — Evaluation Design & Split Freezing:**
   - Define Leave-One-Person-Out (LOPO) across crew members and Leave-One-Scenario-Out (LOSO) across hazard scenario families.
   - Cryptographically lock split assignments, seeds, and dataset hashes in `artifacts/splits/frozen_eval_splits_v2.json` before any model fitting or threshold calibration.
3. **Prompt 2 — Simulator Additions (N14):**
   - Extend the F011 vitals simulator to emit `glucose` (mg/dL) and `sleep_hours` (hours) alongside continuous vitals.
   - Ensure 100% deterministic reproducibility under identical configuration and seed.
4. **Prompt 3 — Bayesian Baseline (X02) & Schema Handoff:**
   - Implement a lightweight, causal NumPy Kalman filter ($x_t = [\mu_t, v_t]^T$) with partial pooling against crew priors.
   - Freeze the X02 output schema for consumer integration (Hour 6 handoff to BE1 and ML2).
5. **Prompt 4 — X02 Evaluation against Baselines:**
   - Evaluate predictive 90% band coverage, detection latency, and Brier calibration against F018 rolling median/MAD and fixed thresholds on held-out folds.
6. **Prompt 5 — Unsupervised Anomaly Detection (F041):**
   - Implement Isolation Forest, Robust Z-score, and Fixed-threshold baselines evaluated at an equal calibrated false-alarm rate (FAR) on held-out LOSO scenarios.
7. **Prompt 6 — Handoff & Reproducibility Summary:**
   - Verify all figures, JSON summaries, and markdown reports link to unique `make eval` run IDs.

---

## 2. Current Project Structure & Interface Contracts

### Repository Organization
- **Root:** `C:\Users\ABHISHEK\AstroCare\`
- **Configuration & Metric Registry:** `astrocare/config.py`
  - Defines `METRIC_REGISTRY` covering units, nominal ranges, critical bounds, typical $\sigma$, and measurement cadences.
- **Simulator Module:** `astrocare/simulator/`
  - `engine.py`: Multi-crew telemetry generator emitting `TelemetryRecord` instances.
  - `hazards.py`: Hazard scenario profiles (confinement, cabin $\text{CO}_2$ leak, radiation storm, hypoglycemia, hyperglycemia, microgravity adaptation).
- **Evaluation Harness & Splits:** `astrocare/evaluation/`
  - `splits.py`: LOPO and LOSO fold generator and SHA-256 verifier.
  - `harness.py`: Master evaluator generating metrics, JSON summaries, and plots with unique run IDs.
- **Model Implementations:** `astrocare/models/`
  - `registry.py`: Pydantic v2 validation contracts for X02 outputs and time-to-critical quantiles.
  - `x02_bayesian.py`: Per-astronaut Kalman filter with partial pooling.
  - `baselines.py`: Fixed-threshold and F018 rolling median/MAD (Robust Z-score) implementations.
  - `f041_anomaly.py`: Isolation Forest, Robust-Z, and Fixed-threshold detector ensemble with equal-FAR calibration.
- **Artifacts:**
  - `artifacts/splits/`: Versioned evaluation split manifests.
  - `artifacts/handoff/`: Hour 6 X02 schema, sample payload, and integration guide.
  - `artifacts/eval_results/`: Machine-readable evaluation outputs, markdown reports, and generated figures.

### Agreed Frozen X02 Output Schema
The JSON output contract is frozen in `artifacts/handoff/x02_contract_schema.json` and validated by `X02BaselineOutput` in `astrocare/models/registry.py`:

```json
{
  "crew_id": "string",
  "metric": "string",
  "ts": "ISO-8601 UTC timestamp",
  "mean": "number",
  "lo90": "number",
  "hi90": "number",
  "p_deviation": "number from 0 to 1",
  "time_to_critical_min": {
    "p10": "number or null",
    "p50": "number or null",
    "p90": "number or null"
  }
}
```

#### Strict Contract Invariants:
1. `lo90 <= mean <= hi90`: Predictive mean is strictly enclosed within the 90% predictive interval.
2. `mean`, `lo90`, `hi90` are expressed in native units (e.g., bpm, mg/dL, mmHg, hours).
3. `time_to_critical_min`: Quantiles are non-negative and strictly ordered (`0 <= p10 <= p50 <= p90`). Returns `null` if the state trajectory does not project a crossing within the 120-minute horizon.
4. Causal Execution: Predictions for timestamp `ts` utilize only observations preceding `ts`.
5. Missing Data Behavior: Missing sensor inputs (`None`) advance the state prediction and widen state uncertainty ($P$), without fabricating imputations.

---

## 3. Reference Pages vs. Measurement Data Inventory

A core scientific principle of AstroCare is maintaining strict separation between **informational reference pages** (used for hazard context and clinical logic) and **empirical measurement datasets** (used for quantitative validation).

### A. Authoritative Spaceflight Reference Pages (Informational Only)

These sources inform scenario definitions, thresholds, and clinical decision-support logic. They **do not** contain downloadable time-series patient measurements:

| Title | Organization | URL | Date Accessed | Relevant Context & Findings | Stated Licence / Data-Use Terms |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **5 Hazards of Human Spaceflight** | NASA Human Research Program | `https://www.nasa.gov/hrp/hazards/` | 2026-11-14 | Outlines the RIDGE framework: Space Radiation (GCR, SPE), Isolation & Confinement (sleep debt, circadian disruption), Distance from Earth (communication latency, autonomous care requirement), Gravity Fields (fluid shifts, bone/muscle loss, SANS), Hostile Closed Environments (elevated cabin $\text{CO}_2$, toxic exposures). | Public Domain (U.S. Government Work, 17 U.S.C. § 105). No commercial restriction. |
| **Risks of Human Spaceflight** | NASA Human Research Program | `https://www.nasa.gov/hrp/risks/` | 2026-11-14 | Catalogs official HRP risk posture: adverse health effects from hostile cabin atmospheres, cardiac rhythm alterations in microgravity, hypothermia/hyperthermia, and impaired performance from fatigue. | Public Domain (U.S. Government Work, 17 U.S.C. § 105). |
| **Ongoing HRP Research** | NASA Human Research Program | `https://www.nasa.gov/hrp/ongoing-hrp-research/` | 2026-11-14 | Details active exploration clinical protocols, behavioral health monitoring tools, exploration medical capability standards, and small-crew Bayesian analytical frameworks. | Public Domain (U.S. Government Work, 17 U.S.C. § 105). |
| **Monitoring radiation for astronaut health** | Canadian Space Agency (CSA) | `https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp` | 2026-11-14 | Details real-time personal radiation dosimeters, biological biodosimetry, cellular damage risks during deep-space exploration, and storm shelter protocols. | Open Government Licence - Canada (OGL-Canada v2.0). Reproduction permitted with explicit attribution; non-commercial and commercial use permitted. |
| **Why do we conduct science experiments in space?** | Canadian Space Agency (CSA) | `https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp` | 2026-11-14 | Explains microgravity physiology: accelerated bone loss, cardiovascular deconditioning, impaired vascular reflexes, and the development of autonomous medical technologies for remote environments. | Open Government Licence - Canada (OGL-Canada v2.0). Reproduction permitted with explicit attribution. |

---

### B. Empirical Measurement Datasets Inventory (Quantitative Telemetry)

| Dataset Name | Source / Maintainer | Access Terms & Population | Metric Coverage | Limitations & Scope Boundaries |
| :--- | :--- | :--- | :--- | :--- |
| **PhysioNet MMASH** | PhysioNet / Bioengineering Consortium | Open access under PhysioNet Credentialed / Open Health Data License. 22 healthy terrestrial adults. | Continuous RR intervals / Heart Rate (Polar H10), Actigraphy (wrist accelerometer), subjective sleep logs. | **NOT astronaut data.** Does **not** contain continuous glucose, blood pressure, or cabin environment readings. Valid for validating nocturnal HRV and sleep/wake transition baselines only. |
| **NASA OSDR Inspiration4** | NASA Open Science Data Repository | Public access subject to OSDR Data Use Agreement and Human Subject Privacy guidelines. 4 commercial spaceflight astronauts. | Pre/post-flight multi-omics, intermittent vitals, sleep surveys, limited actigraphy. | **Intermittent sampling.** Mission duration was only 3 days in LEO. Lacks continuous long-duration time-series telemetry required for 44-minute Mars latency simulations. |
| **OhioT1DM** | Ohio University (Type 1 Diabetes Research) | Restricted academic access under Ohio University Data Use Agreement (DUA). Terrestrial Type 1 diabetes cohort. | Continuous Glucose Monitoring (CGM) sampled at 5-minute intervals, insulin bolus/basal logs, meal carbohydrate estimates. | **Clinical terrestrial diabetes cohort.** Not healthy astronauts; subject to exogenous insulin perturbations. May be referenced strictly to model CGM sensor noise characteristics, **never** claimed as spaceflight-validated. |
| **AstroCare F011 Synthetic Simulator** | AstroCare Repository (`astrocare/simulator/`) | Fully open, fully reproducible local synthetic generator (`DATA_GEN_SEED=42`). | Heart Rate, Systolic BP, Diastolic BP, $\text{SpO}_2$, Body Temp, Respiration, HRV RMSSD, Glucose (N14), Sleep Hours (N14). | **Synthetic proxy data.** Provides controlled hazard injection (hypercapnia, confinement, SPE, acute hypoglycemia) for unbiased, non-circular LOPO/LOSO algorithmic benchmarking. |

---

## 4. Evaluation Methodology: Preventing Circular Validation

### The Scientific Risk of Circular Evaluation
When a synthetic simulator generates both the physiological telemetry and the ground truth labels, machine learning models trained on random train/test splits easily overfit simulator artifacts (e.g., exact mathematical sinusoids or step changes). This produces artificially inflated AUROC metrics that collapse when exposed to unseen individuals or novel hazard profiles.

### Enforced LOPO and LOSO Protocols
1. **Leave-One-Person-Out (LOPO):**
   - 4 cross-validation folds: `ASTRO-01`, `ASTRO-02`, `ASTRO-03`, `ASTRO-04`.
   - Each fold excludes 100% of the held-out astronaut's records from prior estimation and parameter tuning.
   - **Cold-Start Evaluation:** The held-out astronaut is initialized strictly at the crew prior estimated from the remaining 3 astronauts.
   - **Online-Calibration Evaluation:** A fixed, pre-declared warm-up window of 30 unlabeled past observations is provided before scoring. Future observations and test labels are never accessible.
2. **Leave-One-Scenario-Out (LOSO):**
   - 6 hazard folds: `cabin_co2_leak`, `isolation_confinement`, `radiation_solar_event`, `metabolic_hypoglycemia`, `metabolic_hyperglycemia`, `microgravity_adaptation`.
   - Models are calibrated on nominal and non-held-out scenarios, then evaluated on the complete unseen scenario family.
   - Prevents scenario leakage: models do not know the scenario ID or injected hazard tags.

---

## 5. Verification Commands & Acceptance Criteria

To verify the ML1 implementation locally:

```bash
# 1. Run the Master Evaluation Suite (LOPO, LOSO, Equal-FAR Baselines, 4-Person Demo)
python -m eval_runner
# or
make eval

# 2. Run the Full Unit Test Suite (14 unit tests passing)
python -m pytest tests -v
# or
make test

# 3. Verify Evaluation Splits and Cryptographic Hashes
python -m astrocare.evaluation.splits

# 4. Run the 4-Person Live Causal Demonstration
python -m astrocare.benchmarks.demo_four_person
```

### Acceptance Criteria Checklist
- [x] Evaluation split artifact saved before model fitting (`artifacts/splits/frozen_eval_splits_v2.json`).
- [x] N14 simulator emits `glucose` (mg/dL) and `sleep_hours` (hours) deterministically.
- [x] X02 outputs strictly conform to `lo90 <= mean <= hi90` and ordered `time_to_critical_min`.
- [x] Partial pooling demonstrated: data-thin astronaut (ASTRO-04) shrinks to crew prior.
- [x] F041 Isolation Forest evaluated at equal false-alarm rate against rolling robust-z and fixed thresholds.
- [x] All generated figures attach reproducible run IDs matching JSON summaries and Markdown reports.
- [x] F043 (LightGBM risk score) is explicitly untouched and out of scope.
