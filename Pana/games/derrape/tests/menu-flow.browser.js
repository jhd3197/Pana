// Visible navigation, artwork failure, phone layouts and a real two-client room.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { menuStep } from './menu-helpers.js';
const { chromium } = createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH || 'playwright');
const browser = await chromium.launch({ headless: true,
  ...(process.env.PANA_BROWSER_PATH ? { executablePath: process.env.PANA_BROWSER_PATH } : {}) });
const origin = process.env.PANA_TEST_URL || 'http://localhost:8461';
const output = process.env.PANA_TEST_ARTIFACTS || 'art/derrape-menu/proof';
await mkdir(output, { recursive: true });
const errors = [];
const watch = page => page.on('pageerror', error => errors.push(error.message));
const step = async (page, expected) => assert.equal(await page.locator('#garage').getAttribute('data-menu-step'), expected);
async function load(page, query = '') {
  watch(page);
  await page.goto(`${origin}/g/derrape/?debug${query}`);
  await page.locator('.menu-flow').waitFor();
}
async function fits(page, selector) {
  const box = await page.locator(selector).boundingBox(), view = page.viewportSize();
  assert.ok(box && box.x >= -1 && box.y >= -1 && box.x + box.width <= view.width + 1 && box.y + box.height <= view.height + 1, `${selector} stays on screen`);
}
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  watch(page);
  let releaseStartup;
  const startup = new Promise(resolve => { releaseStartup = resolve; });
  await page.route('**/derrape/game.js', async route => { await startup; await route.continue(); });
  await page.goto(`${origin}/g/derrape/?debug`, { waitUntil: 'commit' });
  await page.locator('#menu-boot').waitFor();
  await page.waitForFunction(() => document.querySelector('#menu-boot img').naturalWidth > 0);
  await page.screenshot({ path: `${output}/startup.png` });
  releaseStartup();
  await page.locator('.menu-flow').waitFor();
  assert.equal(await page.locator('#menu-boot').count(), 0);
  await step(page, 'welcome');
  await page.waitForFunction(() => document.querySelector('.festival-art').classList.contains('is-layered'));
  await page.mouse.move(1250, 600);
  assert.notEqual(await page.locator('.festival-art').evaluate(el => el.style.getPropertyValue('--mx')), '0');
  await page.screenshot({ path: `${output}/welcome.png` });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => !document.querySelector('.festival-art').classList.contains('is-layered'));
  await page.locator('#play-solo').focus();
  await page.keyboard.press('Enter');
  await step(page, 'car');
  await page.locator('.car-choice').nth(6).click();
  await page.locator('[data-car-tab="wheels"]').click();
  await page.locator('.wheel-choice').nth(3).click();
  await page.locator('#open-shop').click();
  assert.ok(await page.locator('#shop').isVisible());
  await page.locator('#shop-close').click();
  await page.locator('#menu-next').click();
  await step(page, 'track');
  assert.equal(await page.locator('.circuit-choice').count(), 12);
  for (const button of await page.locator('.circuit-choice').all()) {
    const id = await button.getAttribute('data-circuit');
    await button.click();
    assert.equal(await button.getAttribute('aria-pressed'), 'true');
    await page.waitForFunction(id => {
      const img = document.getElementById('circuit-art');
      return img.src.endsWith(`${id}.webp`) && img.complete && img.naturalWidth > 0;
    }, id);
  }
  assert.equal(await page.evaluate(() => !!race.trackGroup), false, 'browsing artwork never constructs scenery');
  for (const id of ['pana', 'aventura', 'agua']) {
    await page.locator(`[data-mode="${id}"]`).click();
    assert.equal(await page.locator('.cup-stage').count(), 4);
    assert.ok(await page.locator('#circuit-grid').isHidden());
    await page.locator('.cup-stage').nth(2).click();
    await page.locator('#menu-next').click();
    // Previewing stage three does not change where a championship begins.
    assert.match(await page.locator('#ready-route').textContent(), /La primera parada:/);
    await page.locator('#menu-back').click();
  }
  await page.locator('[data-mode="battle"]').click();
  await page.locator('[data-mode="race"]').click();
  await page.locator('[data-circuit="estadio"]').click();
  await page.waitForFunction(() => [...document.querySelectorAll('#circuit-grid img, #mode-pick img')].every(i => i.naturalWidth > 0));
  await page.screenshot({ path: `${output}/circuits.png` });
  await page.locator('#menu-next').click();
  await step(page, 'ready');
  assert.equal(await page.locator('#ready-car').textContent(), 'La Rumbera');
  assert.match(await page.locator('#ready-wheels').textContent(), /palo/i);
  await fits(page, '#play');
  await page.screenshot({ path: `${output}/ready.png` });
  // Cancel a pending real load, then use the visible button to retry it.
  await page.evaluate(async () => { const loading = startRace(6, 'palo'); toGarage(); await loading; });
  await step(page, 'ready');
  await page.locator('#play').click();
  await page.waitForFunction(() => ['count', 'go'].includes(race.state), null, { timeout: 120000 });
  assert.equal(await page.evaluate(() => getActiveTrack().id), 'estadio');
  assert.match(await page.locator('#loading-art').getAttribute('src'), /estadio.webp$/);
  await page.evaluate(() => toGarage());
  await menuStep(page, 'welcome');
  await page.locator('#play-together').click();
  assert.equal(await page.evaluate(() => setup.split), true);
  await menuStep(page, 'ready');
  await page.locator('#play').click();
  await page.waitForFunction(() => !!race.p2, null, { timeout: 120000 });
  await page.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await load(mobile);
  if (await mobile.locator('.pana-rotate').isVisible()) await mobile.locator('[data-act="stay"]').click();
  assert.equal(await mobile.locator('.festival-layer').count(), 0, 'reduced-motion touch devices only load the complete illustration');
  for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 667, height: 375 }, { width: 320, height: 740 }]) {
    await mobile.setViewportSize(size);
    // Orientation media-query notifications arrive after the viewport command.
    await mobile.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    if (await mobile.locator('.pana-rotate').isVisible()) await mobile.locator('[data-act="stay"]').click();
    for (const name of ['welcome', 'car', 'track', 'ready']) {
      await menuStep(mobile, name);
      await fits(mobile, `[data-step="${name}"]`);
      if (name === 'ready') await fits(mobile, '#play');
      assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await mobile.screenshot({ path: `${output}/${size.width}-${name}.png` });
    }
  }
  await mobile.close();

  const fallback = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  await fallback.route('**/images/menu/**', route => route.abort());
  await load(fallback, '&manual');
  await fallback.locator('#play-solo').click();
  await fallback.locator('#menu-next').click();
  await fallback.locator('[data-circuit="plaza"]').click();
  assert.equal(await fallback.locator('#track-name').textContent(), 'Plaza Pana');
  await fallback.locator('#menu-next').click();
  assert.ok(await fallback.locator('#play').isEnabled());
  await fallback.locator('#play').click();
  await fallback.waitForFunction(() => race.state === 'count', null, { timeout: 120000 });
  await fallback.close();

  const host = await browser.newPage(), guest = await browser.newPage();
  await host.addInitScript(() => localStorage.setItem('pana:name', 'Pana Con Un Nombre Bastante Largo'));
  await load(host, '&manual');
  await host.locator('#go-online').click();
  await host.waitForFunction(() => getNet()?.isHost);
  const code = await host.evaluate(() => getNet().code);
  await load(guest, `&manual&room=${code}`);
  await guest.waitForFunction(() => getNet()?.state.players.length === 2);
  await host.waitForFunction(() => getNet()?.state.players.length === 2);
  await guest.locator('.car-choice').nth(2).click();
  await menuStep(host, 'track');
  await menuStep(guest, 'track');
  assert.ok(await guest.locator('[data-circuit="plaza"]').isDisabled());
  await host.locator('[data-circuit="plaza"]').click();
  await guest.waitForFunction(() => document.getElementById('track-name').textContent === 'Plaza Pana');
  await host.locator('#menu-next').click();
  await guest.locator('#menu-next').click();
  assert.equal(await host.locator('#lobby-roster li').count(), 2);
  assert.ok(await guest.locator('#play').isDisabled());
  assert.ok(await guest.locator('[data-difficulty="facil"]').isDisabled());
  await guest.setViewportSize({ width: 320, height: 740 });
  await fits(guest, '#play');
  await guest.screenshot({ path: `${output}/guest-room-320.png` });
  await host.locator('#play').click();
  await Promise.all([host, guest].map(p => p.waitForFunction(() => race.cars.length === 4 && ['count', 'go'].includes(race.state), null, { timeout: 120000 })));
  assert.equal(await guest.evaluate(() => race.player.def.name), 'El Machito');
  await host.close(); await guest.close();
  assert.deepEqual(errors, []);
  console.log('Illustrated menu: solo, split, twelve maps, three cups, tires, shop, keyboard, loading, mobile, reduced motion, missing artwork and two-client room passed.');
} finally { await browser.close(); }
