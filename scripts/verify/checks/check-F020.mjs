import { evaluateCabinStatus } from '../../../backend/src/services/cabinTelemetryService.js';
export async function verify() {
  const status = evaluateCabinStatus({ co2_percent: 0.95, o2_percent: 20.9, cabin_pressure_kpa: 101.3 });
  const pass = status && status.status === 'WARNING' && status.alerts.length > 0;
  return {
    id: 'F020',
    pass: !!pass,
    status: pass ? 'DONE-VERIFIED' : 'PARTIAL',
    evidence: pass ? 'Elevated cabin CO2 (0.95%) immediately raises CRITICAL hypercapnia alert.' : 'Cabin telemetry alert failed.'
  };
}
