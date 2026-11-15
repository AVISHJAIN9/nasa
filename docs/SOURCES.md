# AstroCare External Data Sources Register (F125 / Section 4)

> **DISCLAIMER:** AstroCare is an astronaut health decision-support research prototype (NASA Space Apps 2026), **NOT a medical device**. Data feeds and AI outputs are for informational decision support only.

---

## 1. Overview of External Data Sources

In deep-space operations beyond low Earth orbit (LEO), environmental hazards—including galactic cosmic rays (GCRs), solar particle events (SPEs), coronal mass ejections (CMEs), and life support system (ECLSS) deviations—directly affect crew health, performance, and decision-making.

AstroCare integrates real-time upstream scientific telemetry alongside local biometrics to correlate space environmental stress with astronaut physiological state. Every record ingested is tagged with an immutable **Provenance Class** and attribution metadata.

---

## 2. Ingest Adapters & Registry

### 2.1 NOAA Space Weather Prediction Center (SWPC)
- **Adapter ID:** `noaa_swpc`
- **Default Provenance:** `live_public_feed`
- **Fallback Provenance:** `simulated`
- **License:** U.S. Public Domain (NOAA Open Data Policy)
- **Attribution:** *"Data provided by NOAA Space Weather Prediction Center, Boulder, CO, USA."*
- **Update Frequency / TTL:** Ingested per request with 60-second in-memory TTL caching.
- **Endpoints Queried:**
  1. Planetary K-index (1-minute): `https://services.swpc.noaa.gov/json/planetary_k_index_1m.json`
  2. GOES Primary Integral Protons (1-day): `https://services.swpc.noaa.gov/json/goes/primary/integral-protons-1-day.json`
  3. GOES Primary X-Rays (1-day): `https://services.swpc.noaa.gov/json/goes/primary/xrays-1-day.json`
- **NOAA Space Weather Scales Mapping:**
  - **G-Scale (Geomagnetic Storms):** Derived from Kp index ($Kp \ge 5 \to G1$, up to $Kp \ge 9 \to G5$).
  - **S-Scale (Solar Radiation Storms):** Derived from GOES $>10\text{ MeV}$ proton flux ($\ge 10\text{ pfu} \to S1$, up to $\ge 10^5\text{ pfu} \to S5$).
  - **R-Scale (Radio Blackouts):** Derived from GOES $0.1\text{--}0.8\text{ nm}$ X-ray flux ($\ge 10^{-5}\text{ W/m}^2 \to R1\text{ (M1)}$, up to $\ge 2\times 10^{-3}\text{ W/m}^2 \to R5\text{ (X20)}$).

### 2.2 NASA Space Weather Database Of Notifications, Knowledge, Information (DONKI)
- **Adapter ID:** `nasa_donki`
- **Default Provenance:** `live_public_feed`
- **Fallback Provenance:** `simulated`
- **License:** NASA Open Data Policy (U.S. Government Work)
- **Attribution:** *"Data provided by NASA Space Weather Database Of Notifications, Knowledge, Information (DONKI)."*
- **Update Frequency / TTL:** Ingested with 300-second (5-minute) in-memory TTL caching.
- **Authentication:** Ingests `NASA_API_KEY` from environment variables, falling back to `DEMO_KEY`.
- **Endpoints Queried:**
  - Notifications: `https://api.nasa.gov/DONKI/notifications`
  - Coronal Mass Ejections: `https://api.nasa.gov/DONKI/CME`
  - Solar Flares: `https://api.nasa.gov/DONKI/FLR`
- **Rate Limit Tracking:** Ingests `X-RateLimit-Remaining` headers; tracked live via `GET /v1/sources/health`.

### 2.3 International Space Station (ISS) Live Telemetry & ECLSS
- **Adapter ID:** `iss_live`
- **Default Provenance:** `live_public_feed` (orbital coordinates) / `simulated` (ECLSS life support baseline)
- **License:** NASA Open Data / Public ISS Telemetry
- **Attribution:** *"Data based on NASA ISS environmental standards and public orbital telemetry."*
- **Update Frequency / TTL:** 30-second TTL caching.
- **Metrics Tracked:**
  - `iss_latitude`, `iss_longitude` (degrees)
  - `iss_altitude` ($418.5\text{ km}$ nominal)
  - `iss_velocity` ($27,580\text{ km/h}$ nominal)
  - `iss_cabin_pressure` (nominal $101.3\text{ kPa}$)
  - `iss_cabin_ppo2` (nominal $21.3\text{ kPa}$)
  - `iss_cabin_ppco2` (nominal $2.85\text{ mmHg}$, flight rule $< 4.0\text{ mmHg}$)
  - `iss_cabin_temp` (nominal $22.4^\circ\text{C}$)
  - `iss_cabin_humidity` (nominal $46.2\%$)
  - `iss_radiation_dose_rate` ($\mu\text{Gy/h}$, dynamic South Atlantic Anomaly detection)

### 2.4 Multi-Provider LLM Assistant Router
- **Adapter ID:** `llm_router`
- **Routing Hierarchy:**
  1. **Groq:** `openai/gpt-oss-120b` via `GROQ_API_KEY` (Fast inference, $<2.5\text{ s}$ latency).
  2. **Google Gemini:** `gemini-2.5-flash` via `GEMINI_API_KEY` / `GOOGLE_API_KEY`.
  3. **Ollama:** Local fallback via `OLLAMA_BASE_URL`.
  4. **Offline Canned Rules Fallback:** Deterministic protocol recommendations from NASA Flight Rules.
- **Guardrails & Disclaimers:**
  - Enforced system prompt prohibiting clinical medical diagnosis and prescription.
  - Mandatory disclaimer on every response: *"Research prototype, not a medical device. For informational decision support only."*
  - Automatic circuit-breaking and failover upon rate limiting or network timeout.

---

## 3. Provenance Classification Matrix

| Provenance Class | Description | Example Metric |
| :--- | :--- | :--- |
| `live_public_feed` | Direct real-time fetch from open scientific agency APIs | NOAA SWPC $Kp$, GOES X-ray, NASA DONKI |
| `replayed_dataset` | Replay of public open-access benchmark records | MMASH physiological baseline recordings |
| `own_volunteer` | Team / volunteer collected recordings under informed consent | Zenodo 4326598 sleep deprivation evaluations |
| `simulated` | Nominally generated physical models or offline fallback | ECLSS Cabin $ppCO_2$, fallback orbital telemetry |
| `injected_scenario` | Controlled synthetic deviations injected for testing | Minute 301–400 acute fatigue onset scenario |

---

## 4. API Verification Commands

```bash
# Ingest current space weather
curl -s http://localhost:8001/v1/space-weather/current | jq .

# Ingest recent DONKI solar events
curl -s http://localhost:8001/v1/space-weather/events | jq .

# Ingest ISS cabin telemetry
curl -s http://localhost:8001/v1/iss/cabin/latest | jq .

# Query external sources health and staleness
curl -s http://localhost:8001/v1/sources/health | jq .

# Query decision support assistant
curl -s -X POST http://localhost:8001/v1/assistant/ask \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Astronaut reports elevated heart rate and mild fatigue during EVA prep. Recommend immediate checks."}' | jq .
```
