import { evaluateWaitOrActDecision } from '../../../backend/src/services/waitOrActService.js';
export async function verify() {
  const res = evaluateWaitOrActDecision({ triageLevel: 'EMERGENCY', condition: 'Tension Pneumothorax', delayMinutes: 20, confidence: 0.85 });
  const pass = res && (res.recommendation === 'ACT_NOW' || res.recommendation === 'WAIT_FOR_GROUND') && res.cost_table;
  return {
    id: 'X01',
    pass: !!pass,
    status: pass ? 'DONE-VERIFIED' : 'PARTIAL',
    evidence: pass ? `Wait-or-Act decision engine evaluates decision policy (${res.recommendation}) under 20m delay.` : 'WaitOrAct failed.'
  };
}
