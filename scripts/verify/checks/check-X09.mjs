import { evaluateCabinToBodyEarlyWarning } from '../../../backend/src/services/cabinToBodyEarlyWarningService.js';
export async function verify() {
  const warning = await evaluateCabinToBodyEarlyWarning({ ppco2_mmhg: 3.8, ppco2_delta_rate_mmhg_per_hour: 1.5, current_symptoms: [] });
  const pass = warning && warning.early_warning_active && warning.estimated_lead_time_minutes > 0;
  return {
    id: 'X09',
    pass: !!pass,
    status: pass ? 'DONE-VERIFIED' : 'PARTIAL',
    evidence: pass ? `Cabin-to-body early warning triggers ${warning.estimated_lead_time_minutes}m before subjective symptoms.` : 'Early warning failed.'
  };
}
