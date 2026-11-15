import puppeteer from 'puppeteer-core';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = 'http://localhost:3006';

async function testProof() {
  console.log('=== VERIFYING T5: PROOF PANEL HONESTY & METRICS SUPPRESSION ===');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.goto(`${BASE_URL}/#proof`, { waitUntil: 'domcontentloaded', timeout: 20000 });

    await page.evaluate(() => {
      const store = window.useStore;
      if (store) {
        store.getState().acceptConsent('CDR Elena Vega');
        store.getState().setPage('proof');
      }
    });

    await new Promise((r) => setTimeout(r, 1200));

    // 1. Check badge text
    const badgeText = await page.evaluate(() => {
      const el = document.querySelector('#proof-status-badge');
      return el ? el.innerText.trim() : null;
    });
    console.log('Proof status badge text:', badgeText);
    const badgePass = badgeText === 'RUN PENDING';
    console.log(`Assertion: Proof badge indicates RUN PENDING: ${badgePass ? 'PASS' : 'FAIL'}`);

    // 2. Check AUROC value
    const aurocVal = await page.evaluate(() => {
      const el = document.querySelector('#proof-auroc-val');
      return el ? el.innerText.trim() : null;
    });
    console.log('Overall AUROC rendered value:', aurocVal);
    const aurocPass = aurocVal === '--';
    console.log(`Assertion: Invented AUROC is suppressed to "--": ${aurocPass ? 'PASS' : 'FAIL'}`);

    // 3. Check for any invented 0.942 presence across the full page text
    const fullBodyText = await page.evaluate(() => document.body.innerText);
    const has0942 = fullBodyText.includes('0.942');
    console.log(`Assertion: Page body does NOT contain invented metric 0.942: ${!has0942 ? 'PASS' : 'FAIL'}`);

    // 4. Check that pending explanation is present
    const hasPendingNotice = fullBodyText.toLowerCase().includes('run pending') || fullBodyText.toLowerCase().includes('evaluation run pending');
    console.log(`Assertion: Explicit Run Pending notice displayed: ${hasPendingNotice ? 'PASS' : 'FAIL'}`);

    if (badgePass && aurocPass && !has0942 && hasPendingNotice) {
      console.log('PASS: T5 Proof panel honesty successfully verified.');
      await browser.close();
      process.exit(0);
    } else {
      console.error('FAIL: T5 Proof panel verification assertions failed.');
      await browser.close();
      process.exit(1);
    }
  } catch (err) {
    console.error('FAIL with error:', err);
    await browser.close();
    process.exit(1);
  }
}

testProof();
