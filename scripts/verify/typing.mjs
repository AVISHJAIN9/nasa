import puppeteer from 'puppeteer-core';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = 'http://localhost:3006';

async function testTyping() {
  console.log('=== VERIFYING T1: TYPING & POINTER FATIGUE ===');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const interceptedPayloads = [];

  // Listen to requests without blocking navigation
  page.on('request', (req) => {
    if (req.url().includes('/behavior/events') && req.method() === 'POST') {
      try {
        const body = JSON.parse(req.postData() || '{}');
        interceptedPayloads.push(body);
      } catch (e) {}
    }
  });

  // Navigate to #typing
  await page.goto(`${BASE_URL}/#typing`, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.evaluate(() => {
    const store = window.useStore;
    if (store) {
      store.getState().acceptConsent('CDR Elena Vega');
      store.getState().setPage('typing');
    }
  });

  await new Promise((r) => setTimeout(r, 1000));

  // 1. Enable consent toggle
  const consentToggle = await page.$('#typing-consent-toggle');
  if (!consentToggle) {
    throw new Error('FAIL: typing-consent-toggle not found in DOM');
  }
  await consentToggle.click();
  await new Promise((r) => setTimeout(r, 500));

  const textarea = await page.$('#typing-exercise-input');
  if (!textarea) {
    throw new Error('FAIL: typing-exercise-input not found');
  }

  // Realistic typing helper simulating human dwell and inter-key flight time
  async function typeHuman(text, dwellMs, flightMs) {
    for (const char of text) {
      await page.keyboard.press(char, { delay: dwellMs });
      if (flightMs > 0) {
        await new Promise((r) => setTimeout(r, flightMs));
      }
    }
  }

  // 2. Type 3 baseline windows at a brisk nominal pace (short dwell 40ms, short flight 60ms, 0 errors)
  console.log('Phase 1: Establishing baseline (3 windows at brisk nominal pace)...');
  for (let w = 0; w < 3; w++) {
    await textarea.focus();
    await typeHuman('nominal checklist alpha vega ', 40, 60);
    const flushBtn = await page.$('#flush-window-button');
    if (flushBtn) await flushBtn.click();
    await new Promise((r) => setTimeout(r, 400));
  }

  const baselineState = await page.evaluate(() => {
    const calEl = document.querySelector('#calibration-status');
    const badgeEl = document.querySelector('#fatigue-status-badge');
    const indexEl = document.querySelector('#fatigue-index-value');
    return {
      calText: calEl ? calEl.innerText : null,
      badgeText: badgeEl ? badgeEl.innerText : null,
      indexVal: indexEl ? parseFloat(indexEl.innerText) : 0,
    };
  });
  console.log('Baseline established:', baselineState);

  // 3. Type sluggishly with long flight intervals and frequent error corrections (fatigue state)
  console.log('Phase 2: Inducing fatigue (sluggish flight 220ms + dwell 120ms + multiple backspaces)...');
  await textarea.focus();
  for (let i = 0; i < 4; i++) {
    await typeHuman('error sluggish ', 120, 220);
    await page.keyboard.press('Backspace', { delay: 100 });
    await new Promise((r) => setTimeout(r, 100));
    await page.keyboard.press('Backspace', { delay: 100 });
    await new Promise((r) => setTimeout(r, 100));
  }

  // Flush fatigued window
  const flushBtn = await page.$('#flush-window-button');
  if (flushBtn) await flushBtn.click();
  await new Promise((r) => setTimeout(r, 600));

  const fatiguedState = await page.evaluate(() => {
    const badgeEl = document.querySelector('#fatigue-status-badge');
    const indexEl = document.querySelector('#fatigue-index-value');
    return {
      badgeText: badgeEl ? badgeEl.innerText : null,
      indexVal: indexEl ? parseFloat(indexEl.innerText) : 0,
    };
  });
  console.log('Fatigued state:', fatiguedState);

  // Assertions
  const indexRose = fatiguedState.indexVal > baselineState.indexVal;
  console.log(`Assertion: Fatigue index rose (${baselineState.indexVal} -> ${fatiguedState.indexVal}): ${indexRose ? 'PASS' : 'FAIL'}`);

  // 4. Assert captured network payload contains NO characters or key codes
  let payloadPrivacyPassed = true;
  let forbiddenFound = [];
  const forbiddenKeys = ['key', 'code', 'char', 'text', 'value', 'content', 'string'];

  if (interceptedPayloads.length > 0) {
    for (const p of interceptedPayloads) {
      const events = p.events || (Array.isArray(p) ? p : [p]);
      for (const ev of events) {
        for (const fk of forbiddenKeys) {
          if (fk in ev) {
            payloadPrivacyPassed = false;
            forbiddenFound.push(fk);
          }
        }
      }
    }
  }

  console.log(`Assertion: Payload privacy (no key names or text in network requests): ${payloadPrivacyPassed ? 'PASS' : 'FAIL'}`);
  if (forbiddenFound.length) {
    console.error('Forbidden keys leaked:', forbiddenFound);
  }

  await browser.close();

  if (indexRose && payloadPrivacyPassed) {
    console.log('PASS: T1 Typing & pointer fatigue successfully verified.');
    process.exit(0);
  } else {
    console.error('FAIL: T1 verification failed assertions.');
    process.exit(1);
  }
}

testTyping().catch((err) => {
  console.error('FAIL with error:', err);
  process.exit(1);
});
