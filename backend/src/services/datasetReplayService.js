import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { TelemetryReading } from '../models/TelemetryReading.js';
import { getProvenanceBadge } from './provenanceService.js';
import { eventBus } from '../bus/index.js';
import { NotFoundException } from '../middleware/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.join(__dirname, '../fixtures/datasets');

// In-memory catalog of available datasets
const DATASET_FILES = {
  NASA_LSAH_01: 'nasa_lsah_sample.json',
  PHYSIONET_MIMIC3: 'physionet_mimic_sample.json',
  ZEPHYR_BIOHARNESS: 'zephyr_bioharness_sample.json'
};

export function listAvailableReplayDatasets() {
  const list = [];
  for (const filename of Object.values(DATASET_FILES)) {
    const filePath = path.join(FIXTURES_DIR, filename);
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      list.push({
        dataset_id: data.dataset_id,
        name: data.name,
        license: data.license,
        provenance: data.provenance,
        description: data.description,
        record_count: data.records.length,
        metrics: Array.from(new Set(data.records.map((r) => r.metric)))
      });
    }
  }
  return list;
}

export function loadReplayDataset(datasetId) {
  const filename = DATASET_FILES[datasetId];
  if (!filename) {
    throw new NotFoundException(`Replay dataset '${datasetId}' not found. Available: ${Object.keys(DATASET_FILES).join(', ')}`);
  }
  const filePath = path.join(FIXTURES_DIR, filename);
  if (!fs.existsSync(filePath)) {
    throw new NotFoundException(`Dataset fixture file '${filename}' missing.`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export async function replayDataset({
  datasetId,
  crewId = 'CREW-01',
  startTime = new Date(),
  speed = 1.0,
  ingest = true
}) {
  const rawDataset = loadReplayDataset(datasetId);
  const startMs = new Date(startTime).getTime();
  const replayedReadings = [];
  const telemetryDocs = [];

  for (const rec of rawDataset.records) {
    // Relative seconds shifted according to speed
    const adjustedOffsetMs = (rec.delta_seconds / speed) * 1000;
    const readingTime = new Date(startMs + adjustedOffsetMs);
    const readingId = `tel-rep-${datasetId.toLowerCase()}-${crewId}-${rec.metric}-${readingTime.getTime()}-${crypto.randomBytes(4).toString('hex')}`;

    const readingData = {
      reading_id: readingId,
      crew_id: crewId,
      metric: rec.metric,
      value: rec.value,
      unit: rec.unit,
      timestamp: readingTime,
      provenance: 'REPLAY',
      dataset_id: rawDataset.dataset_id
    };

    replayedReadings.push(readingData);

    if (ingest) {
      telemetryDocs.push(readingData);
    }
  }

  if (ingest && telemetryDocs.length > 0) {
    await TelemetryReading.insertMany(telemetryDocs, { ordered: false });
  }

  // Generate provenance badge metadata for frontend UI
  const provenanceBadge = await getProvenanceBadge({
    provenance: 'REPLAY',
    dataset_id: rawDataset.dataset_id
  });

  // Emit event bus notification
  await eventBus.publish({
    event_type: 'TELEMETRY_REPLAY',
    channel: 'telemetry_replay',
    severity: 'info',
    source: 'dataset_replay_service',
    title: `Replay active: ${rawDataset.name}`,
    payload: {
      dataset_id: rawDataset.dataset_id,
      crew_id: crewId,
      record_count: replayedReadings.length,
      provenance_badge: provenanceBadge
    }
  });

  return {
    dataset_id: rawDataset.dataset_id,
    dataset_name: rawDataset.name,
    license: rawDataset.license,
    crew_id: crewId,
    total_replayed: replayedReadings.length,
    provenance_badge: provenanceBadge,
    readings: replayedReadings
  };
}
