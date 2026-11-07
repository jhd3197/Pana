// Two real clients and the day's dive: the host presses "Del día", both play the
// same fixed cave and pacts, each screen pays its bonus once and shows the day's
// best and the streak, and the next plain dive gets the host's options back.
import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const room = `fosa-daily-${Date.now().toString(36)}`, check = text => console.log(`ok  ${text}`);
const shots = process.env.PANA_DAILY_SHOTS;
const browser = await launch();
const open = async name => { const p = await openGame(browser, 'reliquia', { name, room, query: 'debug' }); p.setDefaultTimeout(90_000); await waitFor(p, () => window.reliquia?.room.connected); return p; };
const saved = (page, key) => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), key);
const visible = (page, id) => page.evaluate(i => { const e = document.getElementById(i); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).display !== 'none'; }, id);
const finish = (page, edit) => page.evaluate(edit => { const g = reliquia.room.game; Object.assign(g, edit); g.finish(edit.outcome); reliquia.room.publish(); }, edit);
const gain = page => page.evaluate(() => document.querySelector('.pk-rank-gain').textContent);
const today = page => page.evaluate(async () => { const d = await import('/engine/daily.js'); return d.dayKey(); });
try {
  const a = await open('Juan'), b = await open('Ana');
  await waitFor(a, () => reliquia.state.players.length === 2); await waitFor(b, () => reliquia.state.players.length === 2);
  await waitFor(a, () => reliquia.room.isHost);
  assert.equal(await visible(a, 'daily-start'), true, 'the host sees the button');
  assert.equal(await visible(b, 'daily-start'), false, 'a guest does not');
  assert.equal(await a.locator('#daily-start').textContent(), 'Del día');
  assert.equal(await a.evaluate(() => getComputedStyle(document.getElementById('daily-start')).borderTopLeftRadius), '0px', 'square corners');
  const clear = await a.evaluate(() => { const r = document.getElementById('daily-start').getBoundingClientRect(), s = document.getElementById('start').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && (r.right <= s.left || s.right <= r.left || r.bottom <= s.top || s.bottom <= r.top); });
  assert.ok(clear, 'on screen, beside the start button');
  if (shots) await a.screenshot({ path: `${shots}/daily-lobby.png` });
  check('only the host gets the button, square and beside the start button');

  // The shared lobby's barrier holds it like the start button: a guest who is not ready stops it.
  const toggleReady = () => b.evaluate(() => document.querySelector('.pk-game-lobby-player.is-own').click());
  const states = want => waitFor(a, want => [...document.querySelectorAll('.pk-game-lobby-state')].filter(e => e.classList.contains('is-ready')).length === want, want);
  await states(2); await toggleReady(); await states(1);
  await a.locator('#daily-start').click();
  assert.match(await a.locator('#pana-lobby-status').textContent(), /Falta que todos/);
  assert.equal(await a.evaluate(() => reliquia.state.phase), 'lobby');
  await toggleReady(); await states(2);
  check('the "everyone ready" barrier holds the button too');

  // A host's own settings, to prove the day replaces them and they come back.
  await a.evaluate(() => reliquia.room.action('configure', { options: { place: 'mina', difficulty: 'hard' } }));
  await waitFor(b, () => reliquia.state.options.place === 'mina');
  const day = await today(a);
  await a.locator('#daily-start').click();
  await waitFor(a, () => reliquia.state.phase === 'playing'); await waitFor(b, () => reliquia.state.phase === 'playing');
  const expected = await a.evaluate(async day => { const { dailyPlan } = await import('./daily.js'); return dailyPlan(day); }, day);
  for (const page of [a, b]) {
    const s = await page.evaluate(() => ({ seed: reliquia.state.seed, daily: reliquia.state.daily, options: reliquia.state.options }));
    assert.equal(s.seed, expected.seed); assert.equal(s.daily, day);
    assert.equal(s.options.place, 'alternar'); assert.equal(s.options.difficulty, 'normal');
    for (const id of expected.pactos) assert.equal(s.options[`pacto:${id}`], true, id);
  }
  check('both clients dive the day\'s seed and pacts, whatever the host had set');

  // The guest played yesterday and the day before, with a freeze saved: this makes day 3.
  await b.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - 1); const y = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; localStorage.setItem('pana:streak:reliquia', JSON.stringify({ days: 2, best: 2, freezes: 1, last: y })); });
  // Every text the results toast shows, in order: a new Calor máximo follows the racha.
  for (const page of [a, b]) await page.evaluate(() => { window.toasts = []; new MutationObserver(() => { const t = document.getElementById('rank-toast')?.textContent; if (t && t !== window.toasts.at(-1)) window.toasts.push(t); }).observe(document.body, { childList: true, subtree: true, characterData: true }); });
  await finish(a, { time: 300, haul: 1000, level: 2, outcome: 'extracted' });
  for (const page of [a, b]) await waitFor(page, () => reliquia.state.phase === 'results' && document.getElementById('daily-best')?.textContent);
  const first = {};
  for (const [who, page] of [['a', a], ['b', b]]) {
    assert.match(await page.locator('#daily-best').textContent(), /^Mejor del día: 1 jornada · Bs\./);
    assert.equal(await page.locator('#streak-chip').textContent(), who === 'a' ? 'Racha 1' : 'Racha 3');
    assert.equal(await visible(page, 'streak-freezes'), who === 'b', 'freezes only when there are some');
    const s = await saved(page, 'pana:progress:reliquia');
    assert.equal(s.dives, 1, 'the bonus is not a dive'); assert.ok(s.receipts.includes(`daily:${day}`));
    assert.equal(await gain(page), `+${s.xp} XP`, 'the line shows the dive and the bonus together');
    first[who] = s.xp;
    assert.equal((await saved(page, 'pana:reliquia:daily-best')).jornadas, 1);
    const inside = await page.evaluate(() => { const r = document.getElementById('daily-line').getBoundingClientRect(), c = document.querySelector('.pk-results-card').getBoundingClientRect(); return r.left >= c.left && r.right <= c.right; });
    assert.ok(inside, 'the line stays inside the card');
    assert.ok(await page.evaluate(() => { const e = document.getElementById('daily-best'); return e.getBoundingClientRect().height < 2 * parseFloat(getComputedStyle(e).lineHeight); }), 'the best stays on one line');
  }
  assert.equal(await visible(a, 'daily-again'), true); assert.equal(await visible(b, 'daily-again'), false);
  assert.equal(await b.locator('#streak-freezes').textContent(), 'Comodín 1');
  await waitFor(b, () => window.toasts.some(t => /3 días seguidos/.test(t)));
  await waitFor(b, () => window.toasts.some(t => /Calor máximo/.test(t)));
  const shown = await b.evaluate(() => window.toasts);
  assert.ok(shown.findIndex(t => /seguidos/.test(t)) < shown.findIndex(t => /Calor máximo/.test(t)), 'the racha comes before the new Calor máximo');
  assert.ok(!(await a.evaluate(() => window.toasts)).some(t => /seguidos/.test(t)));
  if (shots) await b.screenshot({ path: `${shots}/daily-results.png` });
  check('each screen is paid its bonus and shows the best and the streak');

  // Another try at the same day: paid as a dive, no second bonus, no second streak day.
  await a.locator('#daily-again').click(); await waitFor(b, () => reliquia.state.phase === 'playing');
  assert.equal(await b.evaluate(() => reliquia.state.seed), expected.seed);
  await finish(a, { time: 120, haul: 0, outcome: 'wipe' });
  for (const page of [a, b]) await waitFor(page, () => reliquia.state.phase === 'results' && JSON.parse(localStorage.getItem('pana:progress:reliquia')).dives === 2);
  const retried = await saved(a, 'pana:progress:reliquia');
  assert.equal(retried.dives, 2);
  assert.equal(retried.receipts.filter(r => r === `daily:${day}`).length, 1);
  assert.equal(await a.locator('#streak-chip').textContent(), 'Racha 1');
  assert.match(await a.locator('#daily-best').textContent(), /1 jornada/, 'the better try stays');
  check('another try at the day pays as a dive, with no second bonus or streak day');

  // A plain dive: the host's own options, a seed of its own, no daily line.
  await a.locator('#again').click(); await waitFor(b, () => reliquia.state.phase === 'playing' && !reliquia.state.daily);
  const plain = await b.evaluate(() => ({ seed: reliquia.state.seed, options: reliquia.state.options }));
  assert.notEqual(plain.seed, expected.seed);
  assert.equal(plain.options.place, 'mina'); assert.equal(plain.options.difficulty, 'hard');
  for (const id of expected.pactos) assert.equal(plain.options[`pacto:${id}`], false, id);
  await finish(a, { time: 200, haul: 300, outcome: 'extracted' });
  for (const page of [a, b]) await waitFor(page, () => reliquia.state.phase === 'results' && !document.getElementById('daily-best')?.textContent);
  assert.equal(await a.locator('#streak-chip').textContent(), 'Racha 1');
  assert.deepEqual(a.errors, []); assert.deepEqual(b.errors, []);
  check('the next plain dive has the host\'s options back and no daily line');
} finally { await browser.close(); }
