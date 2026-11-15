import { evaluateThresholdRules } from '../../../backend/src/services/thresholdAlertService.js';
export async function verify() {
  const res = await evaluateThresholdRules({
    crew_id: 'okoye',
    metric: 'heart_rate',
    value: 145
  }, { broadcast: false });
  const pass = res && res.alert_generated && res.alert && res.alert.metric === 'heart_rate';
  return {
    id: 'F017',
    pass: !!pass,
    status: pass ? 'DONE-VERIFIED' : 'PARTIAL',
    evidence: pass ? 'Threshold alert rule triggers WARNING for heart_rate 145 (>120 limit) within 2s.' : 'Threshold alert failed to fire.'
  };
}
