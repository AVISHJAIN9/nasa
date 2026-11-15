import { assessReadingQuality } from '../../../backend/src/services/signalQualityService.js';
export async function verify() {
  const good = assessReadingQuality({ value: 75, metric: 'heart_rate' });
  const bad = assessReadingQuality({ value: 350, metric: 'heart_rate' });
  const pass = good.is_alertable && !bad.is_alertable;
  return {
    id: 'F019',
    pass: !!pass,
    status: pass ? 'DONE-VERIFIED' : 'PARTIAL',
    evidence: pass ? 'Signal quality engine correctly rejects corrupted/implausible reading while accepting clean signal.' : 'Signal quality gate failed.'
  };
}
