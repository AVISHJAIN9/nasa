import { fuseAlertStorm } from '../../../backend/src/services/alertFusionService.js';
export async function verify() {
  const storm = Array.from({ length: 50 }, (_, i) => ({
    id: `raw-${i}`,
    metric: i % 2 === 0 ? 'heart_rate' : 'spo2',
    severity: 'WARNING',
    created_at: new Date(Date.now() + i * 10)
  }));
  const fused = await fuseAlertStorm(storm, { persistGrouped: false });
  const count = fused?.grouped_count ?? fused?.length ?? 50;
  const pass = count < 5;
  return {
    id: 'F049',
    pass: !!pass,
    status: pass ? 'DONE-VERIFIED' : 'PARTIAL',
    evidence: pass ? `Alert storm of 50 raw alerts successfully condensed into ${count} grouped alerts (spec target <5).` : 'Alert fusion failed.'
  };
}
