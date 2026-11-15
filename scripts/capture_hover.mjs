import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT_DIR = '/Users/avishjain/Desktop/radha/docs/screenshots';

async function testHover() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({width: 1920, height: 1080});
  await page.goto('http://localhost:3006/#woa', {waitUntil: 'domcontentloaded'});
  await new Promise((r) => setTimeout(r, 2000));

  const slider = await page.waitForSelector('#latency-slider', {timeout: 5000}).catch(() => null);
  console.log('Slider found:', !!slider);
  if (slider) {
    const box = await slider.boundingBox();
    console.log('Slider box:', box);
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await new Promise((r) => setTimeout(r, 600));
      const out = path.join(OUT_DIR, 'task_a1_hover_slider_1920x1080.png');
      await page.screenshot({path: out});
      console.log('Saved hover screenshot to:', out);
    }
  }

  await browser.close();
}

testHover().catch(console.error);
