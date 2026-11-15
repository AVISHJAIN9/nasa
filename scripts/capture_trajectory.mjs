import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT_DIR = '/Users/avishjain/Desktop/radha/docs/screenshots';

const VIEWPORTS = [
  {name: '1920x1080', width: 1920, height: 1080},
  {name: '1366x768', width: 1366, height: 768},
  {name: '1280x720', width: 1280, height: 720},
];

async function captureTrajectory() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setViewport({width: 1920, height: 1080});
  await page.goto('http://localhost:3006/#trajectory', {waitUntil: 'domcontentloaded'});
  await new Promise((r) => setTimeout(r, 2000));

  for (const vp of VIEWPORTS) {
    await page.setViewport({width: vp.width, height: vp.height});
    // Scroll to trajectory section
    await page.evaluate(() => {
      const el = document.getElementById('trajectory');
      if (el) el.scrollIntoView();
    });
    await new Promise((r) => setTimeout(r, 800));

    // Verify caption height / bounding box
    const captionInfo = await page.evaluate(() => {
      const p = document.querySelector('#trajectory p.text-regolith\\/80') || document.querySelector('#trajectory p');
      if (!p) return null;
      const rect = p.getBoundingClientRect();
      const style = window.getComputedStyle(p);
      return {
        height: rect.height,
        lineHeight: style.lineHeight,
        fontSize: style.fontSize,
        whiteSpace: style.whiteSpace,
        text: p.innerText,
      };
    });
    console.log(`[${vp.name}] Caption:`, captionInfo);

    const outPath = path.join(OUT_DIR, `task_a3_a4_trajectory_${vp.name}.png`);
    await page.screenshot({path: outPath, fullPage: false});
    console.log(`Saved screenshot: ${outPath}`);
  }

  await browser.close();
}

captureTrajectory().catch(console.error);
