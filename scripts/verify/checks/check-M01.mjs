export async function verify() {
  return {
    id: 'M01',
    pass: false,
    status: 'PARTIAL',
    evidence: 'ConsentModal exists in frontend, but live write-through to POST /api/v1/consent is not yet wired.'
  };
}
