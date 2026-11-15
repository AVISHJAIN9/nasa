import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT_DIR = '/Users/avishjain/Desktop/radha/docs/screenshots';

const VIEWPORTS = [
  {name: '1920x1080', width: 1920, height: 1080},
  {name: '1366x768', width: 1366, height: 768},
  {name: '1280x720', width: 1280, height: 720},
];

async function captureAstronaut() {
  console.log('Launching browser...');
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

  const errors = [];
  const warnings = [];

  const page = await browser.newPage();
  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') errors.push(text);
    if (type === 'warning') warnings.push(text);
  });
  page.on('pageerror', (err) => {
    errors.push(`PAGE ERROR: ${err.message}`);
  });

  await page.setViewport({width: 1920, height: 1080});
  console.log('Navigating to http://localhost:3006/#home...');
  await page.goto('http://localhost:3006/#home', {waitUntil: 'domcontentloaded'});
  await new Promise((r) => setTimeout(r, 1200));

  // Explicitly set astronaut role and live vitals tab
  await page.evaluate(() => {
    if (window.__store) {
      window.__store.getState().setView('app');
      window.__store.getState().setRole('astronaut');
      window.__store.getState().setPage('home');
      window.__store.getState().setAstronautHomeTab('live');
    }
  });
  await new Promise((r) => setTimeout(r, 1000));

  for (const vp of VIEWPORTS) {
    await page.setViewport({width: vp.width, height: vp.height});
    await new Promise((r) => setTimeout(r, 500));

    // Check BP tile content & overflow
    const bpInfo = await page.evaluate(() => {
      const tiles = Array.from(document.querySelectorAll('button')).filter((b) =>
        b.textContent?.includes('Blood Pressure')
      );
      const bpTile = tiles[0];
      const hasHorizontalScroll = document.documentElement.scrollWidth > document.documentElement.clientWidth;
      return {
        found: !!bpTile,
        text: bpTile ? bpTile.innerText.replace(/\n+/g, ' ') : null,
        hasHorizontalScroll,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      };
    });
    console.log(`[${vp.name}] BP Tile:`, bpInfo);

    const outPath = path.join(OUT_DIR, `task_a5_bp_astronaut_${vp.name}.png`);
    await page.screenshot({path: outPath, fullPage: false});
    console.log(`Saved screenshot: ${outPath}`);
  }

  // Also click BP tile to verify it selects BP trendline
  await page.evaluate(() => {
    const tiles = Array.from(document.querySelectorAll('button')).filter((b) =>
      b.textContent?.includes('Blood Pressure')
    );
    if (tiles[0]) tiles[0].click();
  });
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({path: path.join(OUT_DIR, 'task_a5_bp_selected_trend_1920x1080.png')});
  console.log('Saved BP selected trend screenshot');

  await browser.close();

  console.log(`\nCapture complete. Errors: ${errors.length}, Warnings: ${warnings.length}`);
  if (errors.length) console.log('Errors:', errors);
}

captureAstronaut().catch(console.error);
