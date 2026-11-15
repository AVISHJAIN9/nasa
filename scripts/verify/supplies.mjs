import puppeteer from 'puppeteer-core';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const API_BASE_URL = 'http://127.0.0.1:3006';
const BROWSER_URL = 'http://localhost:3006';

async function testSupplies() {
  console.log('=== VERIFYING T4: SUPPLY PLANNER BACKEND INTEGRATION ===');

  // 1. Backend direct API verification (assert backend plan changes on reduced stock)
  console.log('Phase 1: Direct backend API verification...');
  const highStockRes = await fetch(`${API_BASE_URL}/api/v1/supplies/treatment-plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scenario: 'DEHYDRATION',
      severity: 'SEVERE',
      mission_days_remaining: 30,
      iv_saline_available: 12,
      ors_packets_available: 48,
      crew_size: 4,
    }),
  });

  if (!highStockRes.ok) {
    throw new Error(`High stock request failed with HTTP ${highStockRes.status}`);
  }
  const highStockData = await highStockRes.json();
  const highPlan = highStockData?.data?.selected_treatment_plan || highStockData?.data?.selected_plan;
  const highPlanId = highPlan?.plan_id;
  console.log('High stock plan:', highPlanId, `("${highPlan?.title}")`);

  // Reduce stock to near zero (IV: 0, ORS: 1)
  const lowStockRes = await fetch(`${API_BASE_URL}/api/v1/supplies/treatment-plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scenario: 'DEHYDRATION',
      severity: 'SEVERE',
      mission_days_remaining: 60,
      iv_saline_available: 0,
      ors_packets_available: 1,
      crew_size: 4,
    }),
  });

  if (!lowStockRes.ok) {
    throw new Error(`Low stock request failed with HTTP ${lowStockRes.status}`);
  }
  const lowStockData = await lowStockRes.json();
  const lowPlan = lowStockData?.data?.selected_treatment_plan || lowStockData?.data?.selected_plan;
  const lowPlanId = lowPlan?.plan_id;
  console.log('Reduced stock plan:', lowPlanId, `("${lowPlan?.title}")`);

  const planChanged = highPlanId && lowPlanId && highPlanId !== lowPlanId && lowPlanId === 'CONSERVATION_STAGED';
  console.log(`Assertion: Backend plan changes upon reducing stock (${highPlanId} -> ${lowPlanId}): ${planChanged ? 'PASS' : 'FAIL'}`);

  // 2. Browser UI verification
  console.log('Phase 2: Verifying UI renders backend plan and source label...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.goto(`${BROWSER_URL}/#supplies`, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.evaluate(() => {
    const store = window.useStore;
    if (store) {
      store.getState().acceptConsent('CDR Elena Vega');
      store.getState().setPage('supplies');
    }
  });

  await new Promise((r) => setTimeout(r, 1200));

  const uiState = await page.evaluate(() => {
    const sourceEl = document.querySelector('#supplies-plan-source');
    const titleEl = document.querySelector('#plan-title');
    const scarcityEl = document.querySelector('#plan-scarcity-action');

    return {
      source: sourceEl ? sourceEl.innerText : null,
      planTitle: titleEl ? titleEl.innerText : null,
      scarcityAction: scarcityEl ? scarcityEl.innerText : null,
    };
  });

  console.log('UI Render State:', uiState);
  const sourceRendered = uiState.source && uiState.source.includes('BACKEND');
  const titleRendered = !!uiState.planTitle;
  console.log(`Assertion: UI shows BACKEND plan source: ${sourceRendered ? 'PASS' : 'FAIL'}`);
  console.log(`Assertion: UI displays backend plan title: ${titleRendered ? 'PASS' : 'FAIL'}`);

  await browser.close();

  if (planChanged && sourceRendered && titleRendered) {
    console.log('PASS: T4 Supply planner backend integration successfully verified.');
    process.exit(0);
  } else {
    console.error('FAIL: T4 verification assertions failed.');
    process.exit(1);
  }
}

testSupplies().catch((err) => {
  console.error('FAIL with error:', err);
  process.exit(1);
});
