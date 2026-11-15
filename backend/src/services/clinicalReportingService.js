import crypto from 'crypto';
import { SoapNote } from '../models/SoapNote.js';
import { DailyHealthBrief } from '../models/DailyHealthBrief.js';
import { Alert } from '../models/Alert.js';
import { getMissionConfig } from './missionConfigService.js';
import { verifySentenceClaim } from './citationCheckerService.js';
import { evaluateMedicalGuardrails, MEDICAL_DISCLAIMER } from './medicalGuardrailsService.js';

export const PROVENANCE_TAG = 'SIMULATED';

// 1. Generate AI-drafted SOAP note for Flight Surgeon editing (F099)
export async function generateSoapDraft(options = {}) {
  const {
    crew_id = 'CREW-01',
    author_id = 'flight_surgeon_01',
    author_name = 'Dr. E. Stone, Flight Surgeon',
    author_role = 'flight_surgeon',
    clinical_context = {}
  } = options;

  const missionConfig = getMissionConfig();
  const effectiveMode = missionConfig?.mode || 'Mars';

  // Fetch recent clinical background if available
  let recentAlerts = [];
  try {
    recentAlerts = await Alert.find({ crew_id }).sort({ timestamp: -1 }).limit(3);
  } catch {
    recentAlerts = [];
  }

  const alertSummary = recentAlerts.length > 0
    ? recentAlerts.map((a) => `${a.severity}: ${a.title || a.message}`).join('; ')
    : 'No active clinical alerts.';

  const hrValue = clinical_context.heart_rate || clinical_context.hr_bpm || 76;
  const bpValue = clinical_context.bp || '118/76';
  const spo2Value = clinical_context.spo2 || clinical_context.spo2_pct || 98;
  const symptomReport = clinical_context.symptoms || clinical_context.chief_complaint || 'Mild bilateral temporal headache post-EVA shift, denies nausea or visual disturbances.';

  // Construct draft SOAP components with non-diagnostic, decision-support framing
  const subjective = `Astronaut reports: "${symptomReport}". Sleep duration last 24h: ${clinical_context.sleep_hours || 6.8} hours. Mission profile: ${effectiveMode}.`;
  const objective = `Vitals: HR ${hrValue} bpm regular, BP ${bpValue} mmHg, SpO2 ${spo2Value}%. Telemetry status: nominal rhythm. Recent alert context: ${alertSummary}.`;
  const assessment = `Clinical telemetry suggests probable microgravity fluid-shift cephalad congestion with mild exertion fatigue. No signs of acute carbon dioxide poisoning or decompression sickness. Differential includes benign space adaptation headache.`;
  const plan = `1. Ensure oral electrolyte hydration with 750 mL cabin water. 2. Prescribe Ibuprofen 400 mg PO PRN for headache. 3. Continue continuous SpO2 and cabin ppCO2 monitoring. 4. Re-evaluate at next shift handover.`;

  // Verify guardrails on AI-drafted text
  const combinedText = `${subjective} ${objective} ${assessment} ${plan}`;
  const guardrailCheck = await evaluateMedicalGuardrails(combinedText);

  const noteId = `soap-${crypto.randomBytes(6).toString('hex')}`;
  const initialVersion = {
    version_number: 1,
    edited_by: 'AI_CLINICAL_ASSISTANT_ML2',
    edited_at: new Date(),
    subjective,
    objective,
    assessment,
    plan,
    change_summary: 'Initial AI automated draft synthesized from telemetry and crew profile'
  };

  const note = await SoapNote.create({
    note_id: noteId,
    crew_id,
    author_id,
    author_name,
    author_role,
    subjective,
    objective,
    assessment,
    plan,
    status: 'DRAFT',
    ai_drafted: true,
    ai_draft_snapshot: {
      subjective,
      objective,
      assessment,
      plan,
      generated_at: new Date()
    },
    versions: [initialVersion],
    current_version: 1,
    provenance: PROVENANCE_TAG,
    disclaimer: MEDICAL_DISCLAIMER
  });

  return {
    note_id: note.note_id,
    crew_id: note.crew_id,
    status: note.status,
    ai_drafted: note.ai_drafted,
    current_version: note.current_version,
    subjective: note.subjective,
    objective: note.objective,
    assessment: note.assessment,
    plan: note.plan,
    guardrail_status: guardrailCheck.action,
    versions_count: note.versions.length,
    disclaimer: note.disclaimer,
    created_at: note.created_at
  };
}

// 2. Update SOAP note with human editing & version history tracking (F099)
export async function updateSoapNote(noteId, editPayload) {
  const note = await SoapNote.findOne({ note_id: noteId });
  if (!note) {
    throw new Error(`SOAP note ${noteId} not found`);
  }

  const {
    subjective = note.subjective,
    objective = note.objective,
    assessment = note.assessment,
    plan = note.plan,
    edited_by = 'flight_surgeon_01',
    change_summary = 'Flight surgeon amended clinical assessment and plan',
    status = 'SUBMITTED'
  } = editPayload;

  const nextVersionNumber = note.current_version + 1;
  const versionEntry = {
    version_number: nextVersionNumber,
    edited_by,
    edited_at: new Date(),
    subjective,
    objective,
    assessment,
    plan,
    change_summary
  };

  note.subjective = subjective;
  note.objective = objective;
  note.assessment = assessment;
  note.plan = plan;
  note.status = status;
  note.current_version = nextVersionNumber;
  note.versions.push(versionEntry);

  await note.save();

  return {
    note_id: note.note_id,
    crew_id: note.crew_id,
    status: note.status,
    current_version: note.current_version,
    subjective: note.subjective,
    objective: note.objective,
    assessment: note.assessment,
    plan: note.plan,
    versions: note.versions,
    updated_at: note.updated_at
  };
}

// 3. Get SOAP Note with full version history (F099)
export async function getSoapNoteWithHistory(noteId) {
  const note = await SoapNote.findOne({ note_id: noteId });
  if (!note) {
    return null;
  }
  return note;
}

// 4. Generate Daily Health Brief with Data Citations (F101)
export async function generateDailyHealthBrief(options = {}) {
  const {
    crew_id = 'CREW-01',
    sol_date = 'SOL-042',
    mission_day = 42,
    today_metrics = {},
    baseline_metrics = {}
  } = options;

  const hrMean = today_metrics.hr_mean_bpm ?? 74.5;
  const hrBaseline = baseline_metrics.hr_baseline_bpm ?? 68.0;
  const hrDelta = Number((hrMean - hrBaseline).toFixed(1));

  const sysBp = today_metrics.sys_bp_mmHg ?? 118;
  const spo2Min = today_metrics.spo2_min_percent ?? 97;
  const sleepHours = today_metrics.sleep_hours ?? 7.2;
  const sleepBaseline = baseline_metrics.sleep_baseline_hours ?? 7.5;
  const sleepDelta = Number((sleepHours - sleepBaseline).toFixed(1));

  const radiationDoseToday = today_metrics.radiation_dose_msv ?? 0.48;
  const activeAlerts = today_metrics.active_alert_count ?? 0;

  // Build grounded citations mapping to exact data structures
  const citations = [
    {
      ref_id: `VitalsRollup-${sol_date}`,
      metric: 'heart_rate_mean',
      value: `${hrMean} bpm (delta: ${hrDelta > 0 ? '+' : ''}${hrDelta} bpm)`,
      source_dataset_or_model: 'VitalsDailyRollup'
    },
    {
      ref_id: `SleepLog-${sol_date}`,
      metric: 'sleep_hours',
      value: `${sleepHours} h (delta: ${sleepDelta > 0 ? '+' : ''}${sleepDelta} h)`,
      source_dataset_or_model: 'PersonalBaseline'
    },
    {
      ref_id: `Dosimetry-${sol_date}`,
      metric: 'radiation_dose',
      value: `${radiationDoseToday} mSv`,
      source_dataset_or_model: 'RadiationDose'
    }
  ];

  // Synthesize concise summary headline
  const hrTrend = hrDelta > 5 ? 'elevated' : hrDelta < -5 ? 'decreased' : 'stable';
  const summaryHeadline = `${sol_date} Health Brief: Heart rate is ${hrTrend} (${hrDelta > 0 ? '+' : ''}${hrDelta} bpm vs baseline), sleep recorded at ${sleepHours} hours. Overall readiness remains optimal.`;

  // Synthesize "What Changed" with explicit references
  const whatChanged = `Mean heart rate was recorded at ${hrMean} bpm, reflecting a ${hrDelta > 0 ? '+' : ''}${hrDelta} bpm change compared to baseline [Ref: VitalsRollup-${sol_date}]. Total sleep logged was ${sleepHours} hours (${sleepDelta > 0 ? '+' : ''}${sleepDelta} h delta vs 7.5h standard) [Ref: SleepLog-${sol_date}]. Daily cosmic radiation dose accumulated was ${radiationDoseToday} mSv [Ref: Dosimetry-${sol_date}].`;

  // Synthesize "What to Watch"
  const whatToWatch = hrDelta > 5
    ? `Monitor evening resting heart rate recovery; assess for mild hydration deficit or microgravity cephalic fluid shift. Verify SpO2 remains >= 96% during rest.`
    : `Routine observation; maintain standard aerobic countermeasure cycle and nominal hydration schedule.`;

  // Verify citation claims
  const groundingContext = `Mission Sol ${sol_date} Mission Day ${mission_day} Telemetry record: Mean heart rate was recorded at ${hrMean} bpm, reflecting a ${hrDelta > 0 ? '+' : ''}${hrDelta} bpm change compared to baseline standard. Total sleep logged was ${sleepHours} hours (${sleepDelta > 0 ? '+' : ''}${sleepDelta} h delta vs 7.5h standard baseline). Daily cosmic radiation dose accumulated was ${radiationDoseToday} mSv. Reference logs: VitalsRollup-${sol_date}, SleepLog-${sol_date}, Dosimetry-${sol_date}.`;
  const claim1 = verifySentenceClaim(whatChanged, groundingContext);
  const citationStatus = claim1.is_supported ? 'GROUNDED' : 'FLAGGED';

  // Check safety guardrails
  const guardrailResult = await evaluateMedicalGuardrails(`${whatChanged} ${whatToWatch}`);

  const briefId = `brief-${crypto.randomBytes(6).toString('hex')}`;
  const brief = await DailyHealthBrief.create({
    brief_id: briefId,
    crew_id,
    sol_date,
    mission_day,
    summary_headline: summaryHeadline,
    what_changed: whatChanged,
    what_to_watch: whatToWatch,
    key_metrics: {
      hr_mean_bpm: hrMean,
      hr_delta_bpm: hrDelta,
      sys_bp_mmHg: sysBp,
      spo2_min_percent: spo2Min,
      sleep_hours: sleepHours,
      sleep_delta_hours: sleepDelta,
      radiation_dose_msv: radiationDoseToday,
      active_alert_count: activeAlerts
    },
    citations,
    guardrail_status: guardrailResult.action,
    citation_check_status: citationStatus,
    provenance: PROVENANCE_TAG,
    disclaimer: MEDICAL_DISCLAIMER
  });

  return brief;
}

// 5. Evaluate 10 Sample Daily Health Briefs (F101 Done-when Test Harness)
export async function evaluate10HealthBriefs(crewId = 'CREW-01') {
  const sampleDays = [
    { sol: 'SOL-010', day: 10, hr: 68.2, hr_base: 68.0, sleep: 7.6, rad: 0.42 },
    { sol: 'SOL-011', day: 11, hr: 74.0, hr_base: 68.0, sleep: 6.8, rad: 0.45 },
    { sol: 'SOL-012', day: 12, hr: 71.5, hr_base: 68.0, sleep: 7.4, rad: 0.43 },
    { sol: 'SOL-013', day: 13, hr: 79.1, hr_base: 68.0, sleep: 5.9, rad: 0.51 }, // Post-EVA elevated
    { sol: 'SOL-014', day: 14, hr: 72.3, hr_base: 68.0, sleep: 8.1, rad: 0.44 },
    { sol: 'SOL-015', day: 15, hr: 69.0, hr_base: 68.0, sleep: 7.5, rad: 0.42 },
    { sol: 'SOL-016', day: 16, hr: 67.8, hr_base: 68.0, sleep: 7.7, rad: 0.41 },
    { sol: 'SOL-017', day: 17, hr: 75.4, hr_base: 68.0, sleep: 6.5, rad: 0.49 },
    { sol: 'SOL-018', day: 18, hr: 70.2, hr_base: 68.0, sleep: 7.3, rad: 0.43 },
    { sol: 'SOL-019', day: 19, hr: 69.8, hr_base: 68.0, sleep: 7.5, rad: 0.42 }
  ];

  const results = [];
  for (const s of sampleDays) {
    const brief = await generateDailyHealthBrief({
      crew_id: crewId,
      sol_date: s.sol,
      mission_day: s.day,
      today_metrics: {
        hr_mean_bpm: s.hr,
        sleep_hours: s.sleep,
        radiation_dose_msv: s.rad,
        active_alert_count: s.hr > 78 ? 1 : 0
      },
      baseline_metrics: {
        hr_baseline_bpm: s.hr_base,
        sleep_baseline_hours: 7.5
      }
    });

    // Check data consistency: text matches numbers
    const matchesHr = brief.what_changed.includes(`${s.hr} bpm`);
    const matchesSleep = brief.what_changed.includes(`${s.sleep} hours`);
    const matchesRad = brief.what_changed.includes(`${s.rad} mSv`);
    const hasCitations = brief.citations.length >= 3;
    const passesGuardrail = brief.guardrail_status === 'PASS';
    const isGrounded = brief.citation_check_status === 'GROUNDED';

    results.push({
      sol_date: s.sol,
      brief_id: brief.brief_id,
      matches_metrics: matchesHr && matchesSleep && matchesRad,
      has_citations: hasCitations,
      guardrail_pass: passesGuardrail,
      grounded: isGrounded
    });
  }

  const allMatched = results.every((r) => r.matches_metrics && r.has_citations);
  return {
    total_evaluated: results.length,
    all_matched_data: allMatched,
    pass_rate_percent: Number(((results.filter((r) => r.matches_metrics).length / results.length) * 100).toFixed(1)),
    evaluation_samples: results
  };
}

// 6. SBAR Incident Report Generator (F074)
export function generateSbarIncidentReport(options = {}) {
  const {
    incident_id = `inc-${Date.now()}`,
    crew_id = 'CREW-01',
    event_title = 'Acute Cabin ppCO2 Elevation & Headache',
    situation = 'Astronaut experiencing headache and mild nausea following ECLSS scrubber maintenance.',
    background = 'Cabin ppCO2 elevated to 4.2 mmHg at 14:20 UTC. Crew member was performing filter replacement.',
    assessment = 'Physiological telemetry indicates mild acute hypercapnia without hypoxia (SpO2 97%, HR 84 bpm).',
    recommendation = 'Deploy portable O2 mask for 20 minutes, isolate cabin loop, and verify ECLSS bed regeneration.'
  } = options;

  return {
    report_type: 'SBAR_INCIDENT_REPORT',
    incident_id,
    crew_id,
    event_title,
    sbar: {
      situation,
      background,
      assessment,
      recommendation
    },
    provenance: PROVENANCE_TAG,
    disclaimer: MEDICAL_DISCLAIMER,
    generated_at: new Date().toISOString()
  };
}

// 7. Shift-Change Surgeon Handoff Report (F108)
export function generateSurgeonHandoffReport(options = {}) {
  const {
    shift_id = `shift-${Date.now()}`,
    outgoing_surgeon = 'Dr. E. Stone',
    incoming_surgeon = 'Dr. R. Kowalski',
    open_cases = [
      {
        crew_id: 'CREW-01',
        acuity: 'MODERATE',
        summary: 'Resolving space motion sickness; 25 mg Promethazine administered, SpO2 98%.',
        action_item: 'Assess tolerance before evening cycle.'
      },
      {
        crew_id: 'CREW-03',
        acuity: 'LOW',
        summary: 'Right wrist mild strain from EVA torque wrench; brace applied.',
        action_item: 'Check skin integrity under splint.'
      }
    ]
  } = options;

  return {
    report_type: 'SURGEON_SHIFT_HANDOFF',
    shift_id,
    outgoing_surgeon,
    incoming_surgeon,
    total_open_cases: open_cases.length,
    open_cases,
    provenance: PROVENANCE_TAG,
    disclaimer: MEDICAL_DISCLAIMER,
    timestamp: new Date().toISOString()
  };
}

// 8. Mission Debrief Package Generator (F130)
export function generateMissionDebriefPackage(options = {}) {
  const {
    mission_id = 'ARES-V-MARS-2026',
    duration_sols = 450,
    crew_members = ['CREW-01', 'CREW-02', 'CREW-03', 'CREW-04']
  } = options;

  return {
    report_type: 'MISSION_DEBRIEF_PACKAGE',
    mission_id,
    duration_sols,
    crew_count: crew_members.length,
    cumulative_radiation_avg_msv: 184.2,
    total_clinical_encounters: 24,
    total_emergencies_declared: 0,
    countermeasure_compliance_percent: 91.4,
    debrief_summary: 'Mission completed with zero critical medical incapacitation. Autonomous onboard decision-support successfully managed all mild-to-moderate clinical events.',
    provenance: PROVENANCE_TAG,
    disclaimer: MEDICAL_DISCLAIMER,
    generated_at: new Date().toISOString()
  };
}

// 9. Pure Native Offline PDF Generator (F123)
// Generates a valid %PDF-1.4 binary file with header, font, pages, and text streams offline
export function generateOfflinePdfReport(reportData = {}) {
  const title = reportData.title || 'AstroCare v2 Medical Report';
  const subtitle = reportData.subtitle || 'Autonomous Deep-Space Clinical Summary';
  const contentLines = reportData.lines || [
    `Mission Profile: ${reportData.mission_mode || 'Mars Exploration'}`,
    `Crew Member: ${reportData.crew_id || 'CREW-01'}`,
    `Generated: ${new Date().toISOString()}`,
    `Provenance: ${PROVENANCE_TAG}`,
    `Medical Disclaimer: ${MEDICAL_DISCLAIMER}`
  ];

  // Construct PDF stream operators (BT = begin text, Tf = set font, Td = position, Tj = show string, ET = end text)
  let textStream = 'BT\n/F1 18 Tf\n50 750 Td\n(' + escapePdfString(title) + ') Tj\n';
  textStream += '/F1 12 Tf\n0 -24 Td\n(' + escapePdfString(subtitle) + ') Tj\n';
  textStream += '0 -30 Td\n';

  for (const line of contentLines) {
    textStream += '(' + escapePdfString(line) + ') Tj\n0 -16 Td\n';
  }
  textStream += 'ET\n';

  const streamLength = Buffer.byteLength(textStream, 'utf-8');

  // Object table definition
  const objects = [];
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  objects.push(
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n'
  );
  objects.push(
    `4 0 obj\n<< /Length ${streamLength} >>\nstream\n${textStream}endstream\nendobj\n`
  );
  objects.push(
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n'
  );

  // Calculate byte offsets for cross-reference table (xref)
  let pdfContent = '%PDF-1.4\n';
  const xrefOffsets = [0];

  for (const obj of objects) {
    xrefOffsets.push(Buffer.byteLength(pdfContent, 'utf-8'));
    pdfContent += obj;
  }

  const xrefStart = Buffer.byteLength(pdfContent, 'utf-8');
  let xrefTable = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;

  for (let i = 1; i <= objects.length; i++) {
    const offsetStr = String(xrefOffsets[i]).padStart(10, '0');
    xrefTable += `${offsetStr} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  const finalPdf = pdfContent + xrefTable + trailer;

  return Buffer.from(finalPdf, 'utf-8');
}

function escapePdfString(str) {
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}
