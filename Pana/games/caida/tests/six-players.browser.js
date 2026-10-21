import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { launch, openGame, waitFor, base } from '../../../tests/browser-kit.js';

// Two rendered views plus four independent browser transports exercise all six
// human seats without requiring six simultaneous WebGL contexts on CI.
const browser = await launch(), code = `caida-six-${Date.now()}`;
const clients = [];
try {
  const host = await openGame(browser, 'caida', { room: code, name: 'Ana', query: 'debug' }); clients.push(host);
  await waitFor(host, () => caidaDebug.room.isHost);
  await host.locator('[data-room-option="format"][data-value="teams"]').click();
  await host.locator('#pana-room-more').click();
  await host.locator('[data-room-option="cantos"][data-value="false"]').click();
  await host.locator('[data-room-option="starter"][data-value="anfitrion"]').click();
  await host.locator('#pana-room-done').click();
  const guest = await openGame(browser, 'caida', { room: code, name: 'Luis', mobile: true, query: 'debug' }); clients.push(guest);
  for (let seat = 2; seat < 6; seat++) {
    const context = await browser.newContext(), page = await context.newPage(); page.errors = [];
    page.on('pageerror', error => page.errors.push(error.message));
    await page.goto(`${base}/api/health`);
    await page.evaluate(async ({ code, seat }) => {
      const { CaidaRoom } = await import('/g/caida/network.js');
      window.caidaPeer = new CaidaRoom({ code, name: `Pana ${seat + 1}`, avatar: {}, onState() {}, onStatus() {}, onNotice() {} });
      await caidaPeer.connect();
    }, { code, seat }); clients.push(page);
    await waitFor(page, () => caidaPeer.connected && caidaPeer.seat >= 0);
  }
  await waitFor(host, () => caidaDebug.room.members.size === 6 && caidaDebug.room.state.players.every(p => p.id !== null));
  await waitFor(host, () => caidaDebug.world.characters.filter(p => p?.group.visible).length === 6);
  assert.equal(await host.evaluate(() => caidaDebug.room.state.scores.length), 2);
  const byId = new Map();
  for (const page of clients) byId.set(await page.evaluate(() => (window.caidaPeer || caidaDebug.room).id), page);
  // Seed only the shuffle; all game actions still travel through real room APIs.
  await host.evaluate(() => { caidaDebug.room.game.rng = 32; });
  await host.locator('#start').click();
  await waitFor(host, () => caidaDebug.room.state.phase === 'dealing');
  await host.locator('#call-one').click(); await host.locator('#deal-cards').click();
  await waitFor(host, () => caidaDebug.room.state.phase === 'playing');
  await host.screenshot({ path: path.join(tmpdir(), 'pana-caida-six-playing.png') });
  await guest.screenshot({ path: path.join(tmpdir(), 'pana-caida-six-playing-mobile.png') });
  const seats = new Set(); let turns = 0;
  while (await host.evaluate(() => caidaDebug.room.state.phase === 'playing')) {
    const state = await host.evaluate(() => caidaDebug.room.state), player = state.players[state.turn], page = byId.get(player.id);
    await waitFor(page, revision => (window.caidaPeer || caidaDebug.room).state.revision === revision, state.revision);
    await page.evaluate(card => (window.caidaPeer || caidaDebug.room).action('play', { card }), player.hand[0].id);
    await waitFor(host, revision => caidaDebug.room.state.revision > revision, state.revision);
    seats.add(state.turn); turns++;
  }
  assert.equal(seats.size, 6); assert.equal(turns, 36);
  const completed = await host.evaluate(() => caidaDebug.room.state);
  assert.equal(completed.handNumber, 2); assert.equal(completed.result.baseline, 20);
  assert.equal(new Set(completed.players.flatMap(p => p.captured).map(c => c.id)).size, 40);
  await waitFor(guest, revision => caidaDebug.room.state.revision === revision, completed.revision);
  assert.deepEqual(await guest.evaluate(() => caidaDebug.room.state.scores), completed.scores);
  await host.screenshot({ path: path.join(tmpdir(), 'pana-caida-six-desktop.png') });
  await guest.screenshot({ path: path.join(tmpdir(), 'pana-caida-six-mobile.png') });
  await host.evaluate(() => caidaDebug.room.dispose()); await host.context().close();
  await waitFor(guest, () => caidaDebug.room.isHost);
  assert.equal(await guest.evaluate(() => caidaDebug.room.state.players.length), 6);
  assert.deepEqual(await guest.evaluate(() => caidaDebug.room.state.scores), completed.scores);
  assert.equal(await guest.evaluate(() => caidaDebug.room.state.options.mode), 'sixTeams');
  for (const page of clients) assert.deepEqual(page.errors, []);
  console.log('ok: six real Caída clients rotate all 36 cards, share team scoring, render six panas and preserve results through migration');
} finally { await browser.close(); }
