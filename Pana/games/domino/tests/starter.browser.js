import assert from 'node:assert/strict';
import { launch, openGame, waitFor, qaDir } from '../../../tests/browser-kit.js';

// ¿Quién empieza? as Dominó's first-mano option: two real panas shake at once,
// the bots slam on their own and the highest opens with any tile.
const browser = await launch(), code = `domino-cacho-${Date.now()}`, qa = qaDir(import.meta.url);
try {
  const host = await openGame(browser, 'domino', { room: code, name: 'Juan', query: 'debug' });
  await waitFor(host, () => dominoDebug.room.connected && dominoDebug.world);
  const guest = await openGame(browser, 'domino', { room: code, name: 'Ana', query: 'debug' });
  await waitFor(guest, () => dominoDebug.room.connected && dominoDebug.world);
  await waitFor(host, () => dominoDebug.room.state.players.filter(p => p.id !== null).length === 2);
  if (await host.locator('#pana-lobby-shell').isVisible()) for (const page of [host, guest]) await waitFor(page, () => !document.querySelector('#pana-lobby-ready')?.disabled);
  await host.locator('#pana-room-more').click();
  await host.locator('[data-room-option="starter"][data-value="cacho"]').click();
  await host.locator('#pana-room-done').click();
  await waitFor(guest, () => dominoDebug.room.state.options.starter === 'cacho');
  await host.locator('#start').click();
  await waitFor(guest, () => dominoDebug.room.state.phase === 'starter');
  await host.locator('#pana-starter-shake').waitFor(); await guest.locator('#pana-starter-shake').waitFor();
  const seats = [await host.evaluate(() => dominoDebug.room.seat), await guest.evaluate(() => dominoDebug.room.seat)];
  // Juan holds the button; Ana holds Space. Both shake at once.
  await host.locator('#pana-starter-shake').dispatchEvent('pointerdown', { pointerId: 3, button: 0 });
  await guest.evaluate(() => document.activeElement?.blur()); await guest.keyboard.down(' ');
  await waitFor(host, seats => seats.every(seat => dominoDebug.room.state.cachos.shaking.includes(seat) || seat in dominoDebug.room.state.cachos.slammed), seats);
  assert.ok(await guest.evaluate(() => dominoDebug.world.starter.group.visible), 'the cachos are on the table');
  await host.screenshot({ path: `${qa}/domino-cachos.png` });
  await host.locator('#pana-starter-shake').dispatchEvent('pointerup', { pointerId: 3, button: 0 });
  await guest.keyboard.up(' ');
  await waitFor(host, seats => seats.every(seat => seat in dominoDebug.room.state.cachos.slammed) || dominoDebug.room.state.cachos.phase !== 'shake', seats);
  await waitFor(guest, () => dominoDebug.world.starter.revealed || dominoDebug.room.state.phase === 'playing');
  await waitFor(host, () => dominoDebug.room.state.phase === 'playing');
  const revision = await host.evaluate(() => dominoDebug.room.state.revision);
  await waitFor(guest, revision => dominoDebug.room.state.revision >= revision, revision);
  const state = await guest.evaluate(() => dominoDebug.room.state);
  assert.equal(state.starter, state.cachos.order[0], 'the highest cacho opens');
  // Bots keep playing while we look: the opener's tile is the first play, any tile at all.
  assert.equal(state.openingTile, null, 'no double six needed');
  if (state.history.length) assert.equal(state.history[0].seat, state.cachos.order[0]);
  else { assert.equal(state.turn, state.starter); assert.equal(await guest.evaluate(() => dominoDebug.legalMoves(dominoDebug.room.state).length), 7, 'the winner opens with any tile'); }
  assert.equal(await guest.evaluate(() => dominoDebug.world.starter.active), false, 'the cachos leave the table');
  assert.ok(await guest.locator('.rack-panel').isVisible(), 'the rack is back');
  for (const page of [host, guest]) assert.deepEqual(page.errors, []);
  console.log('ok: Dominó opens its first mano with the cachos, two panas shaking at once');
} finally { await browser.close(); }
