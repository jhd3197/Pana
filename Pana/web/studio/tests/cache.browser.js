// Real routed navigation, selective cache, failure isolation and mobile behavior.
// node cache.browser.js [absolute-playwright-package] [browser-executable]
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)(process.argv[2] || 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}) });
const base = process.env.PANA_QA_URL || 'http://localhost:8461', output = 'art/studio/routes';
await mkdir(output, { recursive: true });
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read','clipboard-write'] });
  const page = await context.newPage(), requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(new URL(request.url()).pathname));
  const ready = () => page.locator('#startup').waitFor({ state: 'hidden' });
  const preview = id => page.waitForFunction(id => window.panaLibrary?.selected === id && panaLibrary.current && document.querySelector('#preview-status').hidden, id, { timeout: 90000 });
  const prepared = count => page.waitForFunction(count => panaLibrary.thumbnails.state.completed === count && !panaLibrary.thumbnails.state.active, count, { timeout: 90000 });
  await page.goto(base + '/studio/library'); await ready();
  const count = await page.locator('[data-asset]').count(); assert.ok(count > 170);
  assert.equal(await page.evaluate(() => !!panaLibrary.renderer), false);
  assert.equal(requests.some(path => /three|tracks\.js|cars\.js|track-runtime|preview\.js/.test(path)), false);
  assert.equal(await page.evaluate(() => panaLibrary.thumbnails.state.generated), 0);
  await page.screenshot({ path: output + '/library.png' });
  await page.locator('#search').fill('barril'); await page.locator('[data-asset="barrel"]').click(); await preview('barrel');
  assert.equal(new URL(page.url()).pathname, '/studio/assets/barrel');
  assert.equal(await page.locator('.library').isVisible(), false);
  assert.equal(requests.some(path => /\/g\/derrape\/(tracks|cars|track-runtime)\.js/.test(path)), false);
  await page.locator('#pin-asset').click(); await page.locator('#copy-link').click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), base + '/studio/assets/barrel');
  await page.locator('#copy-context').click(); assert.match(await page.evaluate(() => navigator.clipboard.readText()), /Fuente: Pana\/engine\/models/);
  await page.screenshot({ path: output + '/asset.png' });
  await page.goBack(); assert.equal(await page.locator('#search').inputValue(), 'barril');
  assert.equal(await page.evaluate(() => panaLibrary.current === null), true, 'route exit releases preview');
  await page.goForward(); await preview('barrel');
  await page.locator('#back-library').click(); await page.locator('#search').fill('mazorca');
  await page.locator('[data-asset="corn"]').click(); await preview('corn'); await page.locator('#pin-asset').click();
  await page.locator('#nav-workspace').click(); assert.equal(await page.locator('[data-asset]').count(), 2);
  await page.locator('#prepare-results').click(); await prepared(2);
  assert.equal(await page.evaluate(() => panaLibrary.thumbnails.state.generated), 2);
  assert.equal(requests.some(path => /\/g\/derrape\/(tracks|cars|track-runtime)\.js/.test(path)), false);
  await page.locator('#view-grid').click(); await page.locator('#prepare-results').click(); await prepared(2);
  await page.screenshot({ path: output + '/selection.png' });
  const downloadPromise = page.waitForEvent('download'); await page.locator('#export').click();
  await (await downloadPromise).saveAs(output + '/selection.json');
  const exported = JSON.parse(await readFile(output + '/selection.json', 'utf8'));
  assert.deepEqual(exported.assets.map(asset => asset.id).sort(), ['barrel','corn']);
  assert.ok(exported.assets.every(asset => asset.metrics && !asset.build && !asset.blob));
  await page.reload(); await ready(); assert.equal(await page.locator('[data-asset]').count(), 2);
  await page.locator('#prepare-results').click(); await prepared(2);
  assert.equal(await page.evaluate(() => panaLibrary.thumbnails.state.generated), 0);
  assert.equal(await page.evaluate(() => panaLibrary.thumbnails.state.reused), 2);
  // A source edit regenerates only its requested consumers.
  await page.route('**/engine/models/props/kitchen.js', async route => { const response = await route.fetch(); await route.fulfill({ response, body: await response.text() + '\n// scoped invalidation proof\n' }); });
  await page.reload(); await ready(); await page.locator('#prepare-results').click(); await prepared(2);
  assert.equal(await page.evaluate(() => panaLibrary.thumbnails.state.generated), 1);
  assert.equal(await page.evaluate(() => panaLibrary.thumbnails.state.reused), 1);
  await page.unroute('**/engine/models/props/kitchen.js');
  // A broken asset never gates the library, or the other requested asset.
  await page.route('**/engine/models/props/kitchen.js', route => route.fulfill({ status: 503, body: 'offline' }));
  await page.reload(); await ready(); await page.locator('#prepare-results').click();
  await page.waitForFunction(() => panaLibrary.thumbnails.errors.has('corn') && panaLibrary.thumbnails.entries.has('barrel'));
  assert.equal(await page.locator('.library').isVisible(), true);
  await page.unroute('**/engine/models/props/kitchen.js'); await page.locator('#retry-thumbnails').click(); await prepared(2);
  // Filters are URLs; sorting retains unmeasured metadata and does not construct it.
  await page.locator('#nav-library').click(); await page.locator('#game-filter').selectOption('Caída');
  const caidaAssets = await page.evaluate(() => panaLibrary.assets.filter(a => a.usedBy.includes('Caída')).map(a => a.id).sort());
  assert.ok(caidaAssets.length >= 4);
  assert.deepEqual(await page.locator('[data-asset]').evaluateAll(nodes => nodes.map(n => n.dataset.asset).sort()), caidaAssets);
  await page.reload(); await ready(); assert.equal(await page.locator('#game-filter').inputValue(), 'Caída');
  await page.locator('#search').fill('zz-missing'); assert.equal(await page.locator('#empty').isVisible(), true);
  await page.locator('#clear-search').click(); await page.locator('#pack-filter').selectOption({ index: 1 });
  const pack = await page.locator('#pack-filter').inputValue(); assert.ok(pack);
  assert.equal(await page.evaluate(pack => [...document.querySelectorAll('[data-asset]')].every(node => panaLibrary.assets.find(asset => asset.id === node.dataset.asset).pack === pack), pack), true);
  // Actual links work in new tabs and on direct refresh. Old hashes still resolve.
  const tab = await context.newPage(); await tab.goto(base + '/studio.html#barrel');
  await tab.waitForFunction(() => window.panaLibrary?.current, null, { timeout: 90000 }); assert.equal(new URL(tab.url()).pathname, '/studio/assets/barrel');
  await tab.reload(); await tab.waitForFunction(() => window.panaLibrary?.current);
  await tab.goto(base + '/studio/assets/missing-id'); await tab.locator('#startup').waitFor({ state: 'hidden' });
  assert.equal(await tab.locator('#missing-asset').isVisible(), true); assert.equal(await tab.evaluate(() => !!panaLibrary.renderer), false);
  const unknown = await tab.goto(base + '/studio/not-a-page'); assert.equal(unknown.status(), 404);
  await tab.close();
  await page.goto(base + '/studio/assets/corn'); await preview('corn');
  await page.locator('#settings-link').click(); await page.waitForFunction(() => document.querySelector('#cache-count')?.textContent === '2');
  assert.equal(await page.locator('canvas').count(), 0);
  assert.match(await page.locator('#inventory-link').getAttribute('href'), /^\/studio\/assets\/corn$/);
  await page.locator('#cache-clear').click(); await page.waitForFunction(() => document.querySelector('#cache-count').textContent === '0');
  for (const path of ['/studio/library', '/studio/workspace', '/studio/assets/barrel', '/studio/settings', '/studio/guide']) {
    await page.setViewportSize({ width: 390, height: 844 }); await page.goto(base + path);
    if (path.includes('assets/')) await preview('barrel'); else if (!/settings|guide/.test(path)) await ready();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, path);
    await page.screenshot({ path: output + '/mobile-' + path.split('/').pop() + '.png', fullPage: true });
  }
  const fallback = await browser.newPage();
  await fallback.addInitScript(() => { Object.defineProperty(window, 'indexedDB', { value: { open() { throw new Error('storage disabled'); } } }); Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage disabled'); } }); });
  await fallback.goto(base + '/studio/library?q=barrel'); await fallback.locator('#startup').waitFor({ state: 'hidden' });
  // ?q=barrel also matches the other barrels in the catalog; pin the plain one only.
  await fallback.locator('.asset-card:has([data-asset="barrel"]) .asset-pin').click(); await fallback.locator('#prepare-results').click();
  await fallback.waitForFunction(() => panaLibrary.thumbnails.state.ready === 1);
  assert.equal(await fallback.evaluate(() => panaLibrary.thumbnails.state.persistent), false);
  assert.match(await fallback.locator('#workspace-status').textContent(), /sesión/);
  assert.deepEqual(errors, []);
  console.log('PASS: real routes, history, direct refresh, no eager renderer, selective cold/warm cache, isolated invalidation/retry, selection/export, filters, settings, mobile and blocked storage.');
} finally { await browser.close(); }
