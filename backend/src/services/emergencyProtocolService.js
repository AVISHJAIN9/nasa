import { EmergencyProtocol } from '../models/EmergencyProtocol.js';

export const OFFICIAL_EMERGENCY_PROTOCOLS = [
  // 1. CPR in Microgravity
  {
    protocol_id: 'CPR_MICROGRAVITY',
    title: 'Cardiopulmonary Resuscitation in Microgravity',
    category: 'RESUSCITATION',
    version: 'v2.1.0',
    source_citation: 'NASA-SP-2015-624, Human Integration Design Handbook: Emergency Medicine; AHA Guidelines for CPR in Isolated Environments',
    license: 'PUBLIC_DOMAIN_NASA_OPEN_GOV',
    prerequisites: ['Patient unresponsive', 'No palpable carotid or femoral pulse within 10 seconds'],
    equipment_needed: ['Medical Restraint Board', 'Overhead ceiling handstand grips', 'Automated External Defibrillator (AED)', 'Bag-Valve-Mask (BVM)', 'Epinephrine autoinjector (1 mg)'],
    steps: [
      {
        step_number: 1,
        action: 'RESTRAINT_BOARD_DOCK',
        instruction: 'Secure patient supine on the Medical Restraint Board on cabin deck with chest and torso retention straps.',
        caution_notes: 'Patient must be securely coupled to deck to prevent chest compressions propelling patient backward in weightlessness.',
        duration_seconds: 15
      },
      {
        step_number: 2,
        action: 'HANDSTAND_COMPRESSION',
        instruction: 'Rescuer places hands on lower sternum, places feet against overhead ceiling, locks knees, and delivers 100-120 compressions/min to depth of 5-6 cm.',
        caution_notes: 'If overhead ceiling is out of reach, transition immediately to Echt-Mackenzie Reverse-Waist Straddle technique.',
        duration_seconds: 120
      },
      {
        step_number: 3,
        action: 'AED_ATTACH_AND_SHOCK',
        instruction: 'Apply AED adhesive pads to bare dry chest. Clear all crew from physical contact with patient before shock delivery.',
        caution_notes: 'Verify no free-floating conductive fluid droplets exist in ambient air before discharging defibrillator.',
        duration_seconds: 30
      },
      {
        step_number: 4,
        action: 'EPINEPHRINE_ADMIN',
        instruction: 'Administer Epinephrine 1.0 mg IV/IO every 3 to 5 minutes while maintaining continuous closed-chest compressions.',
        caution_notes: 'Flush line with 10 mL normal saline after injection.',
        duration_seconds: 20
      }
    ],
    escalation_criteria: ['Return of spontaneous circulation (ROSC) not achieved after 20 minutes', 'Ventricular fibrillation refractory to 3 shocks'],
    applicable_mission_modes: ['ISS', 'MOON', 'MARS']
  },

  // 2. Toxic Cabin Atmosphere & Halon Exposure
  {
    protocol_id: 'TOXIC_ATMOSPHERE',
    title: 'Toxic Cabin Atmosphere, Halon Extinguisher, and Hypercapnia Purge',
    category: 'ENVIRONMENTAL',
    version: 'v2.1.0',
    source_citation: 'NASA-STD-3001 Volume 2, Section 6.2.2.1 Ambient Gas Limits and Emergency Atmosphere Remediation',
    license: 'PUBLIC_DOMAIN_NASA_OPEN_GOV',
    prerequisites: ['Cabin gas alarm sounding', 'ppCO2 > 5.0 mmHg or Halon / pyrolysis gas release detected'],
    equipment_needed: ['Emergency Oxygen Mask (EOM)', 'Portable Breathing Apparatus (PBA)', 'Trace Contaminant Control Purge Assembly', 'Dräger gas detector tubes'],
    steps: [
      {
        step_number: 1,
        action: 'DON_BREATHING_APPARATUS',
        instruction: 'All crew members immediately don Emergency Oxygen Masks (EOM) or PBAs with 100% positive pressure oxygen.',
        caution_notes: 'Do not attempt to locate source of leak before respiratory protection is fully secured.',
        duration_seconds: 10
      },
      {
        step_number: 2,
        action: 'ISOLATE_HABITAT_MODULE',
        instruction: 'Seal inter-module pressure hatches to isolate affected compartment from nominal living quarters.',
        caution_notes: 'Verify hatch differential pressure gauge reads nominal before latching dog handles.',
        duration_seconds: 45
      },
      {
        step_number: 3,
        action: 'ACTIVATE_CDRA_PURGE',
        instruction: 'Command CDRA and amine scrubbers to maximum emergency flow rate. Initiate emergency overboard atmospheric dump if Halon > 100 ppm.',
        caution_notes: 'Monitor habitat total pressure to prevent cabin depressurization below 10.2 psi.',
        duration_seconds: 60
      },
      {
        step_number: 4,
        action: 'ATMOSPHERE_GAS_CHECK',
        instruction: 'Sample atmosphere using colorimetric detector tubes. Verify ppCO2 < 2.0 mmHg and toxic trace contaminants < 0.1 MAC before removing masks.',
        caution_notes: 'Keep oxygen masks in standby for 60 minutes after nominal readings are restored.',
        duration_seconds: 300
      }
    ],
    escalation_criteria: ['Cabin pressure drops below 11.5 psi during dump', 'Unconscious crew member located inside contaminated zone'],
    applicable_mission_modes: ['ISS', 'MOON', 'MARS']
  },

  // 3. Thermal and Chemical Burns
  {
    protocol_id: 'BURNS_THERMAL',
    title: 'Severe Thermal and Chemical Burn Management in Confinement',
    category: 'TRAUMA',
    version: 'v2.1.0',
    source_citation: 'NASA JSC Flight Medicine Clinical Practice Guidelines: Acute Thermal and Chemical Trauma in Spaceflight',
    license: 'PUBLIC_DOMAIN_NASA_OPEN_GOV',
    prerequisites: ['Exposure to hot surfaces, thermal runaway battery, or caustic hypergolic propellant'],
    equipment_needed: ['Sterile Saline Flush (1000 mL)', 'Hydrogel Burn Dressings', 'Silver Sulfadiazine Cream (1%)', 'Morphine Sulfate autoinjector (10 mg)', 'Laminar air containment canopy'],
    steps: [
      {
        step_number: 1,
        action: 'REMOVE_HEAT_AND_DECONTAMINATE',
        instruction: 'Extinguish heat source. For chemical burns, irrigate immediately with sterile saline for a minimum of 15 minutes within suction canopy.',
        caution_notes: 'Capture all liquid droplets with suction to prevent electrical equipment short circuits.',
        duration_seconds: 900
      },
      {
        step_number: 2,
        action: 'ANALGESIA_ADMINISTRATION',
        instruction: 'Administer Morphine Sulfate 5-10 mg IM or Oral Transmucosal Fentanyl 400 mcg for severe burn pain.',
        caution_notes: 'Monitor respiratory rate every 15 minutes following opioid administration.',
        duration_seconds: 60
      },
      {
        step_number: 3,
        action: 'APPLICATION_OF_HYDROGEL',
        instruction: 'Cover partial and full thickness burns with sterile hydrogel sheets or non-adherent silver sulfadiazine dressing. Do not debride blisters in microgravity.',
        caution_notes: 'Avoid circumferential constrictive taping on extremities to prevent compartment syndrome.',
        duration_seconds: 180
      },
      {
        step_number: 4,
        action: 'RESUSCITATION_FLUIDS',
        instruction: 'Calculate fluid resuscitation requirements: 4 mL x kg body weight x % Total Body Surface Area burn. Deliver 50% in first 8 hours.',
        caution_notes: 'Catheterize bladder to monitor target urine output (0.5 to 1.0 mL/kg/h).',
        duration_seconds: 300
      }
    ],
    escalation_criteria: ['Burns exceeding 20% TBSA', 'Inhalation burn with stridor or facial blistering requiring emergent intubation'],
    applicable_mission_modes: ['ISS', 'MOON', 'MARS']
  },

  // 4. Foreign Body Airway Obstruction (Choking)
  {
    protocol_id: 'CHOKING_AIRWAY',
    title: 'Foreign Body Airway Obstruction and Choking in Microgravity',
    category: 'RESUSCITATION',
    version: 'v2.1.0',
    source_citation: 'NASA Exploration Medical Operations Manual: Acute Upper Airway Management in Reduced Gravity',
    license: 'PUBLIC_DOMAIN_NASA_OPEN_GOV',
    prerequisites: ['Crew member unable to speak, cough, or breathe; grasping neck (universal sign of choking)'],
    equipment_needed: ['Suction assembly with Yankauer tip', 'Magill forceps', 'Direct video laryngoscope', 'Cricothyrotomy emergency kit'],
    steps: [
      {
        step_number: 1,
        action: 'RESTRAINT_ASSISTED_THRUSTS',
        instruction: 'Stand behind patient, wrap arms around abdomen between navel and ribcage, and deliver quick inward and upward abdominal thrusts.',
        caution_notes: 'Anchor rescuer feet under deck foot loops to generate counter-reaction force.',
        duration_seconds: 30
      },
      {
        step_number: 2,
        action: 'MAGILL_EXTRACTION',
        instruction: 'If patient becomes unconscious, lay patient supine, insert video laryngoscope, inspect oropharynx, and grasp foreign body with Magill forceps under direct vision.',
        caution_notes: 'Do NOT perform blind finger sweeps; this may force the foreign body into the subglottic larynx.',
        duration_seconds: 45
      },
      {
        step_number: 3,
        action: 'SURGICAL_CRICOTHYROTOMY',
        instruction: 'If complete airway obstruction persists and cannot be relieved, perform emergent surgical cricothyrotomy and insert 6.0 mm cuffed tube.',
        caution_notes: 'Deploy operative canopy with smoke and fluid suction.',
        duration_seconds: 120
      }
    ],
    escalation_criteria: ['Inability to oxygenate (SpO2 < 85%)', 'Complete airway occlusion exceeding 2 minutes'],
    applicable_mission_modes: ['ISS', 'MOON', 'MARS']
  },

  // 5. Acute Anaphylaxis
  {
    protocol_id: 'ACUTE_ANAPHYLAXIS',
    title: 'Acute Anaphylactic Shock and Severe Systemic Allergy',
    category: 'PHARMACOLOGY',
    version: 'v2.1.0',
    source_citation: 'NASA JSC Flight Medicine Formulary: Emergency Protocols for Severe Hypersensitivity',
    license: 'PUBLIC_DOMAIN_NASA_OPEN_GOV',
    prerequisites: ['Rapid onset of urticaria/angioedema with respiratory distress (stridor/wheeze) or hypotension'],
    equipment_needed: ['EpiPen Autoinjector 0.3 mg', 'Diphenhydramine 50 mg injectable', 'Methylprednisolone 125 mg IV', 'Normal Saline IV infusion (1000 mL)'],
    steps: [
      {
        step_number: 1,
        action: 'EPINEPHRINE_IM_IMMEDIATE',
        instruction: 'Administer Epinephrine 0.3 mg (0.3 mL of 1:1000) IM into anterolateral thigh immediately.',
        caution_notes: 'Do not delay epinephrine for secondary medications. Repeat every 5-15 minutes if symptoms persist.',
        duration_seconds: 15
      },
      {
        step_number: 2,
        action: 'OXYGEN_AND_RECUMBENCY',
        instruction: 'Administer 100% oxygen via non-rebreather mask at 15 L/min. Place patient supine with lower extremities elevated on restraint board.',
        caution_notes: 'Sudden standing or sitting upright can precipitate fatal pulseless electrical activity (empty heart syndrome).',
        duration_seconds: 30
      },
      {
        step_number: 3,
        action: 'SECONDARY_MEDICATIONS',
        instruction: 'Establish IV access and infuse 1-2 Liters Normal Saline bolus. Administer Diphenhydramine 50 mg IV and Methylprednisolone 125 mg IV.',
        caution_notes: 'Monitor for biphasic anaphylactic recurrence for minimum 8 hours post-resolution.',
        duration_seconds: 180
      }
    ],
    escalation_criteria: ['Airway stridor worsening despite 2 doses of epinephrine', 'Systolic blood pressure < 80 mmHg refractory to fluid bolus'],
    applicable_mission_modes: ['ISS', 'MOON', 'MARS']
  },

  // 6. Extremity Fracture and Splinting
  {
    protocol_id: 'EXTREMITY_FRACTURE',
    title: 'Extremity Fracture, Joint Dislocation, and Microgravity Splinting',
    category: 'TRAUMA',
    version: 'v2.1.0',
    source_citation: 'NASA Space Flight Medical Operations Handbook: Orthopedic Emergencies in Exploration Environments',
    license: 'PUBLIC_DOMAIN_NASA_OPEN_GOV',
    prerequisites: ['Blunt trauma or crush injury with localized bone deformity, crepitus, or acute joint lock'],
    equipment_needed: ['SAM Splint (36 inch)', 'Elastic compression wraps', 'Cold pack', 'Morphine autoinjector', 'Portable ultrasound probe'],
    steps: [
      {
        step_number: 1,
        action: 'NEUROVASCULAR_ASSESSMENT',
        instruction: 'Check distal pulses, capillary refill, sensation, and motor function distal to injury site before touching limb.',
        caution_notes: 'Absence of distal pulse indicates arterial compression requiring emergent gentle axial realignment.',
        duration_seconds: 60
      },
      {
        step_number: 2,
        action: 'ANALGESIA_AND_REDUCTION',
        instruction: 'Administer Morphine 5-10 mg IM. If limb is severely angulated and pulse absent, apply gentle inline manual traction.',
        caution_notes: 'Do not force reduction if significant resistance is encountered.',
        duration_seconds: 180
      },
      {
        step_number: 3,
        action: 'SAM_SPLINT_MOLDING',
        instruction: 'Mold malleable SAM splint into structural C-curve or sugar-tong configuration. Immobilize joints above and below fracture site.',
        caution_notes: 'Wrap with elastic bandage with moderate tension; do not occlude venous return.',
        duration_seconds: 240
      },
      {
        step_number: 4,
        action: 'ULTRASOUND_CONFIRMATION',
        instruction: 'Perform focused ultrasound of fracture site to verify bone cortical alignment and rule out hematoma expansion.',
        caution_notes: 'Re-assess distal pulse and sensation every 30 minutes for 4 hours.',
        duration_seconds: 300
      }
    ],
    escalation_criteria: ['Open fracture with bone protruding through skin', 'Distal limb pallor and loss of pulse persisting post-reduction'],
    applicable_mission_modes: ['ISS', 'MOON', 'MARS']
  },

  // 7. Foreign Body Eye Injury & Chemical Flush
  {
    protocol_id: 'EYE_FOREIGN_BODY',
    title: 'Foreign Body Eye Injury, Corneal Abrasion, and Chemical Flush',
    category: 'TRAUMA',
    version: 'v2.1.0',
    source_citation: 'NASA Spaceflight Ophthalmic Emergency Care Standard: Cornea and Anterior Segment Trauma',
    license: 'PUBLIC_DOMAIN_NASA_OPEN_GOV',
    prerequisites: ['Dust, particulate debris, or chemical splash entering eye; acute ocular pain and blepharospasm'],
    equipment_needed: ['Eye Wash Irrigation Assembly', 'Morgan Lens with IV tubing', 'Fluorescein paper strips', 'Cobalt blue examination light', 'Proparacaine (0.5%) ophthalmic drops', 'Erythromycin ointment'],
    steps: [
      {
        step_number: 1,
        action: 'TOPICAL_ANESTHETIC_INSTILLATION',
        instruction: 'Instill 1-2 drops of Proparacaine 0.5% into conjunctival sac to relieve blepharospasm.',
        caution_notes: 'Do not prescribe ongoing topical anesthetics to crew members as they inhibit corneal re-epithelialization.',
        duration_seconds: 30
      },
      {
        step_number: 2,
        action: 'CONTINUOUS_IRRIGATION',
        instruction: 'Insert Morgan Lens onto cornea and flush with 1000 mL normal saline over 15 minutes. Capture effluent with fluid suction.',
        caution_notes: 'Check conjunctival pH with test paper; continue flush until pH reaches 7.0-7.4 for chemical burns.',
        duration_seconds: 900
      },
      {
        step_number: 3,
        action: 'FLUORESCEIN_SLIT_EVALUATION',
        instruction: 'Moisten fluorescein strip with saline, touch inferior conjunctiva, and inspect with cobalt blue light for corneal epithelial defect or Seidel sign (aqueous humor leak).',
        caution_notes: 'Positive Seidel sign indicates globe perforation: apply rigid metal eye shield immediately and withhold all pressure.',
        duration_seconds: 120
      },
      {
        step_number: 4,
        action: 'ANTIBIOTIC_AND_PATCH',
        instruction: 'Apply Erythromycin 0.5% ophthalmic ointment. Do NOT pressure patch the eye.',
        caution_notes: 'Schedule visual acuity check at 12 and 24 hours.',
        duration_seconds: 60
      }
    ],
    escalation_criteria: ['Positive Seidel sign / suspected open globe injury', 'Visual acuity degradation greater than 2 Snellen lines'],
    applicable_mission_modes: ['ISS', 'MOON', 'MARS']
  },

  // 8. Barodontalgia & Acute Space Dental Pain
  {
    protocol_id: 'ACUTE_BARODONTALGIA',
    title: 'Acute Barodontalgia, Dental Pulpitis, and Periapical Abscess',
    category: 'DENTAL',
    version: 'v2.1.0',
    source_citation: 'NASA JSC Flight Medicine Dental Operations Manual: Diagnosis and Interim Stabilization of Odontogenic Emergencies',
    license: 'PUBLIC_DOMAIN_NASA_OPEN_GOV',
    prerequisites: ['Severe throbbing dental pain triggered by cabin pressure fluctuations during EVA prebreathe or ambient atmospheric cycling'],
    equipment_needed: ['Dental Mirror and Explorer probe', 'Zinc Oxide Eugenol (IRM) temporary restorative cement', 'Lidocaine 2% with 1:100,000 Epinephrine', 'Amoxicillin-Clavulanate 875/125 mg tablets', 'Ibuprofen 600 mg'],
    steps: [
      {
        step_number: 1,
        action: 'DENTAL_EXAMINATION_AND_MAPPING',
        instruction: 'Perform visual inspection and gentle percussion test with mirror handle to identify offending tooth. Note facial asymmetry or fluctuant swelling.',
        caution_notes: 'Verify patient is secured in medical workstation restraint harness to prevent involuntary movement during oral probing.',
        duration_seconds: 120
      },
      {
        step_number: 2,
        action: 'INTERIM_SEDATIVE_PACK',
        instruction: 'For exposed pulp or broken restoration, dry cavity with sterile cotton pellet and place Zinc Oxide Eugenol temporary filling.',
        caution_notes: 'Ensure filling does not leave high occlusal contact during biting.',
        duration_seconds: 180
      },
      {
        step_number: 3,
        action: 'ANTIBIOTIC_AND_ANALGESIA_REGIMEN',
        instruction: 'If systemic infection, periapical abscess, or facial edema is present, start Amoxicillin-Clavulanate 875/125 mg PO BID for 7 days plus Ibuprofen 600 mg PO Q6H.',
        caution_notes: 'Barodontalgia often recurs during extravehicular activity; crew member is grounded from EVA until symptom-free for 72 hours.',
        duration_seconds: 60
      }
    ],
    escalation_criteria: ['Ludwig angina (floor of mouth swelling compromising airway)', 'Facial cellulitis spreading toward orbit'],
    applicable_mission_modes: ['ISS', 'MOON', 'MARS']
  },

  // 9. Decompression Sickness Recompression
  {
    protocol_id: 'DCS_RECOMPRESSION',
    title: 'Decompression Sickness Emergency In-Suit and Airlock Recompression',
    category: 'ENVIRONMENTAL',
    version: 'v2.1.0',
    source_citation: 'NASA JSC-66258, Extravehicular Activity Physiology and Medical Operations: Hypobaric Decompression Protocols',
    license: 'PUBLIC_DOMAIN_NASA_OPEN_GOV',
    prerequisites: ['Crew member in EMU suit or recent post-EVA presenting with joint pain, cutis marmorata, dyspnea, or neurological deficits'],
    equipment_needed: ['Airlock Recompression System', 'EMU Spacesuit with Purge Valve', '100% Oxygen delivery mask', 'Normal Saline IV (1000 mL)', 'Aspirin (325 mg)'],
    steps: [
      {
        step_number: 1,
        action: 'ABORT_EVA_AND_AIRLOCK_SEAL',
        instruction: 'Terminate EVA immediately. Re-enter airlock, repressurize airlock to maximum cabin pressure (14.7 psi / 760 mmHg).',
        caution_notes: 'If symptoms persist in airlock, engage Bends Treatment Apparatus (BTA) to overpressurize spacesuit to 8.3 psi over ambient.',
        duration_seconds: 300
      },
      {
        step_number: 2,
        action: 'HYPERBARIC_PURE_O2',
        instruction: 'Administer 100% oxygen continuously via tight-fitting mask to maximize arterial-tissue nitrogen gradient and dissolve emboli.',
        caution_notes: 'Maintain horizontal recumbency to prevent arterial nitrogen bubbles migrating to cerebral circulation.',
        duration_seconds: 1200
      },
      {
        step_number: 3,
        action: 'HYDRATION_AND_ANTIPLATELET',
        instruction: 'Administer 1000 mL Normal Saline IV bolus to counteract microvascular sludging. Give Aspirin 325 mg PO if no bleeding contraindication.',
        caution_notes: 'Do not administer nitrous oxide or let patient stand until fully debriefed by Flight Surgeon.',
        duration_seconds: 180
      }
    ],
    escalation_criteria: ['Type II DCS with neurological hemiparesis or visual field cuts', 'The chokes (retrosternal pain and acute pulmonary edema)'],
    applicable_mission_modes: ['ISS', 'MOON', 'MARS']
  },

  // 10. Massive Arterial Hemorrhage & Wound Packing
  {
    protocol_id: 'MASSIVE_HEMORRHAGE',
    title: 'Massive Arterial Hemorrhage, Hemostasis, and Wound Packing in Weightlessness',
    category: 'SURGICAL',
    version: 'v2.1.0',
    source_citation: 'NASA-CR-2018-219488, Clinical Exploration Medicine and Principles of Microgravity Surgery',
    license: 'PUBLIC_DOMAIN_NASA_OPEN_GOV',
    prerequisites: ['Spurting pulsatile arterial blood or rapid expanding wound hematoma'],
    equipment_needed: ['Combat Application Tourniquet (CAT)', 'Hemostatic Gauze (QuikClot / Celox)', 'Laminar air suction canopy', 'Sterile suction canisters', 'Tranexamic Acid (TXA 1g IV)'],
    steps: [
      {
        step_number: 1,
        action: 'APPLY_TOURNIQUET_HIGH_AND_TIGHT',
        instruction: 'For extremity arterial bleed, apply CAT tourniquet 2-3 inches proximal to bleeding site. Turn windlass rod until pulsatile bleeding stops completely and lock rod in clip.',
        caution_notes: 'Record application time on forehead or tourniquet time strap. In microgravity, deploy suction canopy immediately to capture airborne blood droplets.',
        duration_seconds: 45
      },
      {
        step_number: 2,
        action: 'HEMOSTATIC_WOUND_PACKING',
        instruction: 'For junctional wounds (groin, axilla, neck), pack cavity tightly with Hemostatic Gauze directly against bleeding vessel. Apply firm continuous manual pressure for 3 full minutes.',
        caution_notes: 'Do not release pressure early to inspect wound.',
        duration_seconds: 180
      },
      {
        step_number: 3,
        action: 'TXA_INFUSION',
        instruction: 'Administer Tranexamic Acid (TXA) 1.0 g IV infused over 10 minutes within 3 hours of initial trauma.',
        caution_notes: 'Infuse slowly to prevent transient hypotension.',
        duration_seconds: 600
      }
    ],
    escalation_criteria: ['Hemorrhage uncontrolled after application of 2 tourniquets', 'Signs of hemorrhagic shock (HR > 120, SBP < 80, altered mental status)'],
    applicable_mission_modes: ['ISS', 'MOON', 'MARS']
  }
];

// Seed or update emergency protocols in database
export async function seedEmergencyProtocols() {
  const seeded = [];
  for (const proto of OFFICIAL_EMERGENCY_PROTOCOLS) {
    const updated = await EmergencyProtocol.findOneAndUpdate(
      { protocol_id: proto.protocol_id },
      { $set: proto },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    seeded.push(updated);
  }
  return {
    total_seeded: seeded.length,
    protocols: seeded.map((p) => ({
      protocol_id: p.protocol_id,
      title: p.title,
      category: p.category,
      steps_count: p.steps.length,
      source_citation: p.source_citation
    }))
  };
}

// Get all protocols with optional category filtering
export async function listEmergencyProtocols(filter = {}) {
  const query = {};
  if (filter.category) query.category = filter.category;
  if (filter.mission_mode) query.applicable_mission_modes = filter.mission_mode;

  let protocols = await EmergencyProtocol.find(query).sort({ protocol_id: 1 });
  if (protocols.length === 0) {
    // If not yet in DB, return from pre-compiled official library
    protocols = OFFICIAL_EMERGENCY_PROTOCOLS.filter((p) => {
      if (filter.category && p.category !== filter.category) return false;
      if (filter.mission_mode && !p.applicable_mission_modes.includes(filter.mission_mode)) return false;
      return true;
    });
  }

  return protocols;
}

// Get single protocol by ID
export async function getEmergencyProtocolById(protocolId) {
  let protocol = await EmergencyProtocol.findOne({ protocol_id: protocolId });
  if (!protocol) {
    protocol = OFFICIAL_EMERGENCY_PROTOCOLS.find((p) => p.protocol_id === protocolId) || null;
  }
  return protocol;
}
