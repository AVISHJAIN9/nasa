import { CrewProfile } from '../models/CrewProfile.js';
import { recordAuditEntry } from './auditLogService.js';
import { eventBus } from '../bus/index.js';
import { NotFoundException, BadRequestException } from '../middleware/errors.js';

export const CMO_CHECKLISTS = [
  {
    checklist_id: 'chk-cmo-01',
    title: 'Acute Trauma & Wound Stabilization',
    category: 'SURGICAL',
    steps: [
      'Assess airway, breathing, circulation in microgravity restraints',
      'Apply local pressure dressings or hemostatic gauze from MedKit #2',
      'Establish sterile field using magnetic/adhesive surgical drape',
      'Initiate remote video consult with flight surgeon if latency <= 2 min'
    ]
  },
  {
    checklist_id: 'chk-cmo-02',
    title: 'Anaphylaxis & Acute Allergic Emergency',
    category: 'IMMUNOLOGY',
    steps: [
      'Administer intramuscular epinephrine (0.3 mg) via auto-injector',
      'Deliver supplemental O2 via emergency mask (flow rate 10 L/min)',
      'Prepare IV access kit and diphenhydramine 50 mg ampoule',
      'Continuously log vital signs at 30-second intervals'
    ]
  },
  {
    checklist_id: 'chk-cmo-03',
    title: 'Hypobaric Decompression & Sickness (DCS)',
    category: 'ENVIRONMENTAL',
    steps: [
      'Immediately transition patient to 100% normobaric oxygen',
      'Inspect suit seal integrity and module pressure gauge',
      'Prepare hyperbaric treatment bag if cabin pressure restored < 70 kPa',
      'Notify Mission Control and record event in tamper-evident log'
    ]
  }
];

/**
 * Grants Crew Medical Officer (CMO) designation to an astronaut.
 * Requirement: "Done when: Role granted and revoked with audit entry."
 */
export async function grantCmoRole(crewId, grantedBy = 'flight_surgeon', reason = 'Mission operational designation') {
  const profile = await CrewProfile.findOne({ crew_id: crewId });
  if (!profile) {
    throw new NotFoundException(`Crew profile not found: ${crewId}`);
  }

  const now = new Date();
  profile.is_cmo = true;
  profile.cmo_granted_at = now;
  profile.cmo_granted_by = grantedBy;
  await profile.save();

  // Audit entry creation (hash-chained)
  const auditEntry = await recordAuditEntry({
    user_id: grantedBy,
    user_role: 'flight_surgeon',
    action: 'GRANT_CMO_ROLE',
    resource: `crew:${crewId}`,
    details: {
      crew_id: crewId,
      granted_by: grantedBy,
      reason,
      status: 'GRANTED'
    }
  });

  await eventBus.publish({
    event_type: 'cmo:role_granted',
    channel: 'crew',
    severity: 'info',
    payload: {
      crew_id: crewId,
      is_cmo: true,
      granted_by: grantedBy,
      audit_sequence: auditEntry.sequence
    }
  });

  return {
    crew_id: crewId,
    name: profile.name,
    is_cmo: true,
    badge: 'CREW_MEDICAL_OFFICER',
    granted_at: now.toISOString(),
    granted_by: grantedBy,
    audit_sequence: auditEntry.sequence
  };
}

/**
 * Revokes Crew Medical Officer (CMO) designation.
 */
export async function revokeCmoRole(crewId, revokedBy = 'flight_surgeon', reason = 'Rotation completed or command decision') {
  const profile = await CrewProfile.findOne({ crew_id: crewId });
  if (!profile) {
    throw new NotFoundException(`Crew profile not found: ${crewId}`);
  }

  if (!profile.is_cmo) {
    throw new BadRequestException(`Crew member ${crewId} does not hold CMO role`);
  }

  const now = new Date();
  profile.is_cmo = false;
  profile.cmo_granted_at = null;
  profile.cmo_granted_by = null;
  await profile.save();

  // Audit entry creation (hash-chained)
  const auditEntry = await recordAuditEntry({
    user_id: revokedBy,
    user_role: 'flight_surgeon',
    action: 'REVOKE_CMO_ROLE',
    resource: `crew:${crewId}`,
    details: {
      crew_id: crewId,
      revoked_by: revokedBy,
      reason,
      status: 'REVOKED'
    }
  });

  await eventBus.publish({
    event_type: 'cmo:role_revoked',
    channel: 'crew',
    severity: 'info',
    payload: {
      crew_id: crewId,
      is_cmo: false,
      revoked_by: revokedBy,
      audit_sequence: auditEntry.sequence
    }
  });

  return {
    crew_id: crewId,
    name: profile.name,
    is_cmo: false,
    badge: null,
    revoked_at: now.toISOString(),
    revoked_by: revokedBy,
    audit_sequence: auditEntry.sequence
  };
}

/**
 * Retrieves CMO status, operational badge, and available medical checklists.
 */
export async function getCmoStatus(crewId) {
  const profile = await CrewProfile.findOne({ crew_id: crewId });
  if (!profile) {
    throw new NotFoundException(`Crew profile not found: ${crewId}`);
  }

  return {
    crew_id: crewId,
    name: profile.name,
    is_cmo: Boolean(profile.is_cmo),
    badge: profile.is_cmo ? 'CREW_MEDICAL_OFFICER' : null,
    granted_at: profile.cmo_granted_at,
    granted_by: profile.cmo_granted_by,
    checklists: profile.is_cmo ? CMO_CHECKLISTS : []
  };
}
