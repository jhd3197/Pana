// npm start; node Pana/games/curiara/tests/browser.mjs [playwright-package]
// Two real clients in one room: strokes, countdown, capsize sync, host
// migration, late joiners, touch paddling on a 390 px phone and the offline
// fallback. Screenshots land in art/curiara.
import assert from 'node:assert/strict';
import { launch, waitPrepared } from '../../../tests/browser-kit.js';
import { mkdir } from 'node:fs/promises';
const browser = await launch(), base = process.env.PANA_QA_URL || 'http://localhost:8461';
const output = 'art/curiara'; await mkdir(output, { recursive: true });
const errors = [], code = `curiara-${Date.now()}`;
const check = text => console.log(`ok: ${text}`);
async function open(name, { mobile = false, room = code, query = '' } = {}) {
  const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true } : { viewport: { width: 860, height: 560 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => localStorage.setItem('pana:settings',JSON.stringify({sound:false,music:false,quality:'baja'})));
 const p = await ctx.newPage(); p.on('pageerror', e => { errors.push(e.message); console.log('page error:', e.message); });
  p.on('console', m => { if (m.type() === 'error' && !m.text().includes('favicon')) console.log('console:', m.text()); });
  await p.goto(`${base}/g/curiara/?room=${room}&name=${name}&debug${query}`);
  await p.waitForFunction(() => window.curiara?.room.connected, null, { timeout: 180000 });
  await waitPrepared(p); return p;
}
const shot = (p, name) => p.screenshot({ path: `${output}/${name}.png`, timeout: 120000 });
const mine = p => p.evaluate(() => { const b = curiara.state.boats.find(b => b.crew.some(c => c.id === curiara.room.id)); return b && { id: b.id, strokes: b.strokes, remazos: b.remazos, progress: b.progress, capsized: b.capsized, capsizes: b.capsizes, tip: b.tip }; });
try {
  const a = await open('Juan'); await a.locator('#start').waitFor({ state: 'visible' });
  await shot(a, 'lobby'); check('river and the pana in a curiara render');
  const b = await open('María'); await b.waitForFunction(() => curiara.state.players.length === 2, null, { timeout: 60000 });
  assert.equal(await b.locator('#start').isDisabled(), true, 'only the host starts');
  assert.equal(await b.locator('[data-format="parejas"]').isDisabled(), true, 'only the host picks the format');
  await a.locator('#start').click();
  await b.waitForFunction(() => curiara.state.phase === 'countdown', null, { timeout: 90000 }); check('guest sees the shared countdown');
  await b.waitForFunction(() => curiara.state.phase === 'racing', null, { timeout: 90000 });
  assert.equal(await b.evaluate(() => curiara.state.boats.length), 8); check('bots fill the river to 8 canoes');
  // The guest paddles in rhythm with real key presses (drawing paused so
  // software WebGL doesn't hold the keys back).
  const quiet = v => Promise.all([a, b].map(p => p.evaluate(v => curiara.quiet(v), v)));
  await quiet(true);
  for (let i = 0; i < 10; i++) { await b.keyboard.press(i % 2 ? 'KeyD' : 'KeyA'); await b.waitForTimeout(420); }
  // Each input carries the last 8 strokes, so a starved tab still delivers them.
  await a.waitForFunction(id => { const boat = curiara.state.boats.find(b => b.crew.some(c => c.id === id)); return boat.strokes >= 6 && boat.remazos >= 3; }, await b.evaluate(() => curiara.room.id), { timeout: 60000 });
  await quiet(false);
  check('guest strokes reach the host with their rhythm intact (¡Remazo!)');
  await shot(b, 'race-guest');
  // Capsize on the host shows on the guest.
  const guest = await b.evaluate(() => curiara.room.id);
  await a.evaluate(id => { const g = curiara.room.game, boat = g.boatOf(id); g.tip(boat, 150, 'test'); curiara.room.publish(); }, guest);
  await b.waitForFunction(() => { const boat = curiara.state.boats.find(b => b.crew.some(c => c.id === curiara.room.id)); return boat.capsized > 0; });
  await b.waitForTimeout(500); await shot(b, 'capsize');
  await b.waitForFunction(() => { const boat = curiara.state.boats.find(b => b.crew.some(c => c.id === curiara.room.id)); return boat.capsized === 0 && boat.capsizes === 1; }, null, { timeout: 60000 });
  check('a capsize syncs and the panas climb back in');
  // A late arrival watches until the next race.
  await quiet(true);
  const c = await open('Luisa', { mobile: true });
  await c.waitForFunction(() => curiara.state.players.find(p => p.id === curiara.room.id)?.spectator === true, null, { timeout: 90000 });
  assert.equal(await c.evaluate(() => curiara.state.boats.some(b => b.crew.some(x => x.id === curiara.room.id))), false);
  check('late arrival spectates');
  await c.close(); await quiet(false);
  // Host leaves mid-race: the guest takes over with the race intact.
  const before = await b.evaluate(() => curiara.state.time);
  await a.close();
  await b.waitForFunction(() => curiara.room.isHost, null, { timeout: 90000 });
  assert.equal(await b.evaluate(() => curiara.state.phase), 'racing');
  await b.waitForFunction(t => curiara.state.time > t + 1, before, { timeout: 60000 });
  assert.equal(await b.evaluate(() => curiara.state.boats.length), 8, 'the departed host is now a bot in the same canoe');
  check('host migration keeps the race going');
  // Solo menu pauses.
  await b.waitForFunction(() => curiara.room.members.size === 1);
  await b.locator('#menu').click(); const paused = await b.evaluate(() => curiara.state.time); await b.waitForTimeout(300);
  assert.equal(await b.evaluate(() => curiara.state.time), paused); await b.locator('#pana-resume').click(); check('solo menu pauses the river');
  // Finish → results → replay.
  await b.evaluate(() => { curiara.place(curiara.room.id, curiara.RIVER.LENGTH - 6, 0); curiara.room.game.boatOf(curiara.room.id).v = 5; for (const x of curiara.room.game.boats) if (!x.crew.some(c => c.id === curiara.room.id)) x.finish = 100; curiara.room.publish(); });
  await b.locator('#results').waitFor({ state: 'visible', timeout: 30000 }); await shot(b, 'results');
  assert.ok(await b.evaluate(() => document.querySelectorAll('#result-board .pk-row').length) === 8);
  await b.locator('#again').click(); await b.waitForFunction(() => curiara.state.phase === 'countdown' && curiara.state.time === 0); check('finish, results and another race');
  await b.close();
  // Parejas: one pana at the proa, one at the popa of the same canoe.
  const pairRoom = `${code}-parejas`, p1 = await open('Proa', { room: pairRoom }), p2 = await open('Popa', { room: pairRoom });
  await p2.waitForFunction(() => curiara.state.players.length === 2, null, { timeout: 60000 });
  await p1.locator('[data-format="parejas"]').click();
  await p2.waitForFunction(() => curiara.state.format === 'parejas', null, { timeout: 60000 });
  await p1.locator('#seats [data-roster-move="2"]').click();
  await p2.waitForFunction(() => curiara.state.players.some(p => p.seat?.boat === 1 && p.seat.pos === 0), null, { timeout: 60000 });
  await p2.locator('#seats [data-roster-move="3"]').click();
  await p1.waitForFunction(() => curiara.state.players.filter(p => p.seat?.boat === 1).length === 2, null, { timeout: 60000 });
  await shot(p1, 'parejas-lobby');
  await p1.locator('#start').click();
  await p2.waitForFunction(() => curiara.state.phase === 'racing', null, { timeout: 90000 });
  assert.equal(await p2.evaluate(() => curiara.state.boats.length), 4);
  const pairQuiet = v => Promise.all([p1, p2].map(p => p.evaluate(v => curiara.quiet(v), v)));
  await pairQuiet(true);
  // The proa strokes; the popa taps right behind it: ¡Ahora!
  for (let i = 0; i < 8; i++) { await p1.keyboard.press(i % 2 ? 'KeyD' : 'KeyA'); await p2.keyboard.press('KeyD'); await p1.waitForTimeout(380); }
  await p1.waitForFunction(() => { const b = curiara.state.boats[1]; return b.strokes >= 6 && b.paddle.syncs >= 2; }, null, { timeout: 60000 });
  // Holding A on the helm puts the rudder over.
  await p2.keyboard.down('KeyA');
  await p1.waitForFunction(() => curiara.state.boats[1].paddle.rudder === -1, null, { timeout: 60000 });
  await p2.keyboard.up('KeyA'); await pairQuiet(false);
  assert.equal(await p2.evaluate(() => curiara.state.boats[1].crew.map(c => c.seat).join()), '0,1');
  await shot(p2, 'parejas-race'); check('parejas: proa strokes, popa calls ¡Ahora! and steers');
  await p1.close(); await p2.close();
  // Phone: touch buttons paddle.
  const m = await open('Móvil', { mobile: true, room: `${code}-touch` }); await shot(m, 'mobile-lobby');
  assert.equal(await m.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no sideways scroll at 390 px');
  await m.locator('#start').click(); await m.waitForFunction(() => curiara.state.phase === 'racing', null, { timeout: 90000 });
  const cdp = await m.context().newCDPSession(m);
  // Both stroke buttons fit on the phone's screen (Der. used to sit past 390 px).
  for (const side of [-1, 1]) {
    const box = await m.locator(`[data-stroke="${side}"]`).boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= 390, `stroke button ${side} on screen (${box.x}–${box.x + box.width})`);
  }
  // Drawing paused while tapping, as for the keys above: a full software-GL
  // frame per touch held each tap back for seconds.
  await m.evaluate(() => curiara.quiet(true));
  for (let i = 0; i < 8; i++) {
    const box = await m.locator(`[data-stroke="${i % 2 ? 1 : -1}"]`).boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); await m.waitForTimeout(60);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await m.waitForTimeout(380);
  }
  await m.waitForFunction(() => { const b = curiara.state.boats.find(b => b.crew.some(c => c.id === curiara.room.id)); return b.strokes >= 6; });
  await m.evaluate(() => curiara.quiet(false));
  await shot(m, 'mobile-race'); await cdp.detach(); check('touch stroke buttons paddle on a 390 px phone');
  await m.evaluate(() => curiara.room.cut()); await m.waitForFunction(() => !curiara.room.connected);
  await m.locator('#menu').click(); await m.locator('#local-race').click();
  await m.waitForFunction(() => curiara.room.offline && curiara.state.phase === 'lobby');
  await m.locator('#start').click(); await m.waitForFunction(() => curiara.state.phase === 'countdown'); check('offline fallback starts a local race');
  await m.goto(`${base}/`); await m.getByRole('heading', { name: 'Curiara', exact: true }).waitFor(); check('hub lists Curiara');
  assert.deepEqual(errors, []); check('no uncaught browser errors');
} catch (error) {
  for (const context of browser.contexts()) for (const p of context.pages()) {
    console.log(await p.evaluate(() => window.curiara ? ({ id: curiara.room.id, connected: curiara.room.connected, host: curiara.room.isHost, phase: curiara.state.phase, time: curiara.state.time, boats: curiara.state.boats.map(b => `${b.crew.map(c => c.id).join('+')}:${b.strokes}/${b.remazos}`).join(' '), input: JSON.stringify(curiara.input().strokes.slice(-3)) }) : location.href).catch(() => null));
    await p.screenshot({ path: `${output}/failure-${browser.contexts().indexOf(context)}.png` }).catch(() => {});
  }
  throw error;
} finally { await browser.close(); }
