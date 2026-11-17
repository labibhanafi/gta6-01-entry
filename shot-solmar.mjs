// SOLMAR screenshot tool — my own script (written for this entry).
// Usage: node shot-solmar.mjs <url> <out.jpg>
// 1280x800, waits for window.__shotReady, JPEG quality 82, logs every console
// message and every network request, and FAILS loudly on any console error
// or any request outside localhost.
import sparticuz from '/home/hatch/workspace/makefun/pw-tools/node_modules/@sparticuz/chromium/build/index.js';
import { chromium } from '/home/hatch/workspace/makefun/pw-tools/node_modules/playwright-core/index.mjs';

const url = process.argv[2];
const out = process.argv[3];
if (!url || !out) {
  console.error('usage: xvfb-run -a node shot-solmar.mjs <url> <out.jpg>');
  process.exit(2);
}

// The chrome-bin build cannot create a WebGL context on this VM; the
// @sparticuz/chromium binary works headed under Xvfb (WebGL 2.0 verified).
sparticuz.setGraphicsMode = false;
const exe = await sparticuz.executablePath();
console.log('chromium at:', exe);
const browser = await chromium.launch({
  executablePath: exe,
  headless: false,
  // NOTE: sparticuz.args disables the GPU and kills WebGL here — use only
  // the flags the probe proved working with this binary.
  args: ['--no-sandbox', '--hide-scrollbars', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const errors = [];
const badRequests = [];
page.on('console', (msg) => {
  const t = msg.type();
  console.log(`[console.${t}]`, msg.text());
  if (t === 'error') errors.push(msg.text());
});
page.on('pageerror', (err) => { console.log('[pageerror]', String(err)); errors.push(String(err)); });
page.on('request', (req) => {
  const u = req.url();
  console.log('[request]', u);
  if (!u.startsWith('http://localhost') && !u.startsWith('http://127.0.0.1') && !u.startsWith('data:') && !u.startsWith('blob:')) {
    badRequests.push(u);
  }
});
page.on('requestfailed', (req) => { console.log('[requestfailed]', req.url(), req.failure()?.errorText); errors.push(`request failed: ${req.url()}`); });

await page.goto(url, { waitUntil: 'load' });
try {
  await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 30000 });
} catch {
  console.error('FAIL: __shotReady never became true for', url);
  await browser.close();
  process.exit(1);
}
await page.waitForTimeout(150);
await page.screenshot({ path: out, type: 'jpeg', quality: 82 });
await browser.close();
if (errors.length > 0) {
  console.error('FAIL: console/page errors:', JSON.stringify(errors, null, 2));
  process.exit(1);
}
if (badRequests.length > 0) {
  console.error('FAIL: non-localhost requests:', JSON.stringify(badRequests, null, 2));
  process.exit(1);
}
console.log('shot ok ->', out);
