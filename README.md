# AstroCare: Autonomous Deep-Space Medical Decision Support Platform

> [!CAUTION]
> **SYNTHETIC PRELIMINARY PROTOTYPE — DO NOT USE AS CLINICAL EVIDENCE.**
> AstroCare is an engineering decision-support prototype built on synthetic telemetry and publicly licensed spaceflight literature (NASA Space Apps Challenge 2026). It is **NOT** a certified medical device, does not provide autonomous clinical diagnoses, and does not replace a Flight Surgeon or Crew Medical Officer. All telemetry labels are synthetic simulation proxies.

---

## 1. System Overview

AstroCare provides autonomous medical surveillance and decision-support for deep-space human spaceflight missions (ISS Low Earth Orbit, Lunar Artemis base, and Mars Transit / Surface operations). When communication round-trip latency reaches up to **44 minutes** (22 minutes one-way), terrestrial telemedicine cannot perform real-time triage. AstroCare provides:
- **Local Client-Side Health Surveillance:** Real-time 3D anatomical pain mapping, optical rPPG camera pulse extraction, and multi-modal passive telemetry monitoring.
- **Audited ML1 Intelligence Engine:** Causal 2-state Kalman baseline filtering (X02), multi-model anomaly detection ensemble (F041), monotone health risk scoring (F043), and sourced clinical action lines from N13 Indicator Cards (F047).
- **Autonomous Operational Policy (X01):** Mathematically optimal "Wait-or-Act" policy minimizing expected health loss across variable communication latencies.
- **Offline-First Resilience:** Local edge assistant with sentence-level citation verification, emergency escalation directives, and store-and-forward offline synchronization.

---

## 2. Platform Architecture

```
                    +------------------------------------+
                    |  AstroCare Web Client (Port 3006)  |
                    |   (React 19 + Vite 6 + Tailwind)   |
                    +-----------------+------------------+
                                      |
                     /api/v1/clinical | /api/v1/assess, /v1/telemetry, /v1/space-weather
                                      |
       +------------------------------+-------------------------------+
       |                                                              |
       v                                                              v
+-------------------------------+                     +-------------------------------+
|     Node.js Clinical Core     |                     |  FastAPI Intelligence Engine  |
|          (Port 8000)          |                     |          (Port 8001)          |
| - SOAP Clinical Notes         |                     | - POST /assess                |
| - Medical Inventory & Kits    |                     | - WebSocket /ws/telemetry     |
| - Static Clinical Protocols   |                     | - WebSocket /ws/alerts        |
+---------------+---------------+                     +---------------+---------------+
                |                                                     |
                v                                                     v
+-------------------------------+                     +-------------------------------+
|     MongoDB 7.0 (NoSQL)       |                     |  TimescaleDB / Postgres 16    |
|          (Port 27018)         |                     |          (Port 5433)          |
| - Unstructured Clinical Docs  |                     | - High-Freq Telemetry Streams |
| - Medical Dispensary Catalog  |                     | - Digital Twin Daily States   |
+-------------------------------+                     +---------------+---------------+
                                                                      |
                                                                      v
                                                      +-------------------------------+
                                                      |      Audited ML1 Engine       |
                                                      |         (`astrocare/`)        |
                                                      | - X02 2-State Kalman Filter   |
                                                      | - F041 Anomaly Ensemble       |
                                                      | - F043 Monotone Risk Score    |
                                                      | - F047 Sourced Explanations   |
                                                      +-------------------------------+
```

---

## 3. Quickstart & Verification Commands

### Full-Stack Docker Deployment
```bash
# 1. Start all 6 containerized services (Mongo, Timescale, Node, FastAPI, Frontend, Gateway)
docker compose up -d

# 2. View running services and health status
docker compose ps
```

### ML Engine & Evaluation Verification
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

# 5. Run Hour-6 multi-crew telemetry streaming handoff
python -m astrocare.models.x02_bayesian
# or
make handoff
```

### Frontend Local Development
```bash
# Install dependencies
npm install

# Start Vite development server (Port 3006)
npm run dev

# Static type checking
npm run lint

# Production build
npm run build
```

---

## 4. Key Components & Status Summary

### ML1 Pipeline (Telemetry, Bayesian Filtering, Anomaly Detection)
- **F011 & N14 Multi-Cadence Simulator (`astrocare/simulator/engine.py`):**
  - Generates multi-crew physiological streams with circadian rhythm and multi-phase mission fatigue.
  - Supports variable sampling cadences: 60s vitals (HR, SpO2, temp, resp), 300s cuff BP, 300s CGM glucose, and 24h morning wake boundary sleep.
  - Deterministic seeded generator (`DATA_GEN_SEED=42`).
- **Evaluation Design & Split Freeze (`astrocare/evaluation/splits.py`):**
  - Strict Leave-One-Person-Out (LOPO) across 4 crew members (`ASTRO-01` to `ASTRO-04`).
  - Strict Leave-One-Scenario-Out (LOSO) across 6 hazard scenario families.
  - Cryptographically frozen in `artifacts/splits/frozen_eval_splits_v2.json` (SHA-256 verified).
- **X02 Bayesian Local-Trend Kalman Baseline (`astrocare/models/x02_bayesian.py`):**
  - Continuous-time 2-state Kalman filter ($x_t = [\mu_t, v_t]^T$) with dynamic $\Delta t$ from ISO-8601 timestamps.
  - Observation noise $R$ estimated via von Neumann successive differences; dynamic 24h harmonic circadian regression.
  - Relative Huber innovation clipping ($8.0\sigma$) prevents sustained acute anomalies from masking themselves.
- **F041 Anomaly Detection Ensemble (`astrocare/models/f041_anomaly.py`):**
  - Isolation Forest, Rolling Robust-Z (F018), and Fixed Threshold evaluated on **identical person-relative normalized features**.
  - Calibrated against a predeclared 5% validation false-alarm rate with transparent empirical test FPR reporting.
- **F043 Monotone Health Risk Score (`astrocare/models/f043_risk_score.py`):**
  - Two-sided physiological distress features with monotonic constraints in LightGBM.
  - Graded 20 clinical test cases graduating smoothly from 0.08 (nominal) to 0.93 (crisis) without early saturation.
  - Gated deployment strictly requiring verified F041 equal-FAR acceptance.
- **F047 Sourced Alert Explanations (`astrocare/models/f047_explanation.py`):**
  - Attaches verified, direction-aware action lines pulled directly from audited N13 Indicator Cards.
  - Computes standardized deviation feature attributions with deterministic SHA-256 explanation IDs.
- **F012 Real Dataset Replay Loaders (`astrocare/data/f012_replay.py`):**
  - Concrete loaders for PhysioNet MMASH and NASA GeneLab OSD-575 Inspiration4 data with verified on-disk checksums.
- **F147 Scientific Research Report (`artifacts/reports/F147_RESEARCH_REPORT.md`):**
  - Data-driven research report auto-built from machine evaluation summaries with relative POSIX links.

---

## 5. Keyboard Shortcuts & Demo Lab

- <kbd>D</kbd>: Toggle Demo Simulation Lab drawer.
- <kbd>Shift</kbd> + <kbd>R</kbd>: Instant Demo Reset (clears active scenarios and restores baseline seeds in < 2s).
- <kbd>Space</kbd>: Pause / Resume automated demonstration tour.
- <kbd>→</kbd> / <kbd>←</kbd>: Step forward / backward through mission chapters.
- <kbd>P</kbd>: Toggle Presenter Notes cue card.
- <kbd>Esc</kbd>: Close open modals, drawers, and overlays.

---

## 6. License & Attribution

- **Software License:** MIT License.
- **3D Anatomical Model:** Adapted from Z-Anatomy ([CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)) and BodyParts3D ([CC BY-SA 2.1 Japan](https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en)).
- **NASA / CSA References:** NASA HRP Evidence Books and NASA-STD-3001 are public domain (17 U.S.C. § 105). CSA resources used under Crown Copyright educational terms with attribution.
