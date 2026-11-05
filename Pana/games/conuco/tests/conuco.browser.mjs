// The plot in a real page: it opens straight on the 3D plot, plants, shows offline
// growth from a saved timestamp, harvests into the shared wallet, repairs the house,
// buys from the shelf, puts out a decoration, keeps it all across a reload, and fits a phone.
// Run: npm run test:browser -- conuco
import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const HOUR = 3_600_000;
const rect = (page, selector) => page.locator(selector).evaluate(n => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; });
const overlaps = (a, b) => a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom;

const browser = await launch();
try {
  const page = await openGame(browser, 'conuco', { name: 'Ana', query: 'debug' });
  await waitFor(page, () => window.conucoDebug?.ui && document.querySelectorAll('.bed').length === 3);
  const view = () => page.evaluate(() => { const { beds, tier, decor, seeds } = conucoDebug.plot.view(); return { tier, decor, seeds, beds: beds.map(b => b && { crop: b.crop, stage: b.stage, ready: b.ready }) }; });
  const mangos = () => page.evaluate(() => conucoDebug.wallet.peek());
  const shown = () => page.locator('#mangos').textContent().then(Number);

  // The hub links here, from its bar and from a tile.
  const hub = await page.context().newPage();
  await hub.goto(new URL('/', page.url()).href, { waitUntil: 'domcontentloaded' });
  await hub.locator('[data-id="conuco"]').first().waitFor({ state: 'attached' });
  await hub.locator('.nav a[href="/g/conuco/"]').click();
  await hub.waitForURL('**/g/conuco/');
  await hub.close();

  // Straight to the plot: no lobby, no room, a real 3D scene.
  assert.equal(await page.locator('#pana-lobby-shell').isVisible(), false, 'no lobby in front of the plot');
  assert.ok(!(new URL(page.url())).searchParams.has('room'), 'a solo plot has no room');
  assert.equal(await page.locator('canvas#world').evaluate(c => c.getContext('2d') === null), true, 'a WebGL canvas');
  assert.equal(await page.locator('[data-bed="0"]').getAttribute('data-state'), 'empty');

  // Plant through the bed's own button: the seed sheet opens with the free crop.
  await page.locator('[data-bed="0"]').click();
  await page.locator('#sheet [data-item="maiz"] button').click();
  await waitFor(page, () => document.getElementById('sheet').hidden);
  assert.equal((await view()).beds[0].crop, 'maiz');
  assert.equal(await page.locator('[data-bed="0"]').getAttribute('data-state'), 'growing');

  // Harvesting too early does nothing.
  await page.locator('[data-bed="0"]').click();
  assert.equal((await view()).beds[0].crop, 'maiz');
  assert.equal(await mangos(), 0);

  // Offline growth: a plant saved long ago, found ready on load, paid into the wallet.
  await page.evaluate(hour => {
    const doc = JSON.parse(localStorage.getItem('pana:plot:conuco'));
    doc.beds[0].at = Date.now() - hour; doc.beds[1] = { id: 'old', crop: 'maiz', at: Date.now() - 40 * hour };
    localStorage.setItem('pana:plot:conuco', JSON.stringify(doc));
    localStorage.setItem('pana:mangos', JSON.stringify({ balance: 300, receipts: [] }));
  }, HOUR);
  await page.reload();
  await waitFor(page, () => window.conucoDebug?.ui && document.querySelectorAll('.bed').length === 3);
  assert.equal(await page.locator('[data-bed="0"]').getAttribute('data-state'), 'ready', 'grew with the page closed');
  assert.equal(await page.locator('[data-bed="1"]').getAttribute('data-state'), 'wilted', 'wilted, gently');
  assert.equal(await page.locator('#harvest-all').isVisible(), true);
  await page.locator('[data-bed="1"]').click();
  assert.equal(await mangos(), 301, 'a wilted crop pays less, not nothing');
  await page.locator('[data-bed="0"]').click();
  assert.equal(await mangos(), 303);
  assert.equal(await shown(), 303);
  assert.equal(await page.locator('#harvest-all').isVisible(), false);
  assert.deepEqual((await view()).beds, [null, null, null]);

  // The rest of a stage is on the clock: warp past the shelf's window and the sheet follows.
  await page.locator('#open-shop').click();
  await page.locator('#sheet-body .row').first().waitFor();
  const shelf = await page.locator('#sheet-body .row').evaluateAll(rows => rows.map(r => r.dataset.item));
  assert.equal(shelf.length, 3);
  assert.deepEqual(shelf, await page.evaluate(() => conucoDebug.plot.stock().items.map(i => i.id)));
  await page.locator(`#sheet [data-item="${shelf[0]}"] button`).click();
  assert.equal((await view()).seeds[shelf[0]], 1);
  await page.evaluate(hours => conucoDebug.warp(hours), 4 * HOUR);
  await waitFor(page, was => document.querySelector('#sheet-body .row')?.dataset.item !== was || document.querySelectorAll('#sheet-body .row')[1]?.dataset.item !== was, shelf[0]);
  assert.notDeepEqual(await page.locator('#sheet-body .row').evaluateAll(rows => rows.map(r => r.dataset.item)), shelf, 'a new shelf');
  await page.locator('#sheet-close').click();

  // Repair the house: mangos go, a tier and a bed come.
  const before = await mangos();
  await page.locator('#open-house').click();
  await page.locator('#upgrade').click();
  assert.equal((await view()).tier, 2);
  assert.equal(await mangos(), before - 25);
  await waitFor(page, () => document.querySelectorAll('.bed').length === 4);
  await page.locator('#sheet-close').click();

  // A decoration is locked until the rank; then it goes out and stays.
  await page.locator('#open-decor').click();
  assert.equal(await page.locator('#sheet [data-item="palma"] button').count(), 0, 'locked: no button');
  assert.equal(await page.evaluate(() => { conucoDebug.progress.award(40, 'test:xp', { dive: false }); return conucoDebug.plot.isDecorUnlocked('banca'); }), true);
  await page.locator('#sheet-close').click();
  await page.locator('#open-decor').click();
  await page.locator('#sheet [data-item="banca"] button').click();
  assert.deepEqual((await view()).decor, ['banca']);
  await page.locator('#sheet-close').click();

  // Everything is still there after a reload.
  await page.reload();
  await waitFor(page, () => window.conucoDebug?.ui && document.querySelectorAll('.bed').length === 4);
  const after = await view();
  assert.equal(after.tier, 2);
  assert.deepEqual(after.decor, ['banca']);
  assert.equal(after.seeds[shelf[0]], 1);

  // The shared pause menu, with its Instrucciones page.
  await page.keyboard.press('Escape');
  await page.locator('.pana-menu[open]').waitFor();
  await page.keyboard.press('Escape');

  assert.deepEqual(page.errors, []);
  await page.context().close();

  // A phone: nothing overlaps, and a bed button is still a real target.
  const phone = await openGame(browser, 'conuco', { name: 'Bruno', mobile: true, query: 'debug' });
  await waitFor(phone, () => window.conucoDebug?.ui && document.querySelectorAll('.bed').length === 3);
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'no sideways scroll');
  const [top, bar, bed] = await Promise.all([rect(phone, '#status'), rect(phone, '#bar'), rect(phone, '[data-bed="0"]')]);
  assert.equal(overlaps(top, bar), false, 'the top and the bar stay apart');
  assert.equal(overlaps(bed, bar), false, 'the bar leaves the beds free');
  assert.ok(bed.width >= 44 && bed.height >= 28, `bed button ${bed.width}x${bed.height}`);
  await phone.locator('[data-bed="0"]').click();
  await phone.locator('#sheet [data-item="maiz"]').waitFor();
  const sheet = await rect(phone, '#sheet');
  assert.ok(sheet.bottom <= 844 && sheet.right <= 390, 'the sheet fits');
  assert.deepEqual(phone.errors, []);

  console.log('PASS conuco: opens on the plot, offline growth, harvest pays the wallet, house, shelf, decor, reload, phone.');
} finally { await browser.close(); }
