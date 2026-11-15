import puppeteer from 'puppeteer-core';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = 'http://localhost:3006';

const ROUTES = [
  '#home',
  '#typing',
  '#sensors',
  '#supplies',
  '#proof',
  '#wellness',
  '#woa',
  '#assistant',
  '#protocols',
  '#orders',
  '#notes',
  '#brief'
];

async function verifyAllPages() {
  console.log('=== VERIFYING ALL ASTROCARE ROUTES LIVE ===');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']
  });

  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  // Start with home and accept consent
  await page.goto(`${BASE_URL}/#home`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.evaluate(() => {
    const store = window.useStore;
    if (store) {
      store.getState().acceptConsent('CDR Elena Vega');
      store.getState().setView('app');
    }
  });

  let allOk = true;

  for (const route of ROUTES) {
    const pageName = route.replace('#', '');
    await page.evaluate((p) => {
      window.useStore.getState().setPage(p);
      window.location.hash = '#' + p;
    }, pageName);

    await new Promise((r) => setTimeout(r, 600));

    const check = await page.evaluate(() => {
      const root = document.getElementById('root');
      const text = root ? root.innerText.trim() : '';
      return {
        hasContent: text.length > 20,
        length: text.length,
        title: document.title
      };
    });

    const passed = check.hasContent;
    console.log(`Route ${route.padEnd(12)} -> ${passed ? 'RENDERED OK' : 'BLANK / FAILED'} (${check.length} chars)`);
    if (!passed) allOk = false;
  }

  // Test degraded state banner
  console.log('\nTesting Watchdog AI Degraded Amber Banner...');
  await page.evaluate(() => {
    window.useStore.getState().injectSensorFailure();
  });
  await new Promise((r) => setTimeout(r, 500));

  const degradedState = await page.evaluate(() => {
    const banner = document.body.innerText.includes('AI DEGRADED: RULES ONLY');
    return { hasBanner: banner };
  });
  console.log(`Assertion: AI Degraded Amber Banner renders properly: ${degradedState.hasBanner ? 'PASS' : 'FAIL'}`);

  await page.evaluate(() => {
    window.useStore.getState().clearScenarios();
  });

  console.log(`Console error count across all routes: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.log('Errors:', consoleErrors.slice(0, 5));
  }

  await browser.close();

  if (allOk && degradedState.hasBanner) {
    console.log('\nPASS: All routes render cleanly without white screens.');
    process.exit(0);
  } else {
    console.error('\nFAIL: Route rendering assertion failed.');
    process.exit(1);
  }
}

verifyAllPages();
