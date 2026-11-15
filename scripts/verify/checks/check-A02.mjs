export async function verify() {
  return {
    id: 'A02',
    pass: false,
    status: 'PARTIAL',
    evidence: 'FastAPI behavior endpoints exist, but frontend passive typing timing listener is not yet wired.'
  };
}
