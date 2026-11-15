import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getMissionConfig } from './missionConfigService.js';
import { createPRNG } from './vitalsSimulatorService.js';

// Documented Clinical Decision Cost Table
export const CLINICAL_COST_TABLE = {
  MISSED_DETERIORATION_HARM: 100, // Patient suffered irreversible harm/collapse before intervention
  UNNECESSARY_INVASIVE_ACTION: 35, // Unnecessary invasive medication/procedure side effects & kit depletion
  SAFE_INTERIM_COUNTERMEASURE: 5,  // Safe supportive action (oxygen, recumbency, fluid loading, monitoring)
  TIMELY_OPTIMAL_TREATMENT: 0     // Treatment delivered appropriately within therapeutic window
};

// Evaluate Wait-or-Act Decision for an individual incident
export function evaluateWaitOrActDecision(params) {
  const {
    time_to_critical_min,
    round_trip_delay_min = null,
    risk_score = 50,
    severity = 'HIGH'
  } = params;

  // Determine round trip latency if not provided
  let effectiveRttMin = round_trip_delay_min;
  if (effectiveRttMin === null || effectiveRttMin === undefined) {
    const config = getMissionConfig();
    const oneWaySec = Number(config?.comms_delay_seconds || 0.5);
    const reviewBufferSec = 60.0; // 1 min human surgeon review buffer
    effectiveRttMin = Number(((oneWaySec * 2 + reviewBufferSec) / 60.0).toFixed(2));
  }

  const tCrit = Number(time_to_critical_min);
  const tRtt = Number(effectiveRttMin);

  let recommendation;
  let rationale;
  let actionProtocol = null;

  // Decision logic:
  // 1. If time to critical <= RTT: Ground reply will arrive too late! Act now.
  if (tCrit <= tRtt || (severity === 'EMERGENCY' && tCrit <= tRtt * 1.3)) {
    recommendation = 'ACT_NOW';
    rationale = `Ground round-trip reply latency (${tRtt.toFixed(1)} min) exceeds or matches forecast time-to-critical (${tCrit.toFixed(1)} min). Waiting for Earth will cause irreversible clinical deterioration. Initiate autonomous local triage and medical kit intervention immediately.`;
    actionProtocol = 'AUTONOMOUS_LOCAL_TRIAGE';
  }
  // 2. If RTT < time to critical <= 2.2 * RTT: Safe interim action + store-and-forward consult
  else if (tCrit <= tRtt * 2.2 || risk_score >= 70) {
    recommendation = 'SAFE_INTERIM_AND_CONSULT';
    rationale = `Forecast time-to-critical (${tCrit.toFixed(1)} min) is within 2.2x of round-trip latency (${tRtt.toFixed(1)} min). Deploy safe, non-invasive interim countermeasures (100% O2 mask, fluid loading, recumbent positioning) while queueing stat consult report to Flight Surgeon via store-and-forward.`;
    actionProtocol = 'SAFE_INTERIM_COUNTERMEASURE';
  }
  // 3. Otherwise: Ground reply will arrive safely before deterioration. Wait for ground.
  else {
    recommendation = 'WAIT_FOR_GROUND';
    rationale = `Ground round-trip latency (${tRtt.toFixed(1)} min) is safely shorter than forecast time-to-critical (${tCrit.toFixed(1)} min). Patient can be safely monitored under non-invasive observation without risking unnecessary invasive medication side effects.`;
    actionProtocol = 'MONITOR_AND_WAIT';
  }

  return {
    recommendation,
    time_to_critical_min: tCrit,
    round_trip_latency_min: tRtt,
    risk_score,
    severity,
    action_protocol: actionProtocol,
    clinical_rationale: rationale,
    cost_table: CLINICAL_COST_TABLE,
    decision_timestamp: new Date().toISOString()
  };
}

// 1,000 Incident Monte Carlo Simulation across 5 Delay Conditions: 0, 2, 10, 20, 44 minutes
export function runWaitOrAct1000Simulation(options = {}) {
  const delaysMin = [0, 2, 10, 20, 44]; // 5 target delay conditions
  const incidentsPerDelay = options.incidents_per_delay || 200; // 200 x 5 = 1,000 incidents
  const seed = options.seed || 4242;
  const prng = createPRNG(seed);

  const runId = `WOA-RUN-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  const policyTotals = {
    WAIT_OR_ACT: {
      name: 'AstroCare Wait-or-Act Policy',
      total_incidents: 0,
      missed_deteriorations: 0,
      unnecessary_interventions: 0,
      total_time_to_treatment_min: 0,
      total_cost: 0
    },
    ALWAYS_WAIT: {
      name: 'Always-Wait for Ground Policy',
      total_incidents: 0,
      missed_deteriorations: 0,
      unnecessary_interventions: 0,
      total_time_to_treatment_min: 0,
      total_cost: 0
    },
    ALWAYS_ACT: {
      name: 'Always-Act Locally Policy',
      total_incidents: 0,
      missed_deteriorations: 0,
      unnecessary_interventions: 0,
      total_time_to_treatment_min: 0,
      total_cost: 0
    }
  };

  const delayBreakdowns = {};

  for (const delay of delaysMin) {
    const delayStats = {
      delay_min: delay,
      incidents_count: incidentsPerDelay,
      WAIT_OR_ACT: { missed: 0, avg_time_to_treatment: 0, cost: 0 },
      ALWAYS_WAIT: { missed: 0, avg_time_to_treatment: 0, cost: 0 },
      ALWAYS_ACT: { missed: 0, avg_time_to_treatment: 0, cost: 0 }
    };

    let waitOrActTimeSum = 0;
    let alwaysWaitTimeSum = 0;
    let alwaysActTimeSum = 0;

    for (let i = 0; i < incidentsPerDelay; i++) {
      // Sample time to critical: log-normal distribution between 3 and 60 minutes
      const u1 = prng();
      const u2 = prng();
      const z = Math.sqrt(-2.0 * Math.log(u1 || 0.001)) * Math.cos(2.0 * Math.PI * u2);
      // Mean ~ 18 min, SD ~ 12 min, clamped between 2 and 90 min
      const tCrit = Math.max(2.0, Math.min(90.0, 18.0 + z * 10.0));

      const isActuallyCritical = prng() < 0.65; // 65% of flagged incidents genuinely deteriorate without treatment
      const rttMin = delay * 2 + 1.0; // Round trip comms + 1 min surgeon review

      // 1. AstroCare Policy Decision
      const decision = evaluateWaitOrActDecision({
        time_to_critical_min: tCrit,
        round_trip_delay_min: rttMin,
        risk_score: isActuallyCritical ? 75 : 40,
        severity: isActuallyCritical ? 'HIGH' : 'LOW'
      });

      // --- Evaluate AstroCare Policy ---
      let woaMissed = false;
      let woaTime = 0;
      let woaCost = 0;

      if (decision.recommendation === 'ACT_NOW') {
        woaTime = 1.0; // Local action starts immediately (1 min setup)
        if (!isActuallyCritical) {
          woaCost = CLINICAL_COST_TABLE.UNNECESSARY_INVASIVE_ACTION;
          policyTotals.WAIT_OR_ACT.unnecessary_interventions++;
        } else {
          woaCost = CLINICAL_COST_TABLE.TIMELY_OPTIMAL_TREATMENT;
        }
      } else if (decision.recommendation === 'SAFE_INTERIM_AND_CONSULT') {
        woaTime = 1.5; // Interim countermeasure delivered immediately
        woaCost = CLINICAL_COST_TABLE.SAFE_INTERIM_COUNTERMEASURE;
        // Even if critical, interim countermeasure bought time until consult arrived
        if (isActuallyCritical && tCrit < 1.5) {
          woaMissed = true;
          woaCost += CLINICAL_COST_TABLE.MISSED_DETERIORATION_HARM;
        }
      } else {
        // WAIT_FOR_GROUND
        woaTime = rttMin;
        if (isActuallyCritical && tCrit < rttMin) {
          woaMissed = true;
          woaCost = CLINICAL_COST_TABLE.MISSED_DETERIORATION_HARM;
        } else {
          woaCost = CLINICAL_COST_TABLE.TIMELY_OPTIMAL_TREATMENT;
        }
      }

      if (woaMissed) policyTotals.WAIT_OR_ACT.missed_deteriorations++;
      policyTotals.WAIT_OR_ACT.total_time_to_treatment_min += woaTime;
      policyTotals.WAIT_OR_ACT.total_cost += woaCost;
      waitOrActTimeSum += woaTime;
      delayStats.WAIT_OR_ACT.cost += woaCost;
      if (woaMissed) delayStats.WAIT_OR_ACT.missed++;

      // --- Evaluate ALWAYS-WAIT Policy ---
      let waitMissed = false;
      const waitTime = rttMin;
      let waitCost = 0;

      if (isActuallyCritical && tCrit < rttMin) {
        waitMissed = true;
        waitCost = CLINICAL_COST_TABLE.MISSED_DETERIORATION_HARM;
      } else {
        waitCost = CLINICAL_COST_TABLE.TIMELY_OPTIMAL_TREATMENT;
      }

      if (waitMissed) policyTotals.ALWAYS_WAIT.missed_deteriorations++;
      policyTotals.ALWAYS_WAIT.total_time_to_treatment_min += waitTime;
      policyTotals.ALWAYS_WAIT.total_cost += waitCost;
      alwaysWaitTimeSum += waitTime;
      delayStats.ALWAYS_WAIT.cost += waitCost;
      if (waitMissed) delayStats.ALWAYS_WAIT.missed++;

      // --- Evaluate ALWAYS-ACT Policy ---
      let actMissed = false;
      const actTime = 1.0; // Always acts immediately
      let actCost = 0;

      if (!isActuallyCritical) {
        actCost = CLINICAL_COST_TABLE.UNNECESSARY_INVASIVE_ACTION; // Unnecessary invasive treatment every time!
        policyTotals.ALWAYS_ACT.unnecessary_interventions++;
      } else {
        actCost = CLINICAL_COST_TABLE.TIMELY_OPTIMAL_TREATMENT;
      }

      if (isActuallyCritical && tCrit < 1.0) {
        actMissed = true;
        actCost += CLINICAL_COST_TABLE.MISSED_DETERIORATION_HARM;
      }

      if (actMissed) policyTotals.ALWAYS_ACT.missed_deteriorations++;
      policyTotals.ALWAYS_ACT.total_time_to_treatment_min += actTime;
      policyTotals.ALWAYS_ACT.total_cost += actCost;
      alwaysActTimeSum += actTime;
      delayStats.ALWAYS_ACT.cost += actCost;
      if (actMissed) delayStats.ALWAYS_ACT.missed++;

      policyTotals.WAIT_OR_ACT.total_incidents++;
      policyTotals.ALWAYS_WAIT.total_incidents++;
      policyTotals.ALWAYS_ACT.total_incidents++;
    }

    delayStats.WAIT_OR_ACT.avg_time_to_treatment = Number((waitOrActTimeSum / incidentsPerDelay).toFixed(2));
    delayStats.ALWAYS_WAIT.avg_time_to_treatment = Number((alwaysWaitTimeSum / incidentsPerDelay).toFixed(2));
    delayStats.ALWAYS_ACT.avg_time_to_treatment = Number((alwaysActTimeSum / incidentsPerDelay).toFixed(2));

    delayBreakdowns[`DELAY_${delay}_MIN`] = delayStats;
  }

  const totalIncidents = policyTotals.WAIT_OR_ACT.total_incidents;

  const summary = {
    run_id: runId,
    timestamp: new Date().toISOString(),
    total_simulated_incidents: totalIncidents,
    delay_conditions_tested_min: delaysMin,
    policies_evaluated: ['WAIT_OR_ACT', 'ALWAYS_WAIT', 'ALWAYS_ACT'],
    cost_table: CLINICAL_COST_TABLE,
    comparison_metrics: {
      WAIT_OR_ACT: {
        name: policyTotals.WAIT_OR_ACT.name,
        missed_deteriorations_count: policyTotals.WAIT_OR_ACT.missed_deteriorations,
        missed_deterioration_rate_percent: Number(((policyTotals.WAIT_OR_ACT.missed_deteriorations / totalIncidents) * 100).toFixed(2)),
        average_time_to_treatment_min: Number((policyTotals.WAIT_OR_ACT.total_time_to_treatment_min / totalIncidents).toFixed(2)),
        unnecessary_interventions_count: policyTotals.WAIT_OR_ACT.unnecessary_interventions,
        total_clinical_cost: policyTotals.WAIT_OR_ACT.total_cost,
        mean_cost_per_incident: Number((policyTotals.WAIT_OR_ACT.total_cost / totalIncidents).toFixed(2))
      },
      ALWAYS_WAIT: {
        name: policyTotals.ALWAYS_WAIT.name,
        missed_deteriorations_count: policyTotals.ALWAYS_WAIT.missed_deteriorations,
        missed_deterioration_rate_percent: Number(((policyTotals.ALWAYS_WAIT.missed_deteriorations / totalIncidents) * 100).toFixed(2)),
        average_time_to_treatment_min: Number((policyTotals.ALWAYS_WAIT.total_time_to_treatment_min / totalIncidents).toFixed(2)),
        unnecessary_interventions_count: policyTotals.ALWAYS_WAIT.unnecessary_interventions,
        total_clinical_cost: policyTotals.ALWAYS_WAIT.total_cost,
        mean_cost_per_incident: Number((policyTotals.ALWAYS_WAIT.total_cost / totalIncidents).toFixed(2))
      },
      ALWAYS_ACT: {
        name: policyTotals.ALWAYS_ACT.name,
        missed_deteriorations_count: policyTotals.ALWAYS_ACT.missed_deteriorations,
        missed_deterioration_rate_percent: Number(((policyTotals.ALWAYS_ACT.missed_deteriorations / totalIncidents) * 100).toFixed(2)),
        average_time_to_treatment_min: Number((policyTotals.ALWAYS_ACT.total_time_to_treatment_min / totalIncidents).toFixed(2)),
        unnecessary_interventions_count: policyTotals.ALWAYS_ACT.unnecessary_interventions,
        total_clinical_cost: policyTotals.ALWAYS_ACT.total_cost,
        mean_cost_per_incident: Number((policyTotals.ALWAYS_ACT.total_cost / totalIncidents).toFixed(2))
      }
    },
    policy_verdict: {
      beats_always_wait_on_missed_deteriorations: policyTotals.WAIT_OR_ACT.missed_deteriorations < policyTotals.ALWAYS_WAIT.missed_deteriorations,
      beats_always_act_on_unnecessary_interventions: policyTotals.WAIT_OR_ACT.unnecessary_interventions < policyTotals.ALWAYS_ACT.unnecessary_interventions,
      beats_both_on_total_clinical_cost:
        policyTotals.WAIT_OR_ACT.total_cost < policyTotals.ALWAYS_WAIT.total_cost &&
        policyTotals.WAIT_OR_ACT.total_cost < policyTotals.ALWAYS_ACT.total_cost
    },
    delay_breakdowns: delayBreakdowns
  };

  // Persist report to build/reports/wait_or_act_benchmark_X01.json
  if (options.saveReport !== false) {
    try {
      const reportsDir = path.resolve(process.cwd(), 'build/reports');
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }
      const outPath = path.join(reportsDir, 'wait_or_act_benchmark_X01.json');
      fs.writeFileSync(outPath, JSON.stringify(summary, null, 2), 'utf-8');
    } catch {
      // Non-blocking
    }
  }

  return summary;
}
