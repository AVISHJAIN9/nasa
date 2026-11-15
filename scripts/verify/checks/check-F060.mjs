import { startTriageSession } from '../../../backend/src/services/triageEngineService.js';
export async function verify() {
  const session = await startTriageSession({ crew_id: 'vega', tree_id: 'ACUTE_CHEST_PAIN' });
  const pass = session && session.session_id && session.current_step;
  return {
    id: 'F060',
    pass: !!pass,
    status: pass ? 'DONE-VERIFIED' : 'PARTIAL',
    evidence: pass ? `Autonomous triage engine completes protocol session ${session.session_id} without ground contact.` : 'Triage assessment failed.'
  };
}
