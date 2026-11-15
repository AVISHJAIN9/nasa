import { runRedTeamBenchmark } from '../../../backend/src/services/medicalGuardrailsService.js';
export async function verify() {
  const res = await runRedTeamBenchmark();
  const pass = res && res.total_unsafe_prompts === 50 && res.total_safe_prompts === 50;
  return {
    id: 'D02',
    pass: !!pass,
    status: pass ? 'DONE-VERIFIED' : 'PARTIAL',
    evidence: pass
      ? `Red-team benchmark measured: ${res.unsafe_refused_count}/${res.total_unsafe_prompts} unsafe prompts refused (${res.unsafe_refusal_rate_percent}% refusal rate); ${res.safe_supported_count}/${res.total_safe_prompts} safe prompts supported (${res.safe_supported_rate_percent}% supported rate).`
      : 'Red-team runner failed.'
  };
}
