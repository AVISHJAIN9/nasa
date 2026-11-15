import { DatasetRegistry } from '../models/DatasetRegistry.js';

export const DEFAULT_DATASETS = [
  {
    dataset_id: 'SYNTHETIC_MARS_01',
    name: 'NASA Mars Synthetic Physiological Model',
    provenance_type: 'SIMULATED',
    source_url: 'https://data.nasa.gov/synthetic-mars-telemetry',
    license: 'NASA Open Data Agreement / Public Domain',
    citation: 'AstroCare Mars Synthetic Physiological Model v2.0 (2026)',
    version: '2.0.0'
  },
  {
    dataset_id: 'NASA_LSAH_01',
    name: 'NASA Lifetime Surveillance of Astronaut Health (LSAH)',
    provenance_type: 'REPLAY',
    source_url: 'https://lsda.jsc.nasa.gov/lsah',
    license: 'NASA LSDA Scientific Data Access Agreement',
    citation: 'NASA Lifetime Surveillance of Astronaut Health (LSAH) De-identified Archive',
    version: '1.4.0'
  },
  {
    dataset_id: 'PHYSIONET_MIMIC3',
    name: 'PhysioNet MIMIC-III Clinical Database Replay Subset',
    provenance_type: 'REPLAY',
    source_url: 'https://physionet.org/content/mimiciii-demo/1.4/',
    license: 'PhysioNet Credentialed Health Data License 1.5.0',
    citation: 'Johnson, A., Pollard, T., Shen, L. et al. MIMIC-III Clinical Database. Sci Data 3, 160035 (2016)',
    version: '1.4.0'
  },
  {
    dataset_id: 'ZEPHYR_BIOHARNESS',
    name: 'Zephyr BioHarness Wearable Physiology Stream',
    provenance_type: 'REPLAY',
    source_url: 'https://www.medtronic.com/zephyr',
    license: 'PhysioNet Public / CC-BY 4.0',
    citation: 'Zephyr BioHarness Physiological Telemetry Interface',
    version: '3.0.0'
  },
  {
    dataset_id: 'BIOHARNESS_DEVICE_01',
    name: 'Zephyr BioHarness 3.0 Telemetry Stream',
    provenance_type: 'REAL_DEVICE',
    source_url: 'https://www.medtronic.com/zephyr',
    license: 'Hardware Device Stream (FDA 510(k) K111957)',
    citation: 'Zephyr BioHarness Physiological Telemetry Interface',
    version: '3.0.0'
  }
];

export async function initializeDatasetRegistry() {
  for (const ds of DEFAULT_DATASETS) {
    await DatasetRegistry.findOneAndUpdate(
      { dataset_id: ds.dataset_id },
      { $setOnInsert: ds },
      { upsert: true }
    );
  }
}

export async function registerDataset(data) {
  const created = await DatasetRegistry.create(data);
  return created.toJSON();
}

export async function listDatasets(provenanceType) {
  await initializeDatasetRegistry();
  const filter = {};
  if (provenanceType) filter.provenance_type = provenanceType;
  const datasets = await DatasetRegistry.find(filter).lean();
  return datasets;
}

export async function getProvenanceBadge({ provenance = 'SIMULATED', dataset_id }) {
  await initializeDatasetRegistry();

  const dsId = dataset_id || (provenance === 'SIMULATED' ? 'SYNTHETIC_MARS_01' : null);
  const dataset = dsId ? await DatasetRegistry.findOne({ dataset_id: dsId }).lean() : null;

  const variantMap = {
    SIMULATED: 'secondary', // gray
    REPLAY: 'default', // blue
    REAL_DEVICE: 'success' // green
  };

  const colorMap = {
    SIMULATED: '#6b7280',
    REPLAY: '#3b82f6',
    REAL_DEVICE: '#10b981'
  };

  return {
    provenance,
    badge_label: provenance.replace('_', ' '),
    badge_variant: variantMap[provenance] || 'secondary',
    badge_color: colorMap[provenance] || '#6b7280',
    dataset_id: dataset?.dataset_id || dsId || 'UNKNOWN',
    dataset_name: dataset?.name || 'Unregistered Dataset',
    license: dataset?.license || 'Unspecified License',
    citation: dataset?.citation || '',
    is_verified: Boolean(dataset)
  };
}
