# AstroCare Audit and Repair Plan

**Date:** 2026-11-14  
**Status:** In Progress — Repair Pass  
**Purpose:** Formal audit of source provenance, evaluation protocols, baseline models, and simulation assumptions to eliminate circular evaluation, unverified claims, and semantic defects.

---

## 1. Findings: Source Provenance & Knowledge Base
1. **Artificial Chunk Multiplication:**
   - In `astrocare/knowledge/ingestion.py`, 80 hardcoded summaries were triplicated into 240 chunks with synthetic tags (`_A`, `_B`, `_C`) solely to meet a count target.
   - Document hashes were computed from Python dict strings rather than actual source documents.
2. **Incorrect CSA Terms Attribution:**
   - CSA materials were claimed under *Open Government Licence - Canada (OGL-Canada v2.0)* with commercial reuse rights.
   - The official CSA website terms mandate non-commercial personal/educational reproduction with attribution; commercial redistribution requires prior written permission.
3. **Indicator Cards Clinical Instructions:**
   - Action lines in `cards.py` gave prescriptive medical instructions (e.g., consume carbohydrates, adjust life-support scrubbers) without flight surgeon validation.
   - These must be clearly marked as `UNVERIFIED_SIMULATION_GUIDANCE / PENDING_REVIEW`.

## 2. Findings: Evaluation & Data Leaks
1. **Split Manifest Immutability & Validation:**
   - `artifacts/splits/frozen_eval_splits_v2.json` recorded fold definitions, but `load_frozen_splits()` silently created a new artifact if missing, without cryptographically verifying dataset records or manifest integrity.
2. **F041 Feature Asymmetry & Unequal FAR Comparison:**
   - In `harness.py`, Isolation Forest was trained on a 2D feature space (`[heart_rate, glucose]`), whereas Robust Z-score and Fixed Thresholds evaluated on 1D `heart_rate`.
   - Calibrated at 5% FAR on nominal data, but on held-out test scenarios, reported FPRs diverged drastically (~5% for IF, ~29% for Robust-Z, 0% for Fixed), yet were presented under an "Equal FAR" header.
   - Hazard injection flags were applied to all metrics simultaneously, assuming any hazard causes an anomaly in every vital sign. Anomaly labels must be metric-specific.
3. **X02 Coverage & Brier Score Validation:**
   - Nominal 90% band coverage was reported at ~99%, indicating that the predictive interval was overly conservative and poorly calibrated.
   - Brier score for `p_deviation` was calculated exclusively over nominal records where all true labels were zero.
   - Markdown summary table mistakenly mapped cold-start coverage into the online-calibration column.

## 3. Findings: Model Semantics & Simulator Alignment
1. **X02 Semantics:**
   - `p_deviation` was computed using population nominal bounds from `METRIC_REGISTRY`, not the astronaut's personal baseline mean $\pm$ personalized tolerance.
   - State transition $F$ assumed a fixed 1-minute $\Delta t$, ignoring the observation's actual timestamp delta (glucose arrives every 5 minutes, sleep is daily).
   - `time_to_critical_min` used a heuristic spread rather than trajectory uncertainty propagation.
2. **N14 Simulator & Contract:**
   - Sleep was emitted hourly in the simulator, despite the registry describing it as daily accumulated sleep duration.
   - Synthetic hazard deltas (e.g., $\text{CO}_2$ on glucose) were not explicitly labeled as simulator assumptions.
3. **Assistant / Edge LLM Claims:**
   - Local route was an extractive keyword fallback, not an offline LLM runtime (e.g. Ollama).
   - X06 benchmark computed tokens/sec using an arbitrary multiplier and assumed RAM values.
4. **X01 Wait-or-Act Evaluation:**
   - Evaluated using synthetic beta-distribution random sampling conditioned on deterioration labels, rather than consuming actual sequential X02 filter outputs.

---

## 4. Remediation Steps

- [x] Step 1: Create dependency manifest (`requirements.txt`, `pyproject.toml`).
- [ ] Step 2: Audit knowledge base: Replace inflated chunks with authentic, deduplicated excerpts from verified reference sources; correct CSA terms to non-commercial reproduction with attribution; mark indicator card thresholds and action lines as pending medical review.
- [x] Step 3: Repair evaluation splits (F062/P02): Generate dataset manifest with SHA-256 record hashes; make split loading fail if corrupted; enforce LOPO/LOSO isolation.
- [x] Step 4: Repair N14 simulator: Align sleep cadence to daily cumulative monitoring (07:00:00 UTC wake boundary); document synthetic scenario effects and discrete step-quantization.
- [x] Step 5: Repair X02 Kalman filter: Implement personal-baseline `p_deviation`, timestamp-based $\Delta t$, robust baseline adaptation to prevent anomaly self-hiding, and uncertainty-propagated crossing quantiles (null for sleep).
- [x] Step 6: Repair F041 anomaly detection: Enforce identical 1D feature inputs across models, metric-specific anomaly labels, separate train/val/test streams. (Note: Equal-FAR comparison on held-out test data is **FAIL / NOT MET** [0.0%, 24.7%, 0.0%]; F043 remains strictly gated).
- [ ] Step 7: Implement F012 public proxy dataset replay loaders (PhysioNet MMASH under ODbL 1.0, NASA OSDR Inspiration4 metadata).
- [ ] Step 8: Implement F047 / F098 / N16 alert explanation and card-sourced action lines from N13.
- [ ] Step 9: Complete F147 scientific research-style report.
- [x] Step 10: Run unit test suite and master evaluation harness to confirm all core fixes pass.
