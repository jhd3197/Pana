// Two real clients and the Cuaderno: each screen keeps its own book, a first find
// pays once with a toast, more snapshots pay nothing, a rank reached mid-dive waits for
// the results, and the chip follows from the lobby to the results.
import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const room = `fosa-cuaderno-${Date.now().toString(36)}`, check = text => console.log(`ok  ${text}`);
const shots = process.env.PANA_CUADERNO_SHOTS;
const browser = await launch();
const open = async name => { const p = await openGame(browser, 'reliquia', { name, room, query: 'debug' }); p.setDefaultTimeout(90_000); await waitFor(p, () => window.reliquia?.room.connected); return p; };
const book = page => page.evaluate(() => JSON.parse(localStorage.getItem('pana:logbook:reliquia') || '{"found":[]}').found);
const paid = page => page.evaluate(() => JSON.parse(localStorage.getItem('pana:progress:reliquia') || '{"xp":0,"dives":0,"receipts":[]}'));
const found = (page, id) => waitFor(page, id => JSON.parse(localStorage.getItem('pana:logbook:reliquia') || '{"found":[]}').found.includes(id), id);
const chip = (page, parent) => page.evaluate(parent => document.querySelector(`#${parent} .pk-chip`)?.textContent, parent);
try {
  const a = await open('Juan'), b = await open('Ana');
  await waitFor(a, () => reliquia.state.players.length === 2); await waitFor(b, () => reliquia.state.players.length === 2);
  await waitFor(a, () => reliquia.room.isHost);
  for (const page of [a, b]) {
    await waitFor(page, () => document.querySelector('#room-options .pk-logbook .pk-chip')?.textContent === 'Cuaderno 0 %');
    // Hit-tested at its bottom edge: a scroller's clip keeps the box's size, and only this sees it.
    const seen = await page.evaluate(() => { const c = document.querySelector('#room-options .pk-logbook .pk-chip'); c.scrollIntoView({ block: 'nearest' }); const r = c.getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.bottom - 2) === c; });
    assert.ok(seen, 'the whole chip shows on the lobby');
  }
  if (shots) await a.screenshot({ path: `${shots}/cuaderno-lobby.png` });
  check('both lobbies show the chip at 0 %');

  await a.evaluate(() => reliquia.room.action('configure', { options: { place: 'mina' } }));
  await waitFor(b, () => reliquia.state.options.place === 'mina');
  await a.locator('#start').click(); await waitFor(b, () => reliquia.state.phase === 'playing');
  await waitFor(a, () => reliquia.state.phase === 'playing');
  assert.deepEqual(await book(a), [], 'nothing is written at the camp');

  // The host goes down alone: only their book takes the place.
  const down = page => page.evaluate(() => { const g = reliquia.room.game, stop = g.layout.run.lifts.find(l => l.floor === 1); reliquia.place(reliquia.room.id, stop.x, stop.z - 5, Math.PI); });
  await down(a);
  await found(a, 'lugar:mina');
  await waitFor(a, () => /^Cuaderno: .+ · \+5 XP$/.test(document.getElementById('toast').textContent));
  assert.deepEqual(await book(b), [], 'the guest stayed at the camp');
  const first = await paid(a);
  assert.equal(first.xp, (await book(a)).length * 5, 'all it found by the lift, each paid once'); assert.equal(first.dives, 0, 'a find is not a dive'); assert.ok(first.receipts.includes('logbook:lugar:mina'));
  assert.equal((await paid(b)).xp, 0);
  check('a first find pays the one who made it, with its toast');

  // The guest holds a treasure the host does not: their own book.
  const guest = await b.evaluate(() => reliquia.room.id);
  await a.evaluate(id => { const g = reliquia.room.game, stop = g.layout.run.lifts.find(l => l.floor === 1), p = g.players.find(q => q.id === id); reliquia.place(id, stop.x, stop.z - 5, Math.PI); p.hands[0] = { kind: 'miche' }; reliquia.room.publish(); }, guest);
  await found(b, 'tesoro:miche'); await found(b, 'lugar:mina');
  assert.ok(!(await book(a)).includes('tesoro:miche'), 'the host holds nothing');
  check('each pana keeps their own book');

  // A creature right ahead, then a pile of snapshots: one page, one payment.
  const spawned = await a.evaluate(() => reliquia.spawn('lector', 2.5));
  assert.ok(spawned, 'spawned');
  await found(a, 'bicho:lector');
  await a.evaluate(() => { for (let i = 0; i < 5; i++) reliquia.room.publish(); });
  const event = await a.evaluate(() => reliquia.state.eventId); await waitFor(b, id => reliquia.state.eventId === id, event);
  const host = await paid(a), written = await book(a);
  assert.equal(host.xp, written.length * 5, 'every find paid once');
  assert.equal(host.receipts.filter(r => r === 'logbook:bicho:lector').length, 1);
  check('more snapshots pay nothing');

  // Five finds reach Buzo, but no ceremony lands during the dive.
  await a.evaluate(() => { const g = reliquia.room.game; for (const suceso of ['apagon', 'derrumbe', 'creciente', 'esporada']) g.event('suceso', '', { suceso }); reliquia.room.publish(); });
  await waitFor(a, () => JSON.parse(localStorage.getItem('pana:progress:reliquia')).xp >= 25);
  assert.equal(await a.evaluate(() => !!document.querySelector('.pk-lu')), false, 'no ceremony mid-dive');
  check('a rank reached mid-dive waits');

  const beforeEnd = await paid(a), inBook = (await book(a)).length;
  await a.evaluate(() => { const g = reliquia.room.game; g.time = 60; g.finish('wipe'); reliquia.room.publish(); });
  for (const page of [a, b]) await waitFor(page, () => reliquia.state.phase === 'results' && document.querySelector('.pk-rank-gain')?.textContent);
  const after = await paid(a);
  assert.equal(after.dives, 1); assert.ok(after.xp > beforeEnd.xp, 'the dive pays on top');
  assert.equal(await a.locator('.pk-rank-gain').first().textContent(), `+${after.xp} XP`, 'the line holds the finds and the dive');
  const total = await a.evaluate(async () => (await import('./cuaderno.js')).CATALOG.length);
  assert.equal(await chip(a, 'result-cuaderno'), `Cuaderno ${Math.floor(inBook / total * 100)} %`);
  const fits = await a.evaluate(() => { const r = document.querySelector('#result-cuaderno .pk-logbook').getBoundingClientRect(), c = document.querySelector('.pk-results-card').getBoundingClientRect(), t = document.querySelector('#result-cuaderno .pk-copy'); return r.left >= c.left && r.right <= c.right && t.textContent.length > 0; });
  assert.ok(fits, 'the line stays inside the card, with the newest entry');
  await waitFor(a, () => /Buzo/.test(document.getElementById('rank-toast')?.textContent || ''));
  if (shots) await a.screenshot({ path: `${shots}/cuaderno-results.png` });
  assert.equal(await chip(b, 'result-cuaderno'), `Cuaderno ${Math.floor((await book(b)).length / total * 100)} %`);
  check('the results show the chip, the whole line and the rank that waited');
} finally { await browser.close(); }
