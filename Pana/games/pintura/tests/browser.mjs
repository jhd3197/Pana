import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH || 'playwright');
const base = process.env.PANA_TEST_URL || 'http://localhost:8461', code = `paint-${Date.now()}`, errors = [];
const browser = await chromium.launch({ headless: true, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const out = 'Pana/games/pintura/qa'; await mkdir(out, { recursive: true });
const wait = (p, fn, arg, timeout = 60000) => p.waitForFunction(fn, arg, { timeout });
async function open(name, room = code, mobile = false) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  await context.addInitScript(name => { localStorage.setItem('pana:name', name); localStorage.setItem('pana:settings', JSON.stringify({ sound: false, quality: 'baja' })); localStorage.setItem('pana:avatar', JSON.stringify({ outfit: 'hoodie', outfitColor: '#3775cc', hat: 'gorra' })); }, name);
  const p = await context.newPage(); p.on('pageerror', e => errors.push(e.message)); await p.goto(`${base}/g/pintura/?room=${room}&debug`, { waitUntil: 'domcontentloaded' });
  // Prepared, not just connected: the shared lobby docks the menu until the scene is ready.
  await wait(p, () => window.pinturaDebug?.room.connected && pinturaDebug.room.id && window.PANA_PREPARED === true, undefined, 120000); return p;
}
try {
  if (process.env.PANA_BROWSER_MOBILE_ONLY !== '1') {
  const a = await open('Juan'), b = await open('María'); await wait(a, () => pinturaDebug.room.state.players.length === 2);
  assert.equal(await a.evaluate(() => pinturaDebug.world.camera.isPerspectiveCamera), true);
  assert.ok(await b.locator('#start').isDisabled()); await wait(a, () => pinturaDebug.world.avatars.size === 2);
  await a.screenshot({ path: `${out}/lobby.png` }); await a.locator('#start').click(); await wait(b, () => pinturaDebug.room.state.phase === 'playing');
  // This long cross-court shot uses the player's overview option. The follow
  // camera and camera-relative touch movement are covered below and in 3d.browser.
  for (const p of [a, b]) {
    await p.locator('#menu').click(); await p.locator('#pana-tab-settings').click();
    await p.locator('#pana-opt-view').getByRole('radio', { name: 'Ver la cancha', exact: true }).click(); await p.keyboard.press('Escape');
  }
  await b.keyboard.press('Tab'); await b.locator('#world').click({ position: { x: 640, y: 400 } });
  await b.keyboard.down('w'); await wait(b, () => pinturaDebug.room.state.players.find(p => p.id === pinturaDebug.room.id).z < -13.5); await b.keyboard.up('w');
  await wait(b, () => !pinturaDebug.room.state.players.find(p => p.id === pinturaDebug.room.id).walk);
  const guest = await b.evaluate(() => pinturaDebug.room.state.players.find(p => p.id === pinturaDebug.room.id));
  await wait(a, id => pinturaDebug.room.state.players.find(p => p.id === id)?.z < -13.5, guest.id);
  const target = await a.evaluate(p => pinturaDebug.world.screen(p.x, p.z), guest); await a.mouse.move(target.x, target.y); await a.mouse.down();
  await wait(a, () => pinturaDebug.room.state.players.find(p => p.id === pinturaDebug.room.id).score > 0); await a.mouse.up();
  await wait(b, () => pinturaDebug.room.state.players.find(p => p.id === pinturaDebug.room.id).hits > 0);
  console.log('ok: real guest movement and host aim/fire produce a server-confirmed hit on both clients');
  await a.screenshot({ path: `${out}/playing.png` });
  await wait(b, () => !pinturaDebug.room.state.players.find(p => p.id === pinturaDebug.room.id).respawn);
  await a.close(); await wait(b, () => pinturaDebug.room.isHost); const before = await b.evaluate(() => pinturaDebug.room.state.time); await b.waitForTimeout(700); assert.ok(await b.evaluate(() => pinturaDebug.room.state.time) < before);
  const c = await open('Luis'); await wait(c, () => pinturaDebug.room.state.phase === 'playing'); assert.equal(await c.evaluate(() => pinturaDebug.room.state.round), 1);
  console.log('ok: respawn, host departure and late arrival preserve the running round');
  // The real round clock or a player reaching ten ends this without a debug server mutation.
  await wait(b, () => pinturaDebug.room.state.phase === 'finished', undefined, 210000); await wait(c, () => pinturaDebug.room.state.phase === 'finished');
  const scores = await b.evaluate(() => pinturaDebug.room.state.players.map(p => [p.id, p.score])); assert.deepEqual(await c.evaluate(() => pinturaDebug.room.state.players.map(p => [p.id, p.score])), scores);
  await b.screenshot({ path: `${out}/results.png` }); await b.locator('#again').click(); await wait(c, () => pinturaDebug.room.state.round === 2 && pinturaDebug.room.state.phase === 'playing');
  console.log('ok: real round end agrees across clients and the new host starts a clean rematch');
  await b.close(); await c.close();
  }
  const m = await open('Móvil', `${code}-mobile`, true); await m.screenshot({ path: `${out}/mobile-lobby.png` }); await m.locator('#practice').tap();
  await wait(m, () => pinturaDebug.room.local && pinturaDebug.room.state.phase === 'playing'); assert.ok(await m.locator('#fire').isVisible());
  // A bot's hit would respawn the pana elsewhere mid-check: shield it while touch movement is measured.
  await wait(m, () => pinturaDebug.room.game.players[0].respawn === 0);
  await m.evaluate(() => { pinturaDebug.room.game.players[0].shield = 30; });
  const start = await m.evaluate(() => { const p = pinturaDebug.room.state.players[0]; return { x: p.x, z: p.z, direction: pinturaDebug.world.movement(1, 0) }; });
  // Hold until the pana has moved (state, not a fixed sleep), then release.
  await m.locator('#right').dispatchEvent('pointerdown', { pointerId: 9, pointerType: 'touch', button: 0, buttons: 1 });
  // Measure along the input the pad actually sent: the camera's yaw (and so the
  // pad's world direction) is only known once the first playing frame drew.
  await wait(m, start => { const p = pinturaDebug.room.state.players[0], c = pinturaDebug.room.current; return (c.x || c.z) && (p.x - start.x) * c.x + (p.z - start.z) * c.z > .1; }, start, 20000);
  await m.locator('#right').dispatchEvent('pointerup', { pointerId: 9, pointerType: 'touch', button: 0 });
  await m.locator('#fire').tap(); await m.screenshot({ path: `${out}/mobile-playing.png` });
  for (const id of ['fire', 'up', 'reload']) { const box = await m.locator(`#${id}`).boundingBox(); assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= 391 && box.y + box.height <= 845); }
  await m.locator('#menu').tap(); const time = await m.evaluate(() => pinturaDebug.room.state.time); await m.waitForTimeout(400); assert.equal(await m.evaluate(() => pinturaDebug.room.state.time), time); await m.locator('#pana-resume').tap();
  assert.equal(await m.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); await m.setViewportSize({ width: 844, height: 390 }); await m.screenshot({ path: `${out}/mobile-landscape.png` });
  for (const id of ['fire', 'up', 'reload']) { const box = await m.locator(`#${id}`).boundingBox(); assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= 845 && box.y + box.height <= 391); }
  console.log('ok: touch movement/fire, local pause and both phone orientations'); assert.deepEqual(errors, []); console.log('Paintball browser proof passed.');
} catch (error) {
  for (const context of browser.contexts()) for (const page of context.pages()) {
    console.log(await page.evaluate(() => window.pinturaDebug ? { id: pinturaDebug.room.id, input: pinturaDebug.input(), state: pinturaDebug.room.state } : 'Game not loaded').catch(() => 'Page closed'));
    await page.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  }
  console.log(errors); throw error;
} finally { await browser.close(); }
