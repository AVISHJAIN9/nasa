import { accumulateRadiationDose } from '../../../backend/src/services/radiationTrackerService.js';
export async function verify() {
  const dose = await accumulateRadiationDose({ crewId: 'vega', days: 1 });
  const pass = dose && dose.daily_rate_msv > 0;
  return {
    id: 'F021',
    pass: !!pass,
    status: pass ? 'DONE-VERIFIED' : 'PARTIAL',
    evidence: pass ? `Radiation tracker accumulates ${dose.daily_rate_msv} mSv/day for active mission mode.` : 'Radiation dose tracking failed.'
  };
}
