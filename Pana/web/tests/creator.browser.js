import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const base = process.env.PANA_TEST_URL || 'http://localhost:8461';
const browser = await chromium.launch({ headless: true });
await mkdir('Pana/web/qa', { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  let release; const pending = new Promise(resolve => { release = resolve; });
  await page.route('**/pana.js', async route => { await pending; await route.continue(); });
  await page.goto(base + '/#mi-pana');
  await page.locator('#pana-loading').waitFor();
  assert.equal(await page.locator('#pana-random').isDisabled(), true);
  assert.equal(await page.locator('.customizer').evaluate(n => n.inert), true);
  await page.screenshot({ path: 'Pana/web/qa/creator-loading.png' });
  release();
  await page.locator('#pana-loading').waitFor({ state: 'hidden', timeout: 120000 });
  assert.equal(await page.locator('#pana-random').isDisabled(), false);
  assert.equal(await page.locator('.customizer').evaluate(n => n.inert), false);
  for (const width of [1920, 1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    const edges = await page.evaluate(() => {
      const logo = document.querySelector('.topbar .pk-logo').getBoundingClientRect();
      const card = document.getElementById('mi-pana').getBoundingClientRect();
      return { delta: Math.abs(logo.left - card.left), overflow: document.documentElement.scrollWidth > innerWidth };
    });
    assert.ok(edges.delta <= 1, `creator/header alignment at ${width}`); assert.equal(edges.overflow, false);
  }
  await page.screenshot({ path: 'Pana/web/qa/creator-mobile.png', fullPage: true });
  await page.goto(base + '/#jugar');
  await page.goto(base + '/#mi-pana');
  assert.equal(await page.locator('#pana-loading').isVisible(), false);
  const failed = await browser.newPage();
  await failed.route('**/pana.js', route => route.abort());
  await failed.goto(base + '/#mi-pana');
  await failed.locator('#pana-loading-retry').waitFor();
  assert.equal(await failed.locator('#pana-random').isDisabled(), true);
  await failed.unroute('**/pana.js'); await failed.locator('#pana-loading-retry').click();
  await failed.locator('#pana-loading').waitFor({ state: 'hidden', timeout: 120000 });
  assert.deepEqual(errors, []);
  console.log('PASS creator: visible loading, real preparation, failure/retry, reuse and aligned responsive edges.');
} finally { await browser.close(); }
