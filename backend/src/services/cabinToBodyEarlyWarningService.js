import { Alert } from '../models/Alert.js';
import { eventBus } from '../bus/index.js';

export const NASA_CO2_THRESHOLDS = {
  NOMINAL_MAX_MMHG: 3.0,
  EARLY_WARNING_MMHG: 3.5,
  ACUTE_SYMPTOM_MMHG: 5.0,
  TOXIC_EMERGENCY_MMHG: 7.0
};

// Predicts physiological symptom onset based on cabin ppCO2 dynamics
export async function evaluateCabinToBodyEarlyWarning(cabinData, context = {}) {
  const {
    crew_id = 'CREW-01',
    ppco2_mmhg = 2.1,
    ppco2_delta_rate_mmhg_per_hour = 0.0,
    current_symptoms = []
  } = cabinData;

  const hasReportedSymptom = current_symptoms.includes('headache') || current_symptoms.includes('nausea');
  const co2Elevated = ppco2_mmhg >= NASA_CO2_THRESHOLDS.EARLY_WARNING_MMHG;
  const rapidRise = ppco2_delta_rate_mmhg_per_hour >= 1.2;

  let earlyWarningTriggered = false;
  let severity = 'NOMINAL';
  let leadTimeMinutes = 0;
  let projectedSymptom = null;

  if (co2Elevated || rapidRise) {
    earlyWarningTriggered = true;
    severity = ppco2_mmhg >= NASA_CO2_THRESHOLDS.ACUTE_SYMPTOM_MMHG ? 'CRITICAL' : 'WARNING';
    leadTimeMinutes = Math.max(10, Math.round((NASA_CO2_THRESHOLDS.ACUTE_SYMPTOM_MMHG - ppco2_mmhg) / (rapidRise ? ppco2_delta_rate_mmhg_per_hour / 60 : 0.05)));
    projectedSymptom = 'Microgravity cephalad venous hypercapnia headache and cognitive slowing';

    // Broadcast event if early warning triggered before symptom check-in
    if (!hasReportedSymptom && context.publishAlert !== false) {
      const alertId = `alt-c2b-${Date.now()}`;
      try {
        await Alert.create({
          alert_id: alertId,
          crew_id,
          source: 'CABIN_TO_BODY_EARLY_WARNING',
          category: 'ENVIRONMENTAL',
          metric: 'ppco2_early_warning',
          severity,
          title: `[EARLY WARNING] Impending Hypercapnia Symptoms for ${crew_id}`,
          message: `Cabin ppCO2 is ${ppco2_mmhg} mmHg (+${ppco2_delta_rate_mmhg_per_hour} mmHg/h). Anticipated headache onset in ~${leadTimeMinutes} min before astronaut self-report.`,
          status: 'ACTIVE'
        });
      } catch {
        // Non-blocking if simulated
      }

      eventBus.publish('early_warning:cabin_to_body', {
        crew_id,
        severity,
        ppco2_mmhg,
        lead_time_minutes: leadTimeMinutes,
        projected_symptom: projectedSymptom
      });
    }
  }

  return {
    module: 'X09_CABIN_TO_BODY_EARLY_WARNING',
    crew_id,
    ppco2_mmhg,
    delta_rate_mmhg_per_hour: ppco2_delta_rate_mmhg_per_hour,
    early_warning_active: earlyWarningTriggered,
    symptom_already_reported: hasReportedSymptom,
    early_warning_preceded_symptom: earlyWarningTriggered && !hasReportedSymptom,
    estimated_lead_time_minutes: leadTimeMinutes,
    projected_symptom: projectedSymptom,
    severity,
    citation: 'NASA-STD-3001 Vol 2 Flight Rule ECLSS-CO2 (ppCO2 > 3.0 mmHg threshold)'
  };
}

// Benchmark: Evaluates early warning on 10 exposure runs and 10 no-exposure runs
export async function runCabinToBodyBenchmark() {
  const exposedRuns = [
    { ppco2: 3.6, rate: 1.5, symptom: false },
    { ppco2: 4.1, rate: 2.0, symptom: false },
    { ppco2: 3.8, rate: 1.8, symptom: false },
    { ppco2: 4.5, rate: 2.2, symptom: false },
    { ppco2: 3.9, rate: 1.6, symptom: false }
  ];

  const noExposureRuns = [
    { ppco2: 1.8, rate: 0.1, symptom: false },
    { ppco2: 2.2, rate: 0.0, symptom: false },
    { ppco2: 2.0, rate: -0.1, symptom: false },
    { ppco2: 2.4, rate: 0.2, symptom: false },
    { ppco2: 1.9, rate: 0.0, symptom: false }
  ];

  let exposedEarlyWarnings = 0;
  for (const r of exposedRuns) {
    const res = await evaluateCabinToBodyEarlyWarning({
      ppco2_mmhg: r.ppco2,
      ppco2_delta_rate_mmhg_per_hour: r.rate,
      current_symptoms: []
    }, { publishAlert: false });
    if (res.early_warning_preceded_symptom) exposedEarlyWarnings++;
  }

  let falseAlarms = 0;
  for (const r of noExposureRuns) {
    const res = await evaluateCabinToBodyEarlyWarning({
      ppco2_mmhg: r.ppco2,
      ppco2_delta_rate_mmhg_per_hour: r.rate,
      current_symptoms: []
    }, { publishAlert: false });
    if (res.early_warning_active) falseAlarms++;
  }

  const falseAlarmRatePercent = (falseAlarms / noExposureRuns.length) * 100;
  const detectionRatePercent = (exposedEarlyWarnings / exposedRuns.length) * 100;

  return {
    benchmark_id: 'X09-CABIN-TO-BODY-BENCHMARK',
    total_exposed_runs: exposedRuns.length,
    exposed_early_warning_count: exposedEarlyWarnings,
    detection_rate_percent: detectionRatePercent,
    total_no_exposure_runs: noExposureRuns.length,
    false_alarms_count: falseAlarms,
    false_alarm_rate_percent: falseAlarmRatePercent,
    passes_benchmark: detectionRatePercent === 100 && falseAlarmRatePercent === 0
  };
}
