import puppeteer from 'puppeteer-core';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = 'http://localhost:3006';

async function testFace() {
  console.log('=== VERIFYING T2: FACE SIGNAL QUALITY GATE & MODEL LOADER ===');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream'
    ]
  });

  const page = await browser.newPage();
  page.on('console', (msg) => console.log('[Browser Log]', msg.text()));

  // Navigate to astronaut home
  await page.goto(`${BASE_URL}/#home`, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.evaluate(() => {
    const store = window.useStore;
    if (store) {
      store.getState().acceptConsent('CDR Elena Vega');
      store.getState().setRole('astronaut');
      store.getState().setPage('home');
    }
  });

  await new Promise((r) => setTimeout(r, 1200));

  // 1. Check Model Loader Status
  const modelStatus = await page.evaluate(() => {
    const el = document.querySelector('#face-model-status');
    return el ? el.innerText : null;
  });
  console.log('Model Loader Status:', modelStatus);

  const modelStatusValid = modelStatus && modelStatus.includes('Model: none (heuristic)');
  console.log(`Assertion: Model loader honestly reports "Model: none (heuristic)": ${modelStatusValid ? 'PASS' : 'FAIL'}`);

  // 2. Click "Measure my pulse"
  console.log('Triggering "Measure my pulse"...');
  await page.evaluate(() => {
    const btn = document.querySelector('#start-camera-pulse-btn');
    if (btn) btn.click();
  });

  // Wait 3.5 seconds for the 2000ms quality gate to trip
  await new Promise((r) => setTimeout(r, 3500));

  // 3. Inspect Screen State under fake camera
  const gateState = await page.evaluate(() => {
    const banner = document.querySelector('#camera-gate-failure-banner');
    const bpmEl = document.querySelector('#live-pulse-bpm');
    const qualityEl = document.querySelector('#pulse-quality-status');
    const realBadge = document.querySelector('#pulse-provenance-badge');
    const errorEl = document.querySelector('.text-mars.font-bold');

    return {
      hasGateBanner: !!banner,
      bannerText: banner ? banner.innerText : null,
      bpmText: bpmEl ? bpmEl.innerText.trim() : null,
      qualityText: qualityEl ? qualityEl.innerText.trim() : null,
      hasRealBadge: !!realBadge,
      cameraError: errorEl ? errorEl.innerText : null,
    };
  });

  console.log('Gate Evaluation State:', gateState);

  // Assertions:
  // - Gate must say "Not reliable" (fake camera stream has no physiological pulsatile blood flow)
  // - BPM must NOT display a real number (must be '--')
  // - Tag REAL must NOT be displayed while gate is failing
  const gateTripped = gateState.bannerText && /not reliable/i.test(gateState.bannerText);
  const bpmHidden = gateState.bpmText === '--';
  const realHidden = !gateState.hasRealBadge;

  console.log(`Assertion: Quality gate triggered ("not reliable"): ${gateTripped ? 'PASS' : 'FAIL'}`);
  console.log(`Assertion: Pulse rate withheld ("--"): ${bpmHidden ? 'PASS' : 'FAIL'}`);
  console.log(`Assertion: REAL provenance tag suppressed during gate failure: ${realHidden ? 'PASS' : 'FAIL'}`);

  await browser.close();

  if (modelStatusValid && gateTripped && bpmHidden && realHidden) {
    console.log('PASS: T2 Face signal-quality gate & pluggable model successfully verified.');
    process.exit(0);
  } else {
    console.error('FAIL: T2 verification assertions failed.');
    process.exit(1);
  }
}

testFace().catch((err) => {
  console.error('FAIL with error:', err);
  process.exit(1);
});
