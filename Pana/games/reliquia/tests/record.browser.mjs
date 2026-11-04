// Fosa's record with two real clients: an old mark in the lobby, a guest who
// falls and gets up, a jornada completed, and the record falling on both
// screens, then still there after a reload. The record is engine/records.js.
import assert from 'node:assert/strict';
import path from 'node:path';
import { launch, openGame, waitFor, qaDir } from '../../../tests/browser-kit.js';

const output = process.env.PANA_SHOT_DIR || qaDir(import.meta.url), room = `reliquia-record-${Date.now().toString(36)}`;
const check = text => console.log(`ok  ${text}`);
const OLD = { players: { beto: { name: 'Beto', best: { rounds: { value: 1, t: Date.UTC(2026, 9, 20) }, comebacks: { value: 3, t: Date.UTC(2026, 9, 20) } } } } };
const tiles = page => page.$$eval('#result-record .pk-record-tile', nodes => nodes.map(n => ({ text: n.textContent, broken: n.classList.contains('is-broken') })));
const browser = await launch();
try {
  const open = async name => { const p = await openGame(browser, 'reliquia', { name, room, query: 'debug' }); p.setDefaultTimeout(90_000); await waitFor(p, () => window.reliquia?.room.connected); return p; };
  const a = await open('Juan');
  // The host has played before: Beto's old marks wait in this browser.
  await a.evaluate(old => localStorage.setItem('pana:records:reliquia', JSON.stringify(old)), OLD);
  await a.reload({ waitUntil: 'domcontentloaded' });
  await waitFor(a, () => window.PANA_PREPARED === true && window.reliquia?.room.connected);
  const b = await open('Ana');
  await waitFor(a, () => reliquia.state.players.length === 2);

  const lobby = a.locator('#lobby-record');
  await lobby.locator('.pk-record-tile').first().waitFor();
  assert.match(await lobby.innerText(), /Beto/);
  assert.equal(await a.locator('.pk-game-lobby-roster #lobby-record').count(), 1, 'the readout stands in the shared lobby\'s roster column');
  await a.evaluate(() => document.querySelector('.pk-loading-cover, .pk-cover')?.remove());
  await a.screenshot({ path: path.join(output, 'lobby-record.png') });
  assert.equal(await b.locator('#lobby-record .pk-record-open').count(), 0, 'a browser with no marks has no table to open');
  check('the lobby reads who holds the record');

  await a.locator('.pk-record-open').click();
  assert.match(await a.locator('.pk-record-table').innerText(), /Beto/);
  await a.locator('.pk-record-open').click();
  check('the shared button opens the table');

  await a.locator('#start').click();
  await waitFor(b, () => reliquia.state.phase === 'playing');
  const ids = await a.evaluate(() => ({ a: reliquia.room.id, b: reliquia.state.players.find(p => p.id !== reliquia.room.id).id }));

  // The guest falls and gets back up; then two jornadas are completed.
  await a.evaluate(({ b }) => { const g = reliquia.room.game, q = g.players.find(p => p.id === b), me = g.players.find(p => p.id === reliquia.room.id); g.down(q); g.getUp(q, me); reliquia.room.publish(); }, ids);
  await a.evaluate(() => reliquia.jornada(3));
  await waitFor(b, () => reliquia.state.level === 3);
  const numbers = await b.evaluate(() => reliquia.state.players.map(p => [p.name, p.stats.rounds, p.stats.comebacks]));
  assert.deepEqual(numbers.sort(), [['Ana', 2, 1], ['Juan', 2, 0]]);
  check('jornadas and comebacks count on both clients');

  // Stored the moment the jornada ends, before the expedition does.
  await waitFor(a, () => JSON.parse(localStorage.getItem('pana:records:reliquia')).players.juan?.best.rounds.value === 2);
  await waitFor(b, () => JSON.parse(localStorage.getItem('pana:records:reliquia')).players.ana?.best.comebacks.value === 1);
  assert.match(await a.locator('#record-line').textContent(), /^2 · /);
  check('the record is saved when the jornada ends, and the Tab panel reads it');

  await a.evaluate(() => { reliquia.room.game.finish('extracted'); reliquia.room.publish(); });
  await waitFor(a, () => reliquia.state.phase === 'results'); await waitFor(b, () => reliquia.state.phase === 'results');
  for (const page of [a, b]) await page.locator('#result-record .pk-record-tile').first().waitFor();
  const [rounds, comebacks] = await tiles(a);
  assert.equal(rounds.broken, true); assert.match(rounds.text, /Juan/); assert.match(rounds.text, /Ana/); assert.match(rounds.text, /Antes: Beto · 1/); assert.match(rounds.text, /Récord roto/);
  assert.equal(comebacks.broken, false); assert.match(comebacks.text, /Beto/);
  const [guestRounds, guestComebacks] = await tiles(b);
  assert.match(guestRounds.text, /Primer récord/); assert.match(guestComebacks.text, /Ana/);
  await a.screenshot({ path: path.join(output, 'end-record-broken.png') });
  check('the end screen says who broke it and who held it, on both screens');

  // The same results again (a late snapshot) change nothing.
  const stored = await a.evaluate(() => localStorage.getItem('pana:records:reliquia'));
  await a.evaluate(() => reliquia.room.publish());
  assert.equal(await a.evaluate(() => localStorage.getItem('pana:records:reliquia')), stored);

  await b.reload({ waitUntil: 'domcontentloaded' });
  await waitFor(b, () => window.PANA_PREPARED === true);
  assert.equal(await b.evaluate(() => JSON.parse(localStorage.getItem('pana:records:reliquia')).players.ana.best.rounds.value), 2);
  check('the record survives a reload');

  const errors = [...a.errors, ...b.errors].filter(e => !/WebSocket|Colyseus|reconnect/i.test(e));
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
