# AstroCare Manual Test Kit & Verification Guide

This guide provides end-to-end instructions for manually clicking through, probing, and testing every feature of AstroCare against the live stack.

---

## 1. Setup & In-App Status Console (`#integration`)

Before testing individual features:
1. Ensure the stack is running:
   ```bash
   npm run doctor
   ```
2. Open the frontend in your browser: `http://localhost:3006/#integration` (or click **Integration** in the sidebar navigation).
3. Click **"Run All (Test Every Endpoint)"** to execute live end-to-end probes across Node.js and FastAPI through the single-origin proxy.
4. Any failing endpoint will render with a red highlight and reveal the raw backend error message and status code.

---

## 2. Hardware Sensor Testing & Requirements

| Hardware Capability | Feature IDs | Requirements & Setup Notes | Common Failure Modes & Fixes |
|---|---|---|---|
| **Webcam rPPG & Face Metrics** | `A03`, `BE-01`, `F013` | - Chrome / Firefox on `localhost` or HTTPS.<br>- Lighting: Face illuminated from the front without strong backlight.<br>- Permission: Grant camera access when prompted by the browser. | **Failure:** `NotAllowedError` or blank feed.<br>**Fix:** Enable camera permissions in Chrome Site Settings (`chrome://settings/content/camera`). |
| **Microphone Voice Biomarker** | `A01`, `C05` | - 16kHz mono audio input.<br>- Speaking distance 30–50cm.<br>- Background noise < 45 dB. | **Failure:** Degraded SNR or `422 Unprocessable Entity`.<br>**Fix:** Check microphone input level in system sound preferences; speak continuously for at least 2 seconds. |
| **Typing & Keystroke Kinematics** | `A02` | - Passive keyboard listener on check-in and notes forms.<br>- Privacy invariant: Keydown/keyup timing only. Text values are stripped at the edge. | **Failure:** `403 Consent Required`.<br>**Fix:** Open Consent Modal (`#consent`) and ensure `keyboard` toggle is granted. |
| **Hands-Free Gestures** | `C04` | - Front-facing camera with clear hand view (30–80cm distance).<br>- Gestures supported: `open_palm` (acknowledge alert), `thumbs_up` (confirm order). | **Failure:** Confidence < 0.60.<br>**Fix:** Position hand within the center third of the camera frame against a neutral background. |
| **Phone / Actigraphy Motion** | `A05`, `BE-08` | - Accelerometer / gyroscope data logged during rest windows.<br>- Simulated via Replay dataset or live mobile browser sensor API. | **Failure:** Stillness flag false during sleep window.<br>**Fix:** Verify sensor provenance tag (`REAL` vs `SIMULATED`). |

---

## 3. Core Feature Verification Checklist

### F001: Unified JWT Authentication & Role Login
- [ ] **Role:** Any (`astronaut`, `flight_surgeon`, `mission_control`, `admin`)
- [ ] **Page / Tab:** Global Header / Modal (`🔑 Sign In / Demo`)
- [ ] **Exact Steps:**
  1. Click **"Sign In / Demo"** in the sidebar console.
  2. Select quick-login for **"Cmdr. Amina Okoye (ASTRONAUT)"**.
  3. Verify the role console switches to `ASTRONAUT` and callsign displays `okoye`.
- [ ] **Expected Result ("Done when"):** JWT token is issued, stored in `localStorage.astrocare_token`, and active user identity is confirmed via `GET /api/v1/auth/me`.
- [ ] **Curl Equivalent:**
  ```bash
  curl -s -X POST http://localhost:8000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"okoye","password":"Password123!"}'
  ```
- [ ] **Inspect in Database:**
  ```bash
  mongosh mongodb://localhost:27018/astrocare --eval 'db.users.findOne({ username: "okoye" })'
  ```
- [ ] **Likely Cause of Failure:** User not seeded; run `curl -X POST http://localhost:8000/api/v1/demo/seed`.

---

### A05: Cross-Service Fused Today Strip (Headline MVP)
- [ ] **Role:** Astronaut (`okoye`) or Surgeon
- [ ] **Page / Tab:** Home (`#home`)
- [ ] **Exact Steps:**
  1. Navigate to **Home Console**.
  2. Observe the **Today Strip** at the top of the viewport.
  3. Verify point estimate probability, uncertainty band (low/high), and crew baseline comparison.
  4. Stop the FastAPI container (`docker stop astrocare-fastapi`) and refresh: verify status strip gracefully shows `degraded: true` with clinical data intact without throwing a 500 error.
- [ ] **Expected Result ("Done when"):** Today Strip returns fused multi-signal status (`normal | off_today | unsure`), with contributors and error-resilient graceful fallback.
- [ ] **Curl Equivalent:**
  ```bash
  curl -s http://localhost:8000/v1/today?person_id=okoye
  ```
- [ ] **Inspect in Database:**
  ```bash
  # Check active alerts affecting point estimate:
  mongosh mongodb://localhost:27018/astrocare --eval 'db.alerts.countDocuments({ crew_id: "okoye", status: { $ne: "resolved" } })'
  ```
- [ ] **Likely Cause of Failure:** FastAPI unreachable and timeout unhandled. Verify Node `FASTAPI_URL` points to `http://localhost:8001`.

---

### F071: Daily Crew Wellness Check-in
- [ ] **Role:** Astronaut (`okoye`)
- [ ] **Page / Tab:** Wellness (`#wellness`)
- [ ] **Exact Steps:**
  1. Set mood slider to `4/5` and energy slider to `5/5`.
  2. Select pain location `Lower Back (Microgravity Spine Elongation)` and pain level `2/10`.
  3. Click **"Submit Daily Check-in"**.
- [ ] **Expected Result ("Done when"):** Confirmation toast appears, record is saved locally and write-through synced to MongoDB with a unique client ID.
- [ ] **Curl Equivalent:**
  ```bash
  TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login -H "Content-Type: application/json" -d '{"username":"okoye","password":"Password123!"}' | jq -r .access_token)
  curl -s -X POST http://localhost:8000/api/v1/checkins \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"crew_id":"okoye","mood":4,"energy":5,"pain":2,"notes":"Nominal EVA prep"}'
  ```
- [ ] **Inspect in Database:**
  ```bash
  mongosh mongodb://localhost:27018/astrocare --eval 'db.checkinrecords.find({ crew_id: "okoye" }).sort({ timestamp: -1 }).limit(1)'
  ```
- [ ] **Likely Cause of Failure:** Astronaut attempting to post check-in for another crew member returns 403 Forbidden.

---

### F081: Flight Surgeon Clinical Orders Delivery & Receipt
- [ ] **Role:** Flight Surgeon (`surgeon`)
- [ ] **Page / Tab:** Orders (`#orders`)
- [ ] **Exact Steps:**
  1. Switch role to **Surgeon**.
  2. Navigate to **Orders** page.
  3. Click **"Compose Clinical Order"**.
  4. Select Target Crew: `Okoye`, Type: `EXERCISE`, Priority: `ROUTINE`.
  5. Title: `ARED Resistance Maintenance`, Instructions: `45 min deadlift & squat cycle`.
  6. Click **"Dispatch Order"**.
  7. Switch role to **Astronaut (Okoye)**: verify new order appears in Orders tab and click **"Acknowledge Receipt"**.
- [ ] **Expected Result ("Done when"):** Order is created by surgeon, received by Okoye, and transitions to `ACKNOWLEDGED` monotonically.
- [ ] **Curl Equivalent:**
  ```bash
  SURGEON_TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login -H "Content-Type: application/json" -d '{"username":"surgeon","password":"Password123!"}' | jq -r .access_token)
  curl -s -X POST http://localhost:8000/api/v1/orders \
    -H "Authorization: Bearer $SURGEON_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"target_crew_id":"okoye","type":"EXERCISE","title":"ARED Protocol","instructions":"45 min cycle","priority":"ROUTINE"}'
  ```
- [ ] **Inspect in Database:**
  ```bash
  mongosh mongodb://localhost:27018/astrocare --eval 'db.clinicalorders.find({ target_crew_id: "okoye" }).sort({ createdAt: -1 }).limit(1)'
  ```
- [ ] **Likely Cause of Failure:** Unauthenticated user or astronaut role attempting `POST /api/v1/orders` returns 401 or 403.

---

### F051: Clinician SOAP Notes with Version History
- [ ] **Role:** Flight Surgeon (`surgeon`)
- [ ] **Page / Tab:** Notes (`#notes`)
- [ ] **Exact Steps:**
  1. Select crew member **Dr. Alex Vega**.
  2. Review AI-drafted subjective and objective vitals summary.
  3. Enter assessment: `Space Adaptation Syndrome, mild cephalad fluid shift headache`.
  4. Enter plan: `Oral rehydration, 200mg ibuprofen, 6 hours resting sleep window`.
  5. Click **"Finalize & Save Note"**.
  6. Re-open note, edit plan to add `Electrolyte replacement`, and click **"Save Revised Version"**.
- [ ] **Expected Result ("Done when"):** Note is committed to MongoDB with `version: 2`, and version history log displays both revisions with timestamp and author name.
- [ ] **Curl Equivalent:**
  ```bash
  curl -s -X GET "http://localhost:8000/api/v1/notes?crew_id=vega" \
    -H "Authorization: Bearer $SURGEON_TOKEN"
  ```
- [ ] **Inspect in Database:**
  ```bash
  mongosh mongodb://localhost:27018/astrocare --eval 'db.soapnotes.findOne({ crew_id: "vega" }, { version: 1, versions: 1 })'
  ```
- [ ] **Likely Cause of Failure:** Note ID collision or conflicting update operators in MongoDB update pipeline.

---

### F091: Mission Control Emergency Broadcast
- [ ] **Role:** Mission Control (`control`)
- [ ] **Page / Tab:** Broadcast (`#broadcast`)
- [ ] **Exact Steps:**
  1. Switch role to **Mission Control**.
  2. Navigate to **Broadcast Console**.
  3. Enter Title: `Solar Flare Radiation Warning`, Priority: `URGENT`.
  4. Message: `Coronal mass ejection incoming in T-4 hours. All crew retreat to radiation storm shelter.`.
  5. Click **"Transmit Announcement"**.
  6. Switch role to **Astronaut**: verify urgent broadcast alert banner appears at the top of the interface.
- [ ] **Expected Result ("Done when"):** Announcement is persisted, broadcasted across the event bus, and displayed to all active role consoles.
- [ ] **Curl Equivalent:**
  ```bash
  CONTROL_TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login -H "Content-Type: application/json" -d '{"username":"control","password":"Password123!"}' | jq -r .access_token)
  curl -s -X POST http://localhost:8000/api/v1/broadcasts \
    -H "Authorization: Bearer $CONTROL_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"sender_id":"flight_director","title":"Solar Warning","message":"Retreat to shelter","priority":"urgent","target_audience":"all"}'
  ```
- [ ] **Inspect in Database:**
  ```bash
  mongosh mongodb://localhost:27018/astrocare --eval 'db.broadcastannouncements.find().sort({ created_at: -1 }).limit(1)'
  ```
- [ ] **Likely Cause of Failure:** Non-control role attempting to broadcast returns 403 Forbidden.

---

### M01: Sensor Consent Ledger & Passive Metric Tracking
- [ ] **Role:** Astronaut (`okoye`)
- [ ] **Page / Tab:** Limits & Privacy (`#limits`) or Consent Modal
- [ ] **Exact Steps:**
  1. Open Privacy & Sensor Consent panel.
  2. Toggle camera consent from Granted to Revoked.
  3. Submit telemetry reading for `camera` sensor: verify request is rejected with `403 CONSENT_REQUIRED`.
  4. Re-grant camera consent: verify telemetry ingestion resumes immediately.
- [ ] **Expected Result ("Done when"):** Consent status transitions are recorded in PostgreSQL `consent_log` append-only table.
- [ ] **Curl Equivalent:**
  ```bash
  curl -s -X POST http://localhost:8001/api/v1/consent \
    -H "Content-Type: application/json" \
    -d '{"crew_id":"okoye","sensor":"camera","granted":true,"consent_version":1}'
  curl -s "http://localhost:8001/api/v1/sensors/state?crew_id=okoye"
  ```
- [ ] **Inspect in Database:**
  ```bash
  docker exec -it astrocare-timescale psql -U astrocare -d astrocare_db -c "SELECT * FROM consent_log WHERE crew_id='okoye' ORDER BY id DESC LIMIT 2;"
  ```
- [ ] **Likely Cause of Failure:** Alembic migration head not applied. Run `alembic upgrade head`.

---

### M05: Mission Phase Management & Dynamic Thresholds
- [ ] **Role:** Flight Surgeon or Mission Control
- [ ] **Page / Tab:** Proof & Benchmarks (`#proof`)
- [ ] **Exact Steps:**
  1. Query active mission phase (default `transit`).
  2. Update mission phase to `landing`.
  3. Verify vital sign alert thresholds for heart rate and blood pressure automatically adapt to high-G entry parameters with published flight citations.
- [ ] **Expected Result ("Done when"):** Active thresholds update dynamically based on mission phase stored in `phase_thresholds` table.
- [ ] **Curl Equivalent:**
  ```bash
  curl -s -X PUT http://localhost:8001/api/v1/mission/phase -H "Content-Type: application/json" -d '{"phase":"landing"}'
  curl -s http://localhost:8001/api/v1/mission/phase
  ```
- [ ] **Inspect in Database:**
  ```bash
  docker exec -it astrocare-timescale psql -U astrocare -d astrocare_db -c "SELECT * FROM phase_thresholds WHERE phase='landing';"
  ```
- [ ] **Likely Cause of Failure:** Missing phase citation constraint violation (`ck_phase_citation_nonempty`).
