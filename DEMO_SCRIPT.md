# AstroCare — 8-Minute Executive Demo Script

> **Thesis Statement:**  
> *"AstroCare: how should a Mars crew decide when a reply takes 20 minutes? A decision-support prototype on simulated and public data. Not a medical device."*

---

## Presentation Overview

- **Audience:** Flight Surgeons, Aerospace Bioengineers, Mission Operations Directors, and Evaluators.
- **Total Duration:** 8 minutes (matching the built-in automated Mars story timeline).
- **Core Narrative:** A 4-person crew aboard AstroCare-1 traversing to Mars (Sol 142). Communication round-trip delay is 44 minutes. Ground control cannot steer the scalpels or calibrate immediate resuscitation. Watch what the autonomous system decides on its own, what it escalates, and how it transparently preserves auditability for Earth review.

---

## Minute-by-Minute Talk Track

### 0:00 – 1:00 · The Physics of Delay & The System Architecture
* **Screen:** Landing page (`Earthrise` → `Trajectory` scrub line)
* **Spoken Track:**
  > "Welcome to AstroCare. When we send humans to low Earth orbit on the International Space Station, Earth is only 1.3 light-seconds away. A flight surgeon in Houston can observe an astronaut's telemetry live on high-definition video and speak in real time.
  >
  > But as we leave Earth orbit on a trans-Mars injection, the delay stretches. At Mars transit, round-trip communication takes 44 minutes—22 minutes each way. If an astronaut exhibits ventricular fibrillation, sepsis, or an acute hypercapnic spike, Houston will only learn about it after the patient has either survived or died.
  >
  > AstroCare is our answer to the central question of deep-space medicine: *How should a Mars crew decide when a reply takes 20 minutes?*
  >
  > Let's enter the operational console."
* **Action:** Click **Open console** (or select **Launch Mars transit console**).

---

### 1:00 – 2:15 · Moment 1: Live Contactless Pulse & Crew Baseline
* **Screen:** Astronaut Console (`Commander Elena Vega` · Live Vitals tab)
* **Spoken Track:**
  > "We are now looking at Commander Elena Vega's health console on Sol 142. Onboard AstroCare, continuous biometrics are evaluated locally on client hardware.
  >
  > In deep space, wearable electrodes fail, skin dries out, and contact patches irritate. AstroCare features an integrated contactless optical rPPG camera bridge. Let me show you this running right now."
* **Action:** Open the **Demo Lab** (<kbd>D</kbd>), click **Moment 1 · Live Pulse**. Click **Enable Camera** on the Camera Pulse card.
* **Spoken Track:**
  > "Notice that the system is capturing ambient light reflection from facial micro-vascular pulse changes. In the top header strip, our provenance chips immediately update: Vega's heart rate switches from `SIMULATED` to `1 REAL`. The rest of the crew remains simulated.
  >
  > Next, look at the top status header: our round-trip delay is 44 minutes, link state is locked, and autonomy is set to Level 3: Onboard-First."

---

### 2:15 – 3:30 · Sol 142 Event 1: The Solar Storm & Shelter Escalation
* **Screen:** Cabin Life Support & Alert Inbox
* **Spoken Track:**
  > "At 02:10 on Sol 142, the spacecraft enters a Solar Particle Event. Let's trigger this contingency."
* **Action:** In Demo Lab, trigger **Solar Event** (or let the automated 8-minute story progress).
* **Spoken Track:**
  > "The cabin dosimeter registers a rapid spike in ionizing flux. Under low Earth orbit protocols, Earth would verify the sensor and issue a shelter directive. But waiting 44 minutes would deliver a lethal ionizing dose.
  >
  > AstroCare fires an immediate autonomous L3 alarm: *Shelter alert broadcast in under 3 seconds*. Every crew member is directed to the storm shelter polyethylene core.
  >
  > Meanwhile, AstroCare bundles the dosimetry telemetry packet and transmits an asynchronous downlink to Houston. The crew decides first; Earth reviews later."

---

### 3:30 – 4:45 · Sol 143 Event 2: Physiological Cross-Coupling (CO2 Leak)
* **Screen:** Flight Director Control Console → Cabin vs Body Dynamics Tab
* **Spoken Track:**
  > "On Sol 143, cabin scrubber bed A suffers an adsorption bypass. Let's inspect the Flight Director console in Houston."
* **Action:** Switch role to **Control**, navigate to the **Cabin vs Body Dynamics** tab. Trigger **CO2 Leak**.
* **Spoken Track:**
  > "Notice our dual-axis cross-coupling graph. Human beings in microgravity don't immediately notice ambient CO2 rising from 800 to 2,000 ppm—symptoms like headaches or lethargy are delayed.
  >
  > But the autonomic nervous system responds within minutes. Look at the blue line: mean crew heart rate variability (HRV) drops sharply as sympathetic tone increases.
  >
  > AstroCare's cross-coupling rule detects this physiological divergence before any crew member reports subjective discomfort. Autonomous life support switches to secondary regenerative scrubbers automatically."

---

### 4:45 – 6:00 · Moment 2: Pulling the Cable & Wait-or-Act Decision Logic
* **Screen:** Wait-or-Act Frontier (`/woa`)
* **Spoken Track:**
  > "Now let's demonstrate true autonomy. What happens if solar conjunction cuts the radio link entirely?"
* **Action:** In Demo Lab, click **Moment 2 · Pull the Cable**. Carrier link shifts to `OFFLINE`.
* **Spoken Track:**
  > "The communications carrier is dead. We are completely isolated.
  >
  > Let's navigate to our proprietary **Wait-or-Act** engine. Suppose Commander Vega presents with right lower quadrant abdominal pain, mild fever, and localized rebound tenderness.
  >
  > Should the crew operate immediately in microgravity—risking sterile field breach, surgical complications, and depleting precious intravenous antibiotics? Or should they wait for observation, risking appendiceal rupture?
  >
  > Look at the **Real-Time Decision Frontier**. AstroCare plots the risk-cost curve: *Expected Harm of Waiting* versus *Harm of Unnecessary Early Intervention*.
  >
  > When the comms delay is 44 minutes, the curve dynamically shifts: AstroCare calculates the exact inflection point and provides a clear recommendation: **ACT NOW** or **WAIT WITH SURVEILLANCE**."

---

### 6:00 – 7:00 · Moment 3: Sensor Failure & Watchdog Fallback
* **Screen:** Flight Surgeon Console (`Dr. Priya Nair`) → Alerts & AI Diagnostics Tab
* **Spoken Track:**
  > "One of the most dangerous risks in clinical AI is algorithmic hallucination or silent model drift. Let's inject a sensor corruption failure."
* **Action:** In Demo Lab, click **Moment 3 · Inject Failure**.
* **Spoken Track:**
  > "Notice what happened instantly: our automated watchdog detected that the input data distribution drifted, driving the Population Stability Index (PSI) to 0.28.
  >
  > Instead of continuing with degraded neural predictions, AstroCare triggers a deterministic failsafe:
  > *'AI DEGRADED: RULES ONLY — reason: sensor quality'*.
  >
  > The system halts machine learning inference and falls back purely to deterministic, battle-tested clinical guidelines. Crew safety is never left to an uncalibrated black-box model."

---

### 7:00 – 7:45 · Grounded RAG Assistant, SOAP Notes & Cryptographic Ledger
* **Screen:** Assistant (`/assistant`) → Audit Ledger (`/audit`)
* **Spoken Track:**
  > "When the crew needs clinical guidance, they consult the **Clinical Assistant**. Every sentence generated by our local RAG pipeline is highlighted with exact sentence-level citations linked directly to verified aerospace clinical protocols. If an assertion is not supported by our verified knowledge base, the system flags it.
  >
  > Every action, dose administered, alert acknowledged, and clinical note written is logged into an immutable SHA-256 cryptographic audit ledger. Earth ground surgeons can verify the cryptographic hash chain to confirm no telemetry was altered or lost."

---

### 7:45 – 8:00 · Conclusion & Safety Stance
* **Screen:** Limits Page (`/limits`)
* **Spoken Track:**
  > "In conclusion: AstroCare does not pretend to replace human doctors.
  >
  > As stated clearly on our Limits page and throughout every screen: *AstroCare is a clinical decision-support prototype on simulated and public data. It is not an FDA-certified medical device.*
  >
  > It is an engineered blueprint for human survival on the frontier—bridging the 44-minute silence between Earth and Mars.
  >
  > Thank you. I am glad to answer your questions or demonstrate any subsystem in detail."
* **Action:** Press <kbd>Shift</kbd> + <kbd>R</kbd> to reset the demo back to initial state.

---

## Quick Reference: Key Demonstration Commands

| Shortcut / Trigger | Action | Expected Visual Result |
| :--- | :--- | :--- |
| <kbd>D</kbd> | Toggle Demo Lab | Slides out right-hand control drawer |
| <kbd>Shift</kbd> + <kbd>R</kbd> | Instant Demo Reset | Wipes scenarios, resets clocks, alerts nominal (<2s) |
| **Moment 1** | Run Live Pulse | Astronaut view opens; camera rPPG activates; `1 REAL` chip appears |
| **Moment 2** | Pull the Cable | DSN carrier goes offline; Level 3 autonomy locks; local queue stores packets |
| **Moment 3** | Inject Failure | Amber banner triggers: *AI DEGRADED: RULES ONLY*; watchdog halts ML |
| **Mars Full Story** | Automated 8-min run | Automated chronological narrative with bottom subtitle captions |
