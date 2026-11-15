export async function verify() {
  return {
    id: 'A01',
    pass: false,
    status: 'PARTIAL',
    evidence: 'POST /api/v1/audio/clip exists in FastAPI, but Wellness UI mic recorder tile is missing.'
  };
}
