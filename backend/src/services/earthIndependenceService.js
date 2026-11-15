import { getMissionConfig } from './missionConfigService.js';
import { isBlackoutActive } from './delayEmulatorService.js';
import { getDualModeStatus } from './llmDualModeService.js';

export const AUTONOMY_LEVELS = {
  LEVEL_0: {
    level: 0,
    name: 'GROUND_LED',
    title: 'Level 0: Ground-Led Operations',
    description: 'Ground Flight Surgeon actively directs medical care in real-time over low-latency link.',
    max_delay_seconds: 2.0
  },
  LEVEL_1: {
    level: 1,
    name: 'SUPPORTED_AUTONOMOUS',
    title: 'Level 1: Supported Autonomous Operations',
    description: 'Onboard clinical decision support assists crew; ground reviews actions in near-real-time.',
    max_delay_seconds: 60.0
  },
  LEVEL_2: {
    level: 2,
    name: 'HIGH_INDEPENDENCE',
    title: 'Level 2: High Independence Operations',
    description: 'Crew and onboard AI execute autonomous triage and interventions; asynchronous store-and-forward consults dispatched to surgeon.',
    max_delay_seconds: 900.0 // 15 min
  },
  LEVEL_3: {
    level: 3,
    name: 'FULLY_AUTONOMOUS',
    title: 'Level 3: Fully Autonomous Operations',
    description: 'Crew operates with zero real-time reliance on Earth; clinical triage, procedures, and resuscitation executed 100% onboard.',
    max_delay_seconds: Infinity
  }
};

// Calculate Earth-Independence Score (0-100) and Autonomy Level (0-3)
export function calculateEarthIndependenceScore(options = {}) {
  const config = getMissionConfig();
  const dualModeStatus = getDualModeStatus();

  // 1. One-way latency in seconds
  let delaySeconds = options.delay_seconds !== undefined
    ? Number(options.delay_seconds)
    : Number(config?.comms_delay_seconds || 0.5);

  // 2. Link state and blackout
  let isBlackout = options.is_blackout !== undefined
    ? Boolean(options.is_blackout)
    : isBlackoutActive().is_blackout || config?.is_blackout || !dualModeStatus.is_network_cable_connected;

  // 3. Clinical event severity
  const severity = (options.severity || 'LOW').toUpperCase();

  // --- Calculate Score Components ---
  // A. Delay component (0 - 65 pts): logarithmic scaling from 0.5s to 2400s
  let delayScore = 0;
  if (delaySeconds <= 1.0) {
    delayScore = 8.0; // ISS nominal ~ 8
  } else if (delaySeconds <= 5.0) {
    delayScore = 25.0; // Moon nominal ~ 25
  } else if (delaySeconds <= 120.0) {
    delayScore = 45.0;
  } else if (delaySeconds <= 720.0) {
    delayScore = 65.0; // Mars nominal (12 min) ~ 65
  } else {
    delayScore = 75.0; // Deep space / opposition
  }

  // B. Blackout / Disconnect component (0 - 25 pts)
  let blackoutScore = 0;
  if (isBlackout) {
    blackoutScore = 25.0; // Blackout forces immediate high autonomy
  }

  // C. Clinical Severity urgency component (0 - 15 pts)
  let severityScore = 0;
  if (severity === 'EMERGENCY' || severity === 'CRITICAL') {
    severityScore = 15.0;
  } else if (severity === 'HIGH' || severity === 'URGENT') {
    severityScore = 8.0;
  } else if (severity === 'MEDIUM' || severity === 'WARNING') {
    severityScore = 4.0;
  }

  // Raw combined score (clamped between 5.0 and 100.0)
  const rawScore = delayScore + blackoutScore + severityScore;
  const totalScore = Number(Math.max(5.0, Math.min(100.0, rawScore)).toFixed(1));

  // Determine Autonomy Level
  let autonomyLevel;
  if (totalScore < 25.0) {
    autonomyLevel = AUTONOMY_LEVELS.LEVEL_0;
  } else if (totalScore < 55.0) {
    autonomyLevel = AUTONOMY_LEVELS.LEVEL_1;
  } else if (totalScore < 80.0) {
    autonomyLevel = AUTONOMY_LEVELS.LEVEL_2;
  } else {
    autonomyLevel = AUTONOMY_LEVELS.LEVEL_3;
  }

  // Generate ML2 explainability narrative
  const explanation = generateAutonomyExplanation({
    totalScore,
    autonomyLevel,
    delaySeconds,
    isBlackout,
    severity,
    mode: config?.mode || 'ISS'
  });

  return {
    earth_independence_score: totalScore,
    autonomy_level: autonomyLevel.level,
    autonomy_name: autonomyLevel.name,
    autonomy_title: autonomyLevel.title,
    autonomy_description: autonomyLevel.description,
    components: {
      delay_seconds: delaySeconds,
      delay_contribution_score: delayScore,
      is_blackout: isBlackout,
      blackout_contribution_score: blackoutScore,
      event_severity: severity,
      severity_contribution_score: severityScore
    },
    mission_mode: config?.mode || 'ISS',
    clinical_explanation: explanation,
    calculated_at: new Date().toISOString()
  };
}

// ML2 Clinical Narrative Generator
function generateAutonomyExplanation({ totalScore, autonomyLevel, delaySeconds, isBlackout, severity, mode }) {
  const parts = [];

  parts.push(`Crew autonomy is operating at ${autonomyLevel.title} (Independence Score: ${totalScore}/100) under ${mode} mission profile.`);

  if (isBlackout) {
    parts.push('Active communications blackout / severed ground link detected. All ground guidance is unavailable; crew must operate with 100% onboard clinical independence.');
  } else if (delaySeconds > 300) {
    const mins = (delaySeconds / 60).toFixed(1);
    parts.push(`One-way latency is ${mins} minutes. Real-time telemedicine is physically impossible under relativistic orbital distances; all triage decisions execute onboard.`);
  } else if (delaySeconds > 1.0) {
    parts.push(`One-way latency is ${delaySeconds.toFixed(1)} seconds. Moderate delay permits supported autonomous triage with retrospective ground debrief.`);
  } else {
    parts.push('Near-zero round-trip latency allows nominal real-time Flight Surgeon oversight and telemedicine.');
  }

  if (severity === 'EMERGENCY' || severity === 'CRITICAL') {
    parts.push('High clinical acuity requires instantaneous local action; waiting for telemetry review is contraindicated.');
  }

  return parts.join(' ');
}
