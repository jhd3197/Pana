// Visible navigation, artwork failure, phone layouts and a real two-client room:
// the shared lobby first, then Copa and Taller, and ¡Vámonos! to race.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { backToLobby, hideTaller, leaveLobby, menuStep } from './menu-helpers.js';
import { TRACK_DEFINITIONS } from '../public/track-definitions.js';
const { chromium } = createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH || 'playwright');
const browser = await chromium.launch({ headless: true,
  ...(process.env.PANA_BROWSER_PATH ? { executablePath: process.env.PANA_BROWSER_PATH } : {}) });
const origin = process.env.PANA_TEST_URL || 'http://localhost:8461';
const output = process.env.PANA_TEST_ARTIFACTS || 'art/carreritas-menu/proof';
await mkdir(output, { recursive: true });
const errors = [];
const watch = page => page.on('pageerror', error => errors.push(error.message));
const step = async (page, expected) => assert.equal(await page.locator('#garage').getAttribute('data-menu-step'), expected);
async function load(page, query = '') {
  watch(page);
  await page.goto(`${origin}/g/carreritas/?debug${query}`);
  await page.locator('.menu-flow').waitFor();
  await page.locator('#menu-boot').waitFor({ state: 'hidden', timeout: 120000 });
  await page.waitForFunction(() => document.getElementById('pana-lobby-ready')?.disabled === false, null, { timeout: 120000 });
}
async function fits(page, selector) {
  const box = await page.locator(selector).boundingBox(), view = page.viewportSize();
  assert.ok(box && box.x >= -1 && box.y >= -1 && box.x + box.width <= view.width + 1 && box.y + box.height <= view.height + 1, `${selector} stays on screen`);
}
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await load(page);
  // The lobby holds the race options; ¡Arrancar! moves on to Copa.
  assert.ok(await page.locator('#pana-lobby-shell').isVisible());
  for (const selector of ['#difficulty-pick', '#laps-pick', '#lobby-mirror', '#lobby-split']) assert.ok(await page.locator(selector).isVisible(), `${selector} sits in the lobby`);
  await page.screenshot({ path: `${output}/lobby.png` });
  await leaveLobby(page);
  await step(page, 'track');
  assert.equal(await page.locator('[data-step]').count(), 2, 'Copa and Taller only');
  await menuStep(page, 'car');
  await step(page, 'car');
  assert.ok(await page.locator('#shop').isVisible(), 'the Taller page opens with the taller docked');
  assert.ok(await page.locator('#shop-close').isHidden(), 'the taller is the page: nothing to close');
  assert.equal((await page.locator('#play').textContent()).trim(), '¡Vámonos!');
  await page.screenshot({ path: `${output}/taller.png` });
  await hideTaller(page);
  await page.locator('.car-choice').nth(6).click();
  await page.locator('[data-car-tab="wheels"]').click();
  await page.locator('.wheel-choice').nth(3).click();
  await page.locator('#open-shop').click();
  assert.ok(await page.locator('#shop').isVisible());
  await hideTaller(page);
  await menuStep(page, 'track');
  await step(page, 'track');
  assert.equal(await page.locator('.circuit-choice').count(), TRACK_DEFINITIONS.length);
  for (const button of await page.locator('.circuit-choice').all()) {
    const id = await button.getAttribute('data-circuit');
    await button.click();
    assert.equal(await button.getAttribute('aria-pressed'), 'true');
    await page.waitForFunction(id => {
      const img = document.getElementById('circuit-art');
      return img.src.endsWith(`${id}.webp`) && img.complete && img.naturalWidth > 0;
    }, id);
    if(id==='galipan'){
      await menuStep(page,'car');
      assert.equal(await page.locator('[data-vehicle="air"]').evaluate(b=>b.classList.contains('unused')),false,'flight kit is known before loading scenery');
      assert.equal(await page.locator('[data-vehicle="boat"]').evaluate(b=>b.classList.contains('unused')),true);
      await menuStep(page,'track');
    }
  }
  assert.equal(await page.evaluate(() => !!race.trackGroup), false, 'browsing artwork never constructs scenery');
  for (const id of ['pana', 'aventura', 'agua']) {
    await page.locator(`[data-mode="${id}"]`).click();
    assert.equal(await page.locator('.cup-stage').count(), 4);
    assert.ok(await page.locator('#circuit-grid').isHidden());
    assert.equal(await page.locator('.cup-choice img').count(), 12);
    // Each championship starts at its actual first circuit.
    assert.match(await page.locator('#menu-summary').textContent(), /^Copa/);
  }
  await page.locator('[data-mode="battle"]').click();
  await page.locator('[data-mode="race"]').click();
  await page.locator('[data-circuit="estadio"]').click();
  await page.waitForFunction(() => [...document.querySelectorAll('#circuit-grid img, #mode-pick img')].every(i => i.naturalWidth > 0));
  await page.screenshot({ path: `${output}/circuits.png` });
  await page.locator('#menu-next').click();
  await step(page, 'car');
  assert.match(await page.locator('#menu-summary').textContent(), /La Rumbera/);
  await fits(page, '#play');
  // Cancel a pending real load, then use the visible button to retry it.
  await page.evaluate(async () => { const loading = startRace(6, 'palo'); toGarage(); await loading; });
  await step(page, 'car');
  await page.locator('#play').click();
  await page.waitForFunction(() => ['count', 'go'].includes(race.state), null, { timeout: 120000 });
  assert.equal(await page.evaluate(() => getActiveTrack().id), 'estadio');
  assert.match(await page.locator('#loading-art').getAttribute('src'), /estadio.webp$/);
  assert.ok(await page.locator('#pana-lobby-shell').isHidden(), 'the lobby never shows over the race');
  assert.ok(await page.locator('#shop').isHidden(), 'the taller closes when the race starts');
  // Split screen is a lobby setting for one computer.
  await page.evaluate(() => toGarage());
  await page.locator('#shop').waitFor();   // back on Taller, the taller is open again
  await backToLobby(page);
  await page.locator('#lobby-split [data-choice="true"]').click();
  assert.equal(await page.evaluate(() => setup.split), true);
  await menuStep(page, 'car');
  await page.locator('#play').click();
  await page.waitForFunction(() => !!race.p2, null, { timeout: 120000 });
  await page.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await load(mobile);
  if (await mobile.locator('.pana-rotate').isVisible()) await mobile.locator('[data-act="stay"]').click();
  for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 667, height: 375 }, { width: 320, height: 740 }]) {
    await mobile.setViewportSize(size);
    // Orientation media-query notifications arrive after the viewport command.
    await mobile.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    if (await mobile.locator('.pana-rotate').isVisible()) await mobile.locator('[data-act="stay"]').click();
    for (const name of ['car', 'track']) {
      await menuStep(mobile, name);
      await fits(mobile, name === 'car' ? '#menu-summary' : '[data-step="track"]');
      if (name === 'car') {
        await fits(mobile, '#play');
        const panels=await mobile.evaluate(()=>{
          const stats=document.querySelector('.tl-stats').getBoundingClientRect(),slots=document.getElementById('shop-tabs').getBoundingClientRect();
          return {statsBottom:stats.bottom,slotsTop:slots.top,height:document.getElementById('shop').getBoundingClientRect().height};
        });
        assert.ok(panels.height>=size.height-2,'the workshop fills the phone screen');
        assert.ok(panels.statsBottom<=panels.slotsTop,'stats never cover the part slots');
      }
      assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await mobile.screenshot({ path: `${output}/${size.width}-${name}.png` });
    }
  }
  await mobile.close();

  const fallback = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  await fallback.route('**/images/menu/**', route => route.abort());
  await load(fallback, '&manual');
  await leaveLobby(fallback);
  await fallback.locator('[data-circuit="plaza"]').click();
  assert.equal(await fallback.locator('#track-name').textContent(), 'Plaza Pana');
  await fallback.locator('#menu-next').click();
  assert.ok(await fallback.locator('#play').isEnabled());
  await fallback.locator('#play').click();
  await fallback.waitForFunction(() => race.state === 'count', null, { timeout: 120000 });
  await fallback.close();

  // A room: the guest waits in the lobby until the host's ¡Arrancar!, then
  // follows to Copa (the host picks) and Taller.
  const host = await browser.newPage(), guest = await browser.newPage();
  await host.addInitScript(() => localStorage.setItem('pana:name', 'Pana Con Un Nombre Bastante Largo'));
  await load(host, '&manual');
  await host.locator('#go-online').click();
  await host.waitForFunction(() => getNet()?.isHost);
  const code = await host.evaluate(() => getNet().code);
  assert.ok(await host.locator('#lobby-split').isVisible(), 'alone in the room, split screen is still a setting');
  await load(guest, `&manual&room=${code}`);
  await guest.waitForFunction(() => getNet()?.state.players.length === 2);
  await host.waitForFunction(() => getNet()?.state.players.length === 2);
  await host.waitForFunction(() => document.getElementById('split').closest('label').hidden);
  assert.ok(await guest.locator('#start').isDisabled(), 'only the host starts');
  assert.ok(await host.locator('#lobby-solo').isHidden(), 'no "correr solo": alone in the room is solo');
  assert.match(await guest.locator('#start').textContent(), /Esperando a/);
  assert.ok(await guest.locator('[data-difficulty="facil"]').isDisabled());
  await leaveLobby(host);
  await guest.locator('#pana-lobby-shell').waitFor({ state: 'hidden' });
  await step(guest, 'track');
  assert.ok(await guest.locator('[data-circuit="plaza"]').isDisabled());
  assert.ok(await guest.locator('#menu-back').isHidden(), 'a guest cannot take the room back to the lobby');
  await host.locator('[data-circuit="plaza"]').click();
  await guest.waitForFunction(() => document.getElementById('track-name').textContent === 'Plaza Pana');
  await host.locator('#menu-next').click();
  await guest.locator('#menu-next').click();
  await guest.evaluate(()=>{getWallet().coins=500;});
  await guest.locator('[data-vehicle="boat"]').click();
  await guest.locator('[data-tab="carro"]').click();
  await guest.locator('#shop-boat [data-id="rayo"]').click();
  await guest.locator('#loadout-back').click();
  await guest.locator('[data-vehicle="car"]').click();
  await hideTaller(guest);
  await guest.locator('.car-choice').nth(2).click();
  assert.ok(await guest.locator('#play').isDisabled());
  await guest.setViewportSize({ width: 320, height: 740 });
  await fits(guest, '#play');
  await guest.screenshot({ path: `${output}/guest-room-320.png` });
  await host.locator('#play').click();
  await host.locator('#parrilla.preparing').waitFor({timeout:120000});
  assert.equal(await host.locator('#loading').isVisible(),false,'the actual 3D race replaces the loading backdrop');
  assert.equal(await host.locator('#garage').isVisible(),false,'garage navigation and car choices stay out of the starting grid');
  assert.equal(await host.locator('#parrilla #grid-count').count(),1,'one presentation countdown');
  assert.equal(await host.locator('#parrilla').getAttribute('data-pad-menu'),'','controller focus stays inside the starting grid');
  await host.locator('#parrilla details summary').nth(1).click();
  await host.locator('#parrilla [data-copy=kit]').click();
  assert.ok(await host.evaluate(()=>JSON.parse(localStorage.getItem('carreritas:wishlist')).entries.length>=6),'the inspected kit is marked for the next workshop');
  if(await host.locator('.grid-ready').isVisible())await host.locator('.grid-ready').click();
  if(await guest.locator('.grid-ready').isVisible())await guest.locator('.grid-ready').click();
  await Promise.all([host, guest].map(p => p.waitForFunction(() => race.cars.length === 4 && ['count', 'go'].includes(race.state), null, { timeout: 120000 })));
  assert.equal(await guest.evaluate(() => race.player.def.name), 'El Machito');
  const guestId=await guest.evaluate(()=>getNet().id);
  assert.equal(await host.evaluate(id=>race.cars.find(c=>c.netId===id).cosmetics.boat,guestId),'rayo','guest kit is carried to the host race');
  assert.equal(await guest.locator('#parrilla').isVisible(),true,'manual countdown displays the starting grid');
  assert.ok(await guest.locator('#parrilla .nivel-badge').count()>=4);

  await host.close(); await guest.close();
  assert.deepEqual(errors, []);
  console.log('Lobby menu: lobby options, Copa, Taller and ¡Vámonos!, all registered maps, three cups, tires, shop, split, loading, mobile, missing artwork and two-client room passed.');
} finally { await browser.close(); }
