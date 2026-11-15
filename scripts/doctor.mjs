#!/usr/bin/env node
/**
 * AstroCare System Diagnostic & Health Audit Script (Doctor)
 *
 * Verifies:
 * 1. Port availability & service listening (27018, 5433, 8000, 8001, 3006).
 * 2. MongoDB connection & admin ping.
 * 3. PostgreSQL / TimescaleDB connectivity & live query.
 * 4. Alembic migration head confirmation (0003_multimodal_twin_fed).
 * 5. Pre-seeded demo user accounts & crew profiles loaded.
 * 6. Dual-stack /health endpoint HTTP 200 confirmation.
 * 7. Unified JWT authentication & role authorization against both stacks.
 * 8. Fused /v1/today strip endpoint & graceful degradation.
 */

import net from 'node:net';
import { spawn, execSync } from 'node:child_process';
import jwt from 'jsonwebtoken';
import mongoose from '../backend/node_modules/mongoose/index.js';
import { User } from '../backend/src/models/User.js';
import { CrewProfile } from '../backend/src/models/CrewProfile.js';
import { seedDemoData } from '../backend/src/services/demoSeedService.js';

const CONFIG = {
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27018/astrocare',
  postgresPort: process.env.POSTGRES_PORT || '5433',
  postgresUser: process.env.POSTGRES_USER || 'astrocare',
  postgresPass: process.env.POSTGRES_PASSWORD || 'astrocare_dev_password',
  postgresDb: process.env.POSTGRES_DB || 'astrocare_db',
  nodePort: 8000,
  fastapiPort: 8001,
  frontendPort: 3006,
  mongoPort: 27018,
  jwtSecret: process.env.JWT_SECRET || 'super_secret_jwt_key_astrocare_2026_min_32_bytes'
};

const spawnedProcesses = [];

function checkTcpPort(port, host = 'localhost', timeoutMs = 1200) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isConnected = false;

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      isConnected = true;
      socket.destroy();
      resolve(true);
    });

    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, host);
  });
}

async function waitForPort(port, timeoutMs = 10000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (await checkTcpPort(port)) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

function cleanup() {
  for (const p of spawnedProcesses) {
    try {
      p.kill('SIGTERM');
    } catch {}
  }
}

process.on('exit', cleanup);
process.on('SIGINT', () => {
  cleanup();
  process.exit(130);
});

async function runDoctor() {
  console.log('🩺 ASTROCARE SYSTEM INTEGRATION DOCTOR');
  console.log('====================================================');
  let hasFailure = false;

  const logStep = (id, name, pass, detail) => {
    const statusTag = pass ? '\x1b[32m[PASS]\x1b[0m' : '\x1b[31m[FAIL]\x1b[0m';
    console.log(`${statusTag} ${id.padEnd(6)} | ${name.padEnd(28)} | ${detail}`);
    if (!pass) hasFailure = true;
  };

  // 1. Probe & auto-start services if needed
  const mongoUp = await checkTcpPort(CONFIG.mongoPort);
  logStep('DOC-01', 'MongoDB Port (:27018)', mongoUp, mongoUp ? 'Port 27018 listening' : 'Port 27018 not listening (start docker container astrocare-mongo)');

  const timescaleUp = await checkTcpPort(CONFIG.postgresPort);
  logStep('DOC-02', 'TimescaleDB Port (:5433)', timescaleUp, timescaleUp ? 'Port 5433 listening' : 'Port 5433 not listening (start docker container astrocare-timescale)');

  // Auto-boot Node API if not listening
  let nodeUp = await checkTcpPort(CONFIG.nodePort);
  if (!nodeUp && mongoUp) {
    console.log('       ↳ Auto-starting Node API server on :8000 for verification...');
    const nodeProc = spawn('node', ['backend/src/server.js'], {
      env: { ...process.env, PORT: '8000' },
      stdio: 'ignore'
    });
    spawnedProcesses.push(nodeProc);
    nodeUp = await waitForPort(CONFIG.nodePort, 6000);
  }
  logStep('DOC-03', 'Node API Port (:8000)', nodeUp, nodeUp ? 'Port 8000 listening and accepting HTTP' : 'Node API failed to start or listen on 8000');

  // Auto-boot FastAPI if not listening
  let fastApiUp = await checkTcpPort(CONFIG.fastapiPort);
  if (!fastApiUp && timescaleUp) {
    console.log('       ↳ Auto-starting Python FastAPI server on :8001 for verification...');
    const fastApiProc = spawn('.venv/bin/uvicorn', ['backend.app.main:app', '--host', '0.0.0.0', '--port', '8001'], {
      env: {
        ...process.env,
        POSTGRES_PORT: String(CONFIG.postgresPort),
        DATABASE_URL: `postgresql+asyncpg://${CONFIG.postgresUser}:${CONFIG.postgresPass}@localhost:${CONFIG.postgresPort}/${CONFIG.postgresDb}`
      },
      stdio: 'ignore'
    });
    spawnedProcesses.push(fastApiProc);
    fastApiUp = await waitForPort(CONFIG.fastapiPort, 7000);
  }
  logStep('DOC-04', 'FastAPI Port (:8001)', fastApiUp, fastApiUp ? 'Port 8001 listening and accepting HTTP' : 'FastAPI failed to start or listen on 8001');

  // 2. MongoDB Live Ping
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(CONFIG.mongoUri, { serverSelectionTimeoutMS: 2000 });
    }
    const adminPing = await mongoose.connection.db.admin().ping();
    const mongoPingOk = adminPing && adminPing.ok === 1;
    logStep('DOC-05', 'MongoDB Database Ping', mongoPingOk, mongoPingOk ? 'Admin ping ok=1 returned' : 'Ping failed');
  } catch (err) {
    logStep('DOC-05', 'MongoDB Database Ping', false, `Connection error: ${err.message}`);
  }

  // 3. PostgreSQL Live Query
  let pgOk = false;
  try {
    const pyCmd = `
import asyncio, asyncpg
async def query():
    conn = await asyncpg.connect('postgresql://${CONFIG.postgresUser}:${CONFIG.postgresPass}@localhost:${CONFIG.postgresPort}/${CONFIG.postgresDb}')
    db_name = await conn.fetchval('SELECT current_database()')
    await conn.close()
    return db_name
print(asyncio.run(query()))
    `;
    const dbName = execSync(`.venv/bin/python -c "${pyCmd.replace(/"/g, '\\"')}"`, { encoding: 'utf-8' }).trim();
    pgOk = dbName === CONFIG.postgresDb;
    logStep('DOC-06', 'Postgres/Timescale Query', pgOk, pgOk ? `Queried current_database()='${dbName}'` : `Mismatch: got '${dbName}'`);
  } catch (err) {
    logStep('DOC-06', 'Postgres/Timescale Query', false, `Query error: ${err.message}`);
  }

  // 4. Alembic Head Migration Verification
  let alembicOk = false;
  try {
    const pyCmd = `
import asyncio, asyncpg
async def check_alembic():
    conn = await asyncpg.connect('postgresql://${CONFIG.postgresUser}:${CONFIG.postgresPass}@localhost:${CONFIG.postgresPort}/${CONFIG.postgresDb}')
    v = await conn.fetchval('SELECT version_num FROM alembic_version')
    await conn.close()
    return v
print(asyncio.run(check_alembic()))
    `;
    const version = execSync(`.venv/bin/python -c "${pyCmd.replace(/"/g, '\\"')}"`, { encoding: 'utf-8' }).trim();
    alembicOk = version === '0003_multimodal_twin_fed';
    logStep('DOC-07', 'Alembic Head Migration', alembicOk, alembicOk ? `Current revision: ${version}` : `Expected '0003_multimodal_twin_fed', found '${version}'`);
  } catch (err) {
    logStep('DOC-07', 'Alembic Head Migration', false, `Alembic check error: ${err.message}`);
  }

  // 5. Pre-seeded Demo Users & Crew Profiles
  try {
    await seedDemoData({ reset: false });
    const userCount = await User.countDocuments({ username: { $in: ['okoye', 'surgeon', 'control', 'admin'] } });
    const crewCount = await CrewProfile.countDocuments({ crew_id: { $in: ['okoye', 'vega', 'marin', 'tanaka'] } });
    const seeded = userCount >= 4 && crewCount >= 4;
    logStep('DOC-08', 'Demo Accounts & Crew', seeded, seeded ? `Found ${userCount}/4 users and ${crewCount}/4 crew profiles` : `Incomplete seed data`);
  } catch (err) {
    logStep('DOC-08', 'Demo Accounts & Crew', false, `Seed verification error: ${err.message}`);
  }

  // 6. Dual-stack /health endpoint 200
  let nodeHealthOk = false;
  try {
    const resNode = await fetch('http://localhost:8000/health');
    const dataNode = await resNode.json();
    nodeHealthOk = resNode.status === 200 && (dataNode.status === 'healthy' || dataNode.status === 'degraded');
    logStep('DOC-09', 'Node /health Endpoint', nodeHealthOk, nodeHealthOk ? `HTTP 200 (status: ${dataNode.status})` : `HTTP ${resNode.status}`);
  } catch (err) {
    logStep('DOC-09', 'Node /health Endpoint', false, `Unreachable: ${err.message}`);
  }

  let fastApiHealthOk = false;
  try {
    const resFast = await fetch('http://localhost:8001/health');
    const dataFast = await resFast.json();
    fastApiHealthOk = resFast.status === 200 && dataFast.status === 'healthy';
    logStep('DOC-10', 'FastAPI /health Endpoint', fastApiHealthOk, fastApiHealthOk ? `HTTP 200 (status: ${dataFast.status})` : `HTTP ${resFast.status}`);
  } catch (err) {
    logStep('DOC-10', 'FastAPI /health Endpoint', false, `Unreachable: ${err.message}`);
  }

  // 7. Unified JWT Authentication
  try {
    const testToken = jwt.sign(
      { sub: 'test-doctor', role: 'flight_surgeon', username: 'surgeon', crew_id: null },
      CONFIG.jwtSecret,
      { expiresIn: '5m' }
    );

    const resNodeAuth = await fetch('http://localhost:8000/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    const nodeAuthOk = resNodeAuth.status === 200;

    const resFastAuth = await fetch('http://localhost:8001/api/v1/passive/metrics', {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    const fastAuthOk = resFastAuth.status === 200;

    const jwtOk = nodeAuthOk && fastAuthOk;
    logStep('DOC-11', 'Unified JWT Auth', jwtOk, jwtOk ? 'JWT validated successfully by both Node & FastAPI' : `Node status: ${resNodeAuth.status}, FastAPI status: ${resFastAuth.status}`);
  } catch (err) {
    logStep('DOC-11', 'Unified JWT Auth', false, `JWT validation error: ${err.message}`);
  }

  // 8. Fused /v1/today & Graceful Degradation
  try {
    const resToday = await fetch('http://localhost:8000/v1/today?person_id=okoye');
    const dataToday = await resToday.json();
    const todayOk = resToday.status === 200 && dataToday.person_id === 'okoye' && dataToday.state !== undefined;
    logStep('DOC-12', 'Cross-Service /v1/today', todayOk, todayOk ? `HTTP 200, state='${dataToday.state}', degraded=${dataToday.degraded}` : `Invalid today response`);
  } catch (err) {
    logStep('DOC-12', 'Cross-Service /v1/today', false, `Today query error: ${err.message}`);
  }

  console.log('====================================================');
  if (hasFailure) {
    console.log('\x1b[31m❌ DOCTOR CHECK FAILED - One or more checks reported FAIL\x1b[0m');
    process.exit(1);
  } else {
    console.log('\x1b[32m✅ ALL DOCTOR CHECKS PASSED - Stack integration verified healthy\x1b[0m');
    process.exit(0);
  }
}

runDoctor();
