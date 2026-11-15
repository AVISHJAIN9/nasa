# AstroCare QA Audit — Incomplete & Missing Features Report

## A. Summary Counts
COMPLETE 18 / PARTIAL 2 / HIDDEN 3 / STUB 1 / NEEDS-MODEL-FILE 1 / MISSING 1 / NOT TESTED 0

---

## B. "NOT COMPLETE" Table (Ranked by Demo Importance)

| # | Feature | Status | Which link is broken (UI / data / backend / model / output / nav) | file:line evidence | Side to fix (frontend / backend / model file / both) | Effort |
|---|---------|--------|-------------------------------------------------------------------|--------------------|-----------------------------------------------------|--------|
| 1 | Typing & Pointer Fatigue (F1) | MISSING | UI, data, output, nav (No keystroke capture component, no pointer kinematics listener, and no fatigue display tile exist in frontend UI. Backend endpoint exists but is orphaned.) | `frontend/src/store.ts:833` (claimed in narration only); `backend/app/api/v1/endpoints/behavior.py:20` (uncalled backend route `POST /v1/behavior/events`); `scripts/audit_browser_run.mjs:71` (0 DOM elements found) | Frontend | M |
| 2 | Face AI Model & Morphology (F2) | NEEDS-MODEL-FILE | model, UI, output (Camera pulse in UI uses a 2D Canvas green-channel heuristic `greenSum / area` rather than an ML model; facial swelling morphometry and eye metrics have no ML weight files and no frontend tile.) | `frontend/src/app/ui/CameraPulse.tsx:84-124` (2D Canvas green channel averaging); `backend/app/services/face_service.py:15` (stores scalar numbers, no model); `backend/app/services/eye_service.py:14` (no model) | Both | M |
| 3 | Voice Fatigue & Stress Biomarkers | STUB | UI, model, output (No microphone audio capture in frontend; backend extraction uses deterministic modulo arithmetic `pitch = 120 + byte_sum % 80` and returns `model_version: "stub"`.) | `backend/app/services/voice_service.py:24-52` (`model_version: "stub"`); `frontend/src/app/pages/Roadmap.tsx:56` (demoted to future roadmap item) | Both | M |
| 4 | Passive Zero-Effort Mode & Sensor Consent List | PARTIAL | UI, nav (ConsentModal provides general regulatory sign-off, but granular per-sensor consent toggles and zero-effort metrics are only accessible via developer `#integration` test suite; no user-facing dashboard tile.) | `backend/app/api/v1/endpoints/consent.py:32` (`/api/v1/sensors/state`); `frontend/src/app/pages/Integration.tsx:260` (only caller); `frontend/src/app/ui/ConsentModal.tsx:4` (lacks granular sensor controls) | Frontend | S |
| 5 | Supply Planner Backend Optimization | PARTIAL | backend (Frontend `#supplies` calculates supply burn rate and ORS vs IV Saline tradeoffs purely in React client state, ignoring existing backend optimization route `POST /api/v1/supplies/treatment-plan`.) | `frontend/src/app/pages/Supplies.tsx:39-51` (client state math); `backend/src/routes/supplies.js:28` (`/api/v1/supplies/treatment-plan` uncalled by UI) | Frontend | S |
| 6 | Hands-Free Gesture Recognition | HIDDEN | UI, data, output, nav (FastAPI backend endpoint `POST /v1/gestures` resolves and logs gestures to actions, but frontend has no camera gesture classifier, user interaction listener, or UI tile.) | `backend/app/api/v1/endpoints/gesture.py:14` (backend route exists); `frontend/src` (0 gesture capture calls) | Both | M |
| 7 | Ocular Eye Metrics (Blinks & Saccades) | HIDDEN | UI, data, output, nav (FastAPI backend endpoint `POST /v1/eye-metrics` stores blink rates and eye open ratios, but frontend has no webcam eye tracking pipeline or UI tile.) | `backend/app/api/v1/endpoints/eye.py:14` (backend route exists); `frontend/src` (0 eye tracking calls) | Both | M |
| 8 | Motion & Sleep Restlessness Ingestion | HIDDEN | UI, data, output, nav (FastAPI backend endpoint `POST /v1/motion` & `GET /v1/motion/night-summary` exists, but frontend has no accelerometer tracking or sleep summary visualization.) | `backend/app/api/v1/endpoints/motion.py:16` (backend route exists); `frontend/src` (0 motion tracking calls) | Both | S |

---

## C. FILES I MUST PROVIDE

The codebase currently contains **0 ML model weight files** (.onnx, .pt, .pth, .tflite, .joblib, .safetensors). The following files and interfaces must be provided to complete the ML pipeline:

1. **Facial Morphology & Landmark Model**
   - **Path:** `frontend/public/models/face_landmarker.task` (or `backend/models/face_landmarks.onnx`)
   - **Filename:** `face_landmarker.task`
   - **Format / Interface:** MediaPipe FaceLandmarker Task bundle or ONNX float32 input `[1, 3, 256, 256]`, returning 478 3D facial landmarks (`[1, 478, 3]`). Used to calculate relative cephalad fluid shift, inter-zygomatic swelling index, and periorbital puffiness relative to astronaut baseline.

2. **Neural Optical rPPG Pulse Extraction Model**
   - **Path:** `frontend/public/models/physnet.onnx` (or `backend/models/physnet.onnx`)
   - **Filename:** `physnet.onnx`
   - **Format / Interface:** ONNX format accepting normalized facial ROI video frames of shape `[1, 3, 30, 128, 128]` (Batch, Channels, Temporal Frames, Height, Width), outputting 1D pulsatile blood volume pulse (BVP) tensor `[1, 30]`. Plugs into `frontend/src/app/ui/CameraPulse.tsx` to replace Canvas 2D green channel peak averaging.

3. **Acoustic Vocal Biomarker Extraction Model**
   - **Path:** `backend/models/voice_biomarkers.onnx`
   - **Filename:** `voice_biomarkers.onnx`
   - **Format / Interface:** ONNX model or OpenSMILE configuration accepting 16 kHz mono PCM audio buffer `[1, 16000 * duration_sec]`, outputting feature dictionary `{pitch: float, jitter: float, shimmer: float, rate: float, pauses: int}`. Plugs into `backend/app/services/voice_service.py:24` to replace `byte_sum % 80` stub.

4. **Real Clinical Benchmark Verification Run**
   - **Path:** `frontend/src/data/evalRun.json`
   - **Filename:** `evalRun.json`
   - **Format / Interface:** JSON document matching schema `{runId: string, evaluatedAt: string, testDataset: string, samplesCount: number, stats: {auroc, meanLatencySec, falseAlarmsPerDay, coveragePercent}, roc: Array<{fpr, tpr}>, calibration: Array<{pred, observed, count}>, ablation: Array<{method, auroc, precision, recall}>, latency: Array<{condition, rulesSec, baselineSec, astrocareSec}>}`. Replaces the current synthetic placeholder dataset generated on 2026-11-14.

---

## D. FAKE DATA STILL IN USE

| Location | Variable / Metric | Mechanism Generating Data | UI Provenance Label |
|---|---|---|---|
| `frontend/src/store.ts:2910-2935` | Crew Vitals (HR, SpO2, BP, Temp, Resp, HRV) | `Math.sin(t * ...) + (Math.random() - 0.5) * 2` added to personal baseline inside `tick()` | Labeled `SIMULATED` on all VitalTiles in `Astronaut.tsx:310-370` and `VitalTile.tsx:43`. (HR switches to `REAL` when camera pulse is engaged). |
| `frontend/src/app/ui/CameraPulse.tsx:84-124` | Optical Camera Pulse Rate | Canvas 2D green reflectance buffer mean `greenSum / (sw * sh)` with peak interval count `(30 / medianInterval) * 60` | Labeled `REAL` badge (`CameraPulse.tsx:254`), despite using optical heuristic rather than ML model. |
| `frontend/src/api/today.ts:70-135` | Daily Health Status & Risk Band (`/today` strip) | `getMockToday()` deterministic script (0-8s normal, 8-22s band widening 0.10 -> 0.60, 22s+ abstained/unsure) with hard-coded contributor weights | Labeled `SIMULATED` in header provenance counter (`AppShell.tsx:584`). |
| `frontend/src/app/pages/Proof.tsx:24-38` | Verification Performance Indicators (AUROC 0.942, ROC, Calibration) | Stored synthetic benchmark run in `frontend/src/data/evalRun.json` | Labeled `PLACEHOLDER` with warning banner: "Placeholder data — replace src/data/evalRun.json with real make eval output". |
| `frontend/src/app/pages/WaitOrAct.tsx:7-40` | 1,000-Incident Policy Benchmark Simulation | Seeded pseudorandom generator (`s = (s * 1664525 + 1013904223) % 4294967296`, seed 42) generating 1,000 synthetic clinical incidents | Labeled `Illustrative` / `Simulated Policy Comparison, Seed 42 (1,000 Incidents)`. |
| `backend/app/services/voice_service.py:35-50` | Voice Biomarkers (pitch, jitter, shimmer, rate) | Modulo operations on raw audio byte sum: `120.0 + (byte_sum % 80)` returning `model_version: "stub"` | Not shown in UI (no UI component). |
| `frontend/src/store.ts:2880-2900` | Cabin Life Support (CO2, Radiation) | Hard-coded base values (CO2 820 ppm, background cosmic radiation 1.4 mSv/d) modified during scenario triggers | Labeled `SIMULATED` on gauges in `Astronaut.tsx:457-506` and `Control.tsx:140-182`. |
| `frontend/src/store.ts:2820-2845` | Ground Clinical Downlink Messages | Hard-coded automatic reply strings scheduled after Mars latency timer expires | Tagged as ground orders/directives. |
