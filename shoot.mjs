// SOLMAR shot script (my own): headed @sparticuz/chromium under xvfb-run,
// SwiftShader software GL, 1280x800, waits for window.__shotReady, JPEG q82.
// Fails loudly on console errors or any non-localhost request.
import sparticuz from '@sparticuz/chromium';
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';

const shots = JSON.parse(readFileSync(new URL('./shots.json', import.meta.url), 'utf8'));
const base = process.argv[2] || 'http://localhost:8080';
const outDir = process.argv[3] || './screenshots';

sparticuz.setGraphicsMode = false;
const exe = await sparticuz.executablePath();
console.log('chromium at:', exe);
const browser = await chromium.launch({
  executablePath: exe,
  headless: false,
  args: ['--no-sandbox', '--hide-scrollbars', '--enable-unsafe-swiftshader'],
});
let failures = 0;
for (const s of shots) {
  const url = `${base}/${s.query}`;
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const errors = [];
  const badReqs = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith('http://localhost') && !u.startsWith('http://127.0.0.1') && !u.startsWith('data:') && !u.startsWith('blob:')) {
      badReqs.push(u);
    }
  });
  console.log('shooting', url);
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  try {
    await page.waitForFunction(() => window.__shotReady === true, { timeout: 120000 });
  } catch (e) {
    console.error('FAIL: __shotReady never set for', url);
    failures += 1;
    await page.close();
    continue;
  }
  await page.waitForTimeout(300);
  const out = `${outDir}/${s.name}`;
  await page.screenshot({ path: out, type: 'jpeg', quality: 82 });
  console.log('shot ok ->', out, 'errors:', errors.length, 'non-localhost:', badReqs.length);
  if (errors.length) { console.error('CONSOLE ERRORS:', errors); failures += 1; }
  if (badReqs.length) { console.error('NON-LOCALHOST REQUESTS:', badReqs); failures += 1; }
  await page.close();
}
await browser.close();
if (failures) {
  console.error(`SHOTS FAILED: ${failures}`);
  process.exit(1);
}
console.log('all shots ok');
