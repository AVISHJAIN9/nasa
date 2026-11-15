import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT_DIR = '/Users/avishjain/Desktop/radha/docs/screenshots';

async function testDirectiveFlow() {
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
  await page.setViewport({width: 1920, height: 1080});
  await page.goto('http://localhost:3006/#home', {waitUntil: 'domcontentloaded'});
  await new Promise((r) => setTimeout(r, 1200));

  // 1. Set Surgeon Role & Select Vega
  await page.evaluate(() => {
    window.__store.getState().setView('app');
    window.__store.getState().setRole('surgeon');
    window.__store.getState().setPage('home');
    window.__store.getState().setSelectedCrewId('vega');
    window.__store.getState().setTimeScale(20); // Accelerated demo speed
  });
  await new Promise((r) => setTimeout(r, 1000));

  // 2. Transmit directive from Surgeon
  await page.evaluate(() => {
    window.__store.getState().composeOrder(
      'vega',
      'medication',
      'Administer 25mg Promethazine IM for acute space motion sickness',
      'Dr. Priya Nair (Houston Flight Surgeon)'
    );
  });
  await new Promise((r) => setTimeout(r, 600));

  const surgeonScreenshot1 = path.join(OUT_DIR, 'task_a6_surgeon_transmitting_1920x1080.png');
  await page.screenshot({path: surgeonScreenshot1});
  console.log('Saved surgeon transmitting screenshot:', surgeonScreenshot1);

  // 3. Fast-forward directive to delivered
  await page.evaluate(() => {
    const orders = window.__store.getState().orders;
    if (orders[0]) {
      window.__store.setState({
        orders: orders.map((o, idx) => (idx === 0 ? {...o, status: 'delivered'} : o)),
      });
    }
  });

  // 4. Switch to Astronaut View: check urgent directive banner
  await page.evaluate(() => {
    window.__store.getState().setRole('astronaut');
    window.__store.getState().setPage('home');
  });
  await new Promise((r) => setTimeout(r, 800));

  const astronautBannerInfo = await page.evaluate(() => {
    const banner = document.querySelector('aside[aria-label="Pending Flight Surgeon Directives"]');
    return {
      visible: !!banner,
      text: banner ? banner.innerText.replace(/\n+/g, ' ') : null,
    };
  });
  console.log('Astronaut Directive Banner:', astronautBannerInfo);

  const astronautScreenshot = path.join(OUT_DIR, 'task_a6_astronaut_received_1920x1080.png');
  await page.screenshot({path: astronautScreenshot});
  console.log('Saved astronaut received screenshot:', astronautScreenshot);

  // 5. Astronaut Acknowledges Directive
  await page.evaluate(() => {
    const ackBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Acknowledge')
    );
    if (ackBtn) ackBtn.click();
  });
  await new Promise((r) => setTimeout(r, 600));

  // 6. Return to Surgeon View: check receipt
  await page.evaluate(() => {
    window.__store.getState().setRole('surgeon');
    window.__store.getState().setPage('home');
  });
  await new Promise((r) => setTimeout(r, 800));

  const receiptInfo = await page.evaluate(() => {
    const logs = Array.from(document.querySelectorAll('div')).filter((d) =>
      d.textContent?.includes('Acknowledged')
    );
    return {
      hasReceipt: logs.length > 0,
      text: logs[0] ? logs[0].innerText.replace(/\n+/g, ' ') : null,
    };
  });
  console.log('Surgeon Receipt Verification:', receiptInfo);

  const surgeonScreenshot2 = path.join(OUT_DIR, 'task_a6_surgeon_acknowledged_1920x1080.png');
  await page.screenshot({path: surgeonScreenshot2});
  console.log('Saved surgeon acknowledged screenshot:', surgeonScreenshot2);

  // 7. Verify Offline Queueing
  await page.evaluate(() => {
    window.__store.getState().toggleLinkUp(); // Link down
    window.__store.getState().composeOrder(
      'vega',
      'rest',
      'Mandatory 6h rest cycle due to elevated HRV stress',
      'Dr. Priya Nair (Houston Flight Surgeon)'
    );
  });
  await new Promise((r) => setTimeout(r, 600));

  const offlineInfo = await page.evaluate(() => {
    const queuedBadge = Array.from(document.querySelectorAll('span')).find((s) =>
      s.textContent?.includes('Queued (Offline)')
    );
    return {
      isQueued: !!queuedBadge,
      linkStatus: window.__store.getState().linkUp ? 'online' : 'offline',
    };
  });
  console.log('Offline Queueing Verification:', offlineInfo);

  // Restore link
  await page.evaluate(() => {
    window.__store.getState().toggleLinkUp(); // Link restored
  });

  await browser.close();
  console.log('Task A6 E2E Verification Complete!');
}

testDirectiveFlow().catch(console.error);
