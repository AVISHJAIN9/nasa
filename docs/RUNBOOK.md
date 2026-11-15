# AstroCare Operations & Integration Runbook

This runbook covers system boot, infrastructure requirements, demo account credentials, role policies, and operational diagnostics.

---

## 1. System Topology & Port Mapping

| Service | Environment / Runtime | Host Port | Internal Container Port | Health Endpoint |
|---|---|---|---|---|
| **Frontend** | React 19 + Vite 6 + Tailwind 4 | `3006` | `3006` | `GET http://localhost:3006/` |
| **Node API** | Node.js 20 / Express / Mongoose | `8000` | `8000` | `GET http://localhost:8000/health` |
| **FastAPI** | Python 3.13 / FastAPI / SQLAlchemy async | `8001` | `8001` | `GET http://localhost:8001/health` |
| **MongoDB** | MongoDB 7.0 | `27018` | `27017` | `mongosh --port 27018 --eval "db.ping()"` |
| **TimescaleDB** | PostgreSQL 16 + TimescaleDB | `5433` | `5432` | `pg_isready -h localhost -p 5433` |

---

## 2. Role Policy Table

All authenticated API requests must pass a signed Bearer JWT token with claims `sub`, `role`, and optional `crew_id`.

| Role (`role` claim) | Permissions & Capabilities | Restricted Endpoints | Seeded Demo Account |
|---|---|---|---|
| `astronaut` | Access own crew data, submit daily wellness check-ins, companion chat, sensor streams, acknowledge clinical orders. | Cannot create clinical orders, cannot write SOAP notes, cannot view other crew members' confidential health records or check-ins, cannot send mission broadcasts. | `okoye` / `Password123!`<br>`vega` / `Password123!`<br>`marin` / `Password123!`<br>`tanaka` / `Password123!` |
| `flight_surgeon` | Comprehensive clinical access: view all crew profiles, EHRs, timeseries vitals, diagnose syndromes, create/manage clinical orders, compose and finalize SOAP notes, provide alert feedback, trigger triage simulations. | Cannot modify platform security settings, cannot access infrastructure governance. | `surgeon` / `Password123!`<br>`flight_surgeon` / `Password123!` |
| `mission_control` | Cabin environmental monitoring, emergency comms, compose and publish mission broadcasts, execute demo choreography, manage scenario playback, view flight operational flags. | Cannot alter private clinical records or write clinical orders. | `control` / `Password123!` |
| `admin` | Full governance: security auditing, feature flag toggling, database maintenance, user registration and role management. | Unrestricted administrative access. | `admin` / `Password123!` |
| **Public** | Public system status and unauthenticated login/token refresh endpoints. | `/health`, `/metrics`, `/api/v1/auth/login`, `/api/v1/auth/register`, `/api/v1/auth/refresh` | N/A |

---

## 3. Quick Start & Execution

### Starting Infrastructure Containers
```bash
# Start MongoDB (27018) and TimescaleDB (5433)
docker compose up -d mongo timescale
```

### Applying Database Migrations
```bash
# TimescaleDB Alembic migrations
source .venv/bin/activate
alembic upgrade head
alembic current
```

### Seeding Demo Data
```bash
# Seed default crew (Vega, Okoye, Marin, Tanaka) and demo users
curl -X POST http://localhost:8000/api/v1/demo/seed -H "Content-Type: application/json" -d '{"reset": false}'
```

### Running the Services
```bash
# Terminal 1: Node.js Backend (:8000)
npm run dev

# Terminal 2: FastAPI Backend (:8001)
source .venv/bin/activate
uvicorn backend.app.main:app --host 0.0.0.0 --port 8001

# Terminal 3: Frontend (:3006)
cd frontend && npm run dev
```

---

## 4. Operational Diagnostics (`npm run doctor`)

To run an automated health and contract audit across the full stack:
```bash
npm run doctor
```
Checks performed:
1. Port availability: `3006`, `8000`, `8001`, `27018`, `5433`.
2. MongoDB database ping.
3. PostgreSQL/TimescaleDB connection & query test.
4. Alembic current migration head verification (`0003_multimodal_twin_fed`).
5. Dual-backend `/health` HTTP 200 checks.
6. Unified JWT authentication verification against both Node and FastAPI.
7. Fused `/v1/today` endpoint query and degradation resilience test.
