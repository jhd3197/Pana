// Domination, in the browser. Online: a host and a guest in one room pick the
// mode, its limits show in the lobby, the server's bots take zones (the guest's
// chips follow the server's zones) and the round ends at the score limit with the
// same result on both clients. Practice: the same rules run in the page; mixed
// ownership, a capture in progress, a contested zone and El Puerto's three zones
// are staged for screenshots, then the round is fast-forwarded to its end.
// Screenshots go to games/pintura/qa (or PANA_SHOTS_DIR) as dom-<name>.png.
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { launch, openGame, waitFor, qaDir } from '../../../tests/browser-kit.js';

const out = process.env.PANA_SHOTS_DIR || qaDir(import.meta.url); fs.mkdirSync(out, { recursive: true });
const shot = (page, name) => page.screenshot({ path: path.join(out, `dom-${name}.png`) });
const frames = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const room = `dom-${Date.now()}`, browser = await launch();
try {
  const a = await openGame(browser, 'pintura', { name: 'Juan', room, query: 'debug' });
  const b = await openGame(browser, 'pintura', { name: 'María', room, query: 'debug' });
  await waitFor(a, () => pinturaDebug.room.connected && pinturaDebug.room.state.players.length === 2);
  await a.evaluate(() => { pinturaDebug.room.configure({ mode: 'dom', domGoal: 100, bots: 5 }); pinturaDebug.room.selectMap('plaza'); });
  await waitFor(b, () => pinturaDebug.room.state.options.mode === 'dom' && pinturaDebug.room.state.options.domGoal === 100 && pinturaDebug.room.state.mapId === 'plaza');
  // The lobby shows the mode's own limits and hides the ordinary round time.
  assert.ok(await a.getByText('Puntos para ganar', { exact: true }).first().isVisible(), 'score limit in the lobby');
  assert.ok(await a.getByText('Tiempo límite').first().isVisible(), 'time limit in the lobby');
  assert.equal(await a.getByText('Tiempo por ronda').first().isVisible(), false);
  assert.equal(await a.locator('#win-target').textContent(), '100');
  await shot(a, 'lobby');

  await a.locator('#start').click();
  const live = () => pinturaDebug.room.state.phase === 'playing' && !pinturaDebug.room.state.loading && !pinturaDebug.room.state.countdown && document.querySelector('#hud .dom-zones')?.hidden === false;
  await waitFor(a, live, undefined, 120_000); await waitFor(b, live, undefined, 120_000);
  assert.equal(await b.locator('#hud .dom-chip').count(), 3);
  assert.equal(await b.locator('#hud .dom-zones').textContent(), 'ABC');
  assert.match(await b.locator('#position').textContent(), /Primero a 100 puntos/);
  assert.equal(await b.evaluate(() => pinturaDebug.room.state.zones.length), 3);
  await frames(b); await shot(b, 'hud-start');
  // The server's bots take a zone: the guest's chip turns a team colour.
  await waitFor(b, () => pinturaDebug.room.state.zones.some(z => z.owner !== null) && [...document.querySelectorAll('#hud .dom-chip')].some(c => c.dataset.owner !== 'none'), undefined, 120_000);
  // The round runs to its end on the server: both clients agree on it.
  const over = () => pinturaDebug.room.state.phase === 'finished';
  await waitFor(a, over, undefined, 400_000); await waitFor(b, over, undefined, 30_000);
  const end = page => page.evaluate(() => ({ outcome: pinturaDebug.room.state.outcome, scores: pinturaDebug.room.state.teamScores, winners: pinturaDebug.room.state.winners, events: pinturaDebug.room.state.zoneEvents.map(e => e.type) }));
  const [ea, eb] = [await end(a), await end(b)];
  assert.deepEqual(ea.outcome, eb.outcome); assert.deepEqual(ea.winners, eb.winners); assert.deepEqual(ea.scores, eb.scores);
  assert.equal(ea.outcome.reason, 'limit'); assert.ok(Math.max(...ea.scores) >= 100, JSON.stringify(ea));
  assert.match(await b.locator('#result-title').textContent(), /Ganó el equipo|Empate/);
  assert.match(await b.locator('#result-copy').textContent(), /Puntos: naranja \d+ · turquesa \d+/);
  await shot(b, 'result');
  assert.deepEqual(b.errors, []); await b.context().close();

  // Practice on El Puerto: stage the zone states in the page's own rules.
  await a.locator('#again').click(); await waitFor(a, () => pinturaDebug.room.state.phase === 'lobby');
  await a.evaluate(() => { pinturaDebug.room.configure({ domGoal: 200 }); pinturaDebug.room.selectMap('terminal'); });
  await waitFor(a, () => pinturaDebug.room.state.mapId === 'terminal' && pinturaDebug.room.state.options.domGoal === 200);
  await a.locator('#practice').click();
  await waitFor(a, () => pinturaDebug.room.local && pinturaDebug.room.state.phase === 'playing' && !pinturaDebug.room.state.loading && !pinturaDebug.room.state.countdown && pinturaDebug.room.state.mapId === 'terminal' && pinturaDebug.room.state.zones.length === 3, undefined, 120_000);
  const stage = fn => a.evaluate(fn);
  // Freeze the simulation, stand west of A and look down the court: A orange, B being turned by turquoise, C turquoise.
  await stage(() => {
    const { room, world } = pinturaDebug, g = room.game, me = g.players.find(p => p.id === room.id);
    room.tick = () => {}; g.players.filter(p => p.bot).forEach((p, i) => Object.assign(p, { x: -20 + i * 6, z: 26 }));
    Object.assign(me, { x: -44, z: 2, respawn: 0, shield: 0 }); world.look(-Math.PI / 2 - world.yaw, 0);
    const [A, B, C] = g.zones;
    Object.assign(A, { owner: 0, claim: 0, progress: 1 }); Object.assign(B, { owner: null, claim: 1, progress: .6 }); Object.assign(C, { owner: 1, claim: 1, progress: 1 });
    g.teamScores = [64, 81]; room.publish();
  });
  await waitFor(a, () => { const c = [...document.querySelectorAll('#hud .dom-chip')]; return c[0].dataset.owner === '0' && c[1].dataset.owner === 'none' && c[2].dataset.owner === '1'; });
  await waitFor(a, () => [...document.querySelectorAll('#hud .dom-mark')].filter(m => !m.hidden).length === 3);
  assert.match(await a.locator('#hud .dom-mark').nth(1).textContent(), /^B\d+ m$/);
  await frames(a); await shot(a, 'hud-mixed');
  // Inside B with a turquoise bot: contested, the banner says so and the wall flashes.
  await stage(() => {
    const { room, world } = pinturaDebug, g = room.game, me = g.players.find(p => p.id === room.id), rival = g.players.find(p => p.bot && p.team === 1), B = g.zones[1];
    Object.assign(me, { x: B.x - 2.6, z: B.z + 1 }); Object.assign(rival, { x: B.x + 1.5, z: B.z - .5, respawn: 0, ax: -1, az: 0 });
    Object.assign(B, { contested: true }); world.look(-Math.PI / 2 - world.yaw, 0); room.publish();
  });
  await waitFor(a, () => /Zona B en disputa/.test(document.querySelector('#hud .dom-banner').textContent) && document.querySelectorAll('#hud .dom-chip')[1].classList.contains('contested'));
  await frames(a); await shot(a, 'contested');
  // Alone in B: capturing, the banner counts the progress.
  await stage(() => { const { room } = pinturaDebug, g = room.game; g.players.find(p => p.bot && p.team === 1).x += 30; Object.assign(g.zones[1], { contested: false, claim: 0, progress: .45 }); room.publish(); });
  await waitFor(a, () => /Capturando B · 45%/.test(document.querySelector('#hud .dom-banner').textContent));
  await frames(a); await shot(a, 'capturing');
  // El Puerto's three zones from above the middle of the yard.
  await stage(() => {
    const { room, world } = pinturaDebug, g = room.game; Object.assign(g.zones[1], { owner: null, claim: 1, progress: .6 }); room.publish();
    world.setView('cancha'); const draw = world.draw; window.domDraw = draw;
    world.draw = (state, id, dt, aim) => { draw(state, id, dt, aim); world.camera.position.set(0, 58, 46); world.camera.lookAt(0, 0, 0); world.camera.updateMatrixWorld(); world.renderer.render(world.scene, world.camera); };
  });
  await waitFor(a, () => ['A', 'B', 'C'].every(id => pinturaDebug.world.scene.getObjectByName(`Zona ${id}`)?.visible === true));
  // From above, B (inside the shed) draws over its roof: the ring and the letter skip the depth test.
  await waitFor(a, () => { const B = pinturaDebug.world.scene.getObjectByName('Zona B'), board = B.getObjectByName('Letra zona B'), ring = B.children.find(m => m.geometry?.type === 'RingGeometry');
    return board.visible && board.material.depthTest === false && ring.material.depthTest === false && ring.renderOrder > 2; });
  await frames(a); await shot(a, 'puerto-zones');
  // Fast-forward the practice round to its end with the bots playing.
  await stage(() => {
    const { room, world } = pinturaDebug, g = room.game; world.draw = window.domDraw;
    g.players.find(p => p.id === room.id).connected = false;
    for (let i = 0; i < 20 * 900 && g.phase === 'playing'; i++) g.step(.05);
    room.publish();
  });
  await waitFor(a, () => pinturaDebug.room.state.phase === 'finished' && !document.querySelector('#results').hidden);
  const practice = await a.evaluate(() => ({ outcome: pinturaDebug.room.state.outcome, scores: pinturaDebug.room.state.teamScores }));
  assert.ok(practice.outcome && ['limit', 'time'].includes(practice.outcome.reason), JSON.stringify(practice));
  assert.match(await a.locator('#result-copy').textContent(), /Puntos/);
  assert.deepEqual(a.errors, []);
  console.log('ok: domination online (server zones, points, end on both clients) and in practice', JSON.stringify({ online: ea, practice }));
} finally { await browser.close(); }
