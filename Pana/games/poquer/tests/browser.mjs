import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH || 'playwright');
const base = process.env.PANA_TEST_URL || 'http://localhost:8461', code = `poker-${Date.now()}`, errors = [];
const browser = await chromium.launch({ headless: true, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const out = 'Pana/games/poquer/qa'; await mkdir(out, { recursive: true });
const wait = (p, fn, arg) => p.waitForFunction(fn, arg, { timeout: 60000 });
async function open(name, room = code, mobile = false) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  await context.addInitScript(name => { localStorage.setItem('pana:name', name); localStorage.setItem('pana:settings', JSON.stringify({ sound: false, quality: 'baja' })); localStorage.setItem('pana:avatar', JSON.stringify({ outfit: 'hoodie', outfitColor: '#3775cc', hat: 'gorra' })); }, name);
  const p = await context.newPage(); p.on('pageerror', e => errors.push(e.message));
  await p.goto(`${base}/g/poquer/?room=${room}&debug`, { waitUntil: 'domcontentloaded' });
  await wait(p, () => window.poquerDebug?.room.connected && poquerDebug.room.id); return p;
}
async function same(a, b) {
  const state = await a.evaluate(() => poquerDebug.room.state);
  await wait(b, revision => poquerDebug.room.state.revision === revision, state.revision);
  const other = await b.evaluate(() => poquerDebug.room.state);
  assert.deepEqual(other.board, state.board); assert.equal(other.pot, state.pot); assert.equal(other.turn, state.turn);
}
async function act(p, selector) { const rev = await p.evaluate(() => poquerDebug.room.state.revision); await p.locator(selector).click(); await wait(p, rev => poquerDebug.room.state.revision > rev, rev); }
try {
  const a = await open('Juan'), b = await open('María');
  await wait(a, () => poquerDebug.room.state.players.length === 2); assert.ok(await b.locator('#start').isDisabled());
  await wait(a, () => poquerDebug.world.avatars.size === 2); await a.screenshot({ path: `${out}/lobby.png` });
  // ¿Quién empieza?: both panas shake their cacho at once; the highest takes the button.
  await a.locator('#start').click(); await wait(b, () => poquerDebug.room.state.phase === 'starter');
  await wait(b, () => poquerDebug.world.starter.active);
  assert.ok(await b.evaluate(() => poquerDebug.world.starter.active), 'the cachos are on the table');
  const seatOf = p => p.evaluate(() => poquerDebug.room.state.players.findIndex(q => q.id === poquerDebug.room.id));
  const [seatA, seatB] = [await seatOf(a), await seatOf(b)];
  await b.locator('#pana-starter-shake').dispatchEvent('pointerdown', { pointerId: 4, button: 0 });
  await a.evaluate(() => document.activeElement?.blur()); await a.keyboard.down(' ');
  // A slow screen may already have been slammed for it after eight seconds.
  await wait(a, seats => { const s = poquerDebug.room.state.starter; return !s || seats.every(seat => s.shaking.includes(seat) || seat in s.slammed || s.phase !== 'shake'); }, [seatA, seatB]);
  await a.screenshot({ path: `${out}/starter.png` });
  await a.keyboard.up(' '); await b.locator('#pana-starter-shake').dispatchEvent('pointerup', { pointerId: 4, button: 0 });
  await wait(b, () => poquerDebug.room.state.phase === 'preflop'); await same(a, b);
  assert.match(await a.evaluate(() => poquerDebug.room.state.message), /reparte/);
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
  await first.locator('#amount').fill('60'); await act(first, '#raise'); await same(first, second); assert.equal(await second.locator('#call').textContent(), 'Igualar 40');
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
  await a.locator('#again').click(); await wait(b, () => poquerDebug.room.state.hand === 2); await same(a, b);
  await a.close(); await wait(b, () => poquerDebug.room.isHost && poquerDebug.room.state.phase === 'finished');
  const c = await open('Luis'); await wait(b, () => poquerDebug.room.state.players.some(p => p.name === 'Luis'));
  await b.locator('#again').click(); await wait(c, () => poquerDebug.room.state.hand === 3); await same(b, c);
  const actor = await b.evaluate(() => poquerDebug.room.state.turn === poquerDebug.room.id) ? b : c;
  await act(actor, '#fold'); await same(b, c); assert.equal(await b.evaluate(() => poquerDebug.room.state.phase), 'finished');
  console.log('ok: host departure folds its hand; next host deals and new player participates');
  await b.locator('#again').click(); await wait(c, () => poquerDebug.room.state.hand === 4); await same(b, c);
  const bankroll = await b.evaluate(() => poquerDebug.room.state.pot + poquerDebug.room.state.players.reduce((n, p) => n + p.chips, 0));
  const shove = await b.evaluate(() => poquerDebug.room.state.turn === poquerDebug.room.id) ? b : c, caller = shove === b ? c : b;
  const maximum = await shove.evaluate(() => poquerDebug.room.state.legal.max); await shove.locator('#amount').fill(String(maximum)); await act(shove, '#raise'); await same(b, c);
  await act(caller, '#call'); await same(b, c); assert.equal(await b.evaluate(() => poquerDebug.room.state.phase), 'finished'); assert.equal(await c.evaluate(() => poquerDebug.room.state.board.length), 5);
  assert.equal(await b.evaluate(() => poquerDebug.room.state.players.reduce((n, p) => n + p.chips, 0)), bankroll);
  console.log('ok: online all-in and call run out the board and conserve both stacks');
  // Leaving and coming back keeps your stack (after the all-in: 0, 1000 on a split, or 2000), not a fresh one.
  const stack = await b.evaluate(() => poquerDebug.room.state.players.find(p => p.name === 'Luis').chips);
  await c.close(); await wait(b, () => !poquerDebug.room.state.players.find(p => p.name === 'Luis')?.connected);
  const back = await open('Luis'); await wait(b, () => poquerDebug.room.state.players.some(p => p.name === 'Luis' && p.connected));
  assert.equal(await b.evaluate(() => poquerDebug.room.state.players.find(p => p.name === 'Luis' && p.connected).chips), stack, 'not a fresh stack');
  console.log('ok: a pana who leaves and rejoins keeps their stack');
  await b.close(); await back.close();
  const m = await open('Móvil', `${code}-mobile`, true); await m.screenshot({ path: `${out}/mobile-lobby.png` });
  // Practice opens with the cachos too: a finger on the table shakes, lifting it slams.
  await m.locator('#practice').tap(); await m.locator('#pana-starter-shake').waitFor();
  assert.equal(await m.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); await m.screenshot({ path: `${out}/mobile-starter.png` });
  await m.locator('#world').tap(); await wait(m, () => 0 in (poquerDebug.room.state.starter?.slammed || { 0: 1 }));
  await wait(m, () => poquerDebug.room.local && poquerDebug.room.state.hand === 1);
  await m.locator('#menu').tap(); const revision = await m.evaluate(() => poquerDebug.room.state.revision); await m.waitForTimeout(1400); assert.equal(await m.evaluate(() => poquerDebug.room.state.revision), revision);
  await m.locator('#pana-resume').tap(); await wait(m, () => !!poquerDebug.room.state.legal);
  await m.screenshot({ path: `${out}/mobile-playing.png` }); assert.equal(await m.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  for (const id of ['fold', 'call', 'raise']) { const box = await m.locator(`#${id}`).boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= 391); assert.ok(box.y + box.height <= 844); }
  await m.locator('#call').tap(); await m.setViewportSize({ width: 844, height: 390 }); await m.screenshot({ path: `${out}/mobile-landscape.png` });
  assert.equal(await m.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  console.log('ok: mobile cards/actions, shared pause, bot practice and landscape layout');
  assert.deepEqual(errors, []); console.log('Poker browser proof passed.');
} finally { await browser.close(); }
