// Capture the flag, in the browser. Online: a host and a guest in one room pick
// the mode, its limits show in the lobby, the server's bots lift a flag (the
// guest's chips and markers follow the server's flags) and the round ends with
// a winner or a draw on both clients. Practice: the same rules run in the page;
// a dropped flag, a carrier and El Puerto's two stands are staged for
// screenshots, then the round is fast-forwarded to its end.
// Screenshots go to games/pintura/qa (or PANA_SHOTS_DIR) as ctf-<name>.png.
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { launch, openGame, waitFor, qaDir } from '../../../tests/browser-kit.js';

const out = process.env.PANA_SHOTS_DIR || qaDir(import.meta.url); fs.mkdirSync(out, { recursive: true });
const shot = (page, name) => page.screenshot({ path: path.join(out, `ctf-${name}.png`) });
const room = `ctf-${Date.now()}`, browser = await launch();
try {
  const a = await openGame(browser, 'pintura', { name: 'Juan', room, query: 'debug' });
  const b = await openGame(browser, 'pintura', { name: 'María', room, query: 'debug' });
  await waitFor(a, () => pinturaDebug.room.connected && pinturaDebug.room.state.players.length === 2);
  await a.evaluate(() => { pinturaDebug.room.configure({ mode: 'ctf', flagGoal: 1, bots: 5 }); pinturaDebug.room.selectMap('plaza'); });
  await waitFor(b, () => pinturaDebug.room.state.options.mode === 'ctf' && pinturaDebug.room.state.options.flagGoal === 1 && pinturaDebug.room.state.mapId === 'plaza');
  // The lobby shows the mode's own limits and hides the ordinary round time.
  assert.ok(await a.getByText('Capturas para ganar').first().isVisible(), 'score limit in the lobby');
  assert.ok(await a.getByText('Tiempo límite').first().isVisible(), 'time limit in the lobby');
  assert.equal(await a.getByText('Tiempo por ronda').first().isVisible(), false);
  assert.equal(await a.locator('#win-target').textContent(), '1');
  await shot(a, 'lobby');

  await a.locator('#start').click();
  const live = () => pinturaDebug.room.state.phase === 'playing' && !pinturaDebug.room.state.loading && !pinturaDebug.room.state.countdown && document.querySelector('#hud .ctf-flags')?.hidden === false;
  await waitFor(a, live, undefined, 120_000); await waitFor(b, live, undefined, 120_000);
  const flags = page => page.evaluate(() => pinturaDebug.room.state.flags.map(f => f.state));
  // Bots reach a flag within seconds, so any of the three states may show already.
  assert.ok((await flags(b)).every(s => ['home', 'carried', 'dropped'].includes(s)));
  assert.equal(await b.locator('#hud .ctf-chip').count(), 2);
  assert.match(await b.locator('#hud .ctf-flags').textContent(), /^Naranja(En su base|La lleva .+|En el suelo · \d+ s)Turquesa(En su base|La lleva .+|En el suelo · \d+ s)$/);
  // The server's bots go for the flags: the guest sees a flag taken and who has it.
  await waitFor(b, () => pinturaDebug.room.state.flags.some(f => f.state === 'carried'), undefined, 120_000);
  assert.match(await b.locator('#hud .ctf-flags').textContent(), /La lleva/);
  // The round runs to its end on the server: both clients agree on it.
  const over = () => pinturaDebug.room.state.phase === 'finished';
  await waitFor(a, over, undefined, 300_000); await waitFor(b, over, undefined, 30_000);
  const end = page => page.evaluate(() => ({ outcome: pinturaDebug.room.state.outcome, scores: pinturaDebug.room.state.teamScores, winners: pinturaDebug.room.state.winners, events: pinturaDebug.room.state.flagEvents.map(e => e.type) }));
  const [ea, eb] = [await end(a), await end(b)];
  assert.deepEqual(ea.outcome, eb.outcome); assert.deepEqual(ea.winners, eb.winners);
  assert.equal(ea.outcome.reason, 'limit'); assert.ok(ea.events.includes('capture'), JSON.stringify(ea));
  assert.match(await b.locator('#result-title').textContent(), /Ganó el equipo|Empate/);
  assert.match(await b.locator('#result-copy').textContent(), /Capturas/);
  await shot(b, 'result');
  assert.deepEqual(b.errors, []); await b.context().close();

  // Practice on El Puerto: stage the flag states in the page's own rules.
  await a.locator('#again').click(); await waitFor(a, () => pinturaDebug.room.state.phase === 'lobby');
  await a.evaluate(() => { pinturaDebug.room.configure({ flagGoal: 3 }); pinturaDebug.room.selectMap('terminal'); });
  await waitFor(a, () => pinturaDebug.room.state.mapId === 'terminal' && pinturaDebug.room.state.options.flagGoal === 3);
  await a.locator('#practice').click();
  await waitFor(a, () => pinturaDebug.room.local && pinturaDebug.room.state.phase === 'playing' && !pinturaDebug.room.state.loading && !pinturaDebug.room.state.countdown && pinturaDebug.room.state.mapId === 'terminal', undefined, 120_000);
  // Freeze the simulation and look along the court from the orange base.
  const stage = fn => a.evaluate(fn);
  await stage(() => {
    const { room, world } = pinturaDebug, g = room.game, me = g.players.find(p => p.id === room.id);
    room.tick = () => {}; g.players.filter(p => p.bot).forEach((p, i) => Object.assign(p, { x: -20 + i * 6, z: 26 }));
    Object.assign(me, { x: -44, z: 0, respawn: 0, shield: 0 }); world.look(-Math.PI / 2 - world.yaw, 0);
    room.publish();
  });
  await waitFor(a, () => /^NaranjaEn su baseTurquesaEn su base$/.test(document.querySelector('#hud .ctf-flags').textContent));
  await a.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await shot(a, 'hud-home');
  await stage(() => {
    const { room } = pinturaDebug, g = room.game, f = g.flags[1]; Object.assign(f, { state: 'dropped', x: -36, z: 1.5, idle: 9, carrier: null });
    room.publish();
  });
  await waitFor(a, () => [...document.querySelectorAll('#hud .ctf-mark')].some(m => !m.hidden && m.dataset.state === 'dropped'));
  assert.match(await a.locator('#hud .ctf-flags').textContent(), /En el suelo · 21 s/);
  await shot(a, 'flag-dropped');
  await stage(() => {
    const { room } = pinturaDebug, g = room.game, me = g.players.find(p => p.id === room.id);
    Object.assign(g.flags[1], { state: 'carried', carrier: me.id, x: me.x, z: me.z, idle: 0 }); room.publish();
  });
  await waitFor(a, () => document.body.classList.contains('ctf-carrier') && /Corre a tu base/.test(document.querySelector('#hud .ctf-banner').textContent));
  await shot(a, 'carrier');
  // A turquoise bot runs off with the orange flag, in front of you: the alarm and its flag on the back.
  await stage(() => {
    const { room } = pinturaDebug, g = room.game, me = g.players.find(p => p.id === room.id), thief = g.players.find(p => p.bot && p.team === 1);
    Object.assign(g.flags[1], { state: 'home', carrier: null, x: g.flags[1].homeX, z: g.flags[1].homeZ });
    Object.assign(thief, { x: me.x + 7, z: me.z + 1, ax: 0, az: 1, respawn: 0 });
    Object.assign(g.flags[0], { state: 'carried', carrier: thief.id, x: thief.x, z: thief.z, taken: 1 }); room.publish();
  });
  await waitFor(a, () => !document.body.classList.contains('ctf-carrier') && /Se llevan tu bandera/.test(document.querySelector('#hud .ctf-banner').textContent) && /La lleva/.test(document.querySelector('#hud .ctf-flags').textContent));
  await a.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await shot(a, 'flag-taken');
  // Both stands of El Puerto from above the middle of the yard.
  await stage(() => {
    const { room, world } = pinturaDebug, g = room.game;
    g.flags.forEach(f => Object.assign(f, { state: 'home', carrier: null, x: f.homeX, z: f.homeZ })); room.publish();
    world.setView('cancha'); const draw = world.draw; window.ctfStands = draw;
    world.draw = (state, id, dt, aim) => { draw(state, id, dt, aim); world.camera.position.set(0, 62, 64); world.camera.lookAt(0, 0, 4); world.camera.updateMatrixWorld(); world.renderer.render(world.scene, world.camera); };
  });
  await waitFor(a, () => pinturaDebug.world.scene.getObjectByName('Base bandera 1')?.visible === true);
  await a.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await shot(a, 'puerto-stands');
  // Fast-forward the practice round to its end with the bots playing.
  await stage(() => {
    const { room, world } = pinturaDebug, g = room.game; world.draw = window.ctfStands;
    g.players.find(p => p.id === room.id).connected = false;
    for (let i = 0; i < 20 * 900 && g.phase === 'playing'; i++) g.step(.05);
    room.publish();
  });
  await waitFor(a, () => pinturaDebug.room.state.phase === 'finished' && !document.querySelector('#results').hidden);
  const practice = await a.evaluate(() => ({ outcome: pinturaDebug.room.state.outcome, scores: pinturaDebug.room.state.teamScores }));
  assert.ok(practice.outcome && (practice.outcome.reason === 'limit' || practice.outcome.reason === 'time'), JSON.stringify(practice));
  assert.deepEqual(a.errors, []);
  console.log('ok: capture the flag online (server flags, capture, end on both clients) and in practice', JSON.stringify({ online: ea, practice }));
} finally { await browser.close(); }
