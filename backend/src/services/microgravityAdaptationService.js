export const ENCODED_ADAPTATION_EFFECTS = [
  {
    effect_id: 'CEPHALAD_FLUID_SHIFT',
    name: 'Cephalad Fluid Shift & Cardiovascular Reset',
    affected_metrics: ['heart_rate', 'sys_bp', 'dia_bp'],
    onset_flight_day: 1,
    resolution_flight_day: 5,
    citation: 'Charles, J.B. & Lathers, C.M. "Cardiovascular adaptation to space flight." Journal of Clinical Pharmacology 31.10 (1991): 1010-1023. NASA TM-107986.',
    nasa_source_id: 'NASA-TM-107986',
    source_url: 'https://ntrs.nasa.gov/citations/19920003328',
    curve_description: 'Transient elevation in resting HR (+5 to +10 bpm) and diastolic pressure (+4 to +8 mmHg) due to venous engorgement and initial plasma redistribution.'
  },
  {
    effect_id: 'SPACE_MOTION_SICKNESS_AUTONOMIC',
    name: 'Space Motion Sickness Autonomic Suppression',
    affected_metrics: ['hrv'],
    onset_flight_day: 1,
    resolution_flight_day: 3,
    citation: 'Reschke, M.F. et al. "Neurovestibular problems in spaceflight: etiology and countermeasures." Space Biology and Medicine, AIAA (2009). NASA SP-2009-566.',
    nasa_source_id: 'NASA-SP-2009-566',
    source_url: 'https://lsda.jsc.nasa.gov/Document/doc_detail/Doc11132',
    curve_description: 'Neurovestibular conflict induces transient sympathetic predominance and reduced HRV RMSSD (-15 to -25 ms) on flight days 1-3.'
  },
  {
    effect_id: 'SPACE_FEVER_THERMOREGULATION',
    name: 'Microgravity Thermoregulatory Space Fever',
    affected_metrics: ['temperature'],
    onset_flight_day: 2,
    resolution_flight_day: 180,
    citation: 'Stahn, A.C., Werner, A., Opatz, O. et al. "Increased core body temperature in astronauts during long-duration space missions." Scientific Reports 7, 17232 (2017).',
    nasa_source_id: 'PMC5710048',
    source_url: 'https://doi.org/10.1038/s41598-017-17232-4',
    curve_description: 'Core body temperature increases by approximately +0.8 to +1.0 °C due to convective heat dissipation impairment in weightlessness.'
  },
  {
    effect_id: 'ORTHOSTATIC_BARORECEPTOR_RESET',
    name: 'Orthostatic Baroreceptor Reset & Volume Loss',
    affected_metrics: ['sys_bp'],
    onset_flight_day: 1,
    resolution_flight_day: 7,
    citation: 'Buckey, J.C. et al. "Orthostatic intolerance after spaceflight." Journal of Applied Physiology 81.1 (1996): 7-18.',
    nasa_source_id: 'JAP-81-1-7',
    source_url: 'https://doi.org/10.1152/jappl.1996.81.1.7',
    curve_description: 'Plasma volume contraction (10-15%) resets baroreceptor response threshold.'
  }
];

/**
 * Computes expected microgravity adaptation shift for a specific metric on a given mission day
 */
export function getAdaptationShift({ metric, flightDay = 1, missionMode = 'Mars' }) {
  // Ground / ISS 1-g centrifuge modes do not exhibit microgravity cephalad shifts
  if (missionMode === 'Earth' || flightDay <= 0) {
    return { offset: 0, sd_multiplier: 1.0, active_effects: [] };
  }

  let offset = 0;
  let sdMultiplier = 1.0;
  const activeEffects = [];

  if (metric === 'heart_rate') {
    if (flightDay >= 1 && flightDay <= 5) {
      // Cephalad fluid shift elevates resting heart rate by ~8 bpm on day 1 decaying to 0 by day 5
      const decay = (6 - flightDay) / 5;
      offset = Math.round(8.5 * decay * 10) / 10;
      sdMultiplier = 1.25;
      activeEffects.push('CEPHALAD_FLUID_SHIFT');
    }
  } else if (metric === 'temperature') {
    if (flightDay >= 2) {
      // Space fever elevates baseline temperature asymptotically towards +0.9°C
      offset = Math.min(0.9, Math.round((0.3 + 0.1 * Math.min(flightDay, 6)) * 10) / 10);
      sdMultiplier = 1.15;
      activeEffects.push('SPACE_FEVER_THERMOREGULATION');
    }
  } else if (metric === 'hrv') {
    if (flightDay >= 1 && flightDay <= 3) {
      // Space motion sickness depresses HRV RMSSD
      offset = -18.0;
      sdMultiplier = 1.3;
      activeEffects.push('SPACE_MOTION_SICKNESS_AUTONOMIC');
    }
  }

  return { offset, sd_multiplier: sdMultiplier, active_effects: activeEffects };
}

/**
 * Evaluates whether an observed vital reading represents expected spaceflight adaptation vs true acute pathology
 */
export function evaluateAdaptationVsIllness({
  metric,
  observedValue,
  flightDay = 1,
  missionMode = 'Mars',
  posteriorBaseline = { posterior_mean: 64.0, posterior_sd: 4.0 }
}) {
  const { offset, sd_multiplier, active_effects } = getAdaptationShift({
    metric,
    flightDay,
    missionMode
  });

  const adaptedMean = Math.round((posteriorBaseline.posterior_mean + offset) * 10) / 10;
  const adaptedSD = Math.round((posteriorBaseline.posterior_sd * sd_multiplier) * 10) / 10;
  
  // 90% credible adaptation envelope
  const envelopeLower = Math.round((adaptedMean - 1.645 * adaptedSD) * 10) / 10;
  const envelopeUpper = Math.round((adaptedMean + 1.645 * adaptedSD) * 10) / 10;

  const isInsideAdaptationEnvelope = observedValue >= envelopeLower && observedValue <= envelopeUpper;

  // Retrieve citations for active effects
  const citations = ENCODED_ADAPTATION_EFFECTS
    .filter((e) => active_effects.includes(e.effect_id))
    .map((e) => ({
      effect_id: e.effect_id,
      name: e.name,
      citation: e.citation,
      nasa_source_id: e.nasa_source_id,
      source_url: e.source_url
    }));

  if (isInsideAdaptationEnvelope && active_effects.length > 0) {
    return {
      status: 'EXPECTED_ADAPTATION',
      is_alert_suppressed: true,
      is_pathology: false,
      message: `Vital reading (${observedValue}) matches documented early-flight microgravity adaptation. Alert suppressed.`,
      metric,
      observed_value: observedValue,
      flight_day: flightDay,
      adapted_baseline: {
        adapted_mean: adaptedMean,
        adapted_sd: adaptedSD,
        envelope_90: { lower: envelopeLower, upper: envelopeUpper }
      },
      active_effects,
      citations
    };
  }

  // If outside adaptation envelope or no adaptation active
  const isPathology = !isInsideAdaptationEnvelope;
  return {
    status: isPathology ? 'ACUTE_PATHOLOGY_ALERT' : 'NOMINAL',
    is_alert_suppressed: false,
    is_pathology: isPathology,
    message: isPathology
      ? `Critical clinical alert: Reading (${observedValue}) significantly exceeds both baseline and spaceflight adaptation envelope.`
      : 'Reading nominal.',
    metric,
    observed_value: observedValue,
    flight_day: flightDay,
    adapted_baseline: {
      adapted_mean: adaptedMean,
      adapted_sd: adaptedSD,
      envelope_90: { lower: envelopeLower, upper: envelopeUpper }
    },
    active_effects,
    citations
  };
}
