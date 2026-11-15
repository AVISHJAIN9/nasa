import { getMissionConfig, setMissionMode } from './missionConfigService.js';
import { listAvailableScenarios, executeScenario } from './scenarioEngineService.js';
import { seedDemoData } from './demoSeedService.js';
import { eventBus } from '../bus/index.js';

let demoState = {
  time_multiplier: 1.0,
  virtual_start_time: new Date(),
  last_updated_at: new Date(),
  active_scenario: null,
  scenario_history: []
};

export function getDemoPanelState() {
  const missionConfig = getMissionConfig();
  const scenarios = listAvailableScenarios();
  const elapsedMs = (Date.now() - new Date(demoState.last_updated_at).getTime()) * demoState.time_multiplier;
  const currentVirtualTime = new Date(new Date(demoState.virtual_start_time).getTime() + elapsedMs);

  return {
    mission_mode: missionConfig.mode || 'Mars',
    comms_delay_seconds: missionConfig.comms_delay_seconds,
    radiation_rate_msv_per_day: missionConfig.radiation_rate_msv_per_day,
    time_multiplier: demoState.time_multiplier,
    virtual_time: currentVirtualTime,
    active_scenario: demoState.active_scenario,
    available_scenarios: scenarios,
    total_scenarios_available: scenarios.length,
    recent_history: demoState.scenario_history.slice(-5)
  };
}

export function setDemoTimeSpeed(multiplier) {
  demoState.time_multiplier = multiplier;
  demoState.last_updated_at = new Date();
  return { time_multiplier: multiplier };
}

export async function switchDemoMissionMode(mode, operator = 'demo_panel') {
  const updatedConfig = await setMissionMode(mode, operator);
  await eventBus.publish({
    event_type: 'DEMO_MODE_SWITCHED',
    channel: 'demo_control',
    severity: 'info',
    source: 'demo_control_panel',
    title: `Mission mode switched to ${mode}`,
    payload: { mode, comms_delay_seconds: updatedConfig.comms_delay_seconds }
  });
  return updatedConfig;
}

export async function triggerScenarioFromPanel({
  scenarioId,
  targetCrewId = 'CREW-01',
  speed = null,
  dryRun = false
}) {
  const effectiveSpeed = speed || demoState.time_multiplier || 1.0;
  demoState.active_scenario = {
    scenario_id: scenarioId,
    started_at: new Date(),
    speed: effectiveSpeed,
    target_crew_id: targetCrewId,
    status: 'RUNNING'
  };

  const result = await executeScenario({
    scenarioId,
    targetCrewId,
    startTime: new Date(),
    speed: effectiveSpeed,
    dryRun
  });

  demoState.active_scenario.status = 'COMPLETED';
  demoState.active_scenario.completed_at = new Date();
  demoState.scenario_history.push({ ...demoState.active_scenario, result });

  return result;
}

export function stopActiveScenario() {
  if (demoState.active_scenario) {
    demoState.active_scenario.status = 'STOPPED';
    demoState.active_scenario.stopped_at = new Date();
  }
  const prev = demoState.active_scenario;
  demoState.active_scenario = null;
  return { status: 'stopped', previous: prev };
}

export async function triggerDemoSeed(options = {}) {
  return await seedDemoData(options);
}
