import { getMissionConfig, setMissionMode } from '../../../backend/src/services/missionConfigService.js';
export async function verify() {
  const initial = await getMissionConfig();
  const mars = await setMissionMode('MARS');
  const pass = mars && mars.comms_delay_seconds >= 240 && mars.radiation_rate_msv_per_day > 0.5;
  await setMissionMode(initial.mode || 'ISS'); // restore
  return {
    id: 'F003',
    pass: !!pass,
    status: pass ? 'DONE-VERIFIED' : 'PARTIAL',
    evidence: pass ? 'Switching mission mode to MARS live updates delay to 240s and elevated radiation rate.' : 'Mission configurator failed.'
  };
}
