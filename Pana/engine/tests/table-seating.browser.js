import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const base = process.env.PANA_TEST_URL || 'http://localhost:8461';
const browser = await chromium.launch({ headless: true, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const errors = [];
await mkdir('art/table-seating', { recursive: true });
async function open(game, code, name) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(name => {
    localStorage.setItem('pana:name', name);
    localStorage.setItem('pana:settings', JSON.stringify({ sound: false, quality: 'baja' }));
  }, name);
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  const waitForFunction = page.waitForFunction.bind(page);
  page.waitForFunction = (fn, arg, options) => waitForFunction(fn, arg, { polling: 100, ...options });
  await page.goto(`${base}/g/${game}/?debug&room=${code}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(game => window[`${game}Debug`]?.world && window[`${game}Debug`].room.connected, game, { timeout: 90000 });
  await page.evaluate(game => { window.seatingRoom = window[`${game}Debug`].room; window.seatingGame = game; }, game);
  if (game !== 'poquer') await page.locator('#loading').waitFor({ state: 'hidden' });
  return page;
}
const state = page => page.evaluate(() => seatingRoom.state);
async function synced(a, b) {
  const snapshot = await state(a);
  await b.waitForFunction(revision => seatingRoom.state.revision >= revision, snapshot.revision);
}
try {
  for (const game of ['caida', 'domino', 'poquer']) {
    const code = `seating-${game}-${Date.now()}`, a = await open(game, code, 'Ana'), b = await open(game, code, 'Luis');
    await a.waitForFunction(() => seatingRoom.state.players.filter(p => p.id !== null && !p.bot).length === 2);
    if (game === 'caida') await a.locator('[data-room-option="format"][data-value="teams"]').click();
    await synced(a, b);
    const before = await state(a), from = 1, to = game === 'poquer' ? 0 : 2;
    assert.equal(await b.locator('#table-seating select').count(), 0);
    assert.equal(await b.locator('#table-seating [data-roster-select]').count(), 0);
    await b.evaluate(() => {
      if (seatingGame === 'poquer') seatingRoom.link.send('seat', { from: 0, to: 99, revision: seatingRoom.state.revision });
      else seatingRoom.action('seat', { from: 0, to: 2 });
    });
    await b.locator(`#table-seating [data-roster-move="${to}"]`).click();
    await a.waitForFunction(({ to, id }) => seatingRoom.state.players[to].id === id, { to, id: before.players[from].id });
    await b.locator(`#table-seating [data-roster-move="${from}"]`).click();
    await a.waitForFunction(ids => seatingRoom.state.players.every((p, i) => p.id === ids[i]), before.players.map(p => p.id));
    await synced(a, b);
    await a.locator(`#table-seating [data-roster-select="${from}"]`).click();
    await a.locator(`#table-seating [data-roster-move="${to}"]`).click();
    await a.waitForFunction(({ to, id }) => seatingRoom.state.players[to].id === id, { to, id: before.players[from].id });
    await b.waitForFunction(({ to, id }) => seatingRoom.state.players[to].id === id, { to, id: before.players[from].id });
    assert.equal((await state(a)).players[from].id, before.players[to].id);
    await a.locator('#table-seating').scrollIntoViewIfNeeded();
    await a.screenshot({ path: `art/table-seating/${game}-desktop.png` });
    // Start through the UI, then complete a real networked round with legal moves.
    await a.locator('#start').click();
    await b.waitForFunction(() => seatingRoom.state.phase !== 'lobby');
    for (let step = 0; step < 250; step++) {
      const current = await state(a);
      if (['round-over', 'finished'].includes(current.phase)) break;
      await synced(a, b);
      if (game === 'poquer') {
        const actor = await a.evaluate(() => seatingRoom.id === seatingRoom.state.turn) ? a : b;
        await actor.locator('#fold').click();
      } else {
        const seat = current.phase === 'dealing' ? current.dealer : current.turn;
        const id = current.players[seat].id;
        const actor = id === await a.evaluate(() => seatingRoom.id) ? a : b;
        if (id === null) await a.evaluate(() => seatingRoom.tick(2));
        else await actor.evaluate(() => {
          const s = seatingRoom.state;
          if (s.phase === 'dealing') { seatingRoom.action(s.dealCall ? 'deal' : 'call', { call: 'up' }); return; }
          const move = window[`${seatingGame}Debug`].chooseMove(s);
          seatingRoom.action(move ? 'play' : 'pass', move || {});
        });
      }
      await a.waitForFunction(revision => seatingRoom.state.revision > revision, current.revision);
    }
    assert.ok(['round-over', 'finished'].includes((await state(a)).phase));
    await synced(a, b);
    await a.locator('#organize-table').waitFor({ state: 'visible' });
    assert.equal(await b.locator('#organize-table').isDisabled(), true);
    const ended = await state(a);
    await a.locator('#organize-table').click();
    await b.waitForFunction(() => seatingRoom.state.phase === 'lobby');
    const reset = await state(b);
    assert.deepEqual(reset.players.map(p => p.id), ended.players.map(p => p.id));
    if (game === 'poquer') {
      assert.deepEqual(reset.players.map(p => p.chips), ended.players.map(p => p.chips));
      assert.ok(reset.players.every(p => !p.hole.length));
    } else assert.deepEqual(reset.scores, [0, 0]);
    await a.locator(`#table-seating [data-roster-select="${to}"]`).click();
    await a.locator(`#table-seating [data-roster-move="${from}"]`).click();
    await b.waitForFunction(ids => seatingRoom.state.players.every((p, i) => p.id === ids[i]), before.players.map(p => p.id));
    await a.close();
    await b.waitForFunction(() => seatingRoom.isHost);
    // Poker has no automatic lobby bots: one remaining player has nobody to
    // swap with. A new arrival makes seating editable for the promoted host.
    let arrival;
    if (game === 'poquer') {
      assert.equal(await b.locator('#start').isDisabled(), false);
      arrival = await open(game, code, 'Rosa');
      await b.waitForFunction(() => seatingRoom.state.players.filter(p => p.connected).length === 2);
    }
    assert.equal(await b.locator('#table-seating [data-roster-select]').first().isDisabled(), false);
    await b.setViewportSize({ width: 390, height: 844 });
    await b.locator('#table-seating').scrollIntoViewIfNeeded();
    assert.equal(await b.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    for (const button of await b.locator('#table-seating button:visible').all()) {
      const box = await button.boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= 390 && box.height >= 44);
    }
    await b.screenshot({ path: `art/table-seating/${game}-mobile.png` });
    await b.locator('#start').click();
    await b.waitForFunction(() => seatingRoom.state.phase !== 'lobby');
    await arrival?.close();
    await b.close();
    console.log(`ok: ${game} two-client swaps, host authorization, results setup, migration, mobile and new deal`);
  }
  assert.deepEqual(errors, []);
} catch (error) {
  for (const [i, page] of browser.contexts().flatMap(c => c.pages()).entries()) {
    console.log(await page.evaluate(() => window.seatingRoom ? { game: seatingGame, phase: seatingRoom.state.phase, turn: seatingRoom.state.turn, host: seatingRoom.isHost } : location.href).catch(() => null));
    await page.screenshot({ path: `art/table-seating/failure-${i}.png` }).catch(() => {});
  }
  throw error;
} finally { await browser.close(); }
