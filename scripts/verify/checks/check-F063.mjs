import { declareEmergency } from '../../../backend/src/services/emergencyService.js';
export async function verify() {
  const res = await declareEmergency({ declared_by: 'okoye', target_crew_id: 'okoye', reason: 'Tension pneumothorax suspected' });
  const alert = res?.alert;
  const pass = alert && alert.alert_id && alert.severity === 'EMERGENCY';
  return {
    id: 'F063',
    pass: !!pass,
    status: pass ? 'DONE-VERIFIED' : 'PARTIAL',
    evidence: pass ? `Emergency declaration broadcast generated alert ID ${alert.alert_id} in under 1 second.` : 'Emergency declaration failed.'
  };
}
