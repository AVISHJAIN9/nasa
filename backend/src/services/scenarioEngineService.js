import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { recordCabinTelemetry } from './cabinTelemetryService.js';
import { accumulateRadiationDose } from './radiationTrackerService.js';
import { appendMedicalEvent } from './medicalEventLogService.js';
import { TelemetryReading } from '../models/TelemetryReading.js';
import { Inventory } from '../models/Inventory.js';
import { eventBus } from '../bus/index.js';
import { NotFoundException } from '../middleware/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCENARIOS_DIR = path.join(__dirname, '../fixtures/scenarios');

const SCENARIO_FILES = {
  SCENARIO_CO2_LEAK: 'co2_scrubber_failure.json',
  SCENARIO_SOLAR_EVENT: 'solar_particle_event.json',
  SCENARIO_CARDIAC_ILLNESS: 'cardiac_decompensation.json',
  SCENARIO_CABIN_DEPRESS: 'cabin_depressurization.json',
  SCENARIO_CIRCADIAN_FATIGUE: 'sleep_deprivation_fatigue.json',
  SCENARIO_MED_SHORTAGE: 'medication_stock_shortage.json'
};

export function listAvailableScenarios() {
  const scenarios = [];
  for (const filename of Object.values(SCENARIO_FILES)) {
    const filePath = path.join(SCENARIOS_DIR, filename);
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      scenarios.push({
        scenario_id: data.scenario_id,
        title: data.title,
        category: data.category,
        severity: data.severity,
        description: data.description,
        duration_seconds: data.duration_seconds,
        inject_count: data.injects.length
      });
    }
  }
  return scenarios;
}

export function loadScenario(scenarioId) {
  const filename = SCENARIO_FILES[scenarioId];
  if (!filename) {
    throw new NotFoundException(`Scenario '${scenarioId}' not found. Available: ${Object.keys(SCENARIO_FILES).join(', ')}`);
  }
  const filePath = path.join(SCENARIOS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    throw new NotFoundException(`Scenario file '${filename}' missing.`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export async function executeScenario({
  scenarioId,
  targetCrewId = 'CREW-01',
  startTime = new Date(),
  speed = 1.0,
  dryRun = false
}) {
  const scenario = loadScenario(scenarioId);
  const startMs = new Date(startTime).getTime();
  const executionLogs = [];

  for (const inject of scenario.injects) {
    const scheduledTime = new Date(startMs + (inject.time_seconds / speed) * 1000);
    const logEntry = {
      time_seconds: inject.time_seconds,
      scheduled_time: scheduledTime,
      type: inject.type,
      target: inject.target,
      status: 'EXECUTED'
    };

    if (!dryRun) {
      if (inject.type === 'CABIN_TELEMETRY') {
        const res = await recordCabinTelemetry({
          compartment: inject.target || 'hab_module_alpha',
          timestamp: scheduledTime,
          ...inject.payload
        });
        logEntry.result = { reading_id: res.reading_id, status: res.overall_status };
      } else if (inject.type === 'RADIATION_DOSE') {
        const res = await accumulateRadiationDose({
          crewId: inject.target === 'fleet' ? targetCrewId : inject.target,
          days: inject.payload.days || 0,
          speSpikeMsv: inject.payload.spe_spike_msv || 0,
          notes: inject.payload.notes
        });
        logEntry.result = { cumulative_dose_msv: res.cumulative_dose_msv, status: res.status };
      } else if (inject.type === 'VITALS_READING') {
        const crewId = inject.target || targetCrewId;
        const docs = [];
        for (const [metric, val] of Object.entries(inject.payload)) {
          docs.push({
            reading_id: `tel-scen-${scenarioId.toLowerCase()}-${crewId}-${metric}-${scheduledTime.getTime()}`,
            crew_id: crewId,
            metric,
            value: val,
            unit: metric === 'spo2' ? '%' : metric === 'heart_rate' ? 'bpm' : 'mmHg',
            timestamp: scheduledTime,
            provenance: 'SIMULATED',
            dataset_id: 'SCENARIO_INJECT'
          });
        }
        if (docs.length > 0) {
          await TelemetryReading.insertMany(docs, { ordered: false });
        }
        logEntry.result = { readings_inserted: docs.length };
      } else if (inject.type === 'MEDICAL_EVENT') {
        const res = await appendMedicalEvent({
          actor: inject.payload.actor || 'cmo_sarah',
          action: inject.payload.action,
          payload: { crew_id: inject.target, ...inject.payload }
        });
        logEntry.result = { sequence: res.sequence, current_hash: res.current_hash };
      } else if (inject.type === 'INVENTORY_UPDATE') {
        const updated = await Inventory.findOneAndUpdate(
          { item_id: inject.payload.item_id },
          { $set: { quantity: inject.payload.new_quantity } },
          { new: true }
        );
        logEntry.result = { item_id: inject.payload.item_id, remaining_qty: updated ? updated.quantity : null };
      } else if (inject.type === 'EVENT_ALERT') {
        await eventBus.publish({
          event_type: 'SCENARIO_ALERT',
          channel: 'scenario_events',
          severity: inject.payload.severity || 'warning',
          source: 'scenario_engine',
          title: inject.payload.title,
          payload: {
            scenario_id: scenario.scenario_id,
            target: inject.target,
            message: inject.payload.message
          }
        });
        logEntry.result = { alert_dispatched: inject.payload.title };
      }
    }

    executionLogs.push(logEntry);
  }

  // Publish scenario completion event
  await eventBus.publish({
    event_type: 'SCENARIO_COMPLETED',
    channel: 'demo_control',
    severity: 'info',
    source: 'scenario_engine',
    title: `Scenario completed: ${scenario.title}`,
    payload: {
      scenario_id: scenario.scenario_id,
      inject_count: executionLogs.length,
      dry_run: dryRun
    }
  });

  return {
    scenario_id: scenario.scenario_id,
    title: scenario.title,
    category: scenario.category,
    total_injects: executionLogs.length,
    duration_seconds: scenario.duration_seconds,
    timeline: executionLogs
  };
}
