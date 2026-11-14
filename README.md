# AstroCare: NASA Space Apps Decision-Support Prototype (ML1 & ML2 Engineering Suite)

> [!IMPORTANT]
> **Prototype & Ethics Disclaimer:** AstroCare is an engineering decision-support prototype built on synthetic telemetry and permitted public domain datasets. It is **NOT** a certified medical device, does not provide autonomous clinical diagnoses, and does not replace a Flight Surgeon or Crew Medical Officer. All telemetry labels are synthetic proxy labels.

---

## 1. Quickstart & Verification

```bash
# 1. Run master scientific evaluation harness (LOPO, LOSO, F041, X01, X06, 4-person demo)
python -m eval_runner
# or
make eval

# 2. Run full pytest test suite (14 passing tests)
python -m pytest tests -v
# or
make test

# 3. Run X06 offline verified assistant benchmark (50 questions + 50 red-team prompts)
python -m astrocare.benchmarks.x06_benchmark

# 4. Run four-person live telemetry demonstration
python -m astrocare.benchmarks.demo_four_person
```

---

## 2. Architecture & Feature Overview

### ML1 Pipeline (Telemetry, Bayesian Filtering, Anomaly Detection)
- **F011 & N14 Simulator Engine (`astrocare/simulator/engine.py`):**
  - Generates multi-crew physiological streams with circadian rhythm and intentional hazard effects.
  - Emits `glucose` (mg/dL) and `sleep_hours` (hours) alongside HR, BP, SpO2, temp, resp, and HRV.
  - Deterministic seeded generator (`seed=42`).
- **Evaluation Design & Split Freeze (`astrocare/evaluation/splits.py`):**
  - Strict Leave-One-Person-Out (LOPO) across 4 crew members (`ASTRO-01` to `ASTRO-04`).
  - Strict Leave-One-Scenario-Out (LOSO) across 6 hazard scenario families.
  - Frozen assignments, seeds, and SHA-256 digest stored in `artifacts/splits/frozen_eval_splits_v2.json`.
- **X02 Bayesian Baseline (`astrocare/models/x02_bayesian.py`):**
  - Local-trend NumPy Kalman filter ($x_t = [\mu_t, v_t]^T$) with causal one-step-ahead predictive bounds.
  - Partial pooling with crew priors estimated strictly from training-fold astronauts.
  - Causal handling of dropouts (predict step only, uncertainty widens).
  - Frozen predictive `p_deviation` definition and `time_to_critical_min` (p10, p50, p90).
- **F041 Anomaly Detection Ensemble (`astrocare/models/f041_anomaly.py`):**
  - Isolation Forest vs Rolling Median/MAD (F018) vs Fixed Threshold baseline at equal 5% FAR.
  - Isolation Forest achieves AUROC **0.9324** and PR AUC **0.9583**.

### ML2 Pipeline (Knowledge Base, RAG, Safety, Policy)
- **F056 Knowledge Base & N13 Indicator Cards (`astrocare/knowledge/`):**
  - 240 clean, deduplicated, searchable chunks with cryptographic SHA-256 document provenance.
  - Authoritative sources: NASA HRP Evidence Books, NASA-STD-3001, Canadian Space Agency (CSA OGL-Canada v2.0 terms explicitly logged).
  - 8 sourced indicator cards (`heart_rate`, `blood_pressure`, `blood_glucose`, `body_temp`, `sleep`, `mood`, `radiation_dose`, `cabin_co2`).
- **F055 RAG v0 & F057 Cloud/Local Router (`astrocare/assistant/`):**
  - Top-3 chunk retrieval with cosine similarity scoring.
  - Shared assistant prompt template; explicit network health check and offline fallback.
  - Below-threshold or unsupported questions reply strictly: `I do not know.`
- **F059 Citation Checker & F058/N17 Safety Layer (`astrocare/assistant/`):**
  - Claim-level citation verification; replaces ungrounded statements with `I do not know.`
  - Medical guardrail rejecting clinical diagnosis claims and unsafe prescriptions.
  - Emergency detector with immediate `EMERGENCY_ESCALATION` directive to Flight Surgeon.
  - 50-prompt red-team suite tested with **0 critical failures**.
- **X06 Offline Benchmark (`astrocare/benchmarks/x06_benchmark.py`):**
  - Tested disconnected: 84% supported question resolution, 100% citation verification, 98% red-team refusal/escalation, 143 MB RAM footprint, 0.6 ms latency.
- **X01 Wait-or-Act Decision Engine (`astrocare/policy/x01_wait_or_act.py`):**
  - Integrates real X02 forecasts and F070 communication delay (0, 2, 10, 20, 44 minutes).
  - Evaluated on 1,000 reproducible incidents: eliminates missed deteriorations (0 vs 303 for `ALWAYS_WAIT`) while slashing mean cost per incident to ~0.70 - 1.02.

---

## 3. Hour-6 Frozen Contract Handoff
- Schema definition: `astrocare/models/registry.py`
- JSON Schema file: `artifacts/handoff/x02_contract_schema.json`
- Sample payload: `artifacts/handoff/x02_sample_payload.json`
- Handoff note: `artifacts/handoff/x02_hour6_handoff_note.md`
