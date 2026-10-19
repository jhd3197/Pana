// Real browser integration QA against the existing local server.
// node browser.mjs [absolute-playwright-package] [optional-chromium-executable]
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const require = createRequire(import.meta.url), { chromium } = require(process.argv[2] || 'playwright');
const base = process.env.PANA_QA_URL || 'http://localhost:8461', output = process.env.PANA_QA_OUTPUT;
if (output) await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}) });
const errors = [], room = `cocina-qa-${Date.now().toString(36)}`;
const check = text => console.log(`ok  ${text}`);
async function page(name, mobile = false, code = room) {
  // Three simultaneous software-rendered clients can starve the input relay.
  // Compact desktops reduce pixel work while retaining real rendering and input.
  const desktop = process.env.PANA_QA_COMPACT === '0' ? { width: 1440, height: 900 } : { width: 900, height: 650 };
  const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: desktop });
  await ctx.addInitScript(() => localStorage.setItem('pana:settings', JSON.stringify({ quality: 'baja' })));
  const p = await ctx.newPage(); p.on('pageerror', e => errors.push(`${name}: ${e.message}`));
  const timeout = Number(process.env.PANA_QA_TIMEOUT) || 120000;
  await p.goto(`${base}/g/cocina/?name=${name}&room=${code}&debug`, { waitUntil: 'domcontentloaded', timeout });
  await p.waitForFunction(() => window.cocina?.room.connected && window.PANA_LOBBY_LOADING === false, null, { timeout }); return p;
}
async function position(host, id, station) {
  await host.evaluate(({ id, station }) => { const s = cocina.STATIONS.find(s => s.id === station); cocina.place(id, s.x, s.z + s.d / 2 + 0.65); cocina.room.game.players.find(p => p.id === id).cooldown = 0; }, { id, station });
}
async function held(p, stage) { await p.waitForFunction(stage => { const held = cocina.state.players.find(p => p.id === cocina.room.id)?.held; return stage ? held?.stage === stage : !held; }, stage); }
try {
  const a = await page('Juan'), b = await page('Ana');
  await a.waitForFunction(() => cocina.room.members.size === 2); await b.waitForFunction(() => cocina.state.players.length === 2);
  assert.equal(await b.locator('#start').isDisabled(), true); check('two browsers share a lobby; only host can start');
  if (output) await a.screenshot({ path: path.join(output, 'cocina-lobby.png') });
  await a.locator('#pana-room-more').click(); await a.locator('[data-room-option="helpers"][data-value="false"]').click(); await a.locator('#pana-room-done').click(); await a.locator('#start').click(); await b.waitForFunction(() => cocina.state.phase === 'playing');
  // Three software-rendered clients can outlast the normal three-minute round.
  // Keep this interaction fixture alive; the results check below ends it explicitly.
  await a.evaluate(() => { cocina.room.game.remaining = 600; cocina.room.publish(); });
  const ids = await a.evaluate(() => ({ host: cocina.room.id, guest: cocina.state.players.find(p => p.id !== cocina.room.id).id }));
  const initial = await b.evaluate(() => cocina.state.players.find(p => p.id === cocina.room.id).x);
  await b.keyboard.down('d'); await b.waitForFunction(x => cocina.state.players.find(p => p.id === cocina.room.id).x > x + 0.5, initial); await b.keyboard.up('d');
  await a.waitForFunction(id => cocina.state.players.find(p => p.id === id).x > -3.2, ids.guest); check('remote movement reaches the host simulation');
  // Prediction: with the host's snapshots held back (a slow link), the guest's own
  // cook still walks on its input; once they flow again it lands where the host has it.
  await b.waitForFunction(() => cocina.room.predicted);
  await a.evaluate(() => { cocina.room.publish = () => {}; });
  const stalled = await b.evaluate(() => ({ predicted: cocina.room.predicted.x, shown: cocina.state.players.find(p => p.id === cocina.room.id).x }));
  await b.keyboard.down('a'); await b.waitForFunction(x => cocina.room.predicted.x < x - 0.8, stalled.predicted); await b.keyboard.up('a');
  assert.equal(await b.evaluate(() => cocina.state.players.find(p => p.id === cocina.room.id).x), stalled.shown, 'no snapshot arrived while predicting');
  await a.evaluate(() => { delete cocina.room.publish; });
  await b.waitForFunction(() => { const me = cocina.state.players.find(p => p.id === cocina.room.id); return Math.abs(me.x - cocina.room.predicted.x) < 0.3 && Math.abs(me.z - cocina.room.predicted.z) < 0.3; });
  check('the guest moves its own cook at once and settles on the host position');
  await position(a, ids.host, 'supply-arepa'); await a.keyboard.press('e'); await held(a, 'raw');
  await position(a, ids.host, 'prep-1'); await a.keyboard.press('e'); await held(a, null);
  await a.evaluate(() => cocina.step(2.5));
  await position(a, ids.guest, 'prep-1'); await b.keyboard.press('e'); await held(b, 'prepared');
  await position(a, ids.guest, 'stove-1'); await b.keyboard.press('e'); await held(b, null);
  await a.evaluate(() => cocina.step(6.2)); await b.waitForFunction(() => cocina.state.stations.find(s => s.id === 'stove-1').item?.stage === 'cooked');
  await b.keyboard.press('e'); await held(b, 'cooked');
  await position(a, ids.guest, 'serve'); await b.keyboard.press('e'); await a.waitForFunction(() => cocina.state.score === 80); await b.waitForFunction(() => cocina.state.score === 80);
  check('host prepares, guest cooks and serves; food and score agree');
  await a.locator('#sound').click(); assert.equal(await a.locator('#sound').getAttribute('aria-pressed'), 'false');
  await a.locator('#sound').click(); assert.equal(await a.locator('#sound').getAttribute('aria-pressed'), 'true');
  await a.locator('#menu').click(); const before = await a.evaluate(() => cocina.state.remaining);
  await a.waitForFunction(t => cocina.state.remaining < t - 0.2, before); await a.locator('#pana-resume').click(); check('multiplayer menu does not pause the other player');
  const c = await page('Luisa', true); await c.waitForFunction(() => cocina.state.phase === 'playing' && cocina.state.players.length === 3);
  assert.equal(await c.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  const cId = await c.evaluate(() => cocina.room.id); await a.evaluate(id => cocina.place(id, -6, 6), cId);
  // Wait for the host's placement snapshot before measuring movement.
  await c.waitForFunction(() => { const p = cocina.state.players.find(p => p.id === cocina.room.id); return Math.abs(p.x + 6) < 0.1 && Math.abs(p.z - 6) < 0.1; });
  await c.bringToFront();
  const btn = await c.locator('[data-move="right"]').boundingBox(); const x0 = await c.evaluate(() => cocina.state.players.find(p => p.id === cocina.room.id).x);
  // Use an actual held touch on the emulated phone, not a compatibility mouse.
  const touch = await c.context().newCDPSession(c);
  if (output) await c.screenshot({ path: path.join(output, 'cocina-before-touch.png') });
  assert.equal(await c.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-move]')?.dataset.move,
    { x: btn.x + btn.width / 2, y: btn.y + btn.height / 2 }), 'right', 'the prepared game exposes the touch control');
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: btn.x + btn.width / 2, y: btn.y + btn.height / 2 }] });
  await c.waitForFunction(() => document.querySelector('[data-move="right"]').classList.contains('is-held'));
  await c.waitForFunction(x => cocina.state.players.find(p => p.id === cocina.room.id).x > x + 0.5, x0);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await touch.detach();
  await position(a, cId, 'supply-cachapa'); await c.locator('#action').click(); await held(c, 'raw');
  if (output) await c.screenshot({ path: path.join(output, 'cocina-mobile.png') }); check('late join, mobile movement and touch interaction work at 390px');
  const remaining = await b.evaluate(() => cocina.state.remaining); await a.close();
  await b.waitForFunction(() => cocina.room.isHost); assert.equal(await b.evaluate(() => cocina.state.score), 80);
  assert.ok(await b.evaluate(() => cocina.state.remaining) <= remaining); assert.equal(await b.evaluate(() => cocina.state.phase), 'playing');
  check('host departure preserves score, orders, timer and active turn');
  await c.close(); await b.waitForFunction(() => cocina.room.members.size === 1);
  await b.locator('#menu').click(); const paused = await b.evaluate(() => cocina.state.remaining);
  await b.waitForTimeout(300); assert.equal(await b.evaluate(() => cocina.state.remaining), paused); await b.locator('#pana-resume').click(); check('solo menu pauses the turn');
  await b.evaluate(() => { cocina.room.game.remaining = 0.01; cocina.room.tick(0.05, {}); }); await b.locator('#results').waitFor({ state: 'visible' });
  if (output) await b.screenshot({ path: path.join(output, 'cocina-results.png') });
  await b.locator('#again').click(); await b.waitForFunction(() => cocina.state.phase === 'playing' && cocina.state.score === 0); check('results and replay reset the turn');
  // Exhaust automatic retries to keep the disconnected UI stable while testing
  // the fallback. Chromium's HTTP offline emulation does not block all WS reconnects.
  await b.evaluate(() => { cocina.room.cut(); });
  await b.waitForFunction(() => !cocina.room.connected); await b.locator('#menu').click(); await b.locator('#offline').click();
  await b.waitForFunction(() => cocina.room.offline && cocina.state.phase === 'lobby'); await b.locator('#pana-room-more').click(); await b.locator('[data-room-option="helpers"][data-value="true"]').click(); await b.locator('#pana-room-done').click(); await b.locator('#start').click();
  await b.waitForFunction(() => cocina.state.players.filter(p => p.bot).length === 2); await b.evaluate(() => cocina.step(45));
  assert.ok(await b.evaluate(() => cocina.state.served) > 0);
  if (output) await b.screenshot({ path: path.join(output, 'cocina-gameplay.png') }); check('disconnection fallback starts a playable local kitchen with working helpers');
  await b.goto(base + '/g/escondidas/?debug'); await b.waitForFunction(() => window.hunt?.room.connected); await b.locator('#start').click(); await b.waitForFunction(() => hunt.state.phase === 'hide');
  assert.equal(await b.evaluate(async () => (await import('/g/escondidas/plaza.js')).createPlaza === (await import('/engine/worlds/plaza.js')).createPlaza), true); check('Escondidas starts on the extracted shared plaza');
  await b.goto(base + '/g/derrape/?track=llanos&debug'); await b.waitForFunction(() => window.race && window.garage); await b.evaluate(() => startRace(0)); check('Derrape still starts with seated drivers');
  await b.goto(base + '/g/bululu/?debug'); await b.waitForFunction(() => window.board && window.players); check('Bululú loads with the updated shared characters');
  await b.goto(base + '/'); await b.getByRole('heading', { name: 'Pana Cocina', exact: true }).waitFor();
  if (output) await b.screenshot({ path: path.join(output, 'cocina-hub.png') }); check('hub discovers Cocina and renders the chef artwork');
  assert.deepEqual(errors, []); check('no uncaught browser errors');
} catch (error) {
  const diagnostics = [];
  for (const context of browser.contexts()) for (const p of context.pages()) {
    diagnostics.push(await p.evaluate(() => window.cocina ? { phase: cocina.state.phase, remaining: cocina.state.remaining, id: cocina.room.id, connected: cocina.room.connected, players: cocina.state.players.map(p => ({ id: p.id, x: p.x, z: p.z, moving: p.moving })), lobby: document.getElementById('pana-lobby-shell')?.hidden, visible: document.visibilityState, menu: cocina.menu.isOpen, held: [...document.querySelectorAll('[data-move].is-held')].map(el => el.dataset.move), inputs: [...cocina.room.inputs] } : location.href).catch(() => null));
  }
  await writeFile(path.join(os.tmpdir(), 'pana-cocina-legacy-failure.json'), JSON.stringify({ error: error.stack, errors, clients: diagnostics }, null, 2));
  console.log(diagnostics);
  throw error;
} finally { await browser.close(); }
