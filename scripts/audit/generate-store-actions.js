import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORE_FILE = path.join(__dirname, '../../frontend/src/store.ts');
const OUT_FILE = path.join(__dirname, 'store-actions.json');

const content = fs.readFileSync(STORE_FILE, 'utf-8');

// Parse action signatures from AppStore interface
const actionRegex = /^\s*([a-zA-Z0-9_]+)\s*:\s*\(([^)]*)\)\s*=>\s*([^;]+);/gm;
let match;
const actions = [];

// Classification maps
const PURE_UI_ACTIONS = new Set([
  'setRole',
  'setMode',
  'setView',
  'setPage',
  'setAstronautHomeTab',
  'setSurgeonHomeTab',
  'setControlHomeTab',
  'setSelectedCrewId',
  'setTimeScale',
  'setPainMapMode',
  'setNarrationCaption',
  'setAssistantOffline',
  'setAssistantInitialQuery',
  'addToast',
  'removeToast',
  'setOnboardingStep',
  'toggleA11yMode',
  'toggleLinkUp',
  'setMissedCheckInHours',
]);

const SIMULATED_ACTIONS = new Set([
  'tick',
  'startCO2Leak',
  'startSolarEvent',
  'startIllness',
  'clearScenarios',
  'injectSensorFailure',
  'injectDrift',
  'startMarsStory',
  'pauseMarsStory',
  'resumeMarsStory',
  'skipMarsStoryStep',
  'stopMarsStory',
  'runMoment1LivePulse',
  'runMoment2PullTheCable',
  'runMoment3InjectFailure',
  'runMoment4TodayBandWidens',
  'stopMoment4TodayScenario',
  'resetDemoState',
  'computeRiskScore',
  'tamperEventLog',
  'verifyEventLogChain',
  'replayLastHour',
  'draftSoapTemplate',
  'setAiDegraded',
  'setEmergency',
]);

while ((match = actionRegex.exec(content)) !== null) {
  const name = match[1];
  const params = match[2].trim();
  const returnType = match[3].trim();

  let category = 'synced';
  if (PURE_UI_ACTIONS.has(name)) {
    category = 'pure UI';
  } else if (SIMULATED_ACTIONS.has(name)) {
    category = 'simulated';
  }

  actions.push({
    name,
    params,
    returnType,
    category,
    description: `Store action ${name} categorized as ${category}`,
  });
}

// Deduplicate
const uniqueActions = [];
const seen = new Set();
for (const a of actions) {
  if (!seen.has(a.name)) {
    seen.add(a.name);
    uniqueActions.push(a);
  }
}

fs.writeFileSync(OUT_FILE, JSON.stringify(uniqueActions, null, 2), 'utf-8');
console.log(`Generated ${OUT_FILE} with ${uniqueActions.length} store actions.`);
