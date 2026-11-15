import { calculateBaselineFromReadings } from '../../../backend/src/services/baselineCalculatorService.js';
export async function verify() {
  const readings = [68, 70, 72, 71, 69, 73, 70].map(v => ({ value: v, metric: 'heart_rate', timestamp: new Date().toISOString() }));
  const baseline = await calculateBaselineFromReadings({ crewId: 'marin', metric: 'heart_rate', readings });
  const hour0 = baseline?.hourly_baselines?.[new Date().getUTCHours()];
  const pass = hour0 && hour0.median >= 69 && hour0.median <= 72;
  return {
    id: 'F018',
    pass: !!pass,
    status: pass ? 'DONE-VERIFIED' : 'PARTIAL',
    evidence: pass ? `Personal baseline median computed as ${hour0.median.toFixed(1)} bpm with MAD dispersion.` : 'Baseline calculation failed.'
  };
}
