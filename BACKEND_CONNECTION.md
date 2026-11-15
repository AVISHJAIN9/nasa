# AstroCare Backend Connection & Model Integration Guide

> **DISCLAIMER:** AstroCare is an astronaut health decision-support research prototype (NASA Space Apps 2026), **NOT a certified medical device**. The combined ML rule is unvalidated for clinical diagnostic use.

---

## 1. System Architecture

```
                    +------------------------------------+
                    |  AstroCare Web Client (Port 3006)  |
                    |   (Vite + React + Tailwind v4)    |
                    +-----------------+------------------+
                                      |
                     /api/v1/clinical | /api/v1/assess, /assess, /v1/space-weather
                                      |
       +------------------------------+-------------------------------+
       |                                                              |
       v                                                              v
+-------------------------------+                     +-------------------------------+
|   Node.js Clinical Core       |                     |  FastAPI Intelligence Engine  |
|         (Port 8000)           |                     |          (Port 8001)          |
| - SOAP Notes                  |                     | - POST /assess                |
| - Medical Inventory & Kits    |                     | - POST /minute                |
| - Static Protocols            |                     | - External Sources & LLM      |
+---------------+---------------+                     +---------------+---------------+
                |                                                     |
                v                                                     v
+-------------------------------+                     +-------------------------------+
|  MongoDB Daemon (Port 27018)  |                     |   ML Fusion Service (In-Proc) |
|  - Timescale DB (Port 5433)   |                     +---------------+---------------+
+-------------------------------+                                     |
                                        +-----------------------------+-----------------------------+
                                        |                                                           |
                                        v                                                           v
                         +-----------------------------+                             +-----------------------------+
                         | Model A: ml1_stress         |                             | Model B: FusionNet (GRU)    |
                         | - Logistic Regression + Imp |                             | - 9 Physiological Channels  |
                         | - 8 Heart & EDA Features    |                             | - Online EWMA Baseline      |
                         | - Stress Probability [0, 1] |                             | - 120-Min Warming Phase     |
                         +-----------------------------+                             +-----------------------------+
```

---

## 2. Model Contracts & Integration Details

### Model A: `ml1_stress`
- **Location:** `backend/models/model_a/stress_model.joblib`
- **Pipeline:** `SimpleImputer(strategy='mean')` $\to$ `StandardScaler()` $\to$ `LogisticRegression(C=0.1, solver='lbfgs')`
- **Inputs (8 Features):**
  1. `hr_mean` (bpm, 30–240)
  2. `sdnn` (ms, 0–500)
  3. `rmssd` (ms, 1–300)
  4. `pnn50` (%, 0–100)
  5. `eda_mean` ($\mu$S, 0–50)
  6. `eda_std` ($\mu$S, 0–20)
  7. `eda_slope` ($\mu$S/s, -5 to 5)
  8. `temp_mean` (°C, 25–45)
- **Output:** `stress_prob` ($[0, 1]$) and `label` (`"stressed"` / `"not_stressed"`).

### Model B: `FusionNet` Early-Warning Model
- **Location:** `backend/models/model_b/fusionnet.pt`
- **Architecture:** PyTorch GRU (`d_model=64`, `layers=2`) with adaptive EWMA baseline ($\alpha=0.01$).
- **Inputs (9 Ordered Channels):**
  1. `hr` (Heart Rate, bpm, 20–250)
  2. `rmssd` (HRV RMSSD, ms, 1–300)
  3. `activity` (Actigraphy, counts/min, 0–5000)
  4. `resp` (Respiration Rate, br/min, 4–60)
  5. `blink` (Blink Rate, blinks/min, 0–120)
  6. `voice` (Voice Jitter/Prosody, %, 0–100)
  7. `typing` (Typing Dwell/Flight, ms, 0–2000)
  8. `puff` (Facial Puffiness/Fluid Shift, proxy scalar 0–10)
  9. `rppg_hr` (Camera rPPG Heart Rate, bpm, 20–250)
- **Baseline Warming:** Requires **120 minutes** of readings before alerting. During minutes 1–119:
  - `status = "baseline_learning"`
  - `early_warning_score = null`
  - `alert = false`
- **Output:** `early_warning_score` ($[0, 1]$), `alert` (`true`/`false`), and `status`.

---

## 3. API Endpoints

### 3.1 Primary Endpoint: `POST /assess`
Returns combined physiological stress and early-warning alert.

#### Request Schema
```bash
curl -X POST http://localhost:8001/assess \
  -H "Content-Type: application/json" \
  -d '{
    "session": "crew-commander-01",
    "features": {
      "hr_mean": 74.2,
      "sdnn": 52.0,
      "rmssd": 44.5,
      "pnn50": 19.0,
      "eda_mean": 1.4,
      "eda_std": 0.2,
      "eda_slope": 0.005,
      "temp_mean": 34.1
    },
    "minute": {
      "hr": 73.0,
      "rmssd": 46.0,
      "activity": 120.0,
      "resp": 15.0,
      "blink": 16.0,
      "voice": 2.0,
      "typing": 130.0,
      "puff": 0.0,
      "rppg_hr": 72.5
    }
  }'
```

#### Response Schema
```json
{
  "session": "crew-commander-01",
  "model_a": {
    "ran": true,
    "stress_prob": 0.000105,
    "label": "not_stressed",
    "error": null
  },
  "model_b": {
    "ran": true,
    "minute_index": 1,
    "early_warning_score": null,
    "alert": false,
    "status": "baseline_learning",
    "error": null
  },
  "combined": {
    "flag": false,
    "reasons": [],
    "rule": "alert_B OR stress_prob_A >= threshold",
    "threshold": 0.5,
    "validated": false
  },
  "missing": [],
  "disclaimer": "Research prototype, not a medical device. Combined rule not validated."
}
```

### 3.2 Reset Session: `POST /assess/reset/{session}` (or `POST /reset/{session}`)
Resets the per-person EWMA baseline state and minute counter to 0.
```bash
curl -X POST http://localhost:8001/assess/reset/crew-commander-01
```

### 3.3 Reference Parity Endpoints
- `POST /minute`: Feed single minute vector to Model B detector.
- `GET /health`: Platform health status, active session count, and supported channels.
- `GET /claims`: Verifiable validation benchmarks from MMASH, UBFC-rPPG, and Zenodo 4326598.
- `GET /registry`: Component readiness register (F125).

---

## 4. Space Weather, Telemetry & Assistant Endpoints

| Endpoint | Method | Description | Provenance |
| :--- | :--- | :--- | :--- |
| `/v1/space-weather/current` | GET | NOAA SWPC live feeds (Kp, Protons, X-rays, G/S/R scales) | `live_public_feed` |
| `/v1/space-weather/events` | GET | NASA DONKI solar notifications & CME events | `live_public_feed` |
| `/v1/iss/cabin/latest` | GET | ISS orbital position & ECLSS cabin telemetry | `live_public_feed` / `simulated` |
| `/v1/sources/health` | GET | Real-time health, staleness, and rate limits of external sources | System |
| `/v1/llm/status` | GET | Multi-provider router status (Groq, Gemini, Ollama, Fallback) | System |
| `/v1/assistant/ask` | POST | Guardrailed decision support assistant | Multi-provider |

#### Example: Querying Decision Support Assistant
```bash
curl -X POST http://localhost:8001/v1/assistant/ask \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Astronaut reports elevated heart rate and mild fatigue during EVA prep. Recommend immediate checks."}'
```

---

## 5. Environment Variables

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `PORT` | `8001` | FastAPI port |
| `ASTROCARE_STRESS_THRESHOLD` | `0.5` | Model A stress classification threshold |
| `ASTROCARE_SESSION_TTL_HOURS` | `6` | Inactive session cache expiry in hours |
| `ASTROCARE_MAX_SESSIONS` | `1000` | Maximum concurrent in-memory sessions |
| `NASA_API_KEY` | `DEMO_KEY` | NASA DONKI API Key (from env) |
| `GROQ_API_KEY` | - | Primary LLM Provider API Key |
| `GEMINI_API_KEY` | - | Secondary LLM Provider API Key |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Local LLM fallback URL |

---

## 6. Verification & Troubleshooting

### Run Test Suite
```bash
.venv/bin/pytest tests/test_assess.py -v
```
All 7 tests verify:
1. Model A numerical parity with standalone scikit-learn ($< 10^{-6}$).
2. Model B 400-minute simulation parity with PyTorch GRU.
3. Edge case validation (ranges, NaN, session regex, length).
4. Session isolation between concurrent crew streams.
5. Session reset and TTL lifecycle.
6. Reference parity with pre-existing `/health`, `/minute`, `/claims`, `/registry`.
7. Graceful degradation if Model A weights fail to load.

### Privacy Guarantee
**No raw vitals or biometric identifiers are logged to disk or console.**
Log messages record only SHA256 session prefix, request latency, and HTTP status codes.
