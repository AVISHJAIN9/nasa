import request from 'supertest';
export async function verify({ app }) {
  if (!app) return { id: 'F013', pass: false, status: 'PARTIAL', evidence: 'App context required' };
  const res = await request(app).post('/api/v1/telemetry/ingest').send({
    readings: [{ crew_id: 'vega', metric: 'heart_rate', value: 72, provenance: 'SIMULATED' }]
  });
  const pass = res.status === 200 || res.status === 201;
  return {
    id: 'F013',
    pass,
    status: pass ? 'DONE-VERIFIED' : 'PARTIAL',
    evidence: pass ? 'Telemetry ingestion API accepts validated reading payload with 200/201 response.' : 'Telemetry ingest rejected payload.'
  };
}
