import { generateVitalsStream } from '../../../backend/src/services/vitalsSimulatorService.js';
export async function verify() {
  const t0 = new Date('2026-01-01T00:00:00Z');
  const s1 = await generateVitalsStream({ crewId: 'vega', seed: 42, durationSeconds: 10, startTime: t0 });
  const s2 = await generateVitalsStream({ crewId: 'vega', seed: 42, durationSeconds: 10, startTime: t0 });
  const pass = JSON.stringify(s1.points) === JSON.stringify(s2.points) && s1.points.length === 10;
  return {
    id: 'F011',
    pass: !!pass,
    status: pass ? 'DONE-VERIFIED' : 'PARTIAL',
    evidence: pass ? 'Vitals simulator produces identical deterministic stream from seed (10 windows tested).' : 'Simulator stream non-deterministic.'
  };
}
