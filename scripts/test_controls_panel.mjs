import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SCREENSHOT_DIR = path.resolve('docs/screenshots');
if (!existsSync(SCREENSHOT_DIR)) {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function run() {
  console.log('--- STARTING CONTROLS PANEL VERIFICATION (Task A7) ---');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });

  const consoleLogs = [];
  const consoleErrors = [];

  page.on('console', (msg) => {
    const text = msg.text();
    consoleLogs.push(text);
    if (msg.type() === 'error') {
      consoleErrors.push(text);
    }
  });

  await page.goto('http://localhost:3006/#home', { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 1200));

  // 1. Open Demo Lab drawer via 'd' keypress
  console.log('1. Pressing "d" to open Demo Lab drawer...');
  await page.keyboard.press('d');
  await new Promise((r) => setTimeout(r, 600));

  const demoModal = await page.$('div[role="dialog"][aria-label="Clinical Demo Simulation Lab"]');
  if (!demoModal) {
    throw new Error('FAIL: Demo modal did not open on "d" keypress');
  }
  console.log('✓ Demo Lab modal open and visible.');

  // 2. Test row click on ML Anomaly Alerts (#toggle-ml-alerts)
  console.log('2. Testing full-row click on #toggle-ml-alerts...');
  const mlAlertsRow = await page.$('#toggle-ml-alerts');
  if (!mlAlertsRow) {
    throw new Error('FAIL: #toggle-ml-alerts element not found');
  }

  const initialChecked = await page.evaluate(() => {
    return window.__store ? window.__store.getState().mlAlertsEnabled : null;
  });
  console.log(`Initial store mlAlertsEnabled: ${initialChecked}`);

  // Click the row
  await mlAlertsRow.click();
  await new Promise((r) => setTimeout(r, 400));

  const afterClickChecked = await page.evaluate(() => {
    return window.__store ? window.__store.getState().mlAlertsEnabled : null;
  });
  const afterClickAria = await page.$eval('#toggle-ml-alerts', (el) => el.getAttribute('aria-checked'));
  const storedValue = await page.evaluate(() => localStorage.getItem('astrocare_toggle_mlAlertsEnabled'));

  console.log(`After row click -> store: ${afterClickChecked}, aria-checked: ${afterClickAria}, localStorage: ${storedValue}`);

  if (afterClickChecked === initialChecked) {
    throw new Error('FAIL: Clicking row did not toggle mlAlertsEnabled');
  }
  if (storedValue !== JSON.stringify(afterClickChecked)) {
    throw new Error(`FAIL: localStorage mismatch. Expected ${afterClickChecked}, got ${storedValue}`);
  }
  console.log('✓ Row click toggle and localStorage persistence verified.');

  // 3. Test keyboard Space & Enter on #toggle-wait-or-act
  console.log('3. Testing keyboard Space and Enter on #toggle-wait-or-act...');
  const initialWoA = await page.evaluate(() => window.__store.getState().waitOrActEnabled);

  await page.focus('#toggle-wait-or-act');
  await page.keyboard.press('Space');
  await new Promise((r) => setTimeout(r, 300));

  const afterSpaceWoA = await page.evaluate(() => window.__store.getState().waitOrActEnabled);
  if (afterSpaceWoA === initialWoA) {
    throw new Error('FAIL: Space key did not toggle waitOrActEnabled');
  }

  await page.keyboard.press('Enter');
  await new Promise((r) => setTimeout(r, 300));
  const afterEnterWoA = await page.evaluate(() => window.__store.getState().waitOrActEnabled);
  if (afterEnterWoA !== initialWoA) {
    throw new Error('FAIL: Enter key did not toggle waitOrActEnabled back');
  }
  console.log('✓ Keyboard Space and Enter toggling verified.');

  // 4. Test Scenario Card click on #toggle-co2-leak
  console.log('4. Testing emergency scenario card toggle on #toggle-co2-leak...');
  const initialCO2 = await page.evaluate(() => window.__store.getState().scenarios.co2Leak.active);
  await page.click('#toggle-co2-leak');
  await new Promise((r) => setTimeout(r, 300));

  const activeCO2 = await page.evaluate(() => window.__store.getState().scenarios.co2Leak.active);
  if (activeCO2 === initialCO2) {
    throw new Error('FAIL: Clicking CO2 leak card did not activate scenario');
  }

  // Click again to toggle off
  await page.click('#toggle-co2-leak');
  await new Promise((r) => setTimeout(r, 300));
  const clearedCO2 = await page.evaluate(() => window.__store.getState().scenarios.co2Leak.active);
  if (clearedCO2 !== false) {
    throw new Error('FAIL: Clicking active CO2 leak card did not toggle it off');
  }
  console.log('✓ Emergency scenario card toggle on/off verified.');

  // 5. Test Network Fault card on #toggle-sensor-failure
  console.log('5. Testing sensor fault card toggle on #toggle-sensor-failure...');
  await page.click('#toggle-sensor-failure');
  await new Promise((r) => setTimeout(r, 300));

  const faultActive = await page.evaluate(() => window.__store.getState().sensorFailure);
  const aiDegraded = await page.evaluate(() => window.__store.getState().aiDegraded);
  if (!faultActive || !aiDegraded) {
    throw new Error('FAIL: Sensor failure card did not engage fault or aiDegraded mode');
  }

  await page.click('#toggle-sensor-failure');
  await new Promise((r) => setTimeout(r, 300));
  const faultRestored = await page.evaluate(() => window.__store.getState().sensorFailure);
  if (faultRestored !== false) {
    throw new Error('FAIL: Clicking active sensor failure card did not restore sensor');
  }
  console.log('✓ Sensor fault card toggle and AI Degraded sync verified.');

  // 6. Test reload persistence
  console.log('6. Testing reload persistence: setting mlAlertsEnabled to false then reloading...');
  await page.evaluate(() => {
    if (window.__store.getState().mlAlertsEnabled) {
      window.__store.getState().toggleMlAlerts();
    }
  });
  const beforeReload = await page.evaluate(() => window.__store.getState().mlAlertsEnabled);
  console.log(`Before reload mlAlertsEnabled: ${beforeReload}`);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 1200));

  const afterReload = await page.evaluate(() => window.__store.getState().mlAlertsEnabled);
  console.log(`After reload mlAlertsEnabled: ${afterReload}`);
  if (afterReload !== false) {
    throw new Error(`FAIL: Expected mlAlertsEnabled to persist as false across reload, got ${afterReload}`);
  }
  console.log('✓ Page reload state persistence confirmed.');

  // Capture screenshot of DemoPanel open
  await page.keyboard.press('d');
  await new Promise((r) => setTimeout(r, 600));
  const screenshotPath = path.join(SCREENSHOT_DIR, 'task_a7_controls_panel_1366x768.png');
  await page.screenshot({ path: screenshotPath });
  console.log(`✓ Screenshot saved: ${screenshotPath}`);

  // Test other viewports
  for (const [w, h] of [[1920, 1080], [1280, 720]]) {
    await page.setViewport({ width: w, height: h });
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `task_a7_controls_panel_${w}x${h}.png`) });
    console.log(`✓ Screenshot saved for ${w}x${h}`);
  }

  // Restore state nominal
  await page.evaluate(() => window.__store.getState().resetDemoState());

  if (consoleErrors.length > 0) {
    console.error('Console errors detected:', consoleErrors);
    throw new Error(`FAIL: Encountered ${consoleErrors.length} console errors`);
  }

  console.log('✓ All tests passed with 0 console errors!');
  await browser.close();
}

run().catch((err) => {
  console.error('ERROR in test_controls_panel:', err);
  process.exit(1);
});
