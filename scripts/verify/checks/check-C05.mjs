export async function verify() {
  return {
    id: 'C05',
    pass: false,
    status: 'PARTIAL',
    evidence: 'Per-reading quality index exists in backend, but frontend prompt within 2s of degraded SNR is not yet wired.'
  };
}
