import { queryOfflineMedicalAssistant } from './offlineRagService.js';
import { getMissionConfig } from './missionConfigService.js';

// Router State
let preferredMode = 'AUTO'; // 'AUTO', 'CLOUD_API', 'LOCAL_OFFLINE'
let isNetworkCableConnected = true; // Simulates physical network cable / ground link
let fallbackCount = 0;
let requestCounter = 0;
const latencyLog = [];

export function getDualModeStatus() {
  const effectiveMode = resolveEffectiveMode();
  return {
    preferred_mode: preferredMode,
    effective_mode: effectiveMode,
    is_network_cable_connected: isNetworkCableConnected,
    fallback_count: fallbackCount,
    total_requests: requestCounter,
    recent_latencies_ms: latencyLog.slice(-10),
    local_latency_budget_ms: 2000,
    timestamp: new Date().toISOString()
  };
}

export function setPreferredMode(mode) {
  if (!['AUTO', 'CLOUD_API', 'LOCAL_OFFLINE'].includes(mode)) {
    throw new Error(`Invalid mode: ${mode}. Must be AUTO, CLOUD_API, or LOCAL_OFFLINE`);
  }
  preferredMode = mode;
  return getDualModeStatus();
}

export function simulateNetworkCable(connected) {
  isNetworkCableConnected = Boolean(connected);
  return {
    is_network_cable_connected: isNetworkCableConnected,
    effective_mode: resolveEffectiveMode()
  };
}

export function resetDualModeRouter() {
  preferredMode = 'AUTO';
  isNetworkCableConnected = true;
  fallbackCount = 0;
  requestCounter = 0;
  latencyLog.length = 0;
}

// Check health / ground link availability
export function checkCloudLinkHealth() {
  if (!isNetworkCableConnected) {
    return { is_healthy: false, reason: 'Physical link severed / network cable unplugged' };
  }

  // Check mission config for comms blackout if present
  try {
    const config = getMissionConfig();
    if (config?.is_blackout) {
      return { is_healthy: false, reason: 'Mission comms blackout scheduled' };
    }
  } catch {
    // Non-blocking if mission config is uninitialized
  }

  return { is_healthy: true, reason: 'Ground uplink nominal' };
}

// Resolve effective mode
export function resolveEffectiveMode() {
  if (preferredMode === 'LOCAL_OFFLINE') {
    return 'LOCAL_OFFLINE';
  }

  const health = checkCloudLinkHealth();
  if (health.is_healthy) {
    return preferredMode === 'LOCAL_OFFLINE' ? 'LOCAL_OFFLINE' : 'CLOUD_API';
  }

  // Fallback to local
  return 'LOCAL_OFFLINE';
}

// Simulated Cloud Model with telemetry
async function executeCloudInference(query, options = {}) {
  const startTime = Date.now();
  // Simulate cloud query with ground medical knowledge base
  const localRag = await queryOfflineMedicalAssistant(query, options);

  const duration = Math.max(12, Date.now() - startTime);

  return {
    ...localRag,
    answer: `[Cloud-Assisted] ${localRag.answer}`,
    mode_used: 'CLOUD_API',
    latency_ms: duration,
    cloud_verified: true
  };
}

// Local Edge Model
async function executeLocalInference(query, options = {}) {
  const startTime = Date.now();
  const localRag = await queryOfflineMedicalAssistant(query, options);
  const duration = Math.max(5, Date.now() - startTime);

  return {
    ...localRag,
    mode_used: 'LOCAL_OFFLINE',
    latency_ms: duration,
    edge_isolated: true
  };
}

// Main dual-mode execution entry point
export async function executeDualModeQuery(query, options = {}) {
  requestCounter++;
  const startTime = Date.now();
  const health = checkCloudLinkHealth();

  let result;
  let modeUsed;

  if (preferredMode === 'LOCAL_OFFLINE') {
    modeUsed = 'LOCAL_OFFLINE';
    result = await executeLocalInference(query, options);
  } else if (!health.is_healthy) {
    // Pull network cable / severed link fallback path!
    fallbackCount++;
    modeUsed = 'LOCAL_OFFLINE';
    result = await executeLocalInference(query, options);
    result.fallback_triggered = true;
    result.fallback_reason = health.reason;
  } else {
    // Healthy cloud link
    modeUsed = 'CLOUD_API';
    result = await executeCloudInference(query, options);
  }

  const totalDuration = Date.now() - startTime;
  latencyLog.push(totalDuration);
  if (latencyLog.length > 50) latencyLog.shift();

  return {
    ...result,
    mode_used: modeUsed,
    total_pipeline_latency_ms: totalDuration,
    within_latency_budget: totalDuration < 2000
  };
}
