# AstroCare — Autonomous Deep-Space Medical Decision Support

> **AstroCare: how should a Mars crew decide when a reply takes 20 minutes? A decision-support prototype on simulated and public data. Not a medical device.**

AstroCare is a clinical decision-support prototype designed for deep-space human spaceflight missions (ISS Low Earth Orbit, Lunar Artemis base, and Mars Transit/Jezero Crater surface operations). When round-trip radio latency stretches up to 44 minutes (22 minutes one-way), terrestrial telemedicine cannot perform real-time triage. AstroCare provides local client-side autonomous health surveillance, wait-or-act decision logic, verifiable emergency protocol runners, and asymmetric store-and-forward clinical sync.

---

## Quick Start

### Prerequisites
- Node.js 18+ (tested on Node.js 20+)
- npm 9+

### Installation & Local Development
```bash
# Clone the repository
git clone https://github.com/astrocare/astrocare-frontend.git
cd astrocare-frontend

# Install dependencies (zustand, recharts, lucide-react, lenis, tailwindcss)
npm install

# Start the local development server (runs at http://localhost:5173)
npm run dev

# Run static TypeScript type-checking and linter
npm run lint

# Production build (Vite bundled with code-split page chunks)
npm run build
```

---

## System Architecture & Folder Structure

```
astrocare-frontend/
├── index.html                   # HTML entry point with Michroma/Manrope typography
├── package.json                 # Project manifest & build scripts
├── src/
│   ├── main.tsx                 # Root React DOM bootstrap
│   ├── App.tsx                  # Landing page (Lenis smooth scroll) vs App Console view
│   ├── index.css                # Tailwind v4 theme tokens, thin dark scrollbars, prefers-reduced-motion
│   ├── content.ts               # Trajectory narrative, mission milestones, copy constants
│   ├── store.ts                 # Zustand single source of truth (biometrics, link state, alerts, story runner)
│   ├── data/
│   │   ├── adaptation.ts        # NASA HRP microgravity adaptation envelope (Days 1–14 fluid shifts)
│   │   ├── foods.ts             # Microgravity space food database and macronutrient targets
│   │   ├── kb.ts                # Grounded space medicine clinical knowledge base chunks
│   │   └── whatif.ts            # Counterfactual clinical trajectory in-silico simulator
│   ├── components/              # Landing page interactive stage components
│   │   ├── Chrome.tsx           # Global landing header, nav anchors, and prototype footer
│   │   ├── Earthrise.tsx        # WebGL/Canvas layered deep-space visual engine (DO NOT EDIT)
│   │   ├── Trajectory.tsx       # Pinned scrub line showing Mars distance and comms delay curve
│   │   └── Launch.tsx           # Mission mode selector and direct entry into role consoles
│   └── app/                     # Autonomous Clinical Application Shell
│       ├── AppShell.tsx         # Responsive grid shell, sticky 96% blur top header, mobile drawer
│       ├── DemoPanel.tsx        # Floating Demo Lab ([D], Shift+R), 3 Key Moments, 8-min Mars story runner
│       ├── pages/               # 20 Code-Split Clinical & Telemedicine Pages
│       │   ├── Astronaut.tsx    # Live biometrics (corner brackets), cabin life support, 60s check-in
│       │   ├── Surgeon.tsx      # Patient dossier, AI SHAP diagnostic explanation, adaptation priors
│       │   ├── Control.tsx      # ECLSS telemetry, early warning CO2 vs HRV overlay, comms queue
│       │   ├── WaitOrAct.tsx    # X01 Wait-or-Act decision frontier (corner brackets) & benchmark
│       │   ├── Assistant.tsx    # Grounded RAG clinical assistant with exact sentence-level citations
│       │   ├── Protocols.tsx    # Step-by-step emergency cardiac arrest & toxic inhalation runner
│       │   ├── Wellness.tsx     # 2-level segmented tabs: Self-checks, Body, Lifestyle, Records
│       │   ├── Proof.tsx        # Algorithmic synthetic benchmark & ablation suite (corner brackets)
│       │   ├── Limits.tsx       # System boundaries, ethics, regulatory non-device declaration
│       │   ├── Notes.tsx        # Immutable SOAP clinical notes with cryptographic version history
│       │   ├── Orders.tsx       # Surgeon directives queue with carrier transit simulation
│       │   ├── Brief.tsx        # Sol 142 morning executive health status brief
│       │   ├── WhatIf.tsx       # Counterfactual clinical trajectory projections
│       │   ├── Audit.tsx        # SHA-256 chained cryptographic event ledger with tamper detection
│       │   ├── Supplies.tsx     # Medical kit consumable stock tracking & shelf-life degradation
│       │   ├── Syndromes.tsx    # Spaceflight pathology surveillance matrix (SANS, SAS, DCS)
│       │   ├── Forecast.tsx     # Holt exponential smoothing biometric forecast vs naive baseline
│       │   ├── TeleSession.tsx  # Asymmetric delayed split-role teleconsultation terminal
│       │   ├── Broadcast.tsx    # Fleetwide uplink announcements and bilateral crew read receipts
│       │   └── Roadmap.tsx      # Tier 3 architectural capability scoping (20 planned items)
│       └── ui/                  # Shared design system components & accessible widgets
│           ├── AlertCard.tsx    # Severity-colored alert card with clinician feedback controls
│           ├── CameraPulse.tsx  # Local browser optical camera rPPG live pulse detector
│           ├── ConfirmButton.tsx# Accessible double-confirmation modal with Escape key handling
│           ├── ErrorBoundary.tsx# Crash resilient fallback view ("Something went wrong. Reload")
│           ├── Gauge.tsx        # Environmental circular arc telemetry gauge
│           ├── PageHeader.tsx   # Compact sentence-case header (clamp(1.5rem, 2.4vw, 2.25rem))
│           ├── PageSkeleton.tsx # Suspense fallback skeleton loaders
│           ├── Panel.tsx        # Dark card container with optional HUD corner brackets
│           └── TrendChart.tsx   # Recharts area graph with baseline reference and 1m/5m window
└── DEMO_SCRIPT.md               # 8-minute talk track and presentation script
```

---

## Role-Based Workflows

### 1. Astronaut Console (`Commander Elena Vega`)
- **Continuous Biometric Streams**: Real-time heart rate (REAL when camera rPPG active, else SIMULATED), SpO2, blood pressure, core temperature, respiration, and RMSSD heart rate variability with HUD corner brackets.
- **Optical Camera Pulse Bridge**: On-device contactless optical photoplethysmography (rPPG) measuring face luminance variations to calculate pulse in real time.
- **Cabin Life Support**: Environmental telemetry monitoring CO2 partial pressure (ppm), O2 percentage, cabin barometric pressure (kPa), HVAC loop temperatures, and cumulative ionizing radiation dosage (mSv).
- **Daily 60-Second Check-In**: Quick subjective assessment tracking mood, energy, spinal elongation pain, and deep-space red flags.
- **Immediate Medical Emergency**: Direct execution bridge to cardiac arrest (CPR) and toxic exposure interactive clinical checklist runners.

### 2. Flight Surgeon Console (`Dr. Priya Nair · Houston`)
- **Patient Dossier**: Clinical risk stratification of all 4 crew members, sorted dynamically by synthetic Bayesian risk scores.
- **AI Clinical Intelligence**: Local SHAP feature attribution weighting identifying physiological drivers, differential diagnosis prediction sets, and Population Stability Index (PSI) drift monitoring.
- **Adaptation Priors (NASA HRP)**: Dynamic microgravity baseline adaptation envelope accounting for cephalad fluid shifts during Days 1–14 to prevent false alarms.
- **Adaptive Alarm Thresholds**: Per-crew statistical sigma thresholds ($\sigma$) tuned via surgeon feedback with single-click historical replay verification.

### 3. Flight Director Console (`Flight Director Reyes · Mission Control`)
- **Deep-Space Carrier Tracking**: Round-trip signal latency (RTT) indicators, DSN carrier lock telemetry, and automatic solar conjunction blackout simulations.
- **Autonomic Cross-Coupling**: Dual-axis real-time overlay correlating environmental CO2 spikes with crew HRV depression to trigger early-warning automated scrubbing.
- **Store-and-Forward Comms Queue**: Packet-level packet transit monitoring simulating radio wave propagation across interplanetary distances.

---

## Three Key Demo Moments

Open the **Demo Lab** by clicking the floating **Demo Lab [D]** button in the bottom-right corner (or press <kbd>D</kbd> on your keyboard).

### Moment 1: "Live Pulse" (Contactless Optical rPPG)
1. In the Demo Lab panel, click **Run →** under **Moment 1 · Live Pulse**.
2. AstroCare switches to the **Astronaut** console, selects the **Live Vitals** tab, and opens the **Camera rPPG Pulse Bridge**.
3. Click **Enable Camera** to grant webcam permission. Your real pulse rate will be calculated on-device from forehead micro-vascular blood volume changes.
4. Observe the top header status chip change from `0 REAL` to `1 REAL` while Vega's pulse updates live from your webcam.

### Moment 2: "Pull the Cable" (Offline Autonomy & Comms Blackout)
1. In the Demo Lab panel, click **Run →** under **Moment 2 · Pull the Cable**.
2. Carrier link drops to `OFFLINE` and Independence Level escalates to **L3 Onboard-First**.
3. All telemetry processing, clinical rules, and RAG knowledge-base queries continue running 100% client-side in the browser with zero network calls.
4. Transmit a clinical directive or order; notice it is safely held in the local indexed transit queue until comms re-establish.

### Moment 3: "Inject Failure" (AI Model Degradation & Watchdog)
1. In the Demo Lab panel, click **Run →** under **Moment 3 · Inject Failure**.
2. A sensor corruption anomaly degrades ML diagnostic model confidence.
3. The automated supervisory watchdog detects the distribution drift (PSI $\ge 0.28$) and immediately triggers a **failsafe fallback**:
   - Amber alert banner fires: *"AI DEGRADED: RULES ONLY — reason: sensor quality"*.
   - Machine learning inference is halted.
   - Deterministic hard clinical rules take sole control to protect crew safety.
4. Click **Restore AI** to clear the scenario and restore algorithmic diagnostic models.

---

## 8-Minute Mars Full Story Simulation

AstroCare includes an automated, fully scripted **8-Minute Mars Emergency Timeline** covering Sol 142 to Sol 144.
- In the Demo Lab, click **Run Mars Full Story (8:00)**.
- Watch the bottom narration subtitles as AstroCare simulates:
  - **0:00 - 1:30**: Baseline cruise nominal state and circadian calibration.
  - **1:30 - 3:00**: Solar Particle Event (SPE) radiation storm shelter escalation.
  - **3:00 - 4:45**: ECLSS Cabin CO2 scrubber failure and autonomic compensation.
  - **4:45 - 6:30**: Crew sepsis contingency, wait-or-act decision frontier, and sterile medication draw.
  - **6:30 - 8:00**: Earth ground review, delayed tele-consultation sync, and Sol debrief.
- You can **Pause**, **Resume**, or **Skip Step** at any point.
- Press <kbd>Shift</kbd> + <kbd>R</kbd> at any time to instantly reset all demo states back to baseline in under 2 seconds.

---

## Synthetic Data & Honesty Disclaimers

AstroCare clearly tags all simulated and illustrative data across the entire application:

| Feature / Screen | Tag | Clinical Stance & Reality |
| :--- | :---: | :--- |
| **Proof Page (P01)** | `PLACEHOLDER` | Benchmark metrics (AUROC 0.94, Sensitivity 92.4%) are synthetic placeholders from an internal testbed, not yet evaluated on real clinical trials. |
| **Wait-or-Act (X01)** | `ILLUSTRATIVE` | 24-hour decision frontier cost surfaces and simulated delay curves are conceptual models. |
| **Assistant RAG (F055)** | `ILLUSTRATIVE` | Grounded against local aerospace medicine handbook excerpts; not a replacement for board-certified physician consultation. |
| **Syndromes Matrix (F046)** | `ILLUSTRATIVE` | NASA Spaceflight Associated Neuro-ocular Syndrome (SANS) & Decompression Sickness scores represent conceptual indicators. |
| **Adaptation Priors (X03)** | `ILLUSTRATIVE` | Fluid shift curve envelopes are illustrative approximations; requires NASA HRP peer-reviewed flight data verification before operational use. |
| **Predictive Forecast (F044)**| `ILLUSTRATIVE` | Holt exponential smoothing rolling backtests run live in browser on simulated telemetry streams. |
| **Supplies Allocation (X10)** | `ILLUSTRATIVE` | Shelf-life degradation and consumption trajectories are mathematical models. |
| **Biometric Streams** | `SIMULATED` | All crew biometrics are browser-synthesized Markovian streams, except when live webcam rPPG is activated on Vega's heart rate (`REAL`). |

---

## Tier 3 Planned Capabilities (Roadmap)

The **Roadmap** view outlines 20 architecturally scoped capabilities planned for operational flight readiness (TRL 4–5):

1. **EVA Readiness Check**: Autonomous pre-breathe decompression sickness risk assessment.
2. **EVA Live Telemetry**: Suit pressure, metabolic rate calculation, and cooling garment loops.
3. **Continuous Sleep Staging**: Microgravity sleep staging via accelerometry and R-R intervals.
4. **Circadian Entrainment Model**: Two-process sleep-wake model factoring melanopic lux light exposure.
5. **Bone & Muscle Estimator**: Kinematic workload tracking forecasting trabecular bone demineralization.
6. **Radiation Risk Spectrum**: Stochastic oncogenic and acute CNS risk modeling from LET dosimeters.
7. **Hemodynamic Digital Twin**: High-fidelity in-silico cardiovascular avatar parameterized by ground testing.
8. **Acoustic Biomarker Analysis**: Speech vocal tract shifts detecting fatigue and intracranial pressure.
9. **Cognition Battery**: 3-minute spaceflight psychomotor vigilance and dual-task test suite.
10. **Stereoscopic Wound Vision**: Erythema boundary tracking and epithelialization rate scoring.
11. **Mass Casualty Triage Board**: Comms-outage situational triage optimization under consumable limits.
12. **Autonomous Trajectory Abort**: Ballistic orbital return window solver vs onboard stabilization.
13. **In-Flight Emergency Drills**: High-stress contingency simulations for procedural re-currency.
14. **Dynamic Nutrition Planner**: Metabolic macro/micronutrient balancing based on ergometer caloric burn.
15. **Exercise Prescription Engine**: Autonomously adapted high-intensity interval training loads.
16. **Kinematic Pose Rep Counting**: Optical computer vision tracking resistive exercise technique.
17. **Team Psychosocial Monitor**: Non-invasive sociometric interaction clustering and cadence tracking.
18. **Cohort Analytics**: Multi-crew comparative distributions identifying latent environmental hazards.
19. **Automated Incident Debrief**: Autonomous debrief compiler summarizing telemetry, triggers, and outcomes.
20. **Consumables Depletion Solver**: Deep-space inventory forecasting for pharmaceuticals and life-support gases.

---

## Accessibility & Keyboard Shortcuts

- <kbd>D</kbd>: Toggle Demo Simulation Lab drawer.
- <kbd>Shift</kbd> + <kbd>R</kbd>: Instant Demo Reset (clears scenarios, restores baselines in < 2 seconds).
- <kbd>Esc</kbd>: Closes open modals, confirmation dialogues, mobile navigation drawer, and Demo Lab.
- **Focus Rings**: High-contrast `focus-visible:ring-2 focus-visible:ring-earth` visible on all interactive elements.
- **Screen Reader Support**: Live status updates communicated via `role="status"` and `aria-live="polite"` on banners, alerts, and story captions.
- **Motion Restraint**: Full `prefers-reduced-motion` compliance halts all auto-scrolls, animated transitions, and pulsing effects.

---

## 3D Anatomical Model Licences & Attribution

- 3D model: Z-Anatomy and BodyParts3D, CC BY-SA. Modified.
- The 3D human anatomy model and digital twin features are adapted from Z-Anatomy ([CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)), which derives from BodyParts3D, The Database Center for Life Science ([CC BY-SA 2.1 Japan](https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en)).
- Licence note: in accordance with CC BY-SA, any derived model files (`public/models/anatomy.glb`) and modifications remain under the Creative Commons Attribution-ShareAlike licence.

---

## Regulatory Non-Device Notice

> **ASTROCARE IS AN EXPERIMENTAL DECISION-SUPPORT RESEARCH PROTOTYPE. IT IS NOT A CERTIFIED MEDICAL DEVICE UNDER FDA 21 CFR 820, EU MDR 2017/745, OR NASA-STD-3001. IT MUST NEVER BE USED FOR ACTUAL PATIENT DIAGNOSIS, PROGNOSIS, OR PRIMARY CLINICAL INTERVENTION WITHOUT A QUALIFIED MEDICAL DOCTOR IN THE LOOP.**
