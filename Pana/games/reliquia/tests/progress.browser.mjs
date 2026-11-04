// Two real clients finish an expedition: each is paid once on its own device,
// sees the rank chip and "+N XP", and more snapshots of the same results pay nothing.
import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const room = `fosa-rank-${Date.now().toString(36)}`, check = text => console.log(`ok  ${text}`);
const browser = await launch();
const open = async name => { const p = await openGame(browser, 'reliquia', { name, room, query: 'debug' }); p.setDefaultTimeout(90_000); await waitFor(p, () => window.reliquia?.room.connected); return p; };
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('pana:progress:reliquia') || 'null'));
const ui = page => page.evaluate(() => { const box = document.querySelector('.pk-rank'), card = document.querySelector('.pk-results-card').getBoundingClientRect(), r = box?.getBoundingClientRect(); return { title: box?.querySelector('.pk-chip').textContent, gain: box?.querySelector('.pk-rank-gain').textContent, value: Number(box?.querySelector('.pk-bar').style.getPropertyValue('--pk-value')), inside: !!r && r.width > 100 && r.left >= card.left && r.right <= card.right, toast: document.getElementById('rank-toast')?.textContent, above: Number(getComputedStyle(document.getElementById('rank-toast')).zIndex) > Number(getComputedStyle(document.getElementById('results')).zIndex) }; });
try {
  const a = await open('Juan'), b = await open('Ana');
  await waitFor(a, () => reliquia.state.players.length === 2); await waitFor(b, () => reliquia.state.players.length === 2);
  await a.locator('#start').click(); await waitFor(b, () => reliquia.state.phase === 'playing');

  const finish = page => page.evaluate(() => { const g = reliquia.room.game; g.time = 300; g.haul = 1000; g.level = 2; g.finish('extracted'); reliquia.room.publish(); });
  await finish(a);
  await waitFor(a, () => reliquia.state.phase === 'results'); await waitFor(b, () => reliquia.state.phase === 'results');
  await waitFor(a, () => document.querySelector('.pk-rank-gain')?.textContent); await waitFor(b, () => document.querySelector('.pk-rank-gain')?.textContent);
  const paid = 10 + 20 + 15 + 10 + 20;
  for (const page of [a, b]) {
    assert.equal((await saved(page)).xp, paid); assert.equal((await saved(page)).dives, 1);
    const seen = await ui(page);
    assert.equal(seen.gain, `+${paid} XP`); assert.equal(seen.title, 'Buzo'); assert.ok(seen.inside, 'the chip fits the card'); assert.ok(seen.value > 0 && seen.value < 1);
    assert.match(seen.toast, /Buzo/); assert.ok(seen.above, 'the rank-up toast sits over the results layer');
  }
  check('host and guest are each paid once, with the chip, +N XP and the rank-up toast');

  await a.evaluate(() => { for (let i = 0; i < 5; i++) reliquia.room.publish(); });
  const event = await a.evaluate(() => reliquia.state.eventId);
  await waitFor(b, id => reliquia.state.eventId === id, event);
  for (const page of [a, b]) assert.equal((await saved(page)).xp, paid);
  assert.equal((await ui(b)).gain, `+${paid} XP`);
  check('more snapshots of the same results keep the line and pay nothing');

  // A second expedition pays again, and the chip's line follows.
  await a.locator('#again').click(); await waitFor(b, () => reliquia.state.phase === 'playing');
  await a.evaluate(() => { const g = reliquia.room.game; g.time = 60; g.finish('wipe'); reliquia.room.publish(); });
  await waitFor(b, () => reliquia.state.phase === 'results');
  await waitFor(a, want => document.querySelector('.pk-rank-gain')?.textContent === want, '+14 XP'); await waitFor(b, want => document.querySelector('.pk-rank-gain')?.textContent === want, '+14 XP');
  for (const page of [a, b]) { const s = await saved(page); assert.equal(s.xp, paid + 14); assert.equal(s.dives, 2); assert.equal(s.receipts.length, 2); }
  check('the next expedition, a wipe, still pays');
} finally { await browser.close(); }
