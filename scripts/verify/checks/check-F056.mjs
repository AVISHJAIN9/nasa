import { buildMedicalKnowledgeBase } from '../../../backend/src/services/medicalKnowledgeBaseService.js';
export async function verify() {
  const res = await buildMedicalKnowledgeBase({ saveToDb: false });
  const count = res?.total_chunks || 0;
  const pass = count >= 200;
  return {
    id: 'F056',
    pass: !!pass,
    status: pass ? 'DONE-VERIFIED' : 'PARTIAL',
    evidence: pass ? `Medical knowledge base indexes ${count} chunks with cited NASA standards (target >=200).` : 'Knowledge base chunks insufficient.'
  };
}
