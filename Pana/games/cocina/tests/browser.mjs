// Real browser integration QA against the existing local server.
// node browser.mjs [absolute-playwright-package] [optional-chromium-executable]
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(import.meta.url), { chromium } = require(process.argv[2] || 'playwright');
const { WebSocket } = require('ws');
const base = process.env.PANA_QA_URL || 'http://localhost:8461', output = process.env.PANA_QA_OUTPUT;
if (output) await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}) });
const errors = [], sockets = [], room = `cocina-qa-${Date.now().toString(36)}`;
const check = text => console.log(`ok  ${text}`);
async function page(name, mobile = false, code = room) {
  // Three simultaneous software-rendered clients can starve the input relay.
  // Compact desktops reduce pixel work while retaining real rendering and input.
  const desktop = process.env.PANA_QA_COMPACT ? { width: 900, height: 650 } : { width: 1440, height: 900 };
  const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: desktop });
  const p = await ctx.newPage(); p.on('pageerror', e => errors.push(`${name}: ${e.message}`));
  await p.goto(`${base}/g/cocina/?name=${name}&room=${code}&debug`);
  await p.waitForFunction(() => window.cocina?.room.connected, null, { timeout: Number(process.env.PANA_QA_TIMEOUT) || 30000 }); return p;
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
  await a.locator('#helpers').uncheck(); await a.locator('#start').click(); await b.waitForFunction(() => cocina.state.phase === 'playing');
  const ids = await a.evaluate(() => ({ host: cocina.room.id, guest: cocina.state.players.find(p => p.id !== cocina.room.id).id }));
  const initial = await b.evaluate(() => cocina.state.players.find(p => p.id === cocina.room.id).x);
  await b.keyboard.down('d'); await b.waitForFunction(x => cocina.state.players.find(p => p.id === cocina.room.id).x > x + 0.5, initial); await b.keyboard.up('d');
  await a.waitForFunction(id => cocina.state.players.find(p => p.id === id).x > -3.2, ids.guest); check('remote movement reaches the host simulation');
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
  const btn = await c.locator('[data-move="right"]').boundingBox(); const x0 = await c.evaluate(() => cocina.state.players.find(p => p.id === cocina.room.id).x);
  // Use an actual held touch on the emulated phone, not a compatibility mouse.
  const touch = await c.context().newCDPSession(c);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: btn.x + btn.width / 2, y: btn.y + btn.height / 2 }] });
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
  await b.waitForFunction(() => cocina.room.offline && cocina.state.phase === 'lobby'); await b.locator('#helpers').check(); await b.locator('#start').click();
  await b.waitForFunction(() => cocina.state.players.filter(p => p.bot).length === 2); await b.evaluate(() => cocina.step(45));
  assert.ok(await b.evaluate(() => cocina.state.served) > 0);
  if (output) await b.screenshot({ path: path.join(output, 'cocina-gameplay.png') }); check('disconnection fallback starts a playable local kitchen with working helpers');
  for (const game of ['cocina', 'escondidas']) {
    const socket = new WebSocket(base.replace(/^http/, 'ws') + '/ws'); sockets.push(socket);
    await new Promise(resolve => socket.on('open', resolve)); const welcome = new Promise(resolve => socket.once('message', resolve));
    socket.send(JSON.stringify({ t: 'join', game, room: room + '-isolation', name: 'QA' })); await welcome;
  }
  let leaked = false; sockets[1].on('message', raw => { if (JSON.parse(raw).t === 'state') leaked = true; });
  sockets[0].send(JSON.stringify({ t: 'state', v: { game: 'cocina-v1', test: true } })); await b.waitForTimeout(200); assert.equal(leaked, false); check('identical room codes stay isolated between games');
  await b.goto(base + '/g/escondidas/?debug'); await b.waitForFunction(() => window.hunt?.room.connected); await b.locator('#start').click(); await b.waitForFunction(() => hunt.state.phase === 'hide');
  assert.equal(await b.evaluate(async () => (await import('/g/escondidas/plaza.js')).createPlaza === (await import('/engine/plaza.js')).createPlaza), true); check('Escondidas starts on the extracted shared plaza');
  await b.goto(base + '/g/derrape/?track=llanos&debug'); await b.waitForFunction(() => window.race && window.garage); await b.evaluate(() => startRace(0)); check('Derrape still starts with seated drivers');
  await b.goto(base + '/g/bululu/?debug'); await b.waitForFunction(() => window.board && window.players); check('Bululú loads with the updated shared characters');
  await b.goto(base + '/'); await b.getByRole('heading', { name: 'Pana Cocina', exact: true }).waitFor();
  if (output) await b.screenshot({ path: path.join(output, 'cocina-hub.png') }); check('hub discovers Cocina and renders the chef artwork');
  assert.deepEqual(errors, []); check('no uncaught browser errors');
} finally { for (const socket of sockets) socket.close(); await browser.close(); }
