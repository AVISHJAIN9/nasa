import { calculateEarthIndependenceScore } from '../../../backend/src/services/earthIndependenceService.js';
export async function verify() {
  const score = calculateEarthIndependenceScore({ delay_seconds: 1200 });
  const pass = score && score.autonomy_level >= 2 && score.earth_independence_score >= 50;
  return {
    id: 'X07',
    pass: !!pass,
    status: pass ? 'DONE-VERIFIED' : 'PARTIAL',
    evidence: pass ? `Earth independence switches dynamically to Level ${score.autonomy_level} (${score.earth_independence_score}/100) on Mars delay.` : 'Independence switching failed.'
  };
}
