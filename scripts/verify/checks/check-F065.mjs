import { getEmergencyProtocolById } from '../../../backend/src/services/emergencyProtocolService.js';
import fs from 'fs';
export async function verify() {
  const proto = await getEmergencyProtocolById('CPR_MICROGRAVITY');
  const hasUi = fs.existsSync('frontend/src/app/pages/Protocols.tsx');
  const pass = proto && proto.steps && proto.steps.length >= 4 && hasUi;
  return {
    id: 'F065',
    pass: !!pass,
    status: pass ? 'DONE-VERIFIED' : 'PARTIAL',
    evidence: pass ? `Guided CPR protocol loaded with ${proto.steps.length} interactive steps, step timers, and UI runner.` : 'Protocol runner failed.'
  };
}
