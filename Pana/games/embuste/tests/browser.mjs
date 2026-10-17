// ¡Embuste! with real browsers on the game's own room: four panas online,
// private roles, a wrap, a report, the vote and the curiara, a sabotage fixed
// and one that floods the camp, a late joiner, host and mummy departures, and a
// touch client practising with bots.
// npm start, then: node games/embuste/tests/browser.mjs [playwright path]
// Env: PANA_TEST_URL (default http://localhost:8461), PANA_QA_OUTPUT (screenshots).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] || process.env.PANA_PLAYWRIGHT_PATH || 'playwright');
const origin = process.env.PANA_TEST_URL || 'http://localhost:8461', out = process.env.PANA_QA_OUTPUT;
const browser = await chromium.launch({ headless: true, ...(process.env.PANA_BROWSER_PATH ? { executablePath: process.env.PANA_BROWSER_PATH } : {}) });
const errors = [];
const code = 'emb' + Math.random().toString(36).slice(2, 8);
const step = (label) => console.log(`· ${label}`);
const shot = async (page, name) => { if (out) await page.screenshot({ path: `${out}/embuste-${name}.png` }); };

async function player(name, query = '', context = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 700 }, ...context });
  await ctx.addInitScript((n) => localStorage.setItem('pana:name', n), name);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/WebGL|GPU stall/.test(m.text())) errors.push(`${name} console: ${m.text()}`); });
  await page.goto(`${origin}/g/embuste/?debug&quick${query}`);
  await page.waitForFunction(() => window.embuste?.lobby, null, { timeout: 30000 });
  page.label = name;
  return page;
}
const join = (name, query = '') => player(name, `&norender&room=${code}${query}`);
const until = (page, fn, arg, timeout = 30000) => page.waitForFunction(fn, arg, { timeout, polling: 100 });
const all = (pages, fn, arg, timeout) => Promise.all(pages.map(p => until(p, fn, arg, timeout)));
const view = (page) => page.evaluate(() => embuste.view);
const debug = (page, m) => page.evaluate((m) => embuste.debug(m), m);

// Who is who this round, read from each pana's own screen.
async function cast(pages) {
  const views = await Promise.all(pages.map(view));
  const mummy = pages[views.findIndex(v => v.me.role === 'momia')];
  return { views, mummy, panas: pages.filter(p => p !== mummy), seat: (page) => views[pages.indexOf(page)].me.seat };
}

try {
  // ---------- lobby ----------
  const a = await join('Ana', '&lead=1'), b = await join('Beto'), c = await join('Caro'), d = await join('Dani');
  const pages = [a, b, c, d];
  await all(pages, () => embuste.lobby.players.length === 4);
  assert.equal(await a.evaluate(() => embuste.lobby.isHost), true, 'the lead hosts');
  assert.equal(await b.isDisabled('#start'), true, 'guests cannot start');
  await a.click('#opt-bots');
  await until(b, () => document.getElementById('opt-bots').getAttribute('aria-checked') === 'false');
  step('lobby: four panas, the lead hosts, bots off for everyone');

  // ---------- secret roles ----------
  await a.click('#start');
  await all(pages, () => embuste.view?.phase === 'playing');
  let r = await cast(pages);
  assert.equal(r.views.filter(v => v.me.role === 'momia').length, 1, 'one mummy among four');
  for (const [i, v] of r.views.entries()) {
    if (v.me.role === 'momia') { assert.deepEqual(v.partners, [], 'a lone mummy has no partner'); continue; }
    assert.ok(!JSON.stringify(v).includes('momia'), `${pages[i].label}'s screen never says momia`);
    assert.ok(v.roster.every(x => x.seat === v.me.seat || x.role === null), `${pages[i].label} learns no other role`);
  }
  // Out of the lantern's reach, a mummy is not even on the wire.
  await debug(r.mummy, { x: -30, z: -56 });
  await debug(r.panas[0], { x: 0, z: 5 });
  await until(r.panas[0], (s) => !embuste.view.players.some(p => p.seat === s), r.seat(r.mummy));
  step('roles dealt privately; far players are not sent at all');

  // ---------- a wrap, a report, a meeting ----------
  const [victim, finder, third] = r.panas;
  await debug(r.mummy, { x: 20, z: -28, ready: true });
  await debug(victim, { x: 21.5, z: -28 });
  await debug(finder, { x: 0, z: 5 }); await debug(third, { x: 2, z: 5 });
  await until(r.mummy, (s) => embuste.view.players.some(p => p.seat === s && Math.hypot(p.x - 20, p.z + 28) < 2), r.seat(victim));
  await r.mummy.keyboard.press('q');
  await until(victim, () => embuste.view.me.ghost);
  await until(victim, () => !document.getElementById('ghost-note').classList.contains('hidden'));
  await debug(finder, { x: 24, z: -27 });
  await until(finder, () => embuste.view.statues.length === 1);
  await finder.keyboard.press('r');
  await all(pages, () => embuste.view.phase === 'meeting');
  assert.equal((await view(third)).meeting.body, r.seat(victim));
  await until(third, () => !document.getElementById('meeting').classList.contains('hidden'));
  step('the mummy wraps a pana alone; a finder reports the statue; everyone meets at the fire');

  await finder.click('#phrases button:first-child');
  await all(pages, () => embuste.view.meeting?.chat.length > 0);
  assert.equal(await victim.isVisible('#phrases'), false, 'a momiita cannot talk');
  await all(pages, () => embuste.view.meeting?.stage === 'vote');
  const mummySeat = r.seat(r.mummy);
  for (const p of [finder, third]) await p.click(`.vote[data-seat="${mummySeat}"]`);
  await r.mummy.click('#skip');
  await all(pages, () => embuste.view.meeting?.stage === 'eject' || embuste.view.phase === 'ended');
  await shot(third, 'meeting');
  await all(pages, () => embuste.view.phase === 'ended');
  for (const p of pages) assert.deepEqual((await view(p)).ending, { winner: 'panas', reason: 'votes' });
  await until(a, () => !document.getElementById('results').classList.contains('hidden'));
  assert.match(await a.textContent('#result-roster'), /Momia/);
  step('chat, vote, the mummy goes down the river, the panas win at dawn');

  // ---------- sabotage: one fixed, one fatal ----------
  await a.click('#again');
  await all(pages, () => embuste.view?.phase === 'playing' && embuste.view.round === 2);
  r = await cast(pages);
  assert.equal(r.views.filter(v => v.me.role === 'momia').length, 1, 'a fresh deal');
  await debug(r.mummy, { x: 30, z: -50, ready: true });
  await r.mummy.keyboard.press('f');
  await r.mummy.click('#sabotage-menu [data-kind="apagar"]');
  await all(pages, () => embuste.view.sabotage?.kind === 'apagar');
  assert.ok((await view(r.panas[0])).me.vision < 3, 'the panas are nearly blind');
  await debug(r.panas[0], { x: 1.2, z: -5 }); await debug(r.panas[1], { x: -1.2, z: -5 });
  await until(r.panas[0], () => document.getElementById('use-label').textContent.includes('arreglar'));
  await r.panas[0].keyboard.down('e'); await r.panas[1].keyboard.down('e');
  await all(pages, () => !embuste.view.sabotage);
  await r.panas[0].keyboard.up('e'); await r.panas[1].keyboard.up('e');
  step('apagar la reliquia: two panas hold E at the relic and light it again');

  await debug(r.mummy, { ready: true });
  await r.mummy.keyboard.press('f');
  await r.mummy.click('#sabotage-menu [data-kind="crecida"]');
  await until(r.panas[2], () => !document.getElementById('alarm').classList.contains('hidden'));
  await all(pages, () => embuste.view.phase === 'ended', null, 40000);
  assert.deepEqual((await view(a)).ending, { winner: 'momias', reason: 'flood' });
  step('crecida del río left alone: the river takes the camp, the mummies win');

  // ---------- late join, host and mummy departures ----------
  await a.click('#again');
  await all(pages, () => embuste.view?.phase === 'playing' && embuste.view.round === 3);
  r = await cast(pages);
  const late = await join('Eli');
  await until(late, () => embuste.view?.phase === 'playing');
  const lv = await view(late);
  assert.ok(lv.me.spectator && lv.me.ghost, 'a late joiner watches until the next night');
  await until(a, () => embuste.lobby.players.length === 5);
  step('a late joiner spectates the running night');

  const stay = pages.filter(p => p !== a && p !== r.mummy);
  await a.context().close();
  await until(stay[0], () => !embuste.lobby.players.some(p => p.name === 'Ana') && embuste.lobby.players.some(p => p.host), null, 30000);
  const left = [...new Set([...stay, r.mummy, late])].filter(p => p !== a);
  const hosts = await Promise.all(left.map(p => p.evaluate(() => embuste.lobby.isHost)));
  assert.equal(hosts.filter(Boolean).length, 1, 'exactly one new host');
  if (r.mummy !== a) {
    await until(stay[0], () => embuste.view.phase === 'playing');
    await r.mummy.context().close();
  }
  // A dropped tab has the kit's 20 s to come back before the room lets it go.
  await all(stay, () => embuste.view.phase === 'ended', null, 60000);
  assert.equal((await view(stay[0])).ending.winner, 'panas', 'a mummy who leaves counts as voted out');
  step('the host leaves and the room hands over; the mummy leaves and the panas win');

  // ---------- touch ----------
  const phone = await player('Tacto', '&practice', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await until(phone, () => embuste.lobby.isHost);
  await phone.tap('#start');
  await until(phone, () => embuste.view?.phase === 'playing', null, 30000);
  assert.ok(await phone.isVisible('.touch-controls'), 'the d-pad shows on a touch screen');
  const before = await phone.evaluate(() => { const p = embuste.net.night.players.get(1); return p.z; });
  const up = await phone.locator('[data-move="up"]').boundingBox();
  await phone.dispatchEvent('[data-move="up"]', 'pointerdown', { pointerId: 7, pointerType: 'touch', clientX: up.x + 10, clientY: up.y + 10 });
  await phone.waitForTimeout(900);
  await phone.dispatchEvent('[data-move="up"]', 'pointerup', { pointerId: 7, pointerType: 'touch' });
  const after = await phone.evaluate(() => embuste.net.night.players.get(1).z);
  assert.ok(after < before - 1, `the up arrow walks north (${before.toFixed(1)} → ${after.toFixed(1)})`);
  await phone.evaluate(async () => { const { stationById } = await import('/g/embuste/layout.js'); const p = embuste.net.night.players.get(1), s = stationById(p.tasks[0].id === 'provisiones' ? 'prov-muelle' : (await import('/g/embuste/rules.js')).taskById(p.tasks[0].id).stations[0]); p.x = s.x; p.z = s.z + 1.3; });
  await until(phone, () => !document.getElementById('use').disabled);
  await phone.tap('#use');
  await until(phone, () => !document.getElementById('task').classList.contains('hidden'));
  await shot(phone, 'touch-task');
  step('touch: practice with bots, walk with the d-pad, open a task with the Use button');

  assert.deepEqual(errors, []);
  console.log('ok · ¡Embuste! browser suite passed');
} finally {
  await browser.close();
}
