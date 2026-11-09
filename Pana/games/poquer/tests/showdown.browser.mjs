// Two real clients in one online room: a showdown explains the winning hand
// (board, best five lit, why), and a folded hand reaches only its owner.
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const shots = path.join(os.tmpdir(), 'poker-shots'); fs.mkdirSync(shots, { recursive: true });
const room = `poker-sd-${Date.now()}`, browser = await launch();
const view = p => p.evaluate(() => ({ id: poquerDebug.room.id, state: poquerDebug.room.state }));
// Both screens on the same revision before anyone acts again.
async function synced(a, b) { const { state } = await view(a); await waitFor(b, r => poquerDebug.room.state.revision === r, state.revision); }
async function act(pages, action) {
  const turn = await pages[0].evaluate(() => poquerDebug.room.state.turn);
  const actor = (await Promise.all(pages.map(p => p.evaluate(() => poquerDebug.room.id)))).indexOf(turn);
  const p = pages[actor], rev = await p.evaluate(() => poquerDebug.room.state.revision);
  await p.evaluate(a => poquerDebug.room.act(a), action); await waitFor(p, r => poquerDebug.room.state.revision > r, rev);
  await synced(p, pages[1 - actor]); return p;
}
async function shot(p, name) {
  await p.screenshot({ path: path.join(shots, `${name}-desktop.png`) });
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(150);
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name}: no sideways scroll on mobile`);
  await p.screenshot({ path: path.join(shots, `${name}-mobile.png`) });
  await p.setViewportSize({ width: 1280, height: 800 });
}
try {
  const a = await openGame(browser, 'poquer', { name: 'Juan', room, query: 'debug&untimed' }), b = await openGame(browser, 'poquer', { name: 'María', room, query: 'debug&untimed' });
  const pages = [a, b];
  await waitFor(a, () => poquerDebug.room.connected && poquerDebug.room.isHost && poquerDebug.room.state.players.length === 2);
  await waitFor(b, () => poquerDebug.room.connected && poquerDebug.room.state.players.length === 2);
  // The host's seat order picks the dealer (no cachos); ?untimed keeps the
  // turn clock from folding a hand while a slow screen checks it.
  await a.evaluate(() => poquerDebug.room.configure({ starter: 'anfitrion' })); await waitFor(b, () => poquerDebug.room.state.options.starter === 'anfitrion');
  await a.locator('#start').click(); await waitFor(b, () => poquerDebug.room.state.phase === 'preflop'); await synced(a, b);

  // Hand 1: check it down to a real showdown.
  for (let n = 0; n < 12 && await a.evaluate(() => poquerDebug.room.state.phase !== 'finished'); n++) await act(pages, 'call');
  for (const p of pages) {
    await p.locator('#results').waitFor({ state: 'visible' });
    const { state } = await view(p); assert.equal(state.result.showdown, true); assert.equal(state.board.length, 5);
    assert.equal(await p.locator('.showdown-board .card').count(), 5, 'the whole board is shown');
    const pot = state.result.explain[0], lit = await p.locator('.showdown-row .card.is-best').count();
    // Each winner's five are lit on the board and in their own hand.
    assert.ok(lit >= 5, `best five highlighted (${lit})`);
    const boardLit = await p.locator('.showdown-board .card.is-best').count(), holeLit = await p.locator('.showdown-win .card.is-best').count();
    if (pot.winners.length === 1) assert.equal(boardLit + holeLit, 5, 'one winner: exactly five lit');
    const why = (await p.locator('.showdown-win small').first().textContent()).trim();
    assert.ok(why.length > 8, `a reason is written: "${why}"`);
    assert.match(await p.locator('.showdown-win b').first().textContent(), / · /, 'winner · hand name');
    assert.equal(await p.locator('.showdown-folded').count(), 0, 'nobody folded');
  }
  await shot(a, 'showdown-host'); await shot(b, 'showdown-rival');
  console.log('ok: showdown shows the board, the lit best five and why it won on both screens');

  // Hand 2: the first to act folds; the other takes the pot without a showdown.
  await a.locator('#again').click(); await waitFor(b, () => poquerDebug.room.state.hand === 2); await synced(a, b);
  const folder = await act(pages, 'fold'), rival = folder === a ? b : a;
  for (const p of pages) await p.locator('#results').waitFor({ state: 'visible' });
  const mine = await view(folder), theirs = await view(rival);
  const hole = mine.state.players.find(p => p.id === mine.id).hole;
  assert.ok(hole.length === 2 && hole.every(Number.isInteger));
  assert.equal(mine.state.result.showdown, false); assert.equal(mine.state.result.folded.wouldWin, false, 'no board, no claim');
  assert.deepEqual(mine.state.result.folded.hole, hole);
  // The rival's payload (the view exactly as received) never carries the folded cards.
  assert.deepEqual(theirs.state.players.find(p => p.id === mine.id).hole, [null, null]);
  assert.equal(theirs.state.result.folded, undefined);
  assert.ok(!JSON.stringify(theirs.state).includes('"folded":{'), 'no folded summary anywhere in the rival view');
  // Folder: greyed cards with their faces; rival: no folded row, no card faces of the folder.
  assert.equal(await folder.locator('.showdown-folded .card:not(.back)').count(), 2);
  assert.match(await folder.locator('.showdown-folded small').textContent(), /Solo tú ves/);
  assert.doesNotMatch(await folder.locator('.showdown-folded small').textContent(), /Habrías ganado/);
  assert.equal(await rival.locator('.showdown-folded').count(), 0);
  const labels = await rival.locator('#results .card').evaluateAll(n => n.map(e => e.getAttribute('aria-label')));
  const folderLabels = await folder.locator('.showdown-folded .card').evaluateAll(n => n.map(e => e.getAttribute('aria-label')));
  const rivalHoleLabels = await rival.locator('#hand .card').evaluateAll(n => n.map(e => e.getAttribute('aria-label')));
  for (const label of folderLabels) if (!rivalHoleLabels.includes(label)) assert.ok(!labels.includes(label), `rival results never show ${label}`);
  assert.match(await rival.locator('.showdown-win small').first().textContent(), /retiraron/);
  await shot(folder, 'folded-owner'); await shot(rival, 'folded-rival');
  console.log('ok: a folded hand is greyed for its owner only; the rival payload and screen never get it');
  const errors = [...a.errors, ...b.errors]; assert.deepEqual(errors, []);
  console.log(`Poker showdown browser proof passed. Shots: ${shots}`);
} finally { await browser.close(); }
