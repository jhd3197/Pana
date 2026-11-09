// Two real panas at one online table: the cachos pick the dealer, private
// cards stay private, and a whole hand runs every street to the showdown.
// The table's later life is seats.browser.mjs; phones are mobile.browser.mjs.
import assert from 'node:assert/strict';
import { pokerSuite } from './poker-kit.js';
const { errors, out, wait, open, same, act, close } = pokerSuite(import.meta.url), code = `poker-${Date.now()}`;
try {
  const a = await open('Juan', code), b = await open('María', code);
  await wait(a, () => poquerDebug.room.state.players.length === 2); assert.ok(await b.locator('#start').isDisabled());
  await wait(a, () => poquerDebug.world.avatars.size === 2); await a.screenshot({ path: `${out}/lobby.png` });
  // ¿Quién empieza?: both panas shake their cacho at once and slam it; the highest takes the button.
  await a.locator('#start').click(); await wait(b, () => poquerDebug.room.state.phase === 'starter');
  // ?untimed never slams a cacho for its pana, so both screens still show them.
  await wait(a, () => poquerDebug.world.starter.active); await wait(b, () => poquerDebug.world.starter.active);
  assert.ok(await b.evaluate(() => poquerDebug.world.starter.active), 'the cachos are on the table');
  const seatOf = p => p.evaluate(() => poquerDebug.room.state.players.findIndex(q => q.id === poquerDebug.room.id));
  const seats = [await seatOf(a), await seatOf(b)], offered = () => !document.querySelector('#pana-starter-shake').hidden;
  // A tie throws again (heads-up, both panas) until the dealer is known.
  for (let round = 1; await b.evaluate(() => poquerDebug.room.state.phase === 'starter'); round++) {
    await wait(a, offered); await wait(b, offered);
    await b.locator('#pana-starter-shake').dispatchEvent('pointerdown', { pointerId: 4, button: 0 });
    await a.evaluate(() => document.activeElement?.blur()); await a.keyboard.down(' ');
    await wait(a, ([seats, round]) => { const s = poquerDebug.room.state.starter; return s?.phase === 'shake' && s.round === round && seats.every(seat => s.shaking.includes(seat)); }, [seats, round]);
    if (round === 1) await a.screenshot({ path: `${out}/starter.png` });
    await a.keyboard.up(' '); await b.locator('#pana-starter-shake').dispatchEvent('pointerup', { pointerId: 4, button: 0 });
    await wait(b, round => { const { phase, starter } = poquerDebug.room.state; return phase === 'preflop' || starter?.phase === 'shake' && starter.round > round; }, round);
  }
  await same(a, b);
  // The message travels as Spanish source sentences ({ text, vars }); each client translates it.
  assert.match(await a.evaluate(() => poquerDebug.room.state.message.map(m => m.text).join(' ')), /reparte/);
  assert.equal(await a.evaluate(() => poquerDebug.world.starter.active), false, 'the cachos leave the table');
  // Heads-up the dealer acts first preflop: whoever won the cacho.
  const [first, second] = await a.evaluate(() => poquerDebug.room.state.turn === poquerDebug.room.id) ? [a, b] : [b, a];
  const av = await a.evaluate(() => ({ state: poquerDebug.room.state, id: poquerDebug.room.id })), bv = await b.evaluate(() => ({ state: poquerDebug.room.state, id: poquerDebug.room.id }));
  assert.ok(av.state.players.find(p => p.id === av.id).hole.every(Number.isInteger));
  assert.deepEqual(av.state.players.find(p => p.id === bv.id).hole, [null, null]); assert.deepEqual(bv.state.players.find(p => p.id === av.id).hole, [null, null]);
  assert.equal('deck' in av.state, false);
  await wait(a, () => poquerDebug.world.cards.size === 4);
  assert.deepEqual(await a.evaluate(other => [...poquerDebug.world.cards].filter(([key]) => key.startsWith(`hand-${other}-`)).map(([, entry]) => entry.model.userData.card), bv.id), [null, null], 'opponent meshes contain only card backs');
  assert.equal(await a.evaluate(() => poquerDebug.world.camera.isPerspectiveCamera), true);
  await second.evaluate(() => poquerDebug.room.act('raise', 1000)); await second.waitForTimeout(300); await same(a, b); assert.equal(await a.evaluate(() => poquerDebug.room.state.pot), 30);
  console.log('ok: two real clients receive distinct private cards; wrong-turn action rejected');
  await wait(first, () => !document.querySelector('#amount').disabled); await first.locator('#amount').fill('60'); await act(first, '#raise'); await same(first, second); assert.equal(await second.locator('#call').textContent(), 'Igualar 40');
  await act(second, '#call'); await same(second, first); assert.equal(await a.evaluate(() => poquerDebug.room.state.phase), 'flop');
  await wait(a, () => poquerDebug.room.state.board.every((value, i) => poquerDebug.world.cards.get(`board-${i}`)?.model.userData.card === value));
  await a.screenshot({ path: `${out}/playing.png` });
  for (let n = 0; n < 12 && await a.evaluate(() => poquerDebug.room.state.phase !== 'finished'); n++) {
    const turn = await a.evaluate(() => poquerDebug.room.state.turn); const p = turn === av.id ? a : b; await act(p, '#call'); await same(a, b);
  }
  await a.locator('#results').waitFor({ state: 'visible' }); await b.locator('#results').waitFor({ state: 'visible' });
  assert.equal(await a.evaluate(() => poquerDebug.room.state.players.reduce((n, p) => n + p.chips, 0)), 2000);
  assert.ok(await b.evaluate(() => poquerDebug.room.state.players.every(p => p.hole.every(Number.isInteger))));
  await a.screenshot({ path: `${out}/results.png` }); console.log('ok: raises, calls, all streets, showdown, split/awarded pot and conservation');
  assert.deepEqual(errors, []); console.log('Poker browser proof passed.');
} finally { await close(); }
