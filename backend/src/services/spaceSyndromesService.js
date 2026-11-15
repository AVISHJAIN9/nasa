import crypto from 'crypto';
import { SyndromeAssessment } from '../models/SyndromeAssessment.js';
import { CrewProfile } from '../models/CrewProfile.js';

export const SPACE_SYNDROMES_KNOWLEDGE_BASE = {
  SANS: {
    syndrome_id: 'SANS',
    name: 'Spaceflight-Associated Neuro-Ocular Syndrome',
    acronym: 'SANS',
    description: 'Cephalad fluid shift and venous congestion leading to optic disc edema, globe flattening, choroidal folds, and hyperopic refractive shift.',
    sources: [
      {
        citation: 'Stenger MB et al. Risk of Spaceflight-Associated Neuro-ocular Syndrome. NASA HRP Evidence Report.',
        document_code: 'NASA/TP-2017-219291',
        url: 'https://humanresearchroadmap.nasa.gov/evidence/reports/SANS.pdf'
      },
      {
        citation: 'Mader TH et al. Optic disc edema, globe flattening, and hyperopic shifts in astronauts. Ophthalmology 2011.',
        document_code: 'PMID: 21849212',
        url: 'https://pubmed.ncbi.nlm.nih.gov/21849212/'
      }
    ],
    evaluate: (data) => {
      const indicators = [];
      let totalRisk = 0;

      // 1. Mission Duration > 30 days
      const days = data.mission_days ?? 0;
      const durationRisk = days > 90 ? 25 : days > 30 ? 15 : 5;
      totalRisk += durationRisk;
      indicators.push({
        indicator: 'MISSION_DURATION_MICROGRAVITY',
        present: days > 30,
        value: `${days} days`,
        threshold: '> 30 days',
        clinical_weight: durationRisk
      });

      // 2. Optic Disc Edema (Frisén Scale)
      const frisen = data.frisen_grade ?? 0;
      const edemaRisk = frisen >= 2 ? 35 : frisen === 1 ? 25 : 0;
      totalRisk += edemaRisk;
      indicators.push({
        indicator: 'OPTIC_DISC_EDEMA_FRISEN',
        present: frisen >= 1,
        value: `Grade ${frisen}`,
        threshold: 'Grade >= 1',
        clinical_weight: edemaRisk
      });

      // 3. Hyperopic Shift
      const diopters = data.hyperopic_shift_diopters ?? 0;
      const diopterRisk = diopters >= 1.0 ? 20 : diopters >= 0.5 ? 12 : 0;
      totalRisk += diopterRisk;
      indicators.push({
        indicator: 'HYPEROPIC_REFRACTIVE_SHIFT',
        present: diopters >= 0.5,
        value: `+${diopters} D`,
        threshold: '>= +0.50 D',
        clinical_weight: diopterRisk
      });

      // 4. Globe Flattening / Choroidal Folds on OCT
      const octFindings = Boolean(data.globe_flattening || data.choroidal_folds);
      const octRisk = octFindings ? 20 : 0;
      totalRisk += octRisk;
      indicators.push({
        indicator: 'OCT_GLOBE_FLATTENING_OR_FOLDS',
        present: octFindings,
        value: octFindings ? 'Detected' : 'None',
        threshold: 'Visible structural deformation',
        clinical_weight: octRisk
      });

      const clampedRisk = Math.min(100, totalRisk);
      let stage = 'NOMINAL';
      if (clampedRisk >= 70 || frisen >= 2) stage = 'CONFIRMED_CASE';
      else if (clampedRisk >= 40 || frisen === 1) stage = 'ELEVATED_RISK';
      else if (clampedRisk >= 20) stage = 'MONITORING';

      return {
        risk_score: clampedRisk,
        clinical_stage: stage,
        indicators,
        protocols: [
          'Perform weekly optical coherence tomography (OCT) and visual acuity log.',
          'Schedule 60-minute daily lower body negative pressure (LBNP) session (-25 mmHg).',
          'Enforce strict dietary sodium ceiling (< 2,300 mg/day) to mitigate intracranial venous pressure.'
        ]
      };
    }
  },

  SMS: {
    syndrome_id: 'SMS',
    name: 'Space Motion Sickness & Neurovestibular Disorientation',
    acronym: 'SMS',
    description: 'Acute neurovestibular conflict caused by otolith-semicircular canal sensory rearrangement upon entering microgravity.',
    sources: [
      {
        citation: 'Reschke MF et al. Risk of Impaired Control Associated with Spatial Disorientation. NASA HRP Evidence Report.',
        document_code: 'NASA/TM-2009-214786',
        url: 'https://humanresearchroadmap.nasa.gov/evidence/reports/Neurovestibular.pdf'
      },
      {
        citation: 'Davis JR et al. Space motion sickness during 24 Space Shuttle flights. J Clin Pharmacol 1988.',
        document_code: 'PMID: 3235655',
        url: 'https://pubmed.ncbi.nlm.nih.gov/3235655/'
      }
    ],
    evaluate: (data) => {
      const indicators = [];
      let totalRisk = 0;

      // 1. Mission Flight Day (High risk Day 1-4)
      const day = data.flight_day ?? 1;
      const dayRisk = day <= 2 ? 30 : day <= 4 ? 18 : 5;
      totalRisk += dayRisk;
      indicators.push({
        indicator: 'EARLY_FLIGHT_DAY_WINDOW',
        present: day <= 4,
        value: `Flight Day ${day}`,
        threshold: 'FD 1 - 4',
        clinical_weight: dayRisk
      });

      // 2. Subjective Neurovestibular / Nausea Score (0-10)
      const nausea = data.nausea_score ?? 0;
      const nauseaRisk = nausea >= 7 ? 40 : nausea >= 4 ? 25 : nausea >= 2 ? 10 : 0;
      totalRisk += nauseaRisk;
      indicators.push({
        indicator: 'NEUROVESTIBULAR_NAUSEA_SCORE',
        present: nausea >= 3,
        value: `${nausea}/10`,
        threshold: '>= 3/10',
        clinical_weight: nauseaRisk
      });

      // 3. Autonomic Symptoms (Cold sweating, emesis)
      const symptoms = data.symptoms || [];
      const hasEmesis = symptoms.includes('VOMITING');
      const hasSweating = symptoms.includes('COLD_SWEAT');
      const symptomRisk = hasEmesis ? 30 : hasSweating ? 15 : 0;
      totalRisk += symptomRisk;
      indicators.push({
        indicator: 'AUTONOMIC_SMS_SYMPTOMS',
        present: hasEmesis || hasSweating,
        value: symptoms.join(', ') || 'None',
        threshold: 'Emesis or diaphoresis',
        clinical_weight: symptomRisk
      });

      const clampedRisk = Math.min(100, totalRisk);
      let stage = 'NOMINAL';
      if (clampedRisk >= 65 || hasEmesis) stage = 'CONFIRMED_CASE';
      else if (clampedRisk >= 35) stage = 'ELEVATED_RISK';
      else if (clampedRisk >= 15) stage = 'MONITORING';

      return {
        risk_score: clampedRisk,
        clinical_stage: stage,
        indicators,
        protocols: [
          'Administer promethazine 25-50 mg IM or oral as prescribed by flight surgeon.',
          'Restrict abrupt Coriolis head movements during initial 72 hours.',
          'Ensure hydration and electrolyte balance replacement in event of emesis.'
        ]
      };
    }
  },

  VTE: {
    syndrome_id: 'VTE',
    name: 'Internal Jugular Vein Thrombosis & Venous Stasis',
    acronym: 'VTE',
    description: 'Cephalad blood pooling in microgravity causing stagnant or reversed flow in the internal jugular vein with elevated thrombosis risk.',
    sources: [
      {
        citation: 'Marshall-Goebel K et al. Assessment of Jugular Venous Blood Flow and Thrombosis on the ISS. JAMA Netw Open 2019 / NEJM 2020.',
        document_code: 'NEJM-2020-382',
        url: 'https://www.nejm.org/doi/full/10.1056/NEJMc1905875'
      },
      {
        citation: 'NASA HRP Evidence Report: Risk of Venous Thromboembolism in Long-Duration Spaceflight.',
        document_code: 'NASA-HRP-VTE-2021',
        url: 'https://humanresearchroadmap.nasa.gov/'
      }
    ],
    evaluate: (data) => {
      const indicators = [];
      let totalRisk = 0;

      // 1. Doppler Ultrasound Flow Pattern (Stagnant or Reversed)
      const flow = data.ijv_flow_pattern || 'NORMAL';
      const flowRisk = flow === 'THROMBUS_DETECTED' ? 60 : flow === 'STAGNANT_REVERSED' ? 40 : flow === 'REDUCED_VELOCITY' ? 18 : 0;
      totalRisk += flowRisk;
      indicators.push({
        indicator: 'DOPPLER_IJV_FLOW_PATTERN',
        present: flow !== 'NORMAL',
        value: flow,
        threshold: 'Stagnant, reversed, or occluded',
        clinical_weight: flowRisk
      });

      // 2. Neck Fullness / Tenderness
      const neckSymptoms = Boolean(data.neck_tenderness || data.cervical_edema);
      const neckRisk = neckSymptoms ? 25 : 0;
      totalRisk += neckRisk;
      indicators.push({
        indicator: 'CERVICAL_SYMPTOMS_TENDERNESS',
        present: neckSymptoms,
        value: neckSymptoms ? 'Present' : 'Absent',
        threshold: 'Palpable fullness or tenderness',
        clinical_weight: neckRisk
      });

      // 3. Prothrombotic Laboratory / D-Dimer Biomarker
      const dDimer = data.d_dimer_ng_ml ?? 200;
      const dDimerRisk = dDimer > 500 ? 25 : dDimer > 350 ? 12 : 0;
      totalRisk += dDimerRisk;
      indicators.push({
        indicator: 'D_DIMER_ELEVATION',
        present: dDimer > 500,
        value: `${dDimer} ng/mL`,
        threshold: '> 500 ng/mL',
        clinical_weight: dDimerRisk
      });

      const clampedRisk = Math.min(100, totalRisk);
      let stage = 'NOMINAL';
      if (clampedRisk >= 70 || flow === 'THROMBUS_DETECTED') stage = 'CONFIRMED_CASE';
      else if (clampedRisk >= 35 || flow === 'STAGNANT_REVERSED') stage = 'ELEVATED_RISK';
      else if (clampedRisk >= 15) stage = 'MONITORING';

      return {
        risk_score: clampedRisk,
        clinical_stage: stage,
        indicators,
        protocols: [
          'Immediate Point-of-Care Ultrasound (POCUS) compression exam of bilateral jugular veins.',
          'Initiate enoxaparin 1.5 mg/kg SC once daily upon confirmed occlusive thrombus.',
          'Review oral contraceptive / progestin therapy and substitute non-thrombogenic countermeasure.'
        ]
      };
    }
  },

  NEPHROLITHIASIS: {
    syndrome_id: 'NEPHROLITHIASIS',
    name: 'Microgravity Renal Calculus & Hypercalciuria',
    acronym: 'NEPHROLITHIASIS',
    description: 'Accelerated bone demineralization dumping calcium into circulation, combined with reduced urine output, dramatically elevating stone formation.',
    sources: [
      {
        citation: 'Whitson PA et al. Space flight and the risk of renal stone formation. J Urol 2001.',
        document_code: 'PMID: 11371868',
        url: 'https://pubmed.ncbi.nlm.nih.gov/11371868/'
      },
      {
        citation: 'Pietrzyk RA et al. Risk of Renal Stone Formation in Spaceflight. NASA HRP Evidence Report.',
        document_code: 'NASA/TP-2018-220042',
        url: 'https://humanresearchroadmap.nasa.gov/'
      }
    ],
    evaluate: (data) => {
      const indicators = [];
      let totalRisk = 0;

      // 1. Daily Urine Volume (< 2.0 L is high risk)
      const vol = data.daily_urine_volume_liters ?? 2.4;
      const volRisk = vol < 1.2 ? 35 : vol < 1.8 ? 20 : 0;
      totalRisk += volRisk;
      indicators.push({
        indicator: 'URINE_VOLUME_DEFICIT',
        present: vol < 1.8,
        value: `${vol} L/day`,
        threshold: '< 2.0 L/day target',
        clinical_weight: volRisk
      });

      // 2. Urine Specific Gravity (> 1.025 indicates supersaturation)
      const sg = data.urine_specific_gravity ?? 1.015;
      const sgRisk = sg >= 1.028 ? 30 : sg >= 1.024 ? 15 : 0;
      totalRisk += sgRisk;
      indicators.push({
        indicator: 'URINE_SPECIFIC_GRAVITY',
        present: sg >= 1.024,
        value: `${sg}`,
        threshold: '>= 1.024',
        clinical_weight: sgRisk
      });

      // 3. Hypercalciuria / Bone Demineralization Rate
      const calciumMg = data.urinary_calcium_mg_day ?? 180;
      const calRisk = calciumMg > 300 ? 30 : calciumMg > 250 ? 15 : 0;
      totalRisk += calRisk;
      indicators.push({
        indicator: 'URINARY_CALCIUM_EXCRETION',
        present: calciumMg > 250,
        value: `${calciumMg} mg/day`,
        threshold: '> 250 mg/day',
        clinical_weight: calRisk
      });

      // 4. Clinical Flank Pain / Microhematuria
      const flankPain = Boolean(data.flank_pain || data.hematuria);
      const painRisk = flankPain ? 35 : 0;
      totalRisk += painRisk;
      indicators.push({
        indicator: 'FLANK_COLIC_OR_HEMATURIA',
        present: flankPain,
        value: flankPain ? 'Present' : 'None',
        threshold: 'Unilateral colic or blood in urine',
        clinical_weight: painRisk
      });

      const clampedRisk = Math.min(100, totalRisk);
      let stage = 'NOMINAL';
      if (clampedRisk >= 70 || flankPain) stage = 'CONFIRMED_CASE';
      else if (clampedRisk >= 35) stage = 'ELEVATED_RISK';
      else if (clampedRisk >= 15) stage = 'MONITORING';

      return {
        risk_score: clampedRisk,
        clinical_stage: stage,
        indicators,
        protocols: [
          'Force oral hydration with mineral water to target minimum 2.5 L/day urine output.',
          'Initiate potassium citrate (20 mEq BID) to alkalinize urine and inhibit calcium crystallization.',
          'Review resistive exercise compliance to attenuate bone calcium turnover.'
        ]
      };
    }
  },

  CARDIOVASCULAR_DECONDITIONING: {
    syndrome_id: 'CARDIOVASCULAR_DECONDITIONING',
    name: 'Cardiovascular Deconditioning & Orthostatic Intolerance',
    acronym: 'CARDIO_DECONDITION',
    description: 'Loss of plasma volume, baroreflex resetting, and cardiac remodeling during extended microgravity leading to post-landing syncopal risk.',
    sources: [
      {
        citation: 'Charles JB, Lathers CM. Cardiovascular adaptation to spaceflight. J Clin Pharmacol 1991.',
        document_code: 'PMID: 2056075',
        url: 'https://pubmed.ncbi.nlm.nih.gov/2056075/'
      },
      {
        citation: 'Stenger MB et al. Risk of Cardiovascular Alterations in Spaceflight. NASA HRP Evidence Report.',
        document_code: 'NASA/TP-2019-220054',
        url: 'https://humanresearchroadmap.nasa.gov/'
      }
    ],
    evaluate: (data) => {
      const indicators = [];
      let totalRisk = 0;

      // 1. Exercise Countermeasure Adherence (% completed)
      const adherence = data.exercise_adherence_pct ?? 90;
      const adherenceRisk = adherence < 60 ? 35 : adherence < 75 ? 20 : 0;
      totalRisk += adherenceRisk;
      indicators.push({
        indicator: 'EXERCISE_COUNTERMEASURE_ADHERENCE',
        present: adherence < 75,
        value: `${adherence}%`,
        threshold: '< 75% adherence',
        clinical_weight: adherenceRisk
      });

      // 2. Resting Tachycardia Elevation
      const restingHR = data.resting_hr ?? 65;
      const baseHR = data.preflight_hr ?? 60;
      const hrDelta = restingHR - baseHR;
      const hrRisk = hrDelta >= 20 ? 30 : hrDelta >= 12 ? 15 : 0;
      totalRisk += hrRisk;
      indicators.push({
        indicator: 'RESTING_HR_ELEVATION',
        present: hrDelta >= 12,
        value: `+${hrDelta} bpm`,
        threshold: '>= +12 bpm above pre-flight',
        clinical_weight: hrRisk
      });

      // 3. Orthostatic Challenge Heart Rate Delta (Stand Test / LBNP)
      const standDelta = data.orthostatic_hr_delta ?? 15;
      const standRisk = standDelta >= 35 ? 35 : standDelta >= 25 ? 20 : 0;
      totalRisk += standRisk;
      indicators.push({
        indicator: 'ORTHOSTATIC_HR_EXCURSION',
        present: standDelta >= 25,
        value: `+${standDelta} bpm`,
        threshold: '>= +25 bpm increase on tilt/LBNP',
        clinical_weight: standRisk
      });

      const clampedRisk = Math.min(100, totalRisk);
      let stage = 'NOMINAL';
      if (clampedRisk >= 65 || standDelta >= 35) stage = 'CONFIRMED_CASE';
      else if (clampedRisk >= 35) stage = 'ELEVATED_RISK';
      else if (clampedRisk >= 15) stage = 'MONITORING';

      return {
        risk_score: clampedRisk,
        clinical_stage: stage,
        indicators,
        protocols: [
          'Prescribe mandatory 45-minute daily high-intensity interval training (HIIT) on cycle ergometer.',
          'Execute pre-reentry fluid and electrolyte loading protocol (8 salt tablets + 1.0 L water).',
          'Inspect and calibrate anti-gravity lower body compression garment.'
        ]
      };
    }
  }
};

// Evaluate all 5 space-specific syndromes for an astronaut
export async function evaluateSpaceSyndromes(crewId, clinicalData = {}, options = {}) {
  let astronautName = 'Astronaut';
  try {
    const profile = await CrewProfile.findOne({ crew_id: crewId }).lean();
    if (profile) {
      astronautName = `${profile.first_name} ${profile.last_name}`;
    }
  } catch {
    // Non-blocking
  }

  const results = [];
  const syndromeKeys = Object.keys(SPACE_SYNDROMES_KNOWLEDGE_BASE);

  for (const key of syndromeKeys) {
    const def = SPACE_SYNDROMES_KNOWLEDGE_BASE[key];
    const assessment = def.evaluate(clinicalData[key] || clinicalData);

    const assessmentId = `syn-${key.toLowerCase()}-${crypto.randomBytes(3).toString('hex')}`;
    const record = {
      assessment_id: assessmentId,
      crew_id: crewId,
      syndrome_id: def.syndrome_id,
      syndrome_name: def.name,
      risk_score: assessment.risk_score,
      clinical_stage: assessment.clinical_stage,
      detected_indicators: assessment.indicators,
      sources: def.sources,
      recommended_protocol: assessment.protocols,
      timestamp: options.timestamp || new Date()
    };

    if (options.saveToDb !== false) {
      await SyndromeAssessment.create(record);
    }

    results.push(record);
  }

  return {
    crew_id: crewId,
    astronaut_name: astronautName,
    evaluated_at: new Date(),
    syndromes: results
  };
}

// Evaluate a single syndrome by ID
export async function evaluateSingleSyndrome(crewId, syndromeId, data = {}, options = {}) {
  const def = SPACE_SYNDROMES_KNOWLEDGE_BASE[syndromeId?.toUpperCase()];
  if (!def) {
    throw new Error(`Syndrome ${syndromeId} not found in NASA knowledge base. Available: ${Object.keys(SPACE_SYNDROMES_KNOWLEDGE_BASE).join(', ')}`);
  }

  const assessment = def.evaluate(data);
  const assessmentId = `syn-${def.syndrome_id.toLowerCase()}-${crypto.randomBytes(3).toString('hex')}`;

  const record = {
    assessment_id: assessmentId,
    crew_id: crewId,
    syndrome_id: def.syndrome_id,
    syndrome_name: def.name,
    risk_score: assessment.risk_score,
    clinical_stage: assessment.clinical_stage,
    detected_indicators: assessment.indicators,
    sources: def.sources,
    recommended_protocol: assessment.protocols,
    timestamp: options.timestamp || new Date()
  };

  if (options.saveToDb !== false) {
    await SyndromeAssessment.create(record);
  }

  return record;
}
