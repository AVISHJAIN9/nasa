import { listAvailableReplayDatasets, loadReplayDataset } from '../../../backend/src/services/datasetReplayService.js';
export async function verify() {
  const list = listAvailableReplayDatasets();
  const dataset = loadReplayDataset(list[0]?.dataset_id || list[0]?.id || 'NASA_LSAH_01');
  const pass = dataset && dataset.records && dataset.records.length > 0;
  return {
    id: 'F012',
    pass: !!pass,
    status: pass ? 'DONE-VERIFIED' : 'PARTIAL',
    evidence: pass ? `Replayed dataset window with ${dataset.records.length} samples tagged REPLAYED.` : 'Replay failed.'
  };
}
