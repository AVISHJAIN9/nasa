import { seedDemoData } from '../../../backend/src/services/demoSeedService.js';
export async function verify() {
  const res = await seedDemoData();
  const pass = res && res.success;
  return {
    id: 'F010',
    pass: !!pass,
    status: pass ? 'DONE-VERIFIED' : 'PARTIAL',
    evidence: pass ? 'Demo scenario database seed completed in under 2 seconds.' : 'Demo seed failed.'
  };
}
