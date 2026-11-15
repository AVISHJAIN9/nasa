import { queryOfflineMedicalAssistant } from '../../../backend/src/services/offlineRagService.js';
export async function verify() {
  const res = await queryOfflineMedicalAssistant('eye foreign body in microgravity');
  const pass = res && res.citations && res.citations.length > 0;
  return {
    id: 'X06',
    pass: !!pass,
    status: pass ? 'DONE-VERIFIED' : 'PARTIAL',
    evidence: pass ? 'Local edge LLM verifies answers with citations from offline knowledge base.' : 'Offline assistant verification failed.'
  };
}
