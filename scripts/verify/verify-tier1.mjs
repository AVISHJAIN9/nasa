import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import mongoose from '../../backend/node_modules/mongoose/index.js';
import { createApp } from '../../backend/src/app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CHECKS_DIR = path.join(__dirname, 'checks');
const OUT_RESULTS = path.join(__dirname, 'results-tier1.json');

process.on('unhandledRejection', (reason) => {
  // Log unhandled promise rejection without crashing suite
  console.warn('Unhandled rejection caught by verify runner:', reason?.message || reason);
});

async function runWithTimeout(promise, ms, name) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function run() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27018/astrocare';
  try {
    await mongoose.connect(MONGODB_URI);
  } catch (err) {
    console.warn('MongoDB connection warning:', err.message);
  }

  const app = await createApp();
  const checkFiles = fs.readdirSync(CHECKS_DIR).filter((f) => f.startsWith('check-') && f.endsWith('.mjs'));
  checkFiles.sort();

  console.log(`Running Tier 1 verification suite (${checkFiles.length} feature checks)...\n`);
  console.log('ID        | RESULT | EVIDENCE');
  console.log('----------|--------|--------------------------------------------------------------------------------');

  const results = [];
  let passCount = 0;
  let failCount = 0;

  for (const file of checkFiles) {
    const fullPath = path.join(CHECKS_DIR, file);
    try {
      const module = await import(pathToFileURL(fullPath).href);
      const res = await runWithTimeout(
        module.verify({
          app,
          mode: process.env.VITE_USE_MOCKS === 'false' ? 'live' : 'mock'
        }),
        8000,
        file
      );

      const pass = !!res.pass;
      const statusLabel = pass ? 'PASS' : 'FAIL';

      if (pass) passCount++;
      else failCount++;

      results.push({
        id: res.id,
        check_file: `scripts/verify/checks/${file}`,
        pass,
        status: res.status || (pass ? 'DONE-VERIFIED' : 'EXISTS-UNVERIFIED'),
        evidence: res.evidence || (pass ? 'Check passed' : 'Check failed'),
      });

      const paddedId = (res.id || '').padEnd(9, ' ');
      console.log(`${paddedId} | ${statusLabel.padEnd(6, ' ')} | ${res.evidence}`);
    } catch (err) {
      failCount++;
      const id = file.replace('check-', '').replace('.mjs', '').replace('_', ':');
      results.push({
        id,
        check_file: `scripts/verify/checks/${file}`,
        pass: false,
        status: 'EXISTS-UNVERIFIED',
        evidence: `Check execution failed: ${err.message}`,
        error: err.stack,
      });
      const paddedId = id.padEnd(9, ' ');
      console.log(`${paddedId} | FAIL   | Check execution error: ${err.message}`);
    }
  }

  console.log('\n================================================================================');
  console.log(`Tier 1 Verification Summary: ${passCount} PASSED, ${failCount} FAILED out of ${checkFiles.length} checks.`);
  console.log('================================================================================\n');

  fs.writeFileSync(OUT_RESULTS, JSON.stringify(results, null, 2), 'utf-8');

  try {
    await mongoose.disconnect();
  } catch {}

  if (failCount > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Tier 1 verification runner fatal error:', err);
  process.exit(1);
});
