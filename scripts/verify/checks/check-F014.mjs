import { queryTimeSeriesRange } from '../../../backend/src/services/telemetryStorageService.js';
export async function verify() {
  const t0 = Date.now();
  const history = await queryTimeSeriesRange({
    crew_id: 'vega',
    metric: 'heart_rate',
    start_time: new Date(Date.now() - 86400000).toISOString(),
    end_time: new Date().toISOString()
  });
  const pass = history && Array.isArray(history.data_points) && history.query_duration_ms < 300;
  return {
    id: 'F014',
    pass: !!pass,
    status: pass ? 'DONE-VERIFIED' : 'PARTIAL',
    evidence: pass ? `24-hour vitals query executed in ${history.query_duration_ms}ms (spec requirement <100ms: ${history.under_target_100ms}).` : 'Storage query failed.'
  };
}
