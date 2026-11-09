// The online table across hands: the host leaves and the next pana deals, a
// newcomer sits in, an all-in runs out the board, and a pana who leaves keeps
// their stack while someone using the same name does not.
import assert from 'node:assert/strict';
import { pokerSuite } from './poker-kit.js';
const { errors, wait, open, same, act, close } = pokerSuite(import.meta.url), code = `poker-seats-${Date.now()}`;
try {
  const a = await open('Juan', code), b = await open('María', code);
  await wait(a, () => poquerDebug.room.state.players.length === 2);
  // The host's seat order picks the dealer (the cachos are browser.mjs's), and a fold ends the first hand.
  await a.evaluate(() => poquerDebug.room.configure({ starter: 'anfitrion' })); await wait(b, () => poquerDebug.room.state.options.starter === 'anfitrion');
  await a.locator('#start').click(); await wait(b, () => poquerDebug.room.state.phase === 'preflop'); await same(a, b);
  const opener = await a.evaluate(() => poquerDebug.room.state.turn === poquerDebug.room.id) ? a : b;
  await act(opener, '#fold'); await same(a, b); await wait(a, () => poquerDebug.room.state.phase === 'finished');
  await a.locator('#again').click(); await wait(b, () => poquerDebug.room.state.hand === 2); await same(a, b);
  await a.close(); await wait(b, () => poquerDebug.room.isHost && poquerDebug.room.state.phase === 'finished');
  const c = await open('Luis', code); await wait(b, () => poquerDebug.room.state.players.some(p => p.name === 'Luis'));
  await b.locator('#again').click(); await wait(c, () => poquerDebug.room.state.hand === 3); await same(b, c);
  const actor = await b.evaluate(() => poquerDebug.room.state.turn === poquerDebug.room.id) ? b : c;
  await act(actor, '#fold'); await same(b, c); assert.equal(await b.evaluate(() => poquerDebug.room.state.phase), 'finished');
  console.log('ok: host departure folds its hand; next host deals and new player participates');
  await b.locator('#again').click(); await wait(c, () => poquerDebug.room.state.hand === 4); await same(b, c);
  const bankroll = await b.evaluate(() => poquerDebug.room.state.pot + poquerDebug.room.state.players.reduce((n, p) => n + p.chips, 0));
  const shove = await b.evaluate(() => poquerDebug.room.state.turn === poquerDebug.room.id) ? b : c, caller = shove === b ? c : b;
  const maximum = await shove.evaluate(() => poquerDebug.room.state.legal.max); await wait(shove, () => !document.querySelector('#amount').disabled); await shove.locator('#amount').fill(String(maximum)); await act(shove, '#raise'); await same(b, c);
  await act(caller, '#call'); await same(b, c); assert.equal(await b.evaluate(() => poquerDebug.room.state.phase), 'finished'); assert.equal(await c.evaluate(() => poquerDebug.room.state.board.length), 5);
  assert.equal(await b.evaluate(() => poquerDebug.room.state.players.reduce((n, p) => n + p.chips, 0)), bankroll);
  console.log('ok: online all-in and call run out the board and conserve both stacks');
  // Leaving and coming back keeps your stack (after the all-in: 0, 1000 on a split, or 2000), not a fresh one;
  // someone else using the same name never gets it.
  const stack = await b.evaluate(() => poquerDebug.room.state.players.find(p => p.name === 'Luis').chips), device = c.context();
  await c.close(); await wait(b, () => !poquerDebug.room.state.players.find(p => p.name === 'Luis')?.connected);
  const impostor = await open('Luis', code); await wait(b, () => poquerDebug.room.state.players.some(p => p.name === 'Luis' && p.connected));
  await wait(impostor, () => poquerDebug.room.state.players.find(p => p.id === poquerDebug.room.id)?.chips === 1000);   // a name alone starts fresh
  await impostor.close(); await wait(b, () => !poquerDebug.room.state.players.some(p => p.name === 'Luis' && p.connected));
  const back = await open('Luis', code, false, device);
  await wait(back, chips => poquerDebug.room.state.players.find(p => p.id === poquerDebug.room.id)?.chips === chips, stack);   // not a fresh stack
  console.log('ok: a pana who leaves and rejoins keeps their stack; a name alone does not');
  await b.close(); await back.close();
  assert.deepEqual(errors, []); console.log('Poker seats proof passed.');
} finally { await close(); }
