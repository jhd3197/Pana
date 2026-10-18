import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(import.meta.url), { chromium } = require(process.argv[2] || 'playwright');
const base = process.env.PANA_QA_URL || 'http://localhost:8461';
const output = process.env.PANA_QA_OUTPUT || path.resolve('Pana/games/reliquia/qa'); await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}) });
const errors = [], code = `reliquia-qa-${Date.now().toString(36)}`;
const check = text => console.log(`ok  ${text}`);
async function page(name, mobile = false) {
  const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1000, height: 760 } });
  // Keep multiple real software-rendered clients responsive during held input.
  await ctx.addInitScript(() => localStorage.setItem('pana:settings', JSON.stringify({ quality: 'baja', sound: false })));
  const p = await ctx.newPage(); p.setDefaultTimeout(90000); p.on('pageerror', e => { errors.push(`${name}: ${e.message}`); console.log('ERROR', name, e.message); });
  p.on('console', m => { if (m.type() === 'error' && !m.text().includes('favicon')) { errors.push(`${name}: ${m.text()}`); console.log('ERROR', name, m.text()); } });
  await p.goto(`${base}/g/reliquia/?room=${code}&name=${name}&debug`);
  await p.waitForFunction(() => window.reliquia?.room.connected && window.PANA_LOBBY_LOADING === false, null, { timeout: 120000 }); return p;
}
async function place(host, id, x, z) { await host.evaluate(({ id, x, z }) => reliquia.place(id, x, z), { id, x, z }); }
async function ready(p, x, z) { await p.waitForFunction(({ x, z }) => { const p = reliquia.state.players.find(p => p.id === reliquia.room.id); return Math.hypot(p.x - x, p.z - z) < 0.3; }, { x, z }); }
try {
  const a = await page('Juan'), b = await page('Ana');
  await a.waitForFunction(() => reliquia.state.players.length === 2); await b.waitForFunction(() => reliquia.state.players.length === 2);
  assert.equal(await a.evaluate(() => reliquia.room.members.size), 2); check('both panas share one room');
  await a.setViewportSize({ width: 1440, height: 900 }); await a.screenshot({ path: path.join(output, 'lobby.png') }); await a.setViewportSize({ width: 1000, height: 760 });
  assert.equal(await b.locator('#start').isDisabled(), true); check('two browser clients share the lobby and host owns start');
  await a.locator('#start').click(); await b.waitForFunction(() => reliquia.state.phase === 'playing');
  const ids = await a.evaluate(() => ({ a: reliquia.room.id, b: reliquia.state.players.find(p => p.id !== reliquia.room.id).id }));
  const initial = await b.evaluate(() => reliquia.state.players.find(p => p.id === reliquia.room.id).x);
  await b.keyboard.down('d'); await b.waitForFunction(x => reliquia.state.players.find(p => p.id === reliquia.room.id).x > x + 1, initial); await b.keyboard.up('d');
  await a.waitForFunction(({ id, x }) => reliquia.state.players.find(p => p.id === id).x > x + 1, { id: ids.b, x: initial }); check('remote keyboard input moves the shared player');
  await place(a, ids.b, 0, -3); await ready(b, 0, -3);
  await a.evaluate(() => { reliquia.room.game.spawn(0, -5); reliquia.room.publish(); });
  await b.keyboard.press('Space');
  await a.waitForFunction(() => reliquia.state.enemies.some(e => e.hp === 30));
  await b.waitForFunction(() => reliquia.state.players.find(p => p.id === reliquia.room.id).cooldown <= 0); await b.keyboard.press('Space'); await a.waitForFunction(() => reliquia.state.kills === 1); await b.waitForFunction(() => reliquia.state.kills === 1); check('guest attacks resolve once and enemy death agrees');
  await place(a, ids.a, 0, 12); await place(a, ids.b, 1.5, 12); await ready(b, 1.5, 12);
  await a.evaluate(() => { reliquia.room.game.damage(reliquia.room.game.players.find(p => p.id === reliquia.room.id), 100); reliquia.room.publish(); });
  await b.keyboard.down('e'); await a.waitForFunction(() => !reliquia.state.players.find(p => p.id === reliquia.room.id).downed); await b.keyboard.up('e');
  await b.waitForFunction(() => reliquia.state.players.find(p => p.id === reliquia.room.id).revives === 1); check('guest revives a downed host with a held interaction');
  await place(a, ids.a, 33, -36); await place(a, ids.b, 47, -36); await ready(b, 47, -36);
  await a.keyboard.down('e'); await b.keyboard.down('e'); await a.waitForFunction(() => reliquia.state.gateOpen); await b.waitForFunction(() => reliquia.state.gateOpen); await a.keyboard.up('e'); await b.keyboard.up('e');
  await a.screenshot({ path: path.join(output, 'winches.png') }); check('two held winches open the same gate for both players');
  await a.locator('#menu').click(); const before = await a.evaluate(() => reliquia.state.time);
  await a.waitForFunction(t => reliquia.state.time > t + 0.2, before); await a.locator('#pana-resume').click(); check('multiplayer menu does not pause the expedition');
  const c = await page('Luisa', true); await c.waitForFunction(() => reliquia.state.phase === 'playing' && reliquia.state.gateOpen);
  const cId = await c.evaluate(() => reliquia.room.id);
  await place(a, cId, 40, -56); await ready(c, 40, -56);
  const box = await c.locator('[data-move="right"]').boundingBox(), x0 = await c.evaluate(() => reliquia.state.players.find(p => p.id === reliquia.room.id).x);
  const touch = await c.context().newCDPSession(c);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
  await c.waitForFunction(x => reliquia.state.players.find(p => p.id === reliquia.room.id).x > x + 0.5, x0);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await touch.detach();
  assert.equal(await c.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await c.screenshot({ path: path.join(output, 'mobile.png') }); check('late arrival receives the checkpoint and real touch movement works');
  const kills = await b.evaluate(() => reliquia.state.kills); await a.close(); await b.waitForFunction(() => reliquia.room.isHost);
  assert.equal(await b.evaluate(() => reliquia.state.gateOpen), true); assert.equal(await b.evaluate(() => reliquia.state.kills), kills); check('host migration preserves the active run and opened gate');
  await place(b, ids.b, 40, -96); await place(b, cId, 42, -96);
  await b.waitForFunction(() => reliquia.state.enemies.some(e => e.kind === 'guardian'));
  // Place the encounter for QA; damage still goes through normal sequenced input.
  await b.evaluate(() => { const p = reliquia.room.game.players.find(p => p.id === reliquia.room.id); p.invulnerable = 100; const boss = reliquia.room.game.enemies.find(e => e.kind === 'guardian'); reliquia.place(p.id, boss.x, boss.z + 2); });
  await b.screenshot({ path: path.join(output, 'guardian.png') });
  for (let i = 0; i < 20; i++) {
    if (await b.evaluate(() => reliquia.state.guardianDefeated)) break;
    await b.waitForFunction(() => reliquia.state.players.find(p => p.id === reliquia.room.id).cooldown <= 0); await b.keyboard.press('Space');
  }
  await b.waitForFunction(() => reliquia.state.guardianDefeated); await c.waitForFunction(() => reliquia.state.guardianDefeated); check('guardian combat produces the shared objective unlock');
  await place(b, ids.b, 40, -108); await b.keyboard.press('e'); await b.waitForFunction(() => reliquia.state.carrier === reliquia.room.id); await c.waitForFunction(() => reliquia.state.relicTaken);
  await place(b, ids.b, 0, 17); await place(b, cId, 2, 17);
  await b.keyboard.down('e'); await b.waitForFunction(() => reliquia.state.phase === 'results'); await b.keyboard.up('e'); await c.waitForFunction(() => reliquia.state.outcome === 'win');
  await b.screenshot({ path: path.join(output, 'results.png') }); check('relic pickup, team extraction and results agree across clients');
  await b.locator('#again').click(); await c.waitForFunction(() => reliquia.state.phase === 'playing' && !reliquia.state.gateOpen && !reliquia.state.relicTaken); check('replay resets the expedition');
  await c.close(); await b.waitForFunction(() => reliquia.room.members.size === 1);
  await b.locator('#menu').click(); const frozen = await b.evaluate(() => reliquia.state.time); await b.waitForTimeout(350); assert.equal(await b.evaluate(() => reliquia.state.time), frozen); await b.locator('#pana-resume').click(); check('solo pause freezes the simulation');
  await b.evaluate(() => { reliquia.room.cut(); }); await b.waitForFunction(() => !reliquia.room.connected);
  await b.locator('#offline-inline').click(); await b.waitForFunction(() => reliquia.room.offline && reliquia.state.phase === 'lobby'); await b.locator('#start').click();
  await b.waitForFunction(() => reliquia.state.phase === 'playing'); check('failed connection has an explicit playable local fallback');
  await b.setViewportSize({ width: 1440, height: 900 }); await b.evaluate(() => reliquia.place(reliquia.room.id, 40, -96));
  await b.screenshot({ path: path.join(output, 'gameplay.png') });
  console.log('render', await b.evaluate(() => ({ calls: reliquia.renderer.info.render.calls, triangles: reliquia.renderer.info.render.triangles })));
  await b.goto(base + '/'); await b.getByRole('heading', { name: 'Reliquia', exact: true }).waitFor(); check('hub discovers Reliquia');
  assert.deepEqual(errors, []); check('no uncaught browser errors');
} catch (error) {
  const clients = [];
  for (const context of browser.contexts()) for (const p of context.pages()) {
    clients.push(await p.evaluate(() => window.reliquia ? { state: reliquia.state, id: reliquia.room.id, input: reliquia.input(), received: [...reliquia.room.inputs], focus: document.activeElement?.tagName, menu: reliquia.menu.isOpen, lobby: document.getElementById('pana-lobby-shell')?.hidden } : location.href).catch(() => null));
  }
  await writeFile(path.join(output, 'failure.json'), JSON.stringify(clients, null, 2));
  throw error;
} finally { await browser.close(); }
