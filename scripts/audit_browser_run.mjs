import puppeteer from 'puppeteer-core';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = 'http://localhost:3006';

const routes = [
  '',
  '#home',
  '#woa',
  '#assistant',
  '#protocols',
  '#proof',
  '#limits',
  '#wellness',
  '#notes',
  '#orders',
  '#brief',
  '#whatif',
  '#audit',
  '#supplies',
  '#syndromes',
  '#forecast',
  '#telesession',
  '#broadcast',
  '#roadmap',
  '#integration'
];

async function run() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
  });

  const page = await browser.newPage();
  const consoleErrors = [];
  const networkFailures = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(`[Console Error] ${msg.text()}`);
    }
  });

  page.on('response', (res) => {
    if (res.status() >= 400) {
      networkFailures.push(`[${res.status()}] ${res.url()}`);
    }
  });

  console.log('--- VISITING ROUTES ---');
  for (const r of routes) {
    const url = `${BASE_URL}/${r}`;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 8000 });
      // wait a bit for react render
      await new Promise((resolve) => setTimeout(resolve, 800));
      const title = await page.title();
      const bodyTextLength = (await page.evaluate(() => document.body.innerText)).length;
      console.log(`Route: ${r || '/ (landing)'} | Title: "${title}" | Body text length: ${bodyTextLength}`);
      if (bodyTextLength < 20) {
        console.warn(`WARNING: Route ${r} rendered blank or near-empty!`);
      }
    } catch (e) {
      console.error(`FAILED to visit ${r}:`, e.message);
    }
  }

  console.log('\n--- EXERCISING F1 (TYPING / POINTER FATIGUE) ---');
  // Check if any typing or fatigue tile exists in DOM
  const typingElements = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    const matches = all.filter(el => /typing|keystroke|inter-key|dwell time|pointer fatigue/i.test(el.innerText || ''));
    return matches.map(m => ({ tag: m.tagName, text: m.innerText.slice(0, 100) }));
  });
  console.log('Typing / Pointer matches found on page:', typingElements.length);
  if (typingElements.length === 0) {
    console.log('F1 RESULT: No typing or pointer fatigue tile exists on any reachable route.');
  } else {
    console.log('F1 elements:', typingElements.slice(0, 3));
  }

  console.log('\n--- EXERCISING F2 (WEBCAM / CAMERAPULSE) ---');
  // Navigate to Astronaut home page
  await page.goto(`${BASE_URL}/#home`, { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    const store = window.useStore;
    if (store) {
      store.getState().setRole('astronaut');
      store.getState().setPage('home');
      store.getState().acceptConsent('CDR Elena Vega');
    }
  });
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Look for CameraPulse component
  const cameraPulseBtn = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => /measure my pulse/i.test(b.innerText));
    return btn ? btn.innerText : null;
  });
  console.log('Measure pulse button found:', cameraPulseBtn);

  if (cameraPulseBtn) {
    console.log('Clicking "Measure my pulse" button...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => /measure my pulse/i.test(b.innerText));
      if (btn) btn.click();
    });

    await new Promise((resolve) => setTimeout(resolve, 3000));

    const pulseScreenState = await page.evaluate(() => {
      const text = document.body.innerText;
      const bpmEl = document.querySelector('.font-display.text-2xl');
      const qualityEl = Array.from(document.querySelectorAll('span')).find(s => /good|fair|poor/i.test(s.innerText));
      const realTag = Array.from(document.querySelectorAll('span')).find(s => s.innerText.trim() === 'REAL');
      const errorMsg = Array.from(document.querySelectorAll('*')).find(el => /camera access error/i.test(el.innerText || ''));

      return {
        bpmValue: bpmEl ? bpmEl.innerText : null,
        quality: qualityEl ? qualityEl.innerText : null,
        hasRealTag: !!realTag,
        hasError: !!errorMsg,
        errorText: errorMsg ? errorMsg.innerText.slice(0, 100) : null
      };
    });

    console.log('F2 CameraPulse Screen State:', pulseScreenState);
  }

  console.log('\n--- CONSOLE ERRORS & FAILED CALLS ---');
  console.log('Total Console Errors:', consoleErrors.length);
  consoleErrors.slice(0, 10).forEach(e => console.log('  ', e));

  console.log('Total Network Failures (4xx/5xx):', networkFailures.length);
  networkFailures.slice(0, 10).forEach(e => console.log('  ', e));

  await browser.close();
}

run().catch(console.error);
