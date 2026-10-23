import assert from 'node:assert/strict';
import { launch, openGame } from '../../../tests/browser-kit.js';
import { menuStep } from './menu-helpers.js';

const browser = await launch();
try {
  const page = await openGame(browser, 'carreritas', { query: 'debug&manual&track=estadio' });
  await page.locator('.prototype-sala').waitFor();
  const bounds = async selector => {
    await page.waitForFunction(selector => {
      const e = document.querySelector(selector), r = e.getBoundingClientRect();
      return r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1
        && e.scrollWidth <= e.clientWidth + 1 && e.scrollHeight <= e.clientHeight + 1;
    }, selector);
  };
  for (const width of [1440, 1920, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await bounds('#pana-lobby-shell');
    for (const selector of ['.pk-game-lobby-roster', '.pk-game-lobby-settings']) await bounds(selector);
  }
  await menuStep(page, 'car');
  for (const size of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(size);
    for (const tab of ['carro', 'ruedas', 'pintura', 'sonido']) {
      await page.locator(tab === 'carro' ? '#loadout-garage' : `[data-tab=${tab}]`).click();
      await bounds('#loadout-drawer');
      if (tab === 'carro') {
        assert.equal(await page.locator('#shop-car .shop-item small, #shop-car .pills').count(), 0, 'car cards omit descriptions and comparison chips');
        assert.equal(await page.locator('#shop-car .shop-item:not([hidden])').evaluateAll(items => new Set(items.map(e => Math.round(e.getBoundingClientRect().top))).size), 1, 'cars stay in one row');
      }
      if (tab === 'sonido') assert.deepEqual(await page.locator('#shop-body .shop-item').evaluateAll(items => [...new Set(items.map(i => i.dataset.kind))]), ['horn']);
      if (tab === 'pintura') {
        await page.locator('.option-categories [data-kind=flame]').click();
        assert.ok(await page.locator('#shop-flame').isVisible());
        await page.locator('.option-categories [data-kind=paint]').click();
        assert.equal(await page.locator('#shop-paint .shop-item:not([hidden])').evaluateAll(items => new Set(items.map(e => Math.round(e.getBoundingClientRect().top))).size), 1, 'colors stay in one row');
      }
      const seen = new Set();
      while (true) {
        await bounds('#loadout-drawer');
        for (const id of await page.locator('.shop-group:not([hidden]) .shop-item:not([hidden])').evaluateAll(items => items.map(i => i.dataset.id))) seen.add(id);
        const next = page.locator('[data-page=next]');
        if (!await next.isVisible() || await next.isDisabled()) break;
        await next.click();
      }
      assert.equal(seen.size, await page.locator('.shop-group:not([hidden]) .shop-item').count(), 'every option is reachable without scrolling');
      await page.locator('#loadout-back').click();
    }
  }
  assert.deepEqual(page.errors, []);
  console.log('PASS bounded lobby, readable paged options and separate horn/flame categories');
} finally { await browser.close(); }
