import mongoose from 'mongoose';
import { CrewProfile } from '../models/CrewProfile.js';

export const WHAT_IF_SCENARIOS = {
  NO_EXERCISE_2_WEEKS: {
    id: 'NO_EXERCISE_2_WEEKS',
    title: 'Exercise Countermeasure Cessation (2 Weeks)',
    category: 'DECONDITIONING',
    duration_days: 14,
    description: 'Simulates physiological deconditioning when ARED resistive and T2 treadmill exercise countermeasures are halted.',
    baseline_effects: {
      resting_hr_delta: +8.5, // bpm
      bone_density_loss_pct: -1.2, // %
      muscle_mass_loss_pct: -2.8, // %
      vo2_max_delta_pct: -14.0, // %
      risk_score_delta: +28
    },
    projected_timeline: [
      { day: 1, hr_delta: +0.5, muscle_loss_pct: -0.1, risk_delta: +2 },
      { day: 3, hr_delta: +1.8, muscle_loss_pct: -0.6, risk_delta: +6 },
      { day: 7, hr_delta: +4.2, muscle_loss_pct: -1.4, risk_delta: +14 },
      { day: 10, hr_delta: +6.5, muscle_loss_pct: -2.1, risk_delta: +21 },
      { day: 14, hr_delta: +8.5, muscle_loss_pct: -2.8, risk_delta: +28 }
    ],
    countermeasures: [
      'Resume cycle ergometer at 70% VO2 max for 45 min/day.',
      'Re-engage ARED deadlift and squat protocol with gradual load progression.',
      'Prescribe daily vitamin D3 and calcium supplementation.'
    ]
  },

  SOLAR_PARTICLE_EVENT: {
    id: 'SOLAR_PARTICLE_EVENT',
    title: 'Solar Particle Event (SPE) Radiation Storm',
    category: 'RADIATION',
    duration_days: 3,
    description: 'Simulates acute solar particle coronal mass ejection delivering 120 mGy ionizing radiation flux.',
    baseline_effects: {
      cumulative_dose_mgy: +120.0,
      lymphocyte_suppression_pct: -32.0,
      nausea_risk_score: 6.8,
      risk_score_delta: +42
    },
    projected_timeline: [
      { hour: 2, dose_accumulated: 15, nausea_index: 2.1, risk_delta: +10 },
      { hour: 8, dose_accumulated: 55, nausea_index: 4.8, risk_delta: +25 },
      { hour: 24, dose_accumulated: 95, nausea_index: 6.5, risk_delta: +38 },
      { hour: 72, dose_accumulated: 120, nausea_index: 4.2, risk_delta: +42 }
    ],
    countermeasures: [
      'Order crew to Crew Quarters Bay 2 water-wall storm shelter.',
      'Deploy supplemental polyethylene radiation shields on sleep berths.',
      'Administer radioprotective antioxidant regimen (amifostine analogue / N-acetylcysteine).'
    ]
  },

  CABIN_DEPRESSURIZATION_DEHYDRATION: {
    id: 'CABIN_DEPRESSURIZATION_DEHYDRATION',
    title: 'Cabin Depressurization & Acute Hypoxia',
    category: 'ENVIRONMENTAL_EMERGENCY',
    duration_days: 1,
    description: 'Simulates rapid atmospheric pressure decline to 8.2 psi with acute hypobaric hypoxia.',
    baseline_effects: {
      spo2_drop_points: -12.0, // Drops from ~98% to 86%
      hr_elevation_bpm: +26.0,
      respiration_rate_delta: +8.0,
      risk_score_delta: +56
    },
    projected_timeline: [
      { minute: 5, spo2: 95, hr: 82, resp_rate: 18, risk_delta: +15 },
      { minute: 15, spo2: 91, hr: 94, resp_rate: 22, risk_delta: +32 },
      { minute: 30, spo2: 88, hr: 106, resp_rate: 25, risk_delta: +48 },
      { minute: 60, spo2: 86, hr: 112, resp_rate: 26, risk_delta: +56 }
    ],
    countermeasures: [
      'Immediate emergency mask donning with 100% O2 delivery.',
      'Isolate punctured cabin module via automated hatch seal command.',
      'Initiate emergency hyperbaric repressurization protocol.'
    ]
  }
};

export function getWhatIfScenarios() {
  return Object.values(WHAT_IF_SCENARIOS);
}

export async function simulateWhatIfScenario(scenarioId, options = {}) {
  const scenario = WHAT_IF_SCENARIOS[scenarioId];
  if (!scenario) {
    throw new Error(`Scenario ${scenarioId} not found. Available: ${Object.keys(WHAT_IF_SCENARIOS).join(', ')}`);
  }

  const crewId = options.crew_id || 'ast-01';
  let astronautName = 'Commander Alex Morgan';
  let baselineHR = 62;
  let baselineSpO2 = 98;

  // Fetch astronaut profile if exists and mongoose connected
  if (mongoose.connection?.readyState === 1) {
    try {
      const profile = await CrewProfile.findOne({ crew_id: crewId }).lean();
      if (profile) {
        astronautName = `${profile.first_name} ${profile.last_name}`;
        baselineHR = profile.baseline?.resting_hr || 62;
      }
    } catch {
      // Non-blocking
    }
  }

  // Adjust projected outcomes based on astronaut baseline
  const projectedTimeline = scenario.projected_timeline.map((step) => {
    const copy = { ...step };
    if (copy.hr_delta !== undefined) {
      copy.projected_hr = Number((baselineHR + copy.hr_delta).toFixed(1));
    }
    if (copy.spo2_drop !== undefined) {
      copy.projected_spo2 = Number((baselineSpO2 - copy.spo2_drop).toFixed(1));
    }
    return copy;
  });

  return {
    simulation_id: `sim-whatif-${Date.now()}`,
    scenario_id: scenario.id,
    scenario_title: scenario.title,
    category: scenario.category,
    astronaut: {
      crew_id: crewId,
      name: astronautName,
      baseline_hr: baselineHR,
      baseline_spo2: baselineSpO2
    },
    duration_days: options.duration_days || scenario.duration_days,
    baseline_effects: scenario.baseline_effects,
    projected_timeline: projectedTimeline,
    countermeasures: scenario.countermeasures,
    summary: `Digital twin projection for ${astronautName} under '${scenario.title}' indicates an estimated risk score delta of +${scenario.baseline_effects.risk_score_delta} points.`
  };
}
