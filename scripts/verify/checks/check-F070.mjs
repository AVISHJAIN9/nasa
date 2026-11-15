import { getCommsLatencyDetails } from '../../../backend/src/services/delayEmulatorService.js';
import { setMissionMode } from '../../../backend/src/services/missionConfigService.js';
export async function verify() {
  await setMissionMode('ISS');
  const iss = getCommsLatencyDetails();
  await setMissionMode('Mars');
  const mars = getCommsLatencyDetails();
  const pass = iss.one_way_delay_seconds < 1 && mars.one_way_delay_seconds >= 240;
  return {
    id: 'F070',
    pass: !!pass,
    status: pass ? 'DONE-VERIFIED' : 'PARTIAL',
    evidence: pass ? `Comms delay emulator returns ${iss.one_way_delay_seconds}s for ISS and ${mars.one_way_delay_seconds}s for Mars.` : 'Delay emulator failed.'
  };
}
