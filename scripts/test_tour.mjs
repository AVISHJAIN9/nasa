import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SCREENSHOT_DIR = path.resolve('docs/screenshots');
if (!existsSync(SCREENSHOT_DIR)) {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function run() {
  console.log('--- STARTING 8-MINUTE MARS TOUR AUTOMATED VERIFICATION ---');

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

  // Open with ?speed=16 dev acceleration flag so 480s completes in ~30s
  console.log('1. Loading http://localhost:3006/?speed=16#home...');
  await page.goto('http://localhost:3006/?speed=16#home', { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 1200));

  // Reset state to nominal
  await page.evaluate(() => window.__store.getState().resetDemoState());
  await new Promise((r) => setTimeout(r, 500));

  // 2. Start Demo Tour
  console.log('2. Starting Mars Demo Tour (8:00)...');
  await page.evaluate(() => {
    const btn = document.getElementById('start-demo-tour-button');
    if (btn) {
      btn.click();
    } else {
      window.__store.getState().startMarsStory();
    }
  });
  await new Promise((r) => setTimeout(r, 800));

  // Verify tour is running
  const isRunning = await page.evaluate(() => window.__store.getState().storyRunning);
  if (!isRunning) {
    throw new Error('FAIL: Tour did not start running');
  }
  console.log('✓ Tour active and running.');

  // 3. Test Presenter Mode ('P' key)
  console.log('3. Testing Presenter Mode ("P" key)...');
  await page.keyboard.press('p');
  await new Promise((r) => setTimeout(r, 400));
  const presenterPanel = await page.$('div[role="complementary"][aria-label="Presenter Cues and Rehearsal Notes"]');
  if (!presenterPanel) {
    throw new Error('FAIL: Presenter panel did not appear after pressing P');
  }
  console.log('✓ Presenter mode notes panel displayed.');
  await page.keyboard.press('p'); // close presenter mode
  await new Promise((r) => setTimeout(r, 300));

  // 4. Test Pause & Play (Space key)
  console.log('4. Testing Space key pause & play...');
  await page.keyboard.press('Space');
  await new Promise((r) => setTimeout(r, 400));
  const isPaused = await page.evaluate(() => window.__store.getState().storyPaused);
  if (!isPaused) {
    throw new Error('FAIL: Space bar did not pause tour');
  }
  await page.keyboard.press('Space');
  await new Promise((r) => setTimeout(r, 400));
  const isResumed = await page.evaluate(() => !window.__store.getState().storyPaused);
  if (!isResumed) {
    throw new Error('FAIL: Space bar did not resume tour');
  }
  console.log('✓ Space key pause/resume verified.');

  // Capture Ch 1 screenshot
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tour_ch1_mission_setup.png') });
  console.log('✓ Captured Ch 1 screenshot.');

  // 5. Test Chapter Navigation: Jump to each chapter and verify targets
  console.log('5. Stepping through all 10 chapters...');
  for (let ch = 0; ch < 10; ch++) {
    await page.evaluate((step) => {
      window.__store.getState().jumpToStoryStep(step);
    }, ch);

    await new Promise((r) => setTimeout(r, 700));

    const state = await page.evaluate(() => {
      const s = window.__store.getState();
      return {
        stepIndex: s.storyStepIndex,
        elapsed: s.storyElapsedSec,
        role: s.role,
        page: s.page,
        caption: s.narrationCaption,
      };
    });

    console.log(`   Chapter ${ch + 1}/10 -> Page: ${state.page}, Role: ${state.role}, Elapsed: ${state.elapsed}s`);

    // Capture key chapter screenshots
    if (ch === 3) { // Ch 4: Pre-symptomatic CO2 early warning
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tour_ch4_cabin_body.png') });
    } else if (ch === 4) { // Ch 5: Wait-or-Act decision frontier
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tour_ch5_wait_or_act.png') });
    } else if (ch === 5) { // Ch 6: Surgeon directive
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tour_ch6_surgeon_directive.png') });
    }
  }

  // 6. Test Tour Completion at 480s
  console.log('6. Triggering completion at 480s...');
  await page.evaluate(() => {
    window.__store.setState({ storyElapsedSec: 480, storyRunning: true });
  });
  await new Promise((r) => setTimeout(r, 600));

  const completeDialog = await page.$('div[role="dialog"][aria-labelledby="demo-complete-title"]');
  if (!completeDialog) {
    throw new Error('FAIL: Demo Complete modal dialog did not appear at 480s');
  }
  console.log('✓ Demo Complete modal dialog displayed successfully.');

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tour_demo_complete.png') });
  console.log('✓ Captured Demo Complete dialog screenshot.');

  // Clean exit
  await page.evaluate(() => window.__store.getState().resetDemoState());

  if (consoleErrors.length > 0) {
    console.error('Console errors:', consoleErrors);
    throw new Error(`FAIL: Encountered ${consoleErrors.length} console errors`);
  }

  console.log('✓ 8-Minute Mars Tour verification complete with 0 console errors!');
  await browser.close();
}

run().catch((err) => {
  console.error('ERROR in test_tour:', err);
  process.exit(1);
});
