export interface ProtocolStep {
  title: string;
  detail: string;
  timerSec?: number;
  branch?: {
    question: string;
    yes: number;
    no: number;
  };
}

export interface Protocol {
  id: string;
  title: string;
  category: string;
  durationEst: string;
  source: string;
  steps: ProtocolStep[];
}

export const PROTOCOLS: Protocol[] = [
  {
    id: 'cpr',
    title: 'Microgravity CPR Protocol',
    category: 'Cardiac / Acute',
    durationEst: '10 min',
    source: 'Adapted from public first-aid guidance; clinician review pending.',
    steps: [
      {
        title: 'Check Responsiveness & Breathing',
        detail: 'Tap collarbone firmly, call crew name. Inspect chest rise for 5 seconds.',
        timerSec: 10,
        branch: {
          question: 'Is the astronaut breathing normally with palpable carotid pulse?',
          yes: 5,
          no: 1,
        },
      },
      {
        title: 'Restrain Patient to Crew Medical Restraint (CMRS)',
        detail: 'Anchor the patient supine using torso straps to prevent recoil floating in microgravity.',
      },
      {
        title: 'Initiate Chest Compressions (Handstand or Straddle)',
        detail: 'Deliver hard and fast compressions at 100-120 bpm, 5 cm depth. Use ceiling braces for counterforce.',
        timerSec: 120,
      },
      {
        title: 'Deploy Automated External Defibrillator (AED)',
        detail: 'Apply anterior-lateral adhesive pads. Clear patient contact while automated rhythm evaluation runs.',
        timerSec: 30,
        branch: {
          question: 'Did AED advise deliver shock?',
          yes: 4,
          no: 2,
        },
      },
      {
        title: 'Deliver Shock & Immediate Cycle Resume',
        detail: 'Ensure all crew clear of metal structure. Press shock button, then immediately resume 2 minutes of CPR.',
        timerSec: 120,
      },
      {
        title: 'Recovery & Vital Stabilization',
        detail: 'Place in stable airway position. Administer 100% O2 through mask and monitor ECG continuously.',
      },
    ],
  },
  {
    id: 'toxic-atmo',
    title: 'Toxic Atmosphere & Scrubber Breach',
    category: 'ECLSS / Environmental',
    durationEst: '8 min',
    source: 'Adapted from public first-aid guidance; clinician review pending.',
    steps: [
      {
        title: 'Don Emergency Personal Breathing Apparatus (PBA)',
        detail: 'Immediately seal masks for all crew. Connect to independent 15-minute emergency oxygen loop.',
        timerSec: 45,
      },
      {
        title: 'Isolate Compartment Vent Valves',
        detail: 'Manually close atmospheric bulkheads to Jezero habitation module to localize contaminant.',
        branch: {
          question: 'Are toxic particulate alarms reading > 2,500 ppm in adjacent nodes?',
          yes: 2,
          no: 3,
        },
      },
      {
        title: 'Total Node Depressurization & Vacuum Vent',
        detail: 'Confirm all crew evacuated from compromised node. Vent to Martian atmospheric pressure for 3 minutes.',
        timerSec: 180,
      },
      {
        title: 'Activate Secondary Trace Contaminant Scrubber',
        detail: 'Power on charcoal and amine bed scrubbers at maximum draw. Monitor CO2 and volatile organic indexes.',
        timerSec: 60,
      },
      {
        title: 'Atmospheric Air Sniffer Verification',
        detail: 'Perform gas chromatography test before allowing crew to remove PBAs.',
      },
    ],
  },
  {
    id: 'burns',
    title: 'Thermal & Electrical Burn Management',
    category: 'Trauma / Thermal',
    durationEst: '15 min',
    source: 'Adapted from public first-aid guidance; clinician review pending.',
    steps: [
      {
        title: 'Remove Exposure Source & De-energize',
        detail: 'Ensure electrical bus is powered down. Check for smoldering flight suit material.',
      },
      {
        title: 'Cool Burn Area with Sterile Saline',
        detail: 'Apply hydrogel cooling dressing or sterile saline packs. Do not use direct ice packs.',
        timerSec: 300,
      },
      {
        title: 'Assess Burn Depth & Surface Area',
        detail: 'Determine percentage of total body surface area (TBSA). Check for circumferential limb involvement.',
        branch: {
          question: 'Is burn partial/full thickness > 10% TBSA or involving airway/hands?',
          yes: 3,
          no: 4,
        },
      },
      {
        title: 'Initiate Fluid Resuscitation & Analgesia',
        detail: 'Start IV normal saline maintenance per Parkland formula. Administer prescribed pain management protocol.',
      },
      {
        title: 'Apply Non-Adherent Antimicrobial Dressing',
        detail: 'Cover with silver sulfadiazine gauze and loose non-restrictive wrap. Elevate limb if microgravity pooling occurs.',
      },
    ],
  },
];
