# AstroCare: NASA Space Apps Decision-Support Prototype (Audited ML1 & ML2 Suite)

> [!CAUTION]
> **SYNTHETIC PRELIMINARY PROTOTYPE — DO NOT USE AS CLINICAL EVIDENCE.**
> AstroCare is an engineering decision-support prototype built on synthetic telemetry and publicly licensed spaceflight literature. It is **NOT** a certified medical device, does not provide autonomous clinical diagnoses, and does not replace a Flight Surgeon or Crew Medical Officer. All telemetry labels are synthetic simulation proxies.

---

## 1. Quickstart & Verification Commands

```bash
# 1. Run master scientific evaluation harness (LOPO, LOSO, F041, X01, X06, 4-person demo)
python -m eval_runner
# or
make eval

# 2. Run unit test suite (75 passing tests)
python -m pytest tests -v
# or
make test

# 3. Verify Evaluation Splits and Cryptographic Hashes (fails on corruption)
python -m astrocare.evaluation.splits

# 4. Run four-person live telemetry demonstration
python -m astrocare.benchmarks.demo_four_person
```

---

## 2. Architecture & Status Summary

### ML1 Pipeline (Telemetry, Bayesian Filtering, Anomaly Detection)
- **F011 & N14 Simulator Engine (`astrocare/simulator/engine.py`):**
  - Generates multi-crew physiological streams with circadian rhythm and intentional hazard effects.
  - Emits `glucose` (mg/dL) and `sleep_hours` (hours, daily cumulative check-in) alongside HR, BP, SpO2, temp, resp, and HRV.
  - Deterministic seeded generator (`DATA_GEN_SEED=42`).
  - Metric-specific anomaly labeling: only perturbed metrics are labeled anomalous.
- **Evaluation Design & Split Freeze (`astrocare/evaluation/splits.py`):**
  - Strict Leave-One-Person-Out (LOPO) across 4 crew members (`ASTRO-01` to `ASTRO-04`).
  - Strict Leave-One-Scenario-Out (LOSO) across 6 hazard scenario families.
  - Frozen assignments, seeds, and SHA-256 digest stored in `artifacts/splits/frozen_eval_splits_v2.json`.
  - Silent regeneration is strictly forbidden; fails with an error if missing or corrupted.
- **X02 Bayesian Baseline (`astrocare/models/x02_bayesian.py`):**
  - Local-trend NumPy Kalman filter ($x_t = [\mu_t, v_t]^T$) with dynamic $\Delta t$ computed from ISO-8601 timestamps.
  - Partial pooling with crew priors estimated strictly from training-fold astronauts.
  - Personalized `p_deviation` computed against personal baseline tolerance bounds.
  - `time_to_critical_min` (p10, p50, p90) computed via state uncertainty propagation.
- **F041 Anomaly Detection Ensemble (`astrocare/models/f041_anomaly.py`):**
  - Isolation Forest, Rolling Median/MAD (F018), and Fixed Threshold evaluated on **identical feature inputs** on held-out LOSO scenario folds.
  - Calibration performed on independent validation nominal stream; empirical test FPR reported transparently.
- **F043 Monotone Health Risk Score (`astrocare/models/f043_risk_score.py`):**
  - Two-sided physiological distress features with strict monotonic constraints in LightGBM.
  - Calibrated continuous risk scoring across 20 clinically ordered edge cases without saturation.
  - Gated deployment strictly contingent on verified F041 equal-FAR acceptance.
- **F047 / F098 / N16 Alert Explanation Pipeline (`astrocare/models/f047_explanation.py`):**
  - Generates structured, deterministic explanations for 100% of triggered anomaly alerts.
  - Pulls verified, direction-aware action lines from audited N13 Indicator Cards.
- **F012 Real Dataset Replay Loaders (`astrocare/data/f012_replay.py`):**
  - Concrete loaders for PhysioNet MMASH and NASA OSDR OSD-575 Inspiration4 datasets.
  - Parses real local CSV fixtures with verified SHA-256 digests and explicit provenance/licensing terms.
- **F147 Scientific Research Report Auto-Generator (`astrocare/evaluation/report_generator.py`):**
  - Fully automated, data-driven Markdown research report built directly from machine-readable evaluation summaries.

### ML2 Pipeline (Knowledge Base, RAG, Safety, Policy)
- **F056 Knowledge Base & N13 Indicator Cards (`astrocare/knowledge/`):**
  - 39 authentic, deduplicated chunks derived directly from NASA HRP Evidence Books, NASA-STD-3001, and Canadian Space Agency resources.
  - Provenance: Cryptographic document identity hashes, source URLs, access dates (2026-11-14).
  - Data-use terms: NASA Public Domain (17 U.S.C. § 105); CSA Crown Copyright (non-commercial personal/educational use permitted with attribution; commercial redistribution requires permission).
  - 8 indicator cards (`heart_rate`, `blood_pressure`, `blood_glucose`, `body_temp`, `sleep`, `mood`, `radiation_dose`, `cabin_co2`) marked `PENDING_MEDICAL_REVIEW`.
- **F055 RAG & F057 Cloud/Local Router (`astrocare/assistant/`):**
  - Top-3 chunk retrieval with cosine similarity scoring.
  - Below-threshold or unsupported questions reply strictly: `I do not know.`
  - Edge fallback: Deterministic keyword-retrieval rule engine (full quantized edge LLM integration like Ollama is pending).
- **F059 Citation Checker & F058/N17 Safety Layer (`astrocare/assistant/`):**
  - Claim-level citation verification.
  - Medical safety guardrail rejecting clinical diagnosis claims and unsafe prescriptions.
  - Emergency detector with immediate `EMERGENCY_ESCALATION` directive to Flight Surgeon.
  - 50-prompt red-team suite tested with 0 critical safety failures.
- **X01 Wait-or-Act Decision Engine (`astrocare/policy/x01_wait_or_act.py`):**
  - Consumes real X02 Kalman filter predictions on simulated incident trajectories under F070 communication round-trip delay ($0, 2, 10, 20, 44$ min).

---

## 3. Hour-6 Frozen Contract Handoff
- Schema definition: `astrocare/models/registry.py`
- JSON Schema file: `artifacts/handoff/x02_contract_schema.json`
- Sample payload: `artifacts/handoff/x02_sample_payload.json`
- Handoff note: `artifacts/handoff/x02_hour6_handoff_note.md`
