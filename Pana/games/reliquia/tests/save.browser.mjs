// Fosa's saved expedition with real clients. A session autosaves on the host, a
// pana drops out and comes back to their slot, and "next week" the host opens
// Continuar in a new room: a returning pana lands in their slot, a new one takes
// a missing pana's, and the expedition goes on from the same jornada.
import assert from 'node:assert/strict';
import path from 'node:path';
import { launch, openGame, waitFor, waitPrepared, qaDir, base } from '../../../tests/browser-kit.js';

const output = process.env.PANA_SHOT_DIR || qaDir(import.meta.url), id = Date.now().toString(36), check = text => console.log(`ok  ${text}`);
const browser = await launch();
const open = async (name, room) => { const p = await openGame(browser, 'reliquia', { name, room, query: 'debug' }); p.setDefaultTimeout(90_000); await waitFor(p, () => window.reliquia?.room.connected); return p; };
const uncover = page => page.evaluate(() => document.querySelector('.pk-loading-cover, .pk-cover')?.remove());
const slotText = page => page.$$eval('#lobby-slots .pk-save-slot', cards => cards.map(c => c.textContent.replace(/\s+/g, ' ').trim()));
// The shared lobby only lets the start through once everyone has loaded.
async function start(host, phase = 'playing') {
  await waitFor(host, () => window.PANA_PREPARED === true);
  await waitFor(host, () => !document.querySelector('#start').disabled);
  await host.locator('#start').click();
  await host.waitForFunction(phase => { if (reliquia.state.phase === phase) return true; document.querySelector('#start').click(); return false; }, phase, { polling: 500, timeout: 60_000 });
}
try {
  const room1 = `fosa-save-${id}`;
  const a = await open('Juan', room1); let b = await open('Ana', room1);
  await waitFor(a, () => reliquia.state.players.length === 2);
  await start(a); await waitFor(b, () => reliquia.state.phase === 'playing');

  // A party of four: two more divers on the host, tools, mangos, two jornadas.
  const before = await a.evaluate(() => {
    const g = reliquia.room.game;
    g.addPlayer('stand-in-beto', 'Beto'); g.addPlayer('stand-in-luis', 'Luis');
    g.players.find(p => p.name === 'Ana').hands[0] = { kind: 'machete' };
    g.players.find(p => p.name === 'Luis').hands[0] = { kind: 'farol' };
    reliquia.jornada(3); g.mangos = 73; reliquia.room.publish();
    return { origin: g.origin, seed: g.seed, level: g.level, quota: g.quota, encargo: g.encargo, seats: Object.fromEntries(g.players.map(p => [p.name, p.seat])), avatar: g.players.find(p => p.name === 'Ana').avatar };
  });
  await waitFor(a, level => reliquia.saves.store.list()[0]?.meta.level === level && reliquia.saves.store.load(reliquia.saves.store.list()[0].id).mangos === 73, before.level);
  const size = await a.evaluate(() => localStorage.getItem('pana:save:reliquia').length);
  assert.ok(size < 200_000, `a save stays small: ${size} bytes`);
  assert.deepEqual(await b.evaluate(() => localStorage.getItem('pana:save:reliquia')), null, 'the host owns the save');
  check(`the host autosaves between floors (${Math.round(size / 1024)} KB), and only the host`);

  // Ana drops out mid-session and comes back to the same slot.
  await b.context().close();
  await waitFor(a, () => reliquia.state.players.find(p => p.name === 'Ana')?.held === true);
  assert.equal(await a.evaluate(() => reliquia.state.players.length), 4);
  b = await open('Ana', room1);
  await waitFor(a, () => reliquia.state.players.find(p => p.name === 'Ana')?.held === false);
  await waitFor(b, seat => reliquia.me?.seat === seat, before.seats.Ana);
  assert.equal(await a.evaluate(() => reliquia.state.players.length), 4);
  check('a pana who drops out keeps their slot and walks back into it');
  await b.context().close();

  // Next week, a new room. The host's browser still has it.
  const room2 = `fosa-save-b-${id}`;
  await a.goto(`${base}/g/reliquia/?debug&room=${room2}`, { waitUntil: 'domcontentloaded' });
  await waitPrepared(a); await waitFor(a, () => window.reliquia?.room.connected && reliquia.room.isHost);
  const row = a.locator('#lobby-save .pk-save-row');
  await row.first().waitFor();
  assert.match(await row.first().innerText(), /Jornada 3/);
  assert.match(await row.first().innerText(), /4 panas/);
  assert.equal(await a.locator('.pk-game-lobby-roster #lobby-save').count(), 1);
  await uncover(a);
  await a.screenshot({ path: path.join(output, 'continuar.png') });
  check('the lobby offers Continuar with the saved jornada');

  await row.first().locator('.pk-save-continue').click();
  await waitFor(a, () => reliquia.state.resumed === true);
  await a.locator('#lobby-slots .pk-save-slot').first().waitFor();
  assert.equal(await a.locator('#pana-lobby-roster').isVisible(), false, 'the slots replace the empty seats');
  assert.equal(await a.locator('#lobby-save').isVisible(), false);
  assert.equal(await a.locator('#start').textContent(), '¡Seguir!');
  let slots = await slotText(a);
  assert.equal(slots.length, 4);
  assert.match(slots.find(s => /Juan/.test(s)), /Aquí/);
  assert.match(slots.find(s => /Ana/.test(s)), /Guardado/);
  assert.match(slots.find(s => /Luis/.test(s)), /Farol.*Guardado/i);
  check('Continuar opens the slots, with the missing panas held');

  // Ana returns by name; Carla, new, takes Beto's slot; Luis stays missing.
  b = await open('Ana', room2);
  await waitFor(a, () => reliquia.state.players.find(p => p.name === 'Ana')?.held === false);
  await waitFor(b, () => reliquia.state.resumed === true);
  const c = await open('Carla', room2);
  await waitFor(a, () => reliquia.state.players.some(p => p.name === 'Carla'));
  await c.locator('#lobby-slots .pk-save-slot:has-text("Carla")').waitFor();
  assert.match((await slotText(c)).find(s => /Carla/.test(s)), /Nuevo/);
  await c.locator('#lobby-slots .pk-save-slot:has-text("Beto") .pk-save-take').click();
  await waitFor(a, seat => reliquia.state.players.find(p => p.seat === seat)?.name === 'Carla', before.seats.Beto);
  assert.equal(await a.evaluate(() => reliquia.state.players.length), 4);
  await a.locator('#lobby-slots .pk-save-slot:has-text("Carla")').waitFor();
  const held = a.locator('#lobby-slots .pk-save-slot:has-text("Luis")');
  const fits = await held.evaluate(card => { const box = card.getBoundingClientRect(); return [...card.children].every(n => { const r = n.getBoundingClientRect(); return r.top >= box.top - 2 && r.bottom <= box.bottom + 2; }); });
  assert.equal(fits, true, 'a held card holds its picture and its button');
  assert.equal(await a.locator('#room-options button:not(:disabled)[aria-pressed]').count(), 0, 'a resumed expedition keeps its options');
  await uncover(a);
  await a.screenshot({ path: path.join(output, 'slots-resumed.png') });
  check('a returning pana lands in their slot; a new one takes a missing one');

  await start(a);
  await waitFor(b, () => reliquia.state.phase === 'playing'); await waitFor(c, () => reliquia.state.phase === 'playing');
  const after = await b.evaluate(() => { const s = reliquia.state, p = reliquia.me; return { origin: s.origin, seed: s.seed, level: s.level, quota: s.quota, encargo: s.encargo, mangos: s.mangos, seat: p.seat, hand: p.hands[0]?.kind, rounds: p.stats.rounds, held: s.players.filter(q => q.held).map(q => q.name) }; });
  assert.deepEqual({ origin: after.origin, seed: after.seed, level: after.level, quota: after.quota, encargo: after.encargo }, { origin: before.origin, seed: before.seed, level: before.level, quota: before.quota, encargo: before.encargo });
  assert.equal(Math.floor(after.mangos), 73);
  assert.equal(after.seat, before.seats.Ana); assert.equal(after.hand, 'machete');
  assert.deepEqual(after.held, ['Luis']);
  assert.equal(await c.evaluate(() => reliquia.me.seat), before.seats.Beto);
  await a.evaluate(() => reliquia.jornada(4));
  await waitFor(c, () => reliquia.state.level === 4);
  check('the expedition goes on: same seed, jornada, encargo, mangos and tools');

  // The real end clears it.
  await a.evaluate(() => { reliquia.room.game.finish('extracted'); reliquia.room.publish(); });
  await waitFor(a, () => reliquia.state.phase === 'results');
  await waitFor(a, origin => !reliquia.saves.store.list().some(s => s.id === origin), before.origin);
  check('a finished expedition leaves no save behind');

  const errors = [...a.errors, ...b.errors, ...c.errors].filter(e => !/WebSocket|Colyseus|reconnect/i.test(e));
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
