import crypto from 'crypto';
import { TriageSession } from '../models/TriageSession.js';
import { sendConsultMessage } from './storeForwardService.js';
import { getMissionConfig } from './missionConfigService.js';

export const TRIAGE_DECISION_TREES = {
  // 1. Acute Chest Pain Tree
  ACUTE_CHEST_PAIN: {
    tree_id: 'ACUTE_CHEST_PAIN',
    title: 'Autonomous Spaceflight Chest Pain Triage',
    category: 'CARDIOVASCULAR',
    root_node_id: 'CP_01_HEMODYNAMICS',
    nodes: {
      CP_01_HEMODYNAMICS: {
        node_id: 'CP_01_HEMODYNAMICS',
        title: 'Hemodynamic Stability Assessment',
        prompt: 'Is the patient in acute shock, pulseless, or exhibiting Systolic BP < 90 mmHg / Heart Rate > 125 bpm?',
        type: 'QUESTION',
        options: [
          {
            option_id: 'OPT_CRITICAL_INSTABILITY',
            label: 'Yes, patient is hemodynamically unstable or pulseless',
            next_node_id: 'CP_EMERGENCY_ARREST'
          },
          {
            option_id: 'OPT_STABLE_VITALS',
            label: 'No, vitals are stable (BP >= 90 mmHg, HR < 125 bpm)',
            next_node_id: 'CP_02_PAIN_QUALITY'
          }
        ],
        explanation: 'Hemodynamic instability in microgravity requires immediate resuscitation to prevent irreversible cerebral and myocardial hypoperfusion.'
      },
      CP_02_PAIN_QUALITY: {
        node_id: 'CP_02_PAIN_QUALITY',
        title: 'Pain Quality and Radiation',
        prompt: 'Describe chest pain characteristics: is it substernal crushing/pressure radiating to jaw/left arm, or sharp pleuritic pain worsening with respiration?',
        type: 'QUESTION',
        options: [
          {
            option_id: 'OPT_ISCHEMIC_CRUSHING',
            label: 'Substernal pressure / crushing with diaphoresis (Ischemic pattern)',
            next_node_id: 'CP_03_ECG_EVALUATION'
          },
          {
            option_id: 'OPT_PLEURITIC_SHARP',
            label: 'Sharp pleuritic pain with cough / post-EVA atmospheric change (DCS/Musculoskeletal)',
            next_node_id: 'CP_04_PULMONARY_DCS'
          }
        ],
        explanation: 'Differentiating ischemic coronary syndrome from microgravity thoracic musculoskeletal strain or venous gas embolism dictates whether antiplatelet or hyperbaric protocols are required.'
      },
      CP_03_ECG_EVALUATION: {
        node_id: 'CP_03_ECG_EVALUATION',
        title: '12-Lead Electrocardiogram Analysis',
        prompt: '12-lead ECG findings: is ST-elevation present in two contiguous leads or new LBBB?',
        type: 'QUESTION',
        options: [
          {
            option_id: 'OPT_STEMI_PRESENT',
            label: 'Yes, ST-elevation > 1 mm confirmed (STEMI)',
            next_node_id: 'CP_TERMINAL_STEMI'
          },
          {
            option_id: 'OPT_NON_STEMI_NORMAL',
            label: 'No ST-elevation; nonspecific T-wave inversion or normal rhythm',
            next_node_id: 'CP_TERMINAL_NSTEMI_ANGINA'
          }
        ],
        explanation: 'STEMI requires immediate dual antiplatelet therapy, anticoagulation, and nitroglycerin while monitoring for malignant ventricular arrhythmias.'
      },
      CP_04_PULMONARY_DCS: {
        node_id: 'CP_04_PULMONARY_DCS',
        title: 'Pulmonary Decompression Sickness Rule-Out',
        prompt: 'Has the crew member performed an EVA or suit depressurization within the preceding 24 hours?',
        type: 'QUESTION',
        options: [
          {
            option_id: 'OPT_RECENT_EVA',
            label: 'Yes, EVA performed within 24 hours (Suspect Type II Pulmonary DCS "The Chokes")',
            next_node_id: 'CP_TERMINAL_PULMONARY_DCS'
          },
          {
            option_id: 'OPT_NO_EVA',
            label: 'No recent EVA; pain reproducible by chest wall palpation',
            next_node_id: 'CP_TERMINAL_MUSCULOSKELETAL'
          }
        ],
        explanation: 'Venous nitrogen gas bubbles trapped in pulmonary microcirculation post-EVA can mimic cardiac pain; 100% O2 recompression is curative.'
      },
      // Terminal Nodes
      CP_EMERGENCY_ARREST: {
        node_id: 'CP_EMERGENCY_ARREST',
        title: 'Acute Circulatory Arrest Protocol',
        type: 'TERMINAL',
        acuity: 'IMMEDIATE',
        diagnosis: 'CARDIOPULMONARY_COLLAPSE',
        protocol_triggered: 'CPR_MICROGRAVITY',
        actions: [
          'Initiate CPR_MICROGRAVITY protocol using handstand compression technique immediately',
          'Deploy AED and apply pads to dry chest',
          'Administer Epinephrine 1.0 mg IV/IO',
          'Activate cabin emergency broadcast to all crew'
        ],
        explanation: 'Pulseless collapse requires instantaneous mechanical compressions and defibrillation without waiting for Earth transmission.'
      },
      CP_TERMINAL_STEMI: {
        node_id: 'CP_TERMINAL_STEMI',
        title: 'Acute Myocardial Infarction Management',
        type: 'TERMINAL',
        acuity: 'IMMEDIATE',
        diagnosis: 'ACUTE_CORONARY_SYNDROME_STEMI',
        protocol_triggered: null,
        actions: [
          'Administer Chewable Aspirin 325 mg PO immediately',
          'Administer Sublingual Nitroglycerin 0.4 mg spray if SBP > 100 mmHg',
          'Administer Enoxaparin 1 mg/kg SC for full anticoagulation',
          'Place patient on continuous 12-lead ECG and SpO2 telemetry',
          'Transmit stat consult report to Flight Surgeon via store-and-forward'
        ],
        explanation: 'Ischemia requires prompt platelet aggregation blockade and coronary vasodilation to minimize infarct territory.'
      },
      CP_TERMINAL_NSTEMI_ANGINA: {
        node_id: 'CP_TERMINAL_NSTEMI_ANGINA',
        title: 'Unstable Angina / Subacute Ischemia',
        type: 'TERMINAL',
        acuity: 'URGENT',
        diagnosis: 'UNSTABLE_ANGINA',
        protocol_triggered: null,
        actions: [
          'Administer Aspirin 325 mg PO',
          'Administer Atorvastatin 80 mg PO',
          'Serial cardiac troponin test at 0, 3, and 6 hours',
          'Bed rest with continuous vitals telemetry',
          'Queue flight surgeon consult report'
        ],
        explanation: 'Subacute myocardial ischemia managed conservatively with antiplatelets, serial troponin, and continuous telemetry.'
      },
      CP_TERMINAL_PULMONARY_DCS: {
        node_id: 'CP_TERMINAL_PULMONARY_DCS',
        title: 'Type II Pulmonary Decompression Sickness',
        type: 'TERMINAL',
        acuity: 'IMMEDIATE',
        diagnosis: 'TYPE_II_PULMONARY_DCS',
        protocol_triggered: 'DCS_RECOMPRESSION',
        actions: [
          'Initiate DCS_RECOMPRESSION protocol immediately',
          'Administer 100% pure oxygen via tight-fitting mask at 15 L/min',
          'Prepare airlock recompression to maximum habitat pressure',
          'Infuse 1000 mL Normal Saline IV bolus to reduce microvascular sludging'
        ],
        explanation: 'Decompression chokes requires rapid hyperbaric pure oxygen denitrogenation to dissolve pulmonary gas emboli.'
      },
      CP_TERMINAL_MUSCULOSKELETAL: {
        node_id: 'CP_TERMINAL_MUSCULOSKELETAL',
        title: 'Microgravity Thoracic Musculoskeletal Strain',
        type: 'TERMINAL',
        acuity: 'DELAYED',
        diagnosis: 'COSTOCHONDRITIS_MUSCULOSKELETAL_STRAIN',
        protocol_triggered: null,
        actions: [
          'Administer Ibuprofen 600 mg PO with food',
          'Apply warm compression wrap to affected thoracic area',
          'Withhold heavy ARED resistance training for 48 hours',
          'Log progress note in EHR'
        ],
        explanation: 'Microgravity thoracic strain from resistive exercise or awkward IVA posture is self-limiting and responds to NSAIDs.'
      }
    }
  },

  // 2. Acute Dyspnea Tree
  ACUTE_DYSPNEA: {
    tree_id: 'ACUTE_DYSPNEA',
    title: 'Autonomous Spaceflight Acute Respiratory Distress Triage',
    category: 'ENVIRONMENTAL',
    root_node_id: 'DY_01_CABIN_CHECK',
    nodes: {
      DY_01_CABIN_CHECK: {
        node_id: 'DY_01_CABIN_CHECK',
        title: 'Cabin Atmosphere Gas Verification',
        prompt: 'Check cabin environmental monitor: is ppCO2 > 3.8 mmHg or is Halon/ammonia detected?',
        type: 'QUESTION',
        options: [
          {
            option_id: 'OPT_CABIN_CONTAMINATED',
            label: 'Yes, cabin ppCO2 is elevated or toxic gas alarm sounding',
            next_node_id: 'DY_TERMINAL_TOXIC_ATMOSPHERE'
          },
          {
            option_id: 'OPT_CABIN_NOMINAL',
            label: 'No, cabin atmosphere is within nominal limits (ppCO2 < 2.5 mmHg)',
            next_node_id: 'DY_02_BREATH_SOUNDS'
          }
        ],
        explanation: 'Environmental CO2 pockets or scrubber failure are the most common source of acute crew dyspnea; must rule out cabin cause first.'
      },
      DY_02_BREATH_SOUNDS: {
        node_id: 'DY_02_BREATH_SOUNDS',
        title: 'Auscultation and Upper Airway Check',
        prompt: 'Auscultate lungs with electronic stethoscope: what sounds predominate?',
        type: 'QUESTION',
        options: [
          {
            option_id: 'OPT_WHEEZE_STRIDOR',
            label: 'High-pitched stridor or diffuse expiratory wheezing',
            next_node_id: 'DY_TERMINAL_BRONCHOSPASM'
          },
          {
            option_id: 'OPT_UNILATERAL_ABSENCE',
            label: 'Decreased or absent breath sounds on one side following trauma/EVA',
            next_node_id: 'DY_TERMINAL_PNEUMOTHORAX'
          }
        ],
        explanation: 'Stridor indicates upper airway compromise or anaphylaxis; unilateral silence indicates tension pneumothorax.'
      },
      // Terminal Nodes
      DY_TERMINAL_TOXIC_ATMOSPHERE: {
        node_id: 'DY_TERMINAL_TOXIC_ATMOSPHERE',
        title: 'Toxic Atmosphere Hypercapnia Exposure',
        type: 'TERMINAL',
        acuity: 'IMMEDIATE',
        diagnosis: 'HYPERCAPNIA_TOXIC_EXPOSURE',
        protocol_triggered: 'TOXIC_ATMOSPHERE',
        actions: [
          'Initiate TOXIC_ATMOSPHERE protocol: don emergency oxygen mask immediately',
          'Switch CDRA carbon dioxide removal assemblies to high-purge mode',
          'Seal affected module hatches and deploy ventilation ducts'
        ],
        explanation: 'Removes toxic ambient gas from crew respiration and purges habitat atmosphere.'
      },
      DY_TERMINAL_BRONCHOSPASM: {
        node_id: 'DY_TERMINAL_BRONCHOSPASM',
        title: 'Acute Bronchospasm / Asthma Exacerbation',
        type: 'TERMINAL',
        acuity: 'URGENT',
        diagnosis: 'ACUTE_BRONCHOSPASM',
        protocol_triggered: null,
        actions: [
          'Administer Albuterol MDI 4-8 puffs via spacer device',
          'Administer Ipratropium bromide 2 puffs',
          'Administer Dexamethasone 8 mg PO',
          'Re-assess peak flow and SpO2 in 20 minutes'
        ],
        explanation: 'Inhaled beta-agonists and corticosteroids reverse airway bronchoconstriction.'
      },
      DY_TERMINAL_PNEUMOTHORAX: {
        node_id: 'DY_TERMINAL_PNEUMOTHORAX',
        title: 'Pneumothorax / Lung Collapse',
        type: 'TERMINAL',
        acuity: 'IMMEDIATE',
        diagnosis: 'TENSION_PNEUMOTHORAX',
        protocol_triggered: null,
        actions: [
          'Perform ultrasound lung sliding sign evaluation',
          'If tension physiology present (hypotension, tracheal deviation), perform needle decompression at 2nd intercostal space',
          'Apply flutter valve and supplemental 100% O2',
          'Queue flight surgeon stat consult'
        ],
        explanation: 'Tension pneumothorax causes obstructive shock; needle thoracostomy releases pleural air pressure.'
      }
    }
  }
};

// Start a new triage session
export async function startTriageSession(options) {
  const { crew_id = 'CREW-01', tree_id = 'ACUTE_CHEST_PAIN', mission_mode = null } = options;

  const tree = TRIAGE_DECISION_TREES[tree_id];
  if (!tree) {
    throw new Error(`Decision tree ${tree_id} not found. Available: ${Object.keys(TRIAGE_DECISION_TREES).join(', ')}`);
  }

  const effectiveMissionMode = mission_mode || getMissionConfig()?.mode || 'MARS';
  const sessionId = `trg-${crypto.randomBytes(6).toString('hex')}`;
  const rootNode = tree.nodes[tree.root_node_id];

  const session = await TriageSession.create({
    session_id: sessionId,
    crew_id,
    tree_id,
    mission_mode: effectiveMissionMode,
    status: 'IN_PROGRESS',
    current_node_id: tree.root_node_id,
    steps_log: [],
    ground_contact_made: false
  });

  return {
    session_id: session.session_id,
    crew_id: session.crew_id,
    tree_title: tree.title,
    mission_mode: session.mission_mode,
    status: session.status,
    current_step: 1,
    current_node: {
      node_id: rootNode.node_id,
      title: rootNode.title,
      prompt: rootNode.prompt,
      type: rootNode.type,
      options: rootNode.options,
      clinical_explanation: rootNode.explanation
    }
  };
}

// Advance a step in the triage session
export async function advanceTriageStep(payload) {
  const { session_id, option_id, vital_snapshot = null } = payload;

  const session = await TriageSession.findOne({ session_id });
  if (!session) {
    throw new Error(`Triage session ${session_id} not found`);
  }

  if (session.status === 'COMPLETED') {
    throw new Error(`Triage session ${session_id} is already completed`);
  }

  const tree = TRIAGE_DECISION_TREES[session.tree_id];
  const currentNode = tree.nodes[session.current_node_id];

  if (!currentNode) {
    throw new Error(`Node ${session.current_node_id} not found in tree ${session.tree_id}`);
  }

  // Find selected option
  const selectedOption = currentNode.options.find((opt) => opt.option_id === option_id);
  if (!selectedOption) {
    throw new Error(`Invalid option_id: ${option_id}. Available: ${currentNode.options.map((o) => o.option_id).join(', ')}`);
  }

  // Log step
  session.steps_log.push({
    step_number: session.steps_log.length + 1,
    node_id: currentNode.node_id,
    node_title: currentNode.title,
    prompt: currentNode.prompt,
    selected_option: selectedOption,
    clinical_explanation: currentNode.explanation,
    timestamp: new Date()
  });

  // Next node
  const nextNodeId = selectedOption.next_node_id;
  const nextNode = tree.nodes[nextNodeId];

  if (!nextNode) {
    throw new Error(`Target node ${nextNodeId} not found in tree`);
  }

  session.current_node_id = nextNodeId;

  // Check if next node is TERMINAL
  if (nextNode.type === 'TERMINAL') {
    session.status = 'COMPLETED';
    session.triage_acuity = nextNode.acuity;
    session.recommended_actions = nextNode.actions;
    session.protocol_triggered = nextNode.protocol_triggered || null;
    session.completed_at = new Date();

    // Compile comprehensive surgeon report
    const surgeonReport = {
      triage_session_id: session.session_id,
      crew_id: session.crew_id,
      tree_title: tree.title,
      mission_mode: session.mission_mode,
      acuity: nextNode.acuity,
      primary_diagnosis: nextNode.diagnosis,
      protocol_executed: nextNode.protocol_triggered || 'NONE',
      recommended_actions: nextNode.actions,
      clinical_rationale: nextNode.explanation,
      steps_traversed: session.steps_log.length,
      steps_audit: session.steps_log.map((s) => ({
        step: s.step_number,
        prompt: s.prompt,
        decision: s.selected_option.label
      })),
      vitals_at_completion: vital_snapshot,
      completed_at: session.completed_at.toISOString(),
      ground_contact_made: false
    };

    session.surgeonReport = surgeonReport;

    // Queue surgeon report via Store-and-Forward (F069)
    try {
      const consult = await sendConsultMessage({
        sender_id: session.crew_id,
        sender_name: `Crew Medical Officer (${session.crew_id})`,
        sender_role: 'cmo',
        recipient_role: 'flight_surgeon',
        subject: `[AUTONOMOUS TRIAGE REPORT] ${nextNode.acuity}: ${nextNode.diagnosis} (${session.crew_id})`,
        body: `Autonomous onboard triage completed with ZERO ground contact in ${session.mission_mode} mode.\n\nDiagnosis: ${nextNode.diagnosis}\nAcuity: ${nextNode.acuity}\nProtocol: ${nextNode.protocol_triggered || 'Supportive Care'}\n\nClinical Actions Executed:\n- ${nextNode.actions.join('\n- ')}\n\nSteps Traversed: ${session.steps_log.length}`,
        priority: nextNode.acuity === 'IMMEDIATE' ? 'stat' : 'urgent',
        direction: 'space_to_ground',
        attachments: [
          {
            name: 'triage_audit.json',
            url: `store://triage/${session.session_id}/audit.json`,
            mime_type: 'application/json',
            size_bytes: 1024
          }
        ]
      });

      session.store_forward_message_id = consult.message_id;
    } catch (err) {
      console.error('Failed to queue store and forward consult:', err.message);
    }

    await session.save();

    return {
      session_id: session.session_id,
      status: 'COMPLETED',
      is_terminal: true,
      acuity: nextNode.acuity,
      primary_diagnosis: nextNode.diagnosis,
      recommended_actions: nextNode.actions,
      protocol_triggered: nextNode.protocol_triggered,
      clinical_explanation: nextNode.explanation,
      steps_logged_count: session.steps_log.length,
      ground_contact_made: false,
      store_forward_message_id: session.store_forward_message_id,
      surgeon_report: surgeonReport
    };
  }

  // Still in progress
  await session.save();

  return {
    session_id: session.session_id,
    status: 'IN_PROGRESS',
    is_terminal: false,
    current_step: session.steps_log.length + 1,
    current_node: {
      node_id: nextNode.node_id,
      title: nextNode.title,
      prompt: nextNode.prompt,
      type: nextNode.type,
      options: nextNode.options,
      clinical_explanation: nextNode.explanation
    }
  };
}

// Retrieve triage session
export async function getTriageSession(sessionId) {
  const session = await TriageSession.findOne({ session_id: sessionId });
  return session;
}
