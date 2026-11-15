export interface KBChunk {
  id: string;
  title: string;
  text: string;
  source: string;
  licence: string;
}

export const KNOWLEDGE_BASE: KBChunk[] = [
  {
    id: 'kb-co2',
    title: 'Carbon Dioxide (CO2) Toxicity & Hypercapnia Symptoms',
    text: 'Elevated cabin carbon dioxide above 2000 ppm causes frontal headache, visual fatigue, and impaired executive decision making. Severe exposure above 3500 ppm triggers dizziness, nausea, tachypnea, and eventual loss of consciousness. Immediate treatment requires supplemental oxygen and switching secondary scrubbers.',
    source: 'NASA HRP (summary)',
    licence: 'Illustrative',
  },
  {
    id: 'kb-sms',
    title: 'Space Adaptation Syndrome & Motion Sickness',
    text: 'Neurovestibular disorientation occurs in microgravity as otolith organs unload, producing illusions of motion and stomach awareness. Symptoms include malaise, loss of appetite, cold sweating, and emesis. Promethazine administration and limiting rapid head movements facilitate sensory compensation.',
    source: 'NASA HRP (summary)',
    licence: 'Illustrative',
  },
  {
    id: 'kb-dehydration',
    title: 'Microgravity Fluid Shifts & Dehydration',
    text: 'Cephalic fluid shifts prompt central baroreceptors to trigger initial diuresis, reducing total plasma volume by 10-15%. Crew members frequently underestimate water loss due to suppressed thirst sensation and low cabin humidity. Maintain electrolyte balanced fluid intake of at least 2.5 liters daily.',
    source: 'Public first-aid guidance',
    licence: 'Illustrative',
  },
  {
    id: 'kb-burns',
    title: 'Thermal and Flash Burn First Response',
    text: 'Cool the affected burn surface immediately with sterile saline or hydrogel compresses for at least five minutes to halt thermal injury progression. Avoid applying direct ice or bursting intact thermal blisters. Cover with clean, sterile, non-adherent dressing and assess for airway inhalation injury.',
    source: 'Public first-aid guidance',
    licence: 'Illustrative',
  },
  {
    id: 'kb-choking',
    title: 'Foreign Body Airway Obstruction & Choking',
    text: 'If a conscious astronaut is choking and cannot vocalize, administer up to five firm back blows followed by abdominal thrusts. In microgravity, secure the patient against a bulkhead or CMRS to maximize force transmission. If the casualty becomes unresponsive, initiate chest compressions immediately.',
    source: 'Public first-aid guidance',
    licence: 'Illustrative',
  },
  {
    id: 'kb-radiation',
    title: 'Solar Particle Event (SPE) Radiation Shelter Protocol',
    text: 'During extreme ionizing radiation alerts, crew must immediately retreat into high-density water and polyethylene shielded sleep compartments. Maintain shelter until ground controllers confirm the coronal mass ejection shockfront has subsided. Administer antiemetics if acute radiation prodrome emerges.',
    source: 'NASA HRP (summary)',
    licence: 'Illustrative',
  },
  {
    id: 'kb-chest-pain',
    title: 'Acute Coronary Syndrome & Chest Pain Red Flags',
    text: 'Sudden substernal chest pressure radiating to the jaw, neck, or left arm warrants immediate emergency protocol initiation. Accompanying diaphoresis, dyspnea, or presyncope indicates critical cardiovascular compromise. Administer chewable aspirin if not contraindicated and obtain a 12-lead ECG immediately.',
    source: 'Public first-aid guidance',
    licence: 'Illustrative',
  },
  {
    id: 'kb-fever',
    title: 'Pyrexia & Systemic Infection Management',
    text: 'Core body temperatures exceeding 38.0°C indicate active infection or impaired heat dissipation in closed habitats. Hydrate aggressively, apply external conductive cooling towels, and initiate broad-spectrum oral antimicrobial therapy if bacterial etiology is suspected. Monitor pulse oximetry and blood pressure for early septic drift.',
    source: 'Public first-aid guidance',
    licence: 'Illustrative',
  },
  {
    id: 'kb-sleep',
    title: 'Circadian Disruption & Sleep Fragmentation',
    text: 'Absence of natural diurnal lighting and habitat acoustic background noise causes severe sleep architecture fragmentation. Non-pharmacological mitigation involves strict 480 nm blue-depleted evening lighting and consistent crew sleep scheduling. Low-dose melatonin may be utilized to phase-shift circadian rhythms.',
    source: 'NASA HRP (summary)',
    licence: 'Illustrative',
  },
  {
    id: 'kb-sans',
    title: 'Spaceflight-Associated Neuro-Ocular Syndrome (SANS)',
    text: 'Cephalad venous congestion and elevated intracranial pressure lead to optic disc edema, posterior globe flattening, and hyperopic refractive shift. Astronauts report progressive visual degradation, scotomas, and choroidal folds. Periodic optical coherence tomography (OCT) and visual acuity tests are mandatory.',
    source: 'NASA HRP (summary)',
    licence: 'Illustrative',
  },
  {
    id: 'kb-congestion',
    title: 'Cephalic Venous Congestion & Epistaxis',
    text: 'Microgravity induces a 1.5 to 2.0 liter upward fluid redistribution producing facial puffiness, chronic nasal mucosal engorgement, and sinus fullness. Anterior epistaxis is common due to dry cabin atmosphere and fragile capillary beds. Apply steady bilateral nasal pressure for 10 minutes with head neutral.',
    source: 'NASA HRP (summary)',
    licence: 'Illustrative',
  },
  {
    id: 'kb-back-pain',
    title: 'Lumbar Spine Elongation Pain',
    text: 'Intervertebral spinal discs decompress in the absence of gravitational axial loading, lengthening the vertebral column by up to 5 to 7 cm. This produces intense, deep muscular aching in the lumbosacral region during the first weeks of spaceflight. Fetal-tuck positioning and resistance exercise alleviate paraspinal tension.',
    source: 'NASA HRP (summary)',
    licence: 'Illustrative',
  },
  {
    id: 'kb-anxiety',
    title: 'Acute Situational Anxiety & Confinement Stress',
    text: 'Isolated, confined, and extreme (ICE) environments induce intermittent feelings of helplessness, claustrophobia, and sensory deprivation. Structured relaxation breathing, structured team debriefs, and private psychological communication channels mitigate acute panic symptoms. Encourage regular physical exercise routines.',
    source: 'NASA HRP (summary)',
    licence: 'Illustrative',
  },
  {
    id: 'kb-overdose',
    title: 'Accidental Medication Duplication & Toxicity',
    text: 'In the event of an inadvertent double-dose of prescription medical kit agents, immediately cross-reference the onboard formulary for toxic thresholds and reversal antidotes. Monitor vital signs every 15 minutes, prepare oral activated charcoal if ingestion was recent, and transmit an immediate ground consult.',
    source: 'Public first-aid guidance',
    licence: 'Illustrative',
  },
];
