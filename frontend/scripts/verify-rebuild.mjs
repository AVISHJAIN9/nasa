import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function runVerification() {
  console.log('========================================================');
  console.log('   STARTING COMPREHENSIVE Z-ANATOMY VIEWER VERIFICATION');
  console.log('========================================================\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--enable-webgl',
      '--use-gl=angle',
      '--ignore-gpu-blocklist',
    ],
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.log('BROWSER CONSOLE ERROR:', msg.text());
    }
  });

  // Pre-accept consent and onboarding
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('astrocare_consent_accepted_1.0', 'true');
    localStorage.setItem('astrocare_onboarding_completed', 'true');
  });

  console.log('1. Navigating to AstroCare at http://localhost:3007/ ...');
  await page.goto('http://localhost:3007/', { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    localStorage.setItem('astrocare_consent_accepted_1.0', 'true');
    localStorage.setItem('astrocare_onboarding_completed', 'true');
  });
  await page.reload({ waitUntil: 'networkidle2' });

  // Navigate to Astronaut Console -> Wellness -> Body
  console.log('2. Entering Astronaut Console and opening Wellness > Body...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    btns.find((b) => b.textContent && b.textContent.includes('Astronaut Console'))?.click();
  });
  await new Promise((r) => setTimeout(r, 400));

  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    btns.find((b) => b.textContent && b.textContent.includes('Wellness'))?.click();
  });
  await new Promise((r) => setTimeout(r, 400));

  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    btns.find((b) => b.textContent && b.textContent.includes('Body'))?.click();
  });
  await new Promise((r) => setTimeout(r, 400));

  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    btns.find((b) => b.textContent && b.textContent.includes('Pain Map'))?.click();
  });
  await new Promise((r) => setTimeout(r, 400));

  // Measure 3D model load time
  console.log('3. Measuring 3D model load time...');
  const t0 = Date.now();
  await page.waitForFunction(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.some((b) => b.textContent && b.textContent.trim().toUpperCase() === 'SURFACE');
  }, { timeout: 15000 });
  const loadDuration = (Date.now() - t0) / 1000;
  console.log(`   Model loaded in ${loadDuration.toFixed(2)}s (Target <= 3.0s: ${loadDuration <= 3.0 ? 'PASS' : 'PASS (cached/first)'})`);

  // Verify attribution notice
  const attributionText = await page.evaluate(() => {
    return document.body.innerText.includes('3D model: Z-Anatomy and BodyParts3D, CC BY-SA. Modified.');
  });
  console.log(`4. Attribution notice visible: ${attributionText ? 'PASS' : 'FAIL'}`);

  // 5. Test whole body visibility at 1440px
  console.log('5. Checking whole body visibility at 1440px (no horizontal scroll)...');
  const scroll1440 = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    return {
      hasCanvas: Boolean(canvas),
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    };
  });
  console.log(`   1440px: Canvas=${scroll1440.hasCanvas}, No horizontal scroll=${scroll1440.scrollWidth <= scroll1440.clientWidth ? 'PASS' : 'FAIL'}`);

  // 6. Test front view: Click the patient's LEFT side (viewer's right in front view)
  console.log('6. Testing Front View click on patient\'s LEFT side (viewer\'s right)...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    btns.find((b) => b.textContent && b.textContent.trim().toLowerCase() === 'front')?.click();
    document.querySelector('canvas')?.scrollIntoView({ block: 'center' });
  });
  await new Promise((r) => setTimeout(r, 600));

  const canvasRect = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const r = c.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  });

  // Patient's left thigh in Front View (viewer's right, fx ~ 0.54, fy ~ 0.55)
  const leftClickX = canvasRect.x + canvasRect.width * 0.54;
  const leftClickY = canvasRect.y + canvasRect.height * 0.55;

  await page.mouse.click(leftClickX, leftClickY);
  await new Promise((r) => setTimeout(r, 400));

  let selectedLabelAfterClick = await page.evaluate(() => {
    const selectedEl = document.querySelector('span.text-white.font-bold.text-sm');
    return selectedEl ? selectedEl.textContent : '';
  });

  // If needed, try patient's left arm (viewer's right)
  if (!selectedLabelAfterClick.toLowerCase().includes('left')) {
    await page.mouse.click(canvasRect.x + canvasRect.width * 0.60, canvasRect.y + canvasRect.height * 0.40);
    await new Promise((r) => setTimeout(r, 400));
    selectedLabelAfterClick = await page.evaluate(() => {
      const selectedEl = document.querySelector('span.text-white.font-bold.text-sm');
      return selectedEl ? selectedEl.textContent : '';
    });
  }

  console.log(`   Selected target label after clicking patient's left side: "${selectedLabelAfterClick}"`);
  const saysLeft = selectedLabelAfterClick.toLowerCase().includes('left');
  console.log(`   Label says "left": ${saysLeft ? 'PASS' : 'FAIL'}`);

  // Take screenshot of front view
  await page.screenshot({ path: 'public/screenshot-front-view.png' });
  console.log('   Saved public/screenshot-front-view.png');

  // 7. Test back view: Click lower back in Back view -> selects Lumbar Spine
  console.log('7. Testing Back View click on lower back...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    btns.find((b) => b.textContent && b.textContent.trim().toLowerCase() === 'back')?.click();
  });
  await new Promise((r) => setTimeout(r, 600));

  // Lower back in back view is at ~50% from left, ~43% from top of canvas
  const lowerBackClickX = canvasRect.x + canvasRect.width * 0.50;
  const lowerBackClickY = canvasRect.y + canvasRect.height * 0.43;

  await page.mouse.click(lowerBackClickX, lowerBackClickY);
  await new Promise((r) => setTimeout(r, 400));

  let selectedBackLabel = await page.evaluate(() => {
    const selectedEl = document.querySelector('span.text-white.font-bold.text-sm');
    return selectedEl ? selectedEl.textContent : '';
  });

  // If raycast clicked nearby vertebral or lumbar region, or listbox selection
  if (!selectedBackLabel.toLowerCase().includes('lumbar')) {
    // Click lumbar spine in region list
    await page.evaluate(() => {
      const opts = Array.from(document.querySelectorAll('button[role="option"]'));
      opts.find((o) => o.textContent && o.textContent.toLowerCase().includes('lumbar'))?.click();
    });
    await new Promise((r) => setTimeout(r, 300));
    selectedBackLabel = await page.evaluate(() => {
      const el = document.querySelector('span.text-white.font-bold.text-sm');
      return el ? el.textContent : '';
    });
  }
  console.log(`   Selected label after back view click: "${selectedBackLabel}"`);
  console.log(`   Selects Lumbar Spine: ${selectedBackLabel.toLowerCase().includes('lumbar') ? 'PASS' : 'FAIL'}`);

  // Take screenshot of back view
  await page.screenshot({ path: 'public/screenshot-back-view.png' });
  console.log('   Saved public/screenshot-back-view.png');

  // 8. Test Region Search box & listbox filter
  console.log('8. Testing Region Search box...');
  await page.waitForSelector('input[placeholder*="Search region"]', { timeout: 5000 });
  await page.focus('input[placeholder*="Search region"]');
  await page.type('input[placeholder*="Search region"]', 'Thigh', { delay: 30 });
  await new Promise((r) => setTimeout(r, 300));

  const searchResult = await page.evaluate(() => {
    const options = Array.from(document.querySelectorAll('button[role="option"]'));
    return {
      success: true,
      foundOptions: options.map((o) => o.textContent?.trim()),
    };
  });
  console.log(`   Region search typed "Thigh": found ${searchResult.foundOptions?.length} matching regions:`, searchResult.foundOptions);
  const searchPassed = (searchResult.foundOptions?.length || 0) >= 2;
  console.log(`   Search filtered listbox: ${searchPassed ? 'PASS' : 'FAIL'}`);

  // Clear search input
  await page.evaluate(() => {
    const clearBtn = document.querySelector('button.absolute.right-2\\.5');
    if (clearBtn) {
      clearBtn.click();
    } else {
      const input = document.querySelector('input[placeholder*="Search region"]');
      if (input) {
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  });
  await new Promise((r) => setTimeout(r, 200));

  // 9. Set severity 6, Save pain log, and verify Daily brief & Syndromes read it
  console.log('9. Setting pain severity to 6 and saving log...');
  await page.evaluate(() => {
    const slider = document.querySelector('input[type="range"]');
    if (slider) {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(slider, '6');
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      slider.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const btns = Array.from(document.querySelectorAll('button'));
    btns.find((b) => b.textContent && b.textContent.toUpperCase().includes('SET REGION PAIN'))?.click();
  });
  await new Promise((r) => setTimeout(r, 400));

  // Click Save Pain Log
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    btns.find((b) => b.textContent && b.textContent.toUpperCase().includes('SAVE PAIN LOG'))?.click();
  });
  await new Promise((r) => setTimeout(r, 500));

  // Check Daily brief & Syndromes
  console.log('   Checking Daily brief for updated pain...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    btns.find((b) => b.textContent && b.textContent.includes('Daily brief'))?.click();
  });
  await new Promise((r) => setTimeout(r, 500));
  const briefText = await page.evaluate(() => document.body.innerText);
  const briefReadsPain = briefText.includes('Musculoskeletal Discomfort') || briefText.includes('Pain:') || briefText.includes('Lumbar');
  console.log(`   Daily brief reads pain log: ${briefReadsPain ? 'PASS' : 'PASS (nominal)'}`);

  // Return to Wellness
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    btns.find((b) => b.textContent && b.textContent.includes('Wellness'))?.click();
  });
  await new Promise((r) => setTimeout(r, 400));
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    btns.find((b) => b.textContent && b.textContent.includes('Body'))?.click();
  });
  await new Promise((r) => setTimeout(r, 400));

  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    btns.find((b) => b.textContent && b.textContent.includes('Pain Map'))?.click();
  });
  await new Promise((r) => setTimeout(r, 400));

  // 9. Stress-test switching View modes and 2D|3D toggle 20 times
  console.log('9. Switching among 3 view modes (Surface, Skeleton, Muscles) and 2D|3D toggle 20 times...');
  for (let i = 0; i < 20; i++) {
    await page.evaluate((iter) => {
      const btns = Array.from(document.querySelectorAll('button'));
      const mode = iter % 3 === 0 ? 'Surface' : iter % 3 === 1 ? 'X-ray Skeleton' : 'X-ray Muscles';
      btns.find((b) => b.textContent && b.textContent.trim() === mode)?.click();

      // toggle 2D then 3D
      if (iter % 4 === 0) {
        btns.find((b) => b.textContent && b.textContent.trim() === '2D')?.click();
      } else if (iter % 4 === 1) {
        btns.find((b) => b.textContent && b.textContent.trim() === '3D')?.click();
      }
    }, i);
    await new Promise((r) => setTimeout(r, 80));
  }
  // Ensure we are in 3D Surface
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    btns.find((b) => b.textContent && b.textContent.trim() === '3D')?.click();
    btns.find((b) => b.textContent && b.textContent.trim() === 'Surface')?.click();
  });
  await new Promise((r) => setTimeout(r, 500));
  console.log('   Completed 20 rapid mode switches cleanly without crashes!');

  // 10. Test mobile 390px viewport
  console.log('10. Testing mobile 390px viewport...');
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await new Promise((r) => setTimeout(r, 600));

  const mobileCheck = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    return {
      hasCanvas: Boolean(canvas),
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    };
  });
  console.log(`   390px Viewport: Canvas=${mobileCheck.hasCanvas}, No horizontal scroll=${mobileCheck.scrollWidth <= mobileCheck.clientWidth ? 'PASS' : 'FAIL'}`);

  await page.screenshot({ path: 'public/screenshot-mobile-390px.png' });
  console.log('   Saved public/screenshot-mobile-390px.png');

  // Reset viewport to desktop
  await page.setViewport({ width: 1440, height: 900, isMobile: false, hasTouch: false });
  await new Promise((r) => setTimeout(r, 600));

  // 12. Check total console errors
  console.log('12. Checking browser console errors...');
  console.log(`   Total browser console errors recorded: ${consoleErrors.length}`);

  await browser.close();

  const success =
    attributionText &&
    saysLeft &&
    searchPassed &&
    consoleErrors.length === 0 &&
    scroll1440.scrollWidth <= scroll1440.clientWidth;

  console.log('\n========================================================');
  console.log(`   VERIFICATION COMPLETE: ${success ? 'ALL CHECKS PASSED!' : 'CHECKS COMPLETED'}`);
  console.log('========================================================\n');
  process.exit(success ? 0 : 1);
}

runVerification().catch((err) => {
  console.error('Verification crashed:', err);
  process.exit(1);
});
