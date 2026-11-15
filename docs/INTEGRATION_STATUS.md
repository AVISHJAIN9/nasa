# AstroCare Integration Status & Baseline Report

Generated at: 2026-11-15T01:50:00Z  
Platform: AstroCare Autonomous Medical Decision Support Platform (v2 + v3)

---

## 1. Specification Ingestion Baseline

- **Script**: `scripts/audit/ingest-spec.py`
- **Source Workbooks**:
  - `docs/spec/AstroCare_v2_Master_Features.xlsx` (v2 Master Features)
  - `docs/spec/AstroCare_v3_Additions.xlsx` (v3 Additions)
- **Results**:
  - **v2 Features Ingested**: 169 rows (F001–F150, X01–X11, P01, P02, Q01, V01, S01, `v2:D01`, R01, V02)
  - **v3 Features Ingested**: 18 rows (A05, C01, C05, A01, A02, M01, `v3:D01`, D02, C02, C03, C04, A03, M03, M05, A04, M04, M02, D03)
  - **Total Features Combined**: **187 features** (Exact match)
  - **v3 Layer Tasks Ingested**:
    - Frontend (`FE-01`..`FE-18`): 18 tasks
    - Backend (`BE-01`..`BE-18`): 18 tasks
    - Database (`DB-01`..`DB-13`): 13 tasks
    - Machine Learning (`ML-01`..`ML-19`): 19 tasks
  - **Outputs**:
    - `docs/spec/features.json` (187 records with complete linked layer tasks)
    - `docs/spec/features.csv` (187 rows)

---

## 2. Stack Build and Verification Results

### Frontend (React 19 + Vite 6 + Zustand 5 + TypeScript)
- **Directory**: `frontend/`
- **Typecheck Command**: `cd frontend && npx tsc --noEmit`
  - **Exit Code**: 0
  - **Output**: 0 TypeScript compilation errors
- **Production Build Command**: `cd frontend && npx vite build`
  - **Exit Code**: 0
  - **Build Output**: 1038 modules transformed, built in 25.62s. Output written to `frontend/dist/`.

### Backend A (Node 20 / Express / Mongoose / Socket.IO)
- **Directory**: `backend/`
- **Port**: 8000
- **Test Command**: `npm test` (`vitest run`)
  - **Configuration**: `backend/vitest.config.js`
  - **Exit Code**: 0
  - **Results**: 1 test file passed, 3 tests passed (`health.test.js` validating Express app initialization, `/health` 200/503 contract, `/metrics` Prometheus exposition).
- **Database**: MongoDB running on `localhost:27018` verified and connected.

### Backend B (Python 3.13 / FastAPI / SQLAlchemy Async / Alembic / TimescaleDB)
- **Directory**: `backend/app/`, `backend/alembic/`
- **Virtual Environment**: `.venv/` (Python 3.13.9)
- **Dependencies Installed**: `requirements.txt` (FastAPI 0.163, Uvicorn, SQLAlchemy 2.1, Asyncpg, Alembic 1.20, Redis, Cryptography, Prometheus-Client, Pytest)
- **Database Container**: TimescaleDB (`timescale/timescaledb:latest-pg16`) running on host port `5433` (container `astrocare-timescale`).
- **Migrations Command**: `.venv/bin/alembic upgrade head`
  - **Exit Code**: 0
  - **Applied Revisions**:
    1. `0001_initial_platform` (Initial platform schema and feature flags)
    2. `0002_TEMP_until_DB` (`signal_reading`, `voice_features`, `behavior_windows`, `consent_log`)
    3. `0003_TEMP_until_DB` (`phase_thresholds`, `baseline_history`, `watchdog_events`, `face_metrics`, `motion_readings`, `motion_night`, `gesture_log`, `twin_state`, `panel_votes`, `fed_rounds`)
- **Test Command**: `.venv/bin/pytest backend/tests_py`
  - **Exit Code**: 0
  - **Results**: 4 tests passed (health check, gateway metadata, feature flags listing from DB, sensor consent state).

---

## 3. Inventories Generated

| Inventory File | Records | Content Description |
|---|---|---|
| `scripts/audit/routes-node.json` | 209 | Complete Express route inventory with paths, HTTP methods, and parameter schemas |
| `scripts/audit/routes-python.json` | 100 | FastAPI OpenAPI routes across `/v1` and `/api/v1` with parameters and request/response schemas |
| `scripts/audit/pages.json` | 61 | Complete mapping of 18 pages x 3 roles x tabs to components, store fields, and API hooks |
| `scripts/audit/store-actions.json` | 86 | Store action inventory categorized into pure UI, simulated, and synced actions |
