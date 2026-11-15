import puppeteer from 'puppeteer-core';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '../../frontend/dist');
const SHOTS_DIR = path.resolve(__dirname, '../../docs/audit-shots');
const PORT = 3006;
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const PAGES = [
  'home',
  'woa',
  'assistant',
  'protocols',
  'proof',
  'limits',
  'wellness',
  'notes',
  'orders',
  'brief',
  'whatif',
  'audit',
  'supplies',
  'syndromes',
  'forecast',
  'telesession',
  'broadcast',
  'roadmap',
];

const ROLES = ['astronaut', 'surgeon', 'control'];

function startServer() {
  return new Promise((resolve, reject) => {
    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.glb': 'model/gltf-binary',
      '.txt': 'text/plain',
    };

    const server = http.createServer((req, res) => {
      let reqPath = req.url.split('?')[0];
      if (reqPath === '/' || !path.extname(reqPath)) {
        reqPath = '/index.html';
      }
      const filePath = path.join(DIST_DIR, reqPath);

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
      } else {
        const indexPath = path.join(DIST_DIR, 'index.html');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        fs.createReadStream(indexPath).pipe(res);
      }
    });

    server.listen(PORT, () => {
      console.log(`Audit walker server running at http://localhost:${PORT}`);
      resolve(server);
    });
    server.on('error', reject);
  });
}

async function walk() {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
  const server = await startServer();

  console.log('Launching Chrome from:', CHROME_PATH);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  const pageErrors = [];
  const consoleErrors = [];

  try {
    const page = await browser.newPage();

    page.on('pageerror', (err) => {
      console.error('PAGE ERROR:', err.message);
      pageErrors.push(err.message);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore expected network connection failures to non-running endpoints during offline walk
        if (!text.includes('Failed to load resource') && !text.includes('net::ERR_CONNECTION_REFUSED')) {
          console.error('CONSOLE ERROR:', text);
          consoleErrors.push(text);
        }
      }
    });

    const viewports = [
      { name: '1280px', width: 1280, height: 800 },
      { name: '390px', width: 390, height: 844 },
    ];

    for (const vp of viewports) {
      console.log(`\n=== Walking Viewport: ${vp.name} (${vp.width}x${vp.height}) ===`);
      await page.setViewport({ width: vp.width, height: vp.height });

      await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle0' });

      for (const role of ROLES) {
        console.log(`\n-- Testing Role: ${role} --`);

        // Switch role via store directly in page context for reliable test orchestration
        await page.evaluate((r) => {
          const store = window.useStore || window.__ASTROCARE_STORE__;
          if (store) {
            store.getState().setRole(r);
            store.getState().setView('app');
          }
        }, role);

        // Click role button if UI visible
        const roleBtnSelector = `button[data-role="${role}"]`;
        const roleBtn = await page.$(roleBtnSelector);
        if (roleBtn) {
          await roleBtn.click().catch(() => {});
        }

        await new Promise((r) => setTimeout(r, 400));

        for (const p of PAGES) {
          // Switch page
          await page.evaluate((pg) => {
            const store = window.useStore || window.__ASTROCARE_STORE__;
            if (store) {
              store.getState().setPage(pg);
            }
          }, p);

          await new Promise((r) => setTimeout(r, 200));

          // Capture screenshot
          const shotPath = path.join(SHOTS_DIR, `${role}_${p}_${vp.name}.png`);
          await page.screenshot({ path: shotPath });

          // Click enabled buttons inside page (excluding reset/tamper/clear destructive buttons)
          const buttons = await page.$$('button:not([disabled])');
          for (let i = 0; i < Math.min(buttons.length, 5); i++) {
            const btn = buttons[i];
            const text = await page.evaluate((el) => el.textContent || '', btn);
            if (!text.includes('Reset') && !text.includes('Clear') && !text.includes('Tamper')) {
              await btn.click().catch(() => {});
              await new Promise((r) => setTimeout(r, 50));
            }
          }
        }
      }
    }

    console.log('\nAudit walk finished successfully.');
    console.log(`Total screenshots saved: ${fs.readdirSync(SHOTS_DIR).length}`);
    console.log(`Page errors: ${pageErrors.length}, Console errors: ${consoleErrors.length}`);

    if (pageErrors.length > 0 || consoleErrors.length > 0) {
      console.error('WALK FAILED with errors.');
      process.exit(1);
    }
  } finally {
    await browser.close();
    server.close();
  }
}

walk().catch((err) => {
  console.error('Walker fatal error:', err);
  process.exit(1);
});
