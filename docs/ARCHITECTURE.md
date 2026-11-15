# AstroCare System Architecture: Unified Dual-Stack Integration

This document defines the route ownership, system of record, single-origin ingress, and cross-service communication contract between **Node.js (Clinical Core & Governance)** and **Python FastAPI (Multimodal AI & High-Frequency Telemetry)**.

---

## 1. Route Ownership & System of Record

Every path family has exactly **one** owning service. No path is served by two services.

| Path Family | Owning Service | System of Record | Database | Rationale / Resolution |
|---|---|---|---|---|
| `/auth/*` | **Node.js** | Node.js | MongoDB (`users`) | Single identity provider issuing signed HS256 JWTs with `role`, `crew_id`, `sub`. |
| `/alerts/*` | **Node.js** | Node.js | MongoDB (`alerts`) | Clinical alerting engine, monotonic status transitions (`active -> acknowledged -> resolved`). |
| `/checkins/*` | **Node.js** | Node.js | MongoDB (`checkinrecords`) | Daily crew self-reported wellness ratings and somatic check-ins. |
| `/notes/*` | **Node.js** | Node.js | MongoDB (`soapnotes`) | Clinician SOAP notes with version history and AI drafting audit trail. |
| `/orders/*` | **Node.js** | Node.js | MongoDB (`clinicalorders`) | Flight Surgeon clinical orders with astronaut delivery and acknowledgment. |
| `/broadcasts/*` | **Node.js** | Node.js | MongoDB (`broadcastannouncements`) | Mission Control & Surgeon announcements with read-receipt audit logs. |
| `/today` / `/v1/today` | **Node.js** | Node.js (Fused) | Cross-Service | Primary fused daily strip: queries Mongo clinical state + calls FastAPI for multimodal scores. Degrades gracefully if FastAPI is offline. |
| `/telemetry/*` | **Node.js** | Node.js | MongoDB (`telemetryreadings`) | Clinical telemetry ingestion, windowed anomaly triage, and physiological timeseries. |
| `/baselines/*` | **Node.js** | Node.js | MongoDB (`personalbaselines`) | Personal circadian baseline calculations, clinician overrides, and decay functions (F015-F018). |
| `/watchdog/*` | **Node.js** | Node.js | In-Memory / Mongo (`watchdoglogs`) | System-wide clinical watchdog, silent failover to heuristic rules, and log recovery. |
| `/replay/*` | **Node.js** | Node.js | MongoDB (`datasetregistries`) | Multi-scenario clinical replay engine (NASA LSAH, MMASH, simulated spaceflight). |
| `/flags/*` | **Node.js** | Node.js | MongoDB (`featureflags`) | Platform feature flags with in-memory caching and role-governed runtime toggles. |
| `/security/*` | **Node.js** | Node.js | MongoDB (`auditlogs`) | Platform security audit, role governance, and credential verification. |
| `/ml/*` | **Node.js** | Node.js | In-Memory Model Registry | Clinical ML model statuses (LightGBM, Random Forest) and rule-fallback toggles. |
| `/health` / `/metrics` | **Node.js** | Node.js (Unified) | Cross-Service | Public healthcheck verifying Mongo and querying FastAPI `/health`. |
| `/gateway/*` | **Node.js** | Node.js | In-Memory Contract Registry | Public gateway metadata, versioning, and contract definitions. |
| `/triage/*`, `/emergency/*`, `/protocols/*`, `/supplies/*`, `/whatif/*`, `/audit/*`, `/crew/*` | **Node.js** | Node.js | MongoDB | Core clinical workflows, emergency procedures, supplies, countermeasure twins. |
| `/audio/*` | **FastAPI** | FastAPI | Local Audio Buffers | v3 voice acoustic biomarker analysis, pitch/jitter/shimmer extraction (A01, C05). |
| `/behavior/*` | **FastAPI** | FastAPI | TimescaleDB (`behavior_windows`) | Keystroke and pointer dynamics aggregated into 5-minute windows with strict privacy gating (A02). |
| `/face-metrics/*` | **FastAPI** | FastAPI | PostgreSQL (`face_metrics`) | Periorbital puffiness and cephalad fluid shift landmark analysis (A03). |
| `/eye-metrics/*` | **FastAPI** | FastAPI | PostgreSQL | Saccadic velocity, pupil reactivity, and gaze metrics for fatigue (Wave 2). |
| `/gestures/*` | **FastAPI** | FastAPI | PostgreSQL (`gesture_log`) | Hands-free clinical interaction gesture recognition (C04). |
| `/motion/*` | **FastAPI** | FastAPI | TimescaleDB (`motion_readings`, `motion_night`) | Sleep actigraphy, restlessness index, and nocturnal movement summaries (A05). |
| `/twin/*` | **FastAPI** | FastAPI | PostgreSQL (`twin_state`) | Multi-day physiological forecast simulations with 90% confidence bands (M04). |
| `/panel/*` | **FastAPI** | FastAPI | PostgreSQL (`panel_votes`) | Multi-specialist AI consensus panel with recorded dissents and literature citations (D02). |
| `/fed/*` | **FastAPI** | FastAPI | PostgreSQL (`fed_rounds`) | Edge federated learning round coordination and parameter updates (C01). |
| `/mission/*` | **FastAPI** | FastAPI | PostgreSQL (`phase_thresholds`) | Mission phase management (launch/transit/landing/return) and phase-specific thresholds (M05). |
| `/consent/*`, `/sensors/*`, `/passive/*` | **FastAPI** | FastAPI | PostgreSQL (`consent_log`) | Zero-friction passive metric tracking and append-only sensor consent ledger (M01). |
| `/signals/*`, `/readings/*` | **FastAPI** | FastAPI | TimescaleDB (`signal_reading`) | High-frequency sensor ingestion and signal quality gating summaries. |
| `/baseline-history/*` | **FastAPI** | FastAPI | PostgreSQL (`baseline_history`) | Versioned baseline drift records and historical baseline rollback (M03). |
| `/drift-watchdog/*` | **FastAPI** | FastAPI | PostgreSQL (`watchdog_events`) | Statistical distribution drift detection for multimodal sensor inputs. |
| `/timescale-replay/*` | **FastAPI** | FastAPI | TimescaleDB | Raw high-frequency TimescaleDB sensor streaming replay. |

---

## 2. Ingress & Single-Origin Architecture

The browser application connects exclusively to a single origin (in development: `http://localhost:3006`, in production: Gateway/Nginx `:80` or `:8080`).

```
                              [ Browser Client ]
                                      |
                           (Single Origin: :3006 / :80)
                                      |
                      +---------------+---------------+
                      | Vite Dev Proxy / Nginx Gateway|
                      +---------------+---------------+
                                      |
            +-------------------------+-------------------------+
            | /api/v1/audio/*                                   | (all other /api/v1/*,
            | /api/v1/behavior/*                                |  /v1/*, /health)
            | /api/v1/face-metrics/*                            |
            | /api/v1/eye-metrics/*                             |
            | /api/v1/gestures/*                                |
            | /api/v1/motion/*                                  |
            | /api/v1/twin/*                                    |
            | /api/v1/panel/*                                   |
            | /api/v1/fed/*                                     |
            | /api/v1/mission/*                                 |
            | /api/v1/consent/*                                 |
            | /api/v1/sensors/*                                 |
            | /api/v1/passive/*                                 |
            | /api/v1/signals/*                                 |
            | /api/v1/readings/*                                |
            | /api/v1/baseline-history/*                        |
            | /api/v1/drift-watchdog/*                          |
            v                                                   v
  [ FastAPI Service (:8001) ]                         [ Node.js API (:8000) ]
        |                                                   |
  +-----+-----+                                       +-----+-----+
  | Postgres  |                                       |  MongoDB  |
  | Timescale | (:5433)                               |  (:27018) |
  +-----------+                                       +-----------+
```

---

## 3. Cross-Service Fused Today Strip (`GET /v1/today`)

The Today Strip is the primary real-time cross-service fusion point:
1. **Node.js acts as Orchestrator**:
   - Queries MongoDB for active clinical alerts, unacknowledged orders, recent broadcasts, and baseline circadian metrics.
   - Dispatches parallel HTTP queries to FastAPI with a strict 1500ms timeout:
     - `/api/v1/sensors/state?crew_id={person_id}`
     - `/api/v1/passive/metrics`
2. **Graceful Degradation Contract**:
   - If FastAPI is offline or unresponsive, Node.js returns HTTP 200 with:
     ```json
     {
       "degraded": true,
       "missing_keys": ["voice", "behavior", "passive"],
       "clinical_summary": { ... }
     }
     ```
   - The UI displays clinical status seamlessly, labeling multimodal sensors as temporarily offline rather than crashing or throwing 500 errors.
