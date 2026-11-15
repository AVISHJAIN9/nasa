import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT_FILE = path.join(__dirname, 'pages.json');

const PAGES = [
  'home',
  'woa',
  'assistant',
  'protocols',
  'proof',
  'limits',
  'wellness',
  'notes',
  'orders',
  'brief',
  'whatif',
  'audit',
  'supplies',
  'syndromes',
  'forecast',
  'telesession',
  'broadcast',
  'roadmap',
];

const ROLES = ['astronaut', 'surgeon', 'control'];

const PAGE_FILES = {
  home_astronaut: 'frontend/src/app/pages/Astronaut.tsx',
  home_surgeon: 'frontend/src/app/pages/Surgeon.tsx',
  home_control: 'frontend/src/app/pages/Control.tsx',
  woa: 'frontend/src/app/pages/WaitOrAct.tsx',
  assistant: 'frontend/src/app/pages/Assistant.tsx',
  protocols: 'frontend/src/app/pages/Protocols.tsx',
  proof: 'frontend/src/app/pages/Proof.tsx',
  limits: 'frontend/src/app/pages/Limits.tsx',
  wellness: 'frontend/src/app/pages/Wellness.tsx',
  notes: 'frontend/src/app/pages/Notes.tsx',
  orders: 'frontend/src/app/pages/Orders.tsx',
  brief: 'frontend/src/app/pages/Brief.tsx',
  whatif: 'frontend/src/app/pages/WhatIf.tsx',
  audit: 'frontend/src/app/pages/Audit.tsx',
  supplies: 'frontend/src/app/pages/Supplies.tsx',
  syndromes: 'frontend/src/app/pages/Syndromes.tsx',
  forecast: 'frontend/src/app/pages/Forecast.tsx',
  telesession: 'frontend/src/app/pages/TeleSession.tsx',
  broadcast: 'frontend/src/app/pages/Broadcast.tsx',
  roadmap: 'frontend/src/app/pages/Roadmap.tsx',
};

function inspectFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return { store_state: [], store_actions: [], api_calls: [] };
  }
  const content = fs.readFileSync(filePath, 'utf-8');

  // Extract useStore calls
  const storeUsages = new Set();
  const storeRegex = /useStore\s*\(\s*(?:\(s\)\s*=>\s*s\.([a-zA-Z0-9_]+)|\(state\)\s*=>\s*state\.([a-zA-Z0-9_]+))/g;
  let match;
  while ((match = storeRegex.exec(content)) !== null) {
    storeUsages.add(match[1] || match[2]);
  }

  // Extract api calls
  const apiCalls = new Set();
  const fetchRegex = /fetch(?:Today|[a-zA-Z0-9_]*)\s*\(/g;
  while ((match = fetchRegex.exec(content)) !== null) {
    apiCalls.add(match[0].replace('(', '').trim());
  }
  if (content.includes('usePollToday')) apiCalls.add('usePollToday');
  if (content.includes('/api/v1/') || content.includes('/v1/')) {
    const urlRegex = /['"`](\/(?:api\/v1|v1)\/[a-zA-Z0-9_\-\/]+)['"`]/g;
    while ((match = urlRegex.exec(content)) !== null) {
      apiCalls.add(match[1]);
    }
  }

  return {
    store_fields: Array.from(storeUsages).sort(),
    api_calls: Array.from(apiCalls).sort(),
  };
}

const result = [];

for (const page of PAGES) {
  for (const role of ROLES) {
    let componentKey = page;
    let tabs = ['default'];
    if (page === 'home') {
      componentKey = `home_${role}`;
      if (role === 'astronaut') tabs = ['live', 'environment', 'checkin', 'orders'];
      else if (role === 'surgeon') tabs = ['roster', 'alerts', 'priors'];
      else if (role === 'control') tabs = ['overview', 'cabin', 'comms'];
    }

    const filePath = PAGE_FILES[componentKey] || `frontend/src/app/pages/${page}.tsx`;
    const inspection = inspectFile(filePath);

    for (const tab of tabs) {
      result.push({
        page,
        role,
        tab,
        component: path.basename(filePath, '.tsx'),
        file: filePath,
        store_usage: inspection.store_fields,
        api_calls: inspection.api_calls,
      });
    }
  }
}

fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2), 'utf-8');
console.log(`Generated ${OUT_FILE} with ${result.length} page x role x tab entries.`);
