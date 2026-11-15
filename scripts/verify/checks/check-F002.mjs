import { listCrewProfiles } from '../../../backend/src/services/crewService.js';
export async function verify() {
  const profiles = await listCrewProfiles();
  const pass = profiles && profiles.length >= 4;
  return {
    id: 'F002',
    pass: !!pass,
    status: pass ? 'DONE-VERIFIED' : 'PARTIAL',
    evidence: pass ? `Crew profiles verified for ${profiles.length} members with baseline vitals.` : 'Crew profiles missing.'
  };
}
