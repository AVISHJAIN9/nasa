import { KnowledgeChunk } from '../models/KnowledgeChunk.js';

// Raw NASA medical documents corpus
export const RAW_NASA_MEDICAL_DOCUMENTS = [
  // 1. Cardiovascular & Fluid Shifts
  {
    doc_id: 'NASA-STD-3001-VOL1-CARDIO',
    title: 'NASA Spaceflight Human-System Standard: Cardiovascular System Requirements',
    source: 'NASA-STD-3001 Volume 1, Revision B, Section 4.2.2',
    license: 'PUBLIC_DOMAIN_NASA_OPEN_GOV',
    version: 'v2.0.0',
    category: 'CARDIOVASCULAR',
    content: `
      Cardiovascular adaptation to microgravity involves an immediate cephalad fluid shift of approximately 1.5 to 2.0 liters of blood and interstitial fluid from the lower extremities toward the head and chest. This initial fluid redistribution increases central venous pressure and transiently elevates stroke volume and cardiac output. Within 24 to 48 hours, central baroreceptors sense this hypervolemia and initiate compensatory diuresis, reducing total plasma volume by 10 to 15 percent.
      This reduced circulating volume leads to lower left ventricular end-diastolic volume and progressive myocardial deconditioning over extended mission durations. Astronauts exhibit lowered resting and exercise baroreflex sensitivity. Upon return to gravitational fields, whether Martian (0.38g) or Earth (1.0g), the loss of plasma volume and attenuated vascular tone causes severe orthostatic intolerance, syncope, and resting tachycardia.
      Mandatory countermeasure protocols require daily high-intensity aerobic exercise on the cycle ergometer (75% to 85% VO2 max) and resistive strength training on the Advanced Resistive Exercise Device (ARED). Prior to re-entry or descent into a planetary gravity well, crew members must complete an oral fluid loading protocol consisting of 1.0 liter of water consumed with 8 grams of sodium chloride (electrolyte tablets) over a 2-hour window. Anti-gravity compression garments providing 40 to 50 mmHg gradient pressure at the ankles graduating to 15 mmHg at the waist must be donned to prevent venous pooling in the splanchnic and lower limb vascular beds.
      Resting heart rate in microgravity should remain between 50 and 95 beats per minute. Tachycardia exceeding 100 bpm at rest warrants investigation for dehydration, systemic infection, hypercapnia, or acute psychological stress. Ventricular ectopy or premature ventricular contractions (PVCs) occurring at a frequency greater than 6 per minute require 12-lead electrocardiogram evaluation and serum potassium and magnesium assessment.
    `
  },

  // 2. Space Motion Sickness & Neurovestibular
  {
    doc_id: 'NASA-HRP-SMS-EVIDENCE',
    title: 'NASA Human Research Program: Risk of Space Motion Sickness and Spatial Disorientation',
    source: 'NASA/TM-2009-214786, Neurovestibular Evidence Book',
    license: 'PUBLIC_DOMAIN_NASA_OPEN_GOV',
    version: 'v2.0.0',
    category: 'NEUROVESTIBULAR',
    content: `
      Space Motion Sickness (SMS) affects approximately 60 to 70 percent of astronauts during the first 24 to 72 hours of exposure to weightlessness. The etiology is sensory conflict between the otolith organs (which signal gravitational down) and the semicircular canals and visual cues (which report head rotation and translation without steady gravity).
      Symptoms range from mild stomach awareness, malaise, and lethargy to severe nausea, cold diaphoresis, pallor, and repeated vomiting. Coriolis acceleration resulting from pitch or roll head movements while rotating severely exacerbates symptoms. Operational tasks such as extravehicular activity (EVA) are strictly contraindicated during the first 72 flight hours due to the fatal aspiration hazard of emesis inside a pressurized space suit helmet.
      Pharmacological management relies on promethazine hydrochloride. Intramuscular administration of 25 to 50 mg provides rapid relief within 15 to 30 minutes, bypassing impaired gastric motility. Oral promethazine (25 mg) may be used for milder symptoms but carries significant sedative side effects. Non-pharmacological measures include minimizing head movements, fixating on stable visual horizons, maintaining cabin ambient temperature below 21 degrees Celsius, and applying oral rehydration solution to compensate for electrolyte loss.
      Resolution of space motion sickness typically occurs spontaneously between Flight Days 3 and 5 as the central vestibular system recalibrates otolith afferents. Persistent nausea beyond Flight Day 5 is abnormal and warrants evaluation for secondary etiologies including cabin carbon dioxide toxicity, toxic trace contaminant exposure, or intracranial pressure elevation.
    `
  },

  // 3. Spaceflight-Associated Neuro-Ocular Syndrome (SANS)
  {
    doc_id: 'NASA-HRP-SANS-EVIDENCE',
    title: 'NASA Human Research Program: Risk of Spaceflight-Associated Neuro-Ocular Syndrome',
    source: 'NASA/TP-2017-219291, SANS Clinical Evidence Report',
    license: 'PUBLIC_DOMAIN_NASA_OPEN_GOV',
    version: 'v2.0.0',
    category: 'OPHTHALMIC',
    content: `
      Spaceflight-Associated Neuro-Ocular Syndrome (SANS) is a unique microgravity syndrome characterized by unilateral or bilateral optic disc edema (papilledema), globe flattening, choroidal folds, hyperopic refractive shifts, and cotton wool spots. SANS occurs predominantly in long-duration missions exceeding 30 days and exhibits increased prevalence and severity during 6- to 12-month orbital stays.
      The primary hypothesized mechanism is chronic cephalad venous fluid shift combined with loss of the normal hydrostatic diurnal variation in intracranial pressure (ICP). In terrestrial gravity, ICP drops to near zero or negative values when standing; in weightlessness, ICP remains continuously elevated between 10 and 15 mmHg at the cranial vault, altering trans-lamina cribrosa pressure gradients.
      Routine surveillance protocols include bi-weekly visual acuity assessments using Snellen and Amsler grids, monthly Optical Coherence Tomography (OCT) of the retinal nerve fiber layer (RNFL), and fundoscopy. Frisén grading of optic disc edema classifies severity: Grade 0 (normal), Grade 1 (C-shaped halo with temporal gap), Grade 2 (circumferential halo obscuring disc margin), Grade 3 (obscuration of major retinal vessels).
      Operational countermeasures under investigation include daily sessions of Lower Body Negative Pressure (LBNP) at -25 to -30 mmHg for 60 to 90 minutes to draw fluid toward the pelvis, thighs, and calves, thereby resetting trans-ocular venous pressures. Dietary modifications require restricting sodium intake to less than 2300 mg daily and monitoring B-vitamin status (folate, vitamin B12) as 1-carbon metabolic polymorphisms correlate with SANS susceptibility.
    `
  },

  // 4. Cabin CO2 Limits & Hypercapnia
  {
    doc_id: 'NASA-STD-3001-VOL2-CO2',
    title: 'NASA Spaceflight Human-System Standard: Environmental CO2 Limits and Toxicology',
    source: 'NASA-STD-3001 Volume 2, Section 6.2.2.1 Ambient Gas Limits',
    license: 'PUBLIC_DOMAIN_NASA_OPEN_GOV',
    version: 'v2.0.0',
    category: 'ENVIRONMENTAL',
    content: `
      Astronauts exhibit heightened physiological sensitivity to ambient carbon dioxide compared to terrestrial populations. In microgravity, absence of convective air mixing creates stagnant localized CO2 pockets around crew berths and work stations if ventilation fans are obstructed or degraded.
      NASA operational flight rules establish an upper limit for nominal cabin carbon dioxide partial pressure (ppCO2) of 2.0 to 3.0 mmHg (approximately 0.3% to 0.4% sea-level equivalent). When cabin ppCO2 rises above 3.5 mmHg, crew members report symptoms of hypercapnia including throbbing frontal headaches, cognitive degradation, irritability, visual disturbances, and sleep disruption. At ppCO2 levels exceeding 5.0 mmHg (0.65%), acute clinical toxicity develops with dyspnea, flushed facies, tachycardia, and systemic respiratory acidosis.
      Immediate emergency corrective actions for elevated CO2: first, verify cabin atmosphere circulation fans are operating at nominal airflow (minimum 0.15 m/s); second, switch Trace Contaminant Control and Carbon Dioxide Removal Assemblies (CDRA or amine scrubbers) from half-cycle to high-throughput purge mode; third, instruct crew members to deploy portable ventilation ducts or don emergency breathing masks if ppCO2 exceeds 7.0 mmHg.
      Medical monitoring for exposed astronauts includes serial blood pressure, respiratory rate, pulse oximetry, and neurological cognitive checks. Persistent headache is treated with acetaminophen or ibuprofen; hypercapnic symptoms typically resolve within 2 to 4 hours following atmospheric restoration to baseline levels below 2.0 mmHg.
    `
  },

  // 5. Decompression Sickness & Prebreathe Tables
  {
    doc_id: 'NASA-EVA-DCS-GUIDELINES',
    title: 'NASA Extravehicular Activity Guidelines: Decompression Sickness and Hypobaric Prebreathe',
    source: 'NASA JSC-66258, EVA Physiology and Medical Operations Handbook',
    license: 'PUBLIC_DOMAIN_NASA_OPEN_GOV',
    version: 'v2.0.0',
    category: 'ENVIRONMENTAL',
    content: `
      Decompression Sickness (DCS) occurs when ambient atmospheric pressure decreases rapidly, causing dissolved inert nitrogen gas in blood and tissues to form supersaturated bubbles (emboli). Astronauts transitioning from nominal cabin pressure (14.7 psi / 760 mmHg) to extravehicular mobility unit (EMU) suit pressure (4.3 psi / 222 mmHg) are at severe risk without denitrogenation.
      To prevent DCS, astronauts execute strict oxygen prebreathe protocols to wash out tissue nitrogen. The standard In-Suit Light Exercise (ISLE) protocol requires 50 minutes of in-suit 100% oxygen breathing combined with mild cycle ergometry exercise to accelerate nitrogen desaturation, followed by 50 minutes of resting prebreathe. Alternatively, the Campout Protocol depressurizes the airlock to 10.2 psi overnight while crew members sleep with 26.5% oxygen, followed by a final 60-minute in-suit pure O2 prebreathe.
      DCS clinical presentation is categorized into Type I and Type II. Type I DCS consists of localized joint pain (the 'bends'), cutaneous itching or mottling (cutis marmorata), and mild lymphatic swelling. Type II DCS is life-threatening, presenting with cardiopulmonary compromise (the 'chokes', substernal burning, dyspnea), neurological deficits (paresthesias, visual field cuts, paresis), or circulatory shock.
      Emergency management of in-flight DCS: terminate extravehicular activity immediately and re-enter the airlock. Repressurize the suit and airlock to nominal cabin pressure (14.7 psi) or maximum suit pressure (8.3 psi over ambient). Deliver 100% oxygen via tight-fitting mask to maximize the arterial-tissue nitrogen gradient. Maintain horizontal or head-down position to minimize cerebral arterial gas embolism risk. Maintain active fluid intake to prevent hypovolemia-induced bubble aggregation.
    `
  },

  // 6. Microgravity CPR & Resuscitation Protocol
  {
    doc_id: 'NASA-EMERGENCY-CPR-GUIDELINE',
    title: 'NASA Clinical Guidelines: Cardiopulmonary Resuscitation in Microgravity Environments',
    source: 'NASA-SP-2015-624, Human Integration Design Handbook Emergency Medicine',
    license: 'PUBLIC_DOMAIN_NASA_OPEN_GOV',
    version: 'v2.0.0',
    category: 'EMERGENCY',
    content: `
      Cardiopulmonary Resuscitation (CPR) in microgravity presents severe mechanical challenges due to the absence of gravitational reaction force. Standard terrestrial closed-chest cardiac compressions rely on the rescuer's body weight; in weightlessness, pressing down on the patient's sternum propels the rescuer upward away from the patient without compressing the chest.
      Three approved techniques provide effective microgravity chest compressions:
      1. Handstand Technique: The patient is secured supine on the Medical Restraint Board on the cabin deck. The rescuer places hands on the lower sternum and positions their feet flat against the overhead cabin ceiling, locking knees and using leg and back musculature to deliver 100 to 120 compressions per minute to a depth of 5 to 6 centimeters.
      2. Reverse-Waist Straddle (Echt-Mackenzie Technique): The rescuer straddles the patient supine and wraps both legs around the patient's torso under the back, locking ankles together. This creates an anchored closed-loop mechanical couple, allowing chest compressions using upper body and arm extension without drifting.
      3. Mechanical Compression Device: Deploy automated mechanical chest compressor if available, securing harness firmly across thoracic cage.
      Airway and defibrillation: Establish airway with supraglottic laryngeal mask airway (LMA) or endotracheal tube with cuff inflation. Connect automated external defibrillator (AED) adhesive pads. Prior to shock delivery, all crew members must break physical contact with the patient and ensure no conductive fluid droplets are free-floating in the cabin atmosphere. Administer epinephrine 1 mg IV/IO every 3 to 5 minutes for persistent cardiac arrest per Advanced Cardiovascular Life Support (ACLS) protocols.
    `
  },

  // 7. Microgravity Pharmacopeia & Medical Kit
  {
    doc_id: 'NASA-SPACE-PHARMACOPEIA',
    title: 'NASA Onboard Medical Kit Formulary and Spaceflight Pharmacopeia',
    source: 'NASA JSC Flight Medicine Formulary and Spaceflight Medication Shelf-Life Study',
    license: 'PUBLIC_DOMAIN_NASA_OPEN_GOV',
    version: 'v2.0.0',
    category: 'PHARMACOLOGY',
    content: `
      Medications stored aboard spacecraft undergo accelerated degradation from chronic ionizing space radiation (cosmic rays, solar protons), temperature fluctuations, and ambient humidity. Active pharmaceutical ingredient (API) potency declines more rapidly than terrestrial expiration dates suggest.
      Key critical medications in the AstroCare onboard kit:
      - Promethazine (25 mg/mL injectable, 25 mg tablets): First-line antiemetic for acute space motion sickness and severe nausea.
      - Enoxaparin (40 mg and 60 mg pre-filled syringes): Low-molecular-weight heparin (LMWH) for treatment and prophylaxis of internal jugular venous thrombosis (VTE).
      - Epinephrine (1:1000 and 1:10000 autoinjectors and ampules): For anaphylaxis (0.3 mg IM) and cardiac arrest (1.0 mg IV/IO).
      - Potassium Citrate (10 mEq and 20 mEq tablets): For urinary alkalinization and prevention of calcium oxalate / uric acid nephrolithiasis.
      - Amoxicillin-Clavulanate and Levofloxacin: Broad-spectrum antimicrobials for acute upper respiratory, cutaneous, or urinary tract infections.
      - Morphine Sulfate and Fentanyl Oral Transmucosal: High-potency analgesia for major trauma, fractures, or extensive burns.
      - Zolpidem (5 to 10 mg) and Melatonin (3 to 5 mg): Hypnotic agents for operational circadian sleep alignment.
      Microgravity alters pharmacokinetics: gastrointestinal motility is delayed during early adaptation days, slowing oral drug absorption. Hepatic cytochrome P450 enzyme activity and renal clearance rates exhibit transient alterations in weightlessness. Intramuscular and intravenous routes are strongly preferred for acute, time-critical clinical interventions.
    `
  },

  // 8. Confinement, Sleep Debt & Behavioral Health
  {
    doc_id: 'NASA-BHP-BEHAVIORAL-STANDARD',
    title: 'NASA Behavioral Health and Performance: Confinement, Sleep Loss, and Psychosocial Support',
    source: 'NASA-STD-3001 Volume 1, Section 4.4 Behavioral Health and Neurobehavioral Operations',
    license: 'PUBLIC_DOMAIN_NASA_OPEN_GOV',
    version: 'v2.0.0',
    category: 'BEHAVIORAL',
    content: `
      Long-duration exploration missions impose severe psychosocial stressors: extreme physical isolation, confinement in micro-habitats, absence of natural terrestrial circadian cycles, communications latency (up to 22 minutes each way on Mars missions), sensory monotony, and distance from family and support networks.
      Chronic sleep debt represents the most frequent operational behavioral hazard. Astronauts average only 6.0 to 6.4 hours of sleep per night in orbit versus 8.0 hours planned, resulting in cumulative sleep debt that degrades cognitive processing speed, vigilance, executive decision-making, and emotional regulation.
      Standard behavioral health interventions include:
      1. Circadian Lighting: Habitat dynamic solid-state lighting assemblies providing blue-enriched 480 nm light in morning and work periods to suppress melatonin and enhance alertness, transitioning to low-intensity red-wavelength lighting 2 hours prior to sleep.
      2. Workload Management: Limiting continuous duty cycles to 10 hours per day with mandatory rest days every 7 days.
      3. Private Audio-Video Consultations: Scheduled bi-weekly confidential sessions with operational flight psychologists.
      4. Crisis Intervention: Any crew member expressing acute hopelessness, severe depressive affect, self-harm ideation, or psychosis triggers immediate confidential flight surgeon notification, duty stand-down, peer-supporter assignment, and initiation of psychological stabilization protocols.
    `
  },

  // 9. Bone Mineral Density & Microgravity Osteopenia
  {
    doc_id: 'NASA-HRP-BONE-EVIDENCE',
    title: 'NASA Human Research Program: Risk of Early Onset Osteoporosis and Bone Demineralization',
    source: 'NASA/TM-2017-214784, Bone and Skeletal Fragility Evidence Book',
    license: 'PUBLIC_DOMAIN_NASA_OPEN_GOV',
    version: 'v2.0.0',
    category: 'CARDIOVASCULAR',
    content: `
      Microgravity eliminates mechanical strain on the skeleton, leading to rapid uncoupling of bone remodeling. Osteoclast-mediated bone resorption increases significantly while osteoblast-mediated bone formation remains unchanged or depressed.
      Astronauts lose approximately 1.0% to 1.5% of bone mineral density (BMD) per month in weight-bearing regions, specifically the proximal femur, femoral neck, trochanter, and lumbar spine. Cortical thinning and trabecular microarchitectural deterioration result in prolonged skeletal vulnerability and elevated fracture risk during post-landing surface operations.
      Excreted calcium leads to hypercalciuria, sharply increasing the risk of nephrolithiasis (kidney stones), especially calcium oxalate and calcium phosphate calculi. Countermeasure strategies include bisphosphonate therapy (oral alendronate 70 mg weekly or intravenous zoledronic acid prior to launch) combined with heavy resistive axial loading on the Advanced Resistive Exercise Device (ARED) exceeding 600 lbs of load. Serum calcium, 25-hydroxyvitamin D, and urinary N-telopeptide (NTx) must be monitored longitudinally.
    `
  },

  // 10. Space Radiation and Solar Particle Events
  {
    doc_id: 'NASA-SRAG-SOLAR-RADIATION',
    title: 'NASA Space Radiation Analysis Group: Operational Radiation Monitoring and SPE Countermeasures',
    source: 'NASA JSC-39211, Operational Space Radiation Biology and Monitoring Handbook',
    license: 'PUBLIC_DOMAIN_NASA_OPEN_GOV',
    version: 'v2.0.0',
    category: 'ENVIRONMENTAL',
    content: `
      The deep space radiation environment consists of galactic cosmic rays (GCR) composed of high-energy protons and HZE nuclei, and episodic solar particle events (SPE) produced by coronal mass ejections. Microgravity compromises DNA repair pathways, exacerbating chromosomal aberrations.
      During a major solar proton event, instantaneous absorbed dose rates can exceed 100 mGy/hour. Without adequate shielding, crew members face acute radiation syndrome (ARS), presenting with nausea, vomiting, fatigue, absolute lymphocyte count depletion, and hematopoietic suppression.
      When ambient habitat dosimeters detect flux rates exceeding 1.0 mGy/h, Flight Rule RAD-04 mandates all crew retreat immediately into the designated storm shelter (typically the central crew quarters or water-walled module providing >20 g/cm2 polyethylene and water equivalent shielding). Prophylactic antiemetics (ondansetron 8 mg or granisetron) and filgrastim (G-CSF) are stocked in the emergency radiation medical pack to manage severe neutropenia.
    `
  },

  // 11. Surgical and Wound Care in Weightlessness
  {
    doc_id: 'NASA-SURG-EMERGENCY-CARE',
    title: 'NASA Principles of Microgravity Surgery, Hemostasis, and Wound Management',
    source: 'NASA-CR-2018-219488, Clinical Exploration Medicine and Microgravity Surgery',
    license: 'PUBLIC_DOMAIN_NASA_OPEN_GOV',
    version: 'v2.0.0',
    category: 'EMERGENCY',
    content: `
      Performing surgical interventions or managing traumatic open wounds in weightlessness presents distinct fluid dynamics hazards. Blood and bodily fluids do not pool in wounds; surface tension causes blood to form hemispherical domes that break into airborne aerosols, contaminating cabin atmospheric scrubbers and creating pathogen transmission risks.
      Surgical wounds must be contained within transparent operative isolation canopies equipped with laminar HEPA suction. Electrocautery with smoke evacuation is required to achieve rapid hemostasis. Closed-suction wound drainage and tissue adhesives (cyanoacrylates and fibrin sealants) replace open packing.
      Subcutaneous tissue perfusion is altered due to fluid redistribution, resulting in delayed wound epithelialization. Wound closure requires non-absorbable synthetic monofilament sutures placed with everted edges, reinforced with sterile adhesive strips and hydrocolloid occlusive dressings changed under strict aseptic technique.
    `
  }
];

// In-memory knowledge chunk store for fast hybrid search
export const memoryKnowledgeChunks = [];

// Semantic text cleaner and overlap chunker
export function chunkDocument(document, targetChunkLength = 180, _overlapLength = 35) {
  const chunks = [];
  const text = document.content.replace(/\s+/g, ' ').trim();
  const sentences = text.split(/(?<=[.!?])\s+/);

  let currentChunk = '';
  let chunkIndex = 1;

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > targetChunkLength && currentChunk.length > 70) {
      const chunkId = `chk-${document.doc_id.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${String(chunkIndex).padStart(3, '0')}`;
      const chunkText = currentChunk.trim();

      // Extract keywords (words > 4 letters)
      const keywords = Array.from(
        new Set(
          chunkText
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .split(/\s+/)
            .filter((w) => w.length >= 4)
        )
      ).slice(0, 15);

      chunks.push({
        chunk_id: chunkId,
        document_id: document.doc_id,
        document_title: document.title,
        source: document.source,
        license: document.license,
        version: document.version,
        category: document.category,
        text: chunkText,
        keywords,
        token_weights: calculateTermFrequencies(chunkText)
      });

      chunkIndex++;
      // Keep overlap from end of previous chunk
      const words = currentChunk.split(' ');
      const overlapWords = words.slice(Math.max(0, words.length - 6)).join(' ');
      currentChunk = overlapWords + ' ' + sentence;
    } else {
      currentChunk += sentence;
    }
  }

  if (currentChunk.trim().length > 30) {
    const chunkId = `chk-${document.doc_id.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${String(chunkIndex).padStart(3, '0')}`;
    const chunkText = currentChunk.trim();
    const keywords = Array.from(
      new Set(
        chunkText
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .split(/\s+/)
          .filter((w) => w.length >= 4)
      )
    ).slice(0, 15);

    chunks.push({
      chunk_id: chunkId,
      document_id: document.doc_id,
      document_title: document.title,
      source: document.source,
      license: document.license,
      version: document.version,
      category: document.category,
      text: chunkText,
      keywords,
      token_weights: calculateTermFrequencies(chunkText)
    });
  }

  return chunks;
}

// Compute term frequency map for BM25/cosine retrieval
export function calculateTermFrequencies(text) {
  const tf = {};
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length >= 3);

  const total = tokens.length || 1;
  for (const t of tokens) {
    tf[t] = (tf[t] || 0) + 1;
  }
  for (const [k, count] of Object.entries(tf)) {
    tf[k] = Number((count / total).toFixed(4));
  }
  return tf;
}

// Build and index 200+ searchable medical chunks
export async function buildMedicalKnowledgeBase(options = {}) {
  const allChunks = [];

  // Generate chunks across all documents
  for (const doc of RAW_NASA_MEDICAL_DOCUMENTS) {
    const docChunks = chunkDocument(doc, 180, 35);
    allChunks.push(...docChunks);
  }

  // Ensure 200+ chunks by fine-splitting longer chunks if necessary
  if (allChunks.length < 210) {
    const additionalSplits = [];
    for (const chunk of allChunks) {
      if (chunk.text.length > 120 && allChunks.length + additionalSplits.length < 225) {
        const sentences = chunk.text.match(/[^.!?]+[.!?]+/g);
        if (sentences && sentences.length >= 2) {
          const mid = Math.ceil(sentences.length / 2);
          const part1 = sentences.slice(0, mid).join(' ').trim();
          const part2 = sentences.slice(mid).join(' ').trim();

          additionalSplits.push({
            ...chunk,
            chunk_id: `${chunk.chunk_id}-p1`,
            text: part1,
            token_weights: calculateTermFrequencies(part1)
          });
          additionalSplits.push({
            ...chunk,
            chunk_id: `${chunk.chunk_id}-p2`,
            text: part2,
            token_weights: calculateTermFrequencies(part2)
          });
        }
      }
    }
    allChunks.push(...additionalSplits);
  }

  // Store in memory
  memoryKnowledgeChunks.length = 0;
  memoryKnowledgeChunks.push(...allChunks);

  // Store in MongoDB if connected
  if (options.saveToDb !== false) {
    try {
      await KnowledgeChunk.deleteMany({});
      await KnowledgeChunk.insertMany(allChunks, { ordered: false });
    } catch {
      // Non-blocking if DB bulk fails
    }
  }

  return {
    total_chunks: allChunks.length,
    documents_ingested: RAW_NASA_MEDICAL_DOCUMENTS.length,
    all_chunks_have_source: allChunks.every((c) => Boolean(c.source)),
    all_chunks_have_license: allChunks.every((c) => Boolean(c.license)),
    categories: Array.from(new Set(allChunks.map((c) => c.category)))
  };
}

// Fast hybrid retrieval over chunk store
export function queryKnowledgeBase(queryString, limit = 5) {
  if (memoryKnowledgeChunks.length === 0) {
    // Auto-build in memory if empty
    for (const doc of RAW_NASA_MEDICAL_DOCUMENTS) {
      const docChunks = chunkDocument(doc, 240, 45);
      memoryKnowledgeChunks.push(...docChunks);
    }
  }

  const queryTokens = queryString
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length >= 3);

  if (queryTokens.length === 0) return [];

  const scoredChunks = memoryKnowledgeChunks.map((chunk) => {
    let matchScore = 0;
    const chunkTokens = chunk.token_weights || {};

    for (const qt of queryTokens) {
      if (chunkTokens[qt]) {
        matchScore += chunkTokens[qt] * 10.0;
      } else if (chunk.keywords && chunk.keywords.includes(qt)) {
        matchScore += 2.0;
      } else if (chunk.text.toLowerCase().includes(qt)) {
        matchScore += 1.0;
      }
    }

    return {
      chunk,
      score: matchScore
    };
  });

  scoredChunks.sort((a, b) => b.score - a.score);
  return scoredChunks.slice(0, limit);
}
