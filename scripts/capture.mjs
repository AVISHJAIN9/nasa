import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT_DIR = '/Users/avishjain/Desktop/radha/docs/screenshots';

const VIEWPORTS = [
  {name: '1920x1080', width: 1920, height: 1080},
  {name: '1366x768', width: 1366, height: 768},
  {name: '1280x720', width: 1280, height: 720},
];

export async function capture(pageName = 'home', prefix = 'run') {
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
  await page.goto(`http://localhost:3006/#${pageName}`, {waitUntil: 'domcontentloaded'});
  await new Promise((r) => setTimeout(r, 1800));

  for (const vp of VIEWPORTS) {
    await page.setViewport({width: vp.width, height: vp.height});
    await new Promise((r) => setTimeout(r, 400));
    const outPath = path.join(OUT_DIR, `${prefix}_${pageName}_${vp.name}.png`);
    await page.screenshot({path: outPath, fullPage: false});
    console.log(`Saved screenshot: ${outPath}`);
  }

  await browser.close();

  console.log(`Capture complete. Errors: ${errors.length}, Warnings: ${warnings.length}`);
  if (errors.length) console.log('Errors:', errors);
  return {errors, warnings};
}

const targetPage = process.argv[2] || 'home';
const prefix = process.argv[3] || 'run';
capture(targetPage, prefix).catch(console.error);
