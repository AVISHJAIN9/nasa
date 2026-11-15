import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

function log(msg) {
  fs.writeSync(1, msg + '\n');
}

async function runE2E() {
  log('--- Starting Comprehensive End-to-End Test for Z-Anatomy 3D Viewer ---');

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--enable-webgl',
      '--use-gl=angle',
      '--ignore-gpu-blocklist',
    ],
    defaultViewport: {width: 1440, height: 900},
  });

  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      log('BROWSER ERROR: ' + msg.text());
    }
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(err.message);
    log('PAGE ERROR: ' + err.message);
  });

  // Pre-accept consent and onboarding
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('astrocare_consent_accepted_1.0', 'true');
    localStorage.setItem('astrocare_onboarding_completed', 'true');
  });

  log('1. Loading application at http://localhost:3007/ ...');
  await page.goto('http://localhost:3007/', {waitUntil: 'networkidle0', timeout: 20000});

  // Enter console via Astronaut button
  log('2. Entering Astronaut Console...');
  const entered = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const astroBtn = btns.find((b) => b.textContent && b.textContent.includes('Astronaut Console'));
    if (astroBtn) {
      astroBtn.click();
      return true;
    }
    return false;
  });
  log('   Entered console: ' + (entered ? 'PASS' : 'FAIL'));
  await new Promise((r) => setTimeout(r, 600));

  // Dismiss any onboarding modal if visible
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const skip = btns.find((b) => b.textContent && b.textContent.includes('Skip for demo'));
    if (skip) skip.click();
  });
  await new Promise((r) => setTimeout(r, 600));

  // Navigate to Wellness
  log('3. Navigating to Wellness page...');
  const clickedWellness = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const w = btns.find((b) => b.textContent && b.textContent.includes('Wellness'));
    if (w) {
      w.click();
      return true;
    }
    return false;
  });
  log('   Clicked Wellness: ' + (clickedWellness ? 'PASS' : 'FAIL'));
  await new Promise((r) => setTimeout(r, 800));

  // Switch to Body category
  log('4. Opening Body tab...');
  const clickedBody = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const bodyBtn = btns.find((b) => b.textContent && b.textContent.includes('Body'));
    if (bodyBtn) {
      bodyBtn.click();
      return true;
    }
    return false;
  });
  log('   Clicked Body tab: ' + (clickedBody ? 'PASS' : 'FAIL'));
  await new Promise((r) => setTimeout(r, 800));

  // Ensure 3D toggle is active
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn3D = btns.find((b) => b.textContent && b.textContent.trim() === '3D');
    if (btn3D) btn3D.click();
  });

  log('5. Waiting for 3D Z-Anatomy model to finish loading...');
  await page.waitForFunction(
    () => {
      const el = document.querySelector('canvas');
      return el !== null && !document.body.innerText.includes('Loading Z-Anatomy Twin');
    },
    {timeout: 20000}
  );
  log('   Canvas & meshes ready!');
  await new Promise((r) => setTimeout(r, 1000));

  // Verify attribution is visible
  const attributionVisible = await page.evaluate(() => {
    const divs = Array.from(document.querySelectorAll('div'));
    return divs.some((d) => d.textContent && d.textContent.includes('Z-Anatomy and BodyParts3D'));
  });
  log('6. Attribution visible: ' + (attributionVisible ? 'PASS' : 'FAIL'));

  // Verify View preset buttons
  log('7. Testing View buttons (FRONT, BACK, LEFT, RIGHT, RESET)...');
  const viewButtons = ['front', 'back', 'left', 'right', 'reset'];
  for (const v of viewButtons) {
    const clicked = await page.evaluate((viewName) => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find((b) => b.textContent && b.textContent.trim().toLowerCase() === viewName);
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    }, v);
    log(`   View button [${v}]: ` + (clicked ? 'PASS' : 'FAIL'));
    await new Promise((r) => setTimeout(r, 300));
  }

  // Verify Layer preset buttons
  log('8. Testing Layer buttons (SURFACE, MUSCLES, SKELETON)...');
  const layerButtons = ['surface', 'muscles', 'skeleton'];
  for (const l of layerButtons) {
    const clicked = await page.evaluate((layerName) => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find((b) => b.textContent && b.textContent.trim().toLowerCase() === layerName);
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    }, l);
    log(`   Layer button [${l}]: ` + (clicked ? 'PASS' : 'FAIL'));
    await new Promise((r) => setTimeout(r, 300));
  }

  // Verify Systems toggle chips
  log('9. Testing Systems toggle chips...');
  const systemChips = ['Vessels', 'Nerves', 'Viscera'];
  for (const s of systemChips) {
    const toggled = await page.evaluate((sysName) => {
      const btns = Array.from(document.querySelectorAll('button'));
      const chip = btns.find((b) => b.textContent && b.textContent.includes(sysName));
      if (chip) {
        chip.click();
        return true;
      }
      return false;
    }, s);
    log(`   System chip [${s}]: ` + (toggled ? 'PASS' : 'FAIL'));
    await new Promise((r) => setTimeout(r, 250));
  }

  // Verify 23 regions listbox
  log('10. Testing 23 regions listbox selection...');
  const testRegions = ['Cranium / Head', 'Left Shoulder', 'Lumbar Spine (L1-S1)', 'Left Knee', 'Right Foot / Ankle'];
  for (const regLabel of testRegions) {
    const selected = await page.evaluate((label) => {
      const options = Array.from(document.querySelectorAll('button[role="option"]'));
      const opt = options.find((o) => o.textContent && o.textContent.includes(label));
      if (opt) {
        opt.click();
        return true;
      }
      return false;
    }, regLabel);
    log(`   Selected region [${regLabel}]: ` + (selected ? 'PASS' : 'FAIL'));
    await new Promise((r) => setTimeout(r, 300));
  }

  // Test Pain Slider and SET REGION PAIN
  log('11. Testing Pain Slider & Set Region Pain...');
  const painSetResult = await page.evaluate(() => {
    const slider = document.querySelector('input[type="range"]');
    if (!slider) return {success: false, reason: 'Slider not found'};

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    ).set;
    nativeInputValueSetter.call(slider, '7');
    slider.dispatchEvent(new Event('input', {bubbles: true}));
    slider.dispatchEvent(new Event('change', {bubbles: true}));

    const buttons = Array.from(document.querySelectorAll('button'));
    const setBtn = buttons.find((b) => b.textContent && b.textContent.toLowerCase().includes('set region pain'));
    if (setBtn) {
      setBtn.click();
      return {success: true};
    }
    return {success: false, reason: 'Set button not found'};
  });
  log('   Pain set result: ' + JSON.stringify(painSetResult));

  // Test Structure Search Bar
  log('12. Testing Structure Search...');
  const searchResult = await page.evaluate(() => {
    const input = document.querySelector('input[placeholder*="Search anatomy"]');
    if (!input) return {success: false, reason: 'Search input not found'};

    input.focus();
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeSetter.call(input, 'Femur');
    input.dispatchEvent(new Event('input', {bubbles: true}));
    input.dispatchEvent(new Event('change', {bubbles: true}));
    return {success: true};
  });
  log('   Search input typed "Femur": ' + JSON.stringify(searchResult));
  await new Promise((r) => setTimeout(r, 600));

  // Check if dropdown appeared and click first item with real pointer event
  await page.waitForSelector('div.shadow-2xl button', {timeout: 3000});
  const firstItemText = await page.$eval('div.shadow-2xl button', (el) => el.textContent);
  log('   Found search dropdown item: ' + firstItemText);
  await page.click('div.shadow-2xl button');
  log('   Clicked search result item via real pointer');
  await new Promise((r) => setTimeout(r, 800));

  // Verify Details Panel
  const detailsDebug = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      length: text.length,
      hasStructureDetails: text.toUpperCase().includes('STRUCTURE DETAILS'),
      hasDetails: text.includes('Details'),
      topText: text.slice(0, 300),
      hasZAnatomy: text.includes('Z-Anatomy')
    };
  });
  log('   Details debug: ' + JSON.stringify(detailsDebug));
  const detailsVisible = detailsDebug.hasStructureDetails;
  log('13. Structure Details Panel visible: ' + (detailsVisible ? 'PASS' : 'FAIL'));

  // Test mobile viewport (390px)
  log('14. Testing mobile viewport (390px width)...');
  await page.setViewport({width: 390, height: 844, isMobile: true, hasTouch: true});
  await new Promise((r) => setTimeout(r, 600));
  const mobileCanvas = await page.$('canvas');
  log('   Canvas exists in mobile viewport: ' + (mobileCanvas !== null ? 'PASS' : 'FAIL'));

  // Verify Console Errors
  log('15. Console Errors check...');
  log('   Total console errors recorded: ' + consoleErrors.length);

  // Take screenshot for verification evidence
  await page.setViewport({width: 1440, height: 900});
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({path: 'public/screenshot-3d-pain-map.png', fullPage: false});
  log('16. Saved screenshot to public/screenshot-3d-pain-map.png');

  await browser.close();

  const allPassed =
    attributionVisible &&
    detailsVisible &&
    mobileCanvas !== null &&
    consoleErrors.length === 0;

  log('--- Test Summary ---');
  log('All acceptance criteria passed: ' + (allPassed ? 'YES' : 'NO'));
  process.exit(allPassed ? 0 : 1);
}

runE2E().catch((err) => {
  log('Test crashed: ' + err.stack);
  process.exit(1);
});
