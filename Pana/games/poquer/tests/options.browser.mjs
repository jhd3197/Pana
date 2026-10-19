import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const browser = await launch(), clients = [];
try {
  const code = `omaha-options-${Date.now()}`;
  const host = await openGame(browser, 'poquer', { name: 'Ana', room: code, query: 'debug' }); clients.push(host);
  const guest = await openGame(browser, 'poquer', { name: 'Beto', room: code, query: 'debug', mobile: true }); clients.push(guest);
  await waitFor(guest, () => poquerDebug.room.state.players.length === 2);
  await waitFor(host, () => poquerDebug.room.state.players.length === 2);
  async function choose(id, value) {
    await host.locator(`[data-room-option="${id}"][data-value="${value}"]`).click();
    // The next host action carries its own last received revision. A guest's
    // acknowledgement alone does not mean that the host has consumed its view.
    await waitFor(host, ([id, value]) => poquerDebug.room.state.options[id] === value, [id, value]);
    await waitFor(guest, ([id, value]) => poquerDebug.room.state.options[id] === value, [id, value]);
  }
  await host.locator('#pana-room-more').click();
  await choose('variant', 'omaha');
  await host.locator('#map-choice').selectOption('puerto');
  await waitFor(host, () => poquerDebug.room.state.mapId === 'puerto');
  await waitFor(guest, () => poquerDebug.room.state.mapId === 'puerto');
  const beforeReset = await host.evaluate(() => poquerDebug.room.state.revision);
  await host.locator('#pana-room-reset').click();
  await waitFor(host, () => poquerDebug.room.state.mapId === 'plaza' && poquerDebug.room.state.options.variant === 'texas');
  await waitFor(guest, () => poquerDebug.room.state.mapId === 'plaza' && poquerDebug.room.state.options.variant === 'texas');
  assert.equal(await guest.evaluate(() => poquerDebug.room.state.revision), beforeReset + 1);
  await host.locator('#pana-room-done').click();
  await choose('stack', 5000); await choose('blinds', 100); await choose('turnSeconds', 40);
  await host.locator('#pana-room-more').click();
  for (const [id, value] of [['variant', 'omaha'], ['blindMinutes', 5], ['rebuy', false], ['showCards', false], ['limit', 'fixed']]) await choose(id, value);
  await host.locator('#pana-room-done').click();
  await guest.locator('#pana-room-more').click();
  assert.equal(await guest.locator('[data-room-option="variant"][data-value="texas"]').isDisabled(), true);
  await guest.locator('#pana-room-done').click();
  await guest.evaluate(() => poquerDebug.room.link.send('options', { revision: poquerDebug.room.state.revision, options: { stack: 1000 } }));
  await host.evaluate(() => {
    const link = poquerDebug.room.link, send = link.send.bind(link);
    link.send = (type, data) => { if (type === 'start') window.pokerStartSentAt = link.now(); return send(type, data); };
  });
  await host.locator('#start').click();
  await waitFor(guest, () => poquerDebug.room.state.phase === 'preflop');
  await waitFor(host, () => poquerDebug.room.state.phase === 'preflop');
  assert.equal(await guest.evaluate(() => poquerDebug.room.state.options.stack), 5000);
  assert.equal(await host.locator('#hand .card').count(), 4);
  const own = await host.evaluate(() => ({ id: poquerDebug.room.id, state: poquerDebug.room.state }));
  assert.deepEqual(own.state.players.find(p => p.id !== own.id).hole, [null, null, null, null]);
  assert.equal(own.state.pot, 150);
  assert.equal(own.state.legal.min, own.state.legal.max);
  const allotted = await host.evaluate(() => poquerDebug.room.state.deadline - pokerStartSentAt);
  assert(allotted >= 39500 && allotted <= 42000, `40-second deadline from actual start send: ${allotted}ms`);
  await waitFor(host, () => [...poquerDebug.world.cards.keys()].filter(k => k.startsWith(`hand-${poquerDebug.room.id}-`)).length === 4);
  assert.equal(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  console.log('PASS synchronized settings, host-only edits, four private Omaha cards in 3D/HUD, fixed-limit and 40-second deadline');

  for (let turn = 0; turn < 10; turn++) {
    const state = await host.evaluate(() => poquerDebug.room.state);
    if (state.phase === 'finished') break;
    const actor = state.turn === own.id ? host : guest;
    await waitFor(actor, revision => poquerDebug.room.state.revision === revision, state.revision);
    await actor.locator('#call').click();
    await waitFor(host, revision => poquerDebug.room.state.revision > revision, state.revision);
    await waitFor(guest, revision => poquerDebug.room.state.revision > revision, state.revision);
  }
  await waitFor(host, () => poquerDebug.room.state.phase === 'finished');
  const result = await host.evaluate(() => poquerDebug.room.state);
  assert(result.result.showdown); assert.equal(result.players.reduce((n, p) => n + p.chips, 0), 10000);
  assert.deepEqual(result.players.find(p => p.id !== own.id).hole, [null, null, null, null]);
  assert.equal(result.players.find(p => p.id !== own.id).handName, '');
  assert.equal(await host.locator('#showdown .showdown-row').count(), 1);
  console.log('PASS real Omaha showdown settles the pot without revealing opted-out opponents');

  await host.locator('#organize-table').click();
  await waitFor(host, () => poquerDebug.room.state.phase === 'lobby');
  await choose('turnSeconds', 20);
  await host.locator('#pana-room-more').click(); await choose('limit', 'pot'); await host.locator('#pana-room-done').click();
  await host.locator('#start').click(); await waitFor(guest, () => poquerDebug.room.state.phase === 'preflop');
  await waitFor(host, () => poquerDebug.room.state.phase === 'preflop');
  const state = await host.evaluate(() => poquerDebug.room.state), actor = state.turn === own.id ? host : guest;
  const legal = await actor.evaluate(() => poquerDebug.room.state.legal);
  assert.equal(legal.max, 300);
  await actor.evaluate(max => poquerDebug.room.act('raise', max + 1), legal.max);
  await actor.locator('#call').click();
  await waitFor(host, revision => poquerDebug.room.state.revision > revision, state.revision);
  assert.equal(await host.evaluate(() => poquerDebug.room.state.currentBet), 100);
  const revision = await host.evaluate(() => poquerDebug.room.state.revision);
  await waitFor(host, r => poquerDebug.room.state.revision > r, revision, 30000);
  assert.notEqual(await host.evaluate(() => poquerDebug.room.state.turn), state.turn);
  assert.deepEqual([...host.errors, ...guest.errors], []);
  console.log('PASS pot-limit rejects an excessive raise, and the selected 20-second server deadline advances an idle turn');
} catch (error) {
  for (const page of clients) console.error(await page.evaluate(() => ({
    host: poquerDebug.room.isHost, connected: poquerDebug.room.connected,
    revision: poquerDebug.room.state.revision, phase: poquerDebug.room.state.phase,
    mapId: poquerDebug.room.state.mapId, options: poquerDebug.room.state.options,
    mapControl: document.querySelector('#map-choice')?.value,
  })).catch(() => 'Page unavailable'), page.errors);
  throw error;
} finally { await browser.close(); }
