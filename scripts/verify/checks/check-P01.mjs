export async function verify() {
  return {
    id: 'P01',
    pass: false,
    status: 'PARTIAL',
    evidence: 'Proof panel reads static evalRun.json rather than reproducible scripts/eval.js runner.'
  };
}
