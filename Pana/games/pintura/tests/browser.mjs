import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH || 'playwright');
const base = process.env.PANA_TEST_URL || 'http://localhost:8461', code = `paint-${Date.now()}`, errors = [];
const browser = await chromium.launch({ headless: true, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const out = 'Pana/games/pintura/qa'; await mkdir(out, { recursive: true });
const wait = (p, fn, arg, timeout = 60000) => p.waitForFunction(fn, arg, { timeout });
const mine = 'pinturaDebug.room.state.players.find(p => p.id === pinturaDebug.room.id)';
async function walk(p, key, until) { await p.keyboard.down(key); await wait(p, `${mine}.${until}`); await p.keyboard.up(key); }
// Spawns are drawn per round. From any plaza spawn: out to the clear lane past
// |24| round the court, along it to its south side (z < -25.5), then to x. Keys
// move along world axes (the overview, or first person facing yaw 0).
// edge: x is a wall to press against (the court ends near |26.4|), so walk on until past it;
// otherwise x only needs to be near.
async function toSouthLane(p, x, edge = false) {
  const at = () => p.evaluate(`(({ x, z }) => ({ x, z }))(${mine})`);
  let me = await at();
  if (Math.abs(me.z) >= Math.abs(me.x)) await walk(p, me.z < 0 ? 'w' : 's', me.z < 0 ? 'z < -24' : 'z > 24');
  else await walk(p, me.x < 0 ? 'a' : 'd', me.x < 0 ? 'x < -24' : 'x > 24');
  me = await at();
  if (me.z > -24) {
    // From the far x side, the lane itself leads south; from the north, cross to x's side first.
    if (Math.abs(me.x) < 24 || Math.sign(me.x) === Math.sign(x)) await walk(p, x < 0 ? 'a' : 'd', x < 0 ? 'x < -24.5' : 'x > 24.5');
    await walk(p, 'w', 'z < -25.5');
  }
  me = await at();
  if (edge) { if (x > 0 ? me.x <= x : me.x >= x) await walk(p, x > 0 ? 'd' : 'a', x > 0 ? `x > ${x}` : `x < ${x}`); }
  else if (Math.abs(me.x - x) > 1) await walk(p, me.x < x ? 'd' : 'a', me.x < x ? `x > ${x}` : `x < ${x}`);
  await walk(p, 'w', 'z < -25.5');
}
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
  // Guest-authored loadout travels through the real room and remains server-owned.
  await b.locator('#open-armory').click();
  await b.locator('[data-slot="weapon"]').click();
  await b.locator('#armory-choices [data-id="rocket"]').click();
  await b.locator('#armory-parts-back').click();
  await b.locator('[data-slot="attachments"]').first().click();
  await b.locator('#armory-choices [data-id="hopper"]').click();
  await b.locator('#armory-choices [data-id="barrel"]').click();
  assert.equal(await b.locator('#armory-choices [data-id="stock"]').isDisabled(),true);
  await b.locator('#armory-parts-back').click();
  await b.locator('[data-slot="armor"]').click();await b.locator('#armory-choices [data-id="padded"]').click();
  await b.locator('#armory-parts-back').click();
  await b.locator('[data-slot="grenade"]').click();await b.locator('#armory-choices [data-id="pegajosa"]').click();
  await b.locator('#armory-close').click();
  const guestId=await b.evaluate(()=>pinturaDebug.room.id);
  await wait(a,id=>{const p=pinturaDebug.room.state.players.find(p=>p.id===id);return p.kit.weapon==='rocket' && p.kit.attachments.length===2 && p.kit.armor==='padded' && p.kit.grenade==='pegajosa';},guestId);
  // The routes below walk the plaza's outer lane; El Puerto is the default map.
  await a.evaluate(() => pinturaDebug.room.selectMap('plaza')); await wait(b, () => pinturaDebug.room.state.mapId === 'plaza');
  await a.screenshot({ path: `${out}/lobby.png` }); await a.locator('#start').click(); await wait(b, () => pinturaDebug.room.state.phase === 'playing');
  // Both clients load the court, then the room counts 3-2-1: input only counts after ¡YA!
  await wait(b, () => { const s = pinturaDebug.room.state; return !s.loading && !s.countdown; });
  assert.equal(await a.evaluate(() => pinturaDebug.world.view), 'primera');
  await b.evaluate(()=>pinturaDebug.room.selectKit({weapon:'rapid',armor:'wind'}));
  await b.locator('#world').focus();await b.keyboard.press('g');
  await wait(a,id=>!pinturaDebug.room.state.players.find(p=>p.id===id).grenadeReady,guestId);
  assert.equal(await a.evaluate(id=>pinturaDebug.room.state.players.find(p=>p.id===id).kit.weapon,guestId),'rocket','mid-round kit edit is rejected');
  console.log('ok: armory choices replicate, two-attachment cap, one grenade and mid-round kit lock');

  // The guest crosses the court with the overview option (world-axis keys); the
  // host plays the default first-person view: turn, walk, then fire along the crosshair.
  await b.locator('#menu').click(); await b.locator('#pana-tab-settings').click();
  await b.locator('.pana-settings-nav button', { hasText: 'Pepazo' }).click();
  await b.locator('#pana-opt-view').getByRole('radio', { name: 'Ver la cancha', exact: true }).click(); await b.keyboard.press('Escape');
  await b.locator('#world').focus(); await toSouthLane(b, 26, true);
  await wait(b, `!${mine}.walk`);
  await a.locator('#world').focus(); await a.evaluate(() => pinturaDebug.world.look(-pinturaDebug.world.yaw)); await toSouthLane(a, -10);
  const guest = await b.evaluate(() => pinturaDebug.room.state.players.find(p => p.id === pinturaDebug.room.id));
  await wait(a, id => { const g = pinturaDebug.room.state.players.find(p => p.id === id); return g.x > 26 && g.z < -25.5; }, guest.id);
  await a.evaluate(id => { const { room, world } = pinturaDebug, me = room.state.players.find(p => p.id === room.id), g = room.state.players.find(p => p.id === id); world.look(Math.atan2(-(g.x - me.x), -(g.z - me.z)) - world.yaw); }, guest.id);
  // Space hops (server-side), up and back down, before the duel.
  await a.keyboard.press(' '); await wait(a, `${mine}.jumpHeight > .2`); await wait(a, `${mine}.jumpHeight === 0`);
  await a.keyboard.down('Enter');
  // The first confirmed hit raises the feat toast (¡Pintaste a…!, then ¡Doble!/¡Triple pintada!).
  await wait(a, () => /Pintaste|pintada/.test(document.getElementById('toast').textContent));
  await wait(a, `${mine}.score > 0`); await a.keyboard.up('Enter');
  await wait(b, `${mine}.hits > 0`);
  await wait(a, id => !!pinturaDebug.world.avatars.get(id)?.knockout, guest.id);
  assert.equal(await a.evaluate(id => pinturaDebug.world.avatars.get(id).knockout.physics.points.every(p => Number.isFinite(p.x+p.y+p.z)), guest.id), true);
  const impact = await b.evaluate(() => pinturaDebug.room.state.players.find(p=>p.id===pinturaDebug.room.id).impact);
  assert.ok(Math.abs(Math.hypot(impact.x,impact.z)-1)<1e-6);
  console.log('ok: authoritative impact drives finite own-pana knockout physics');
  console.log('ok: real guest movement and first-person host aim/fire produce a server-confirmed hit on both clients, with the feat toast');
  await a.screenshot({ path: `${out}/playing.png` });
  await wait(b, () => !pinturaDebug.room.state.players.find(p => p.id === pinturaDebug.room.id).respawn);
  assert.equal(await b.evaluate(() => pinturaDebug.world.avatars.get(pinturaDebug.room.id).knockout), null);
  await a.close(); await wait(b, () => pinturaDebug.room.isHost); const before = await b.evaluate(() => pinturaDebug.room.state.time); await b.waitForTimeout(700); assert.ok(await b.evaluate(() => pinturaDebug.room.state.time) < before);
  const c = await open('Luis'); await wait(c, () => pinturaDebug.room.state.phase === 'playing'); assert.equal(await c.evaluate(() => pinturaDebug.room.state.round), 1);
  console.log('ok: respawn, host departure and late arrival preserve the running round');
  // The real round clock or a player reaching ten ends this without a debug server mutation.
  await wait(b, () => pinturaDebug.room.state.phase === 'finished', undefined, 210000); await wait(c, () => pinturaDebug.room.state.phase === 'finished');
  const scores = await b.evaluate(() => pinturaDebug.room.state.players.map(p => [p.id, p.score])); assert.deepEqual(await c.evaluate(() => pinturaDebug.room.state.players.map(p => [p.id, p.score])), scores);
  await b.screenshot({ path: `${out}/results.png` }); await b.locator('#again').click(); await wait(c, () => pinturaDebug.room.state.phase === 'lobby');
  // Back in the lobby the host picks the next map, and the next round plays it.
  assert.ok(await b.locator('#map-choice').isEnabled());
  await b.evaluate(() => pinturaDebug.room.selectMap('muelle')); await wait(c, () => pinturaDebug.room.state.mapId === 'muelle');
  await b.locator('#start').click(); await wait(c, () => pinturaDebug.room.state.round === 2 && pinturaDebug.room.state.phase === 'playing' && pinturaDebug.room.state.mapId === 'muelle');
  console.log('ok: real round end agrees across clients, Otra ronda returns to the lobby and the next map is the host\'s pick');
  await b.close(); await c.close();
  }
  const m = await open('Móvil', `${code}-mobile`, true); await m.screenshot({ path: `${out}/mobile-lobby.png` }); await m.locator('#practice').tap();
  await wait(m, () => pinturaDebug.room.local && pinturaDebug.room.state.phase === 'playing' && !pinturaDebug.room.state.loading && !pinturaDebug.room.state.countdown); assert.ok(await m.locator('#fire').isVisible());
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
