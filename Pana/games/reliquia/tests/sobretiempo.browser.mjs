// Two real clients see Sobretiempo: the running figure in the Tab panel, the
// jornada's line and shout on both screens, and the total on the results card.
import assert from 'node:assert/strict';
import path from 'node:path';
import { launch, openGame, waitFor, qaDir } from '../../../tests/browser-kit.js';

const output = process.env.PANA_SHOT_DIR || qaDir(import.meta.url), room = `fosa-sobre-${Date.now().toString(36)}`, check = text => console.log(`ok  ${text}`);
const browser = await launch();
const open = async name => { const p = await openGame(browser, 'reliquia', { name, room, query: 'debug' }); p.setDefaultTimeout(90_000); await waitFor(p, () => window.reliquia?.room.connected); return p; };
try {
  const a = await open('Juan');
  // A high mark, so the jornada's shout is its own and not the record's.
  await a.evaluate(() => localStorage.setItem('pana:records:reliquia', JSON.stringify({ players: { beto: { name: 'Beto', best: { rounds: { value: 99, t: 1 }, comebacks: { value: 99, t: 1 } } } } })));
  await a.reload({ waitUntil: 'domcontentloaded' }); await waitFor(a, () => window.PANA_PREPARED === true && window.reliquia?.room.connected);
  const b = await open('Ana');
  await waitFor(a, () => reliquia.state.players.length === 2); await waitFor(b, () => reliquia.state.players.length === 2);
  await a.locator('#start').click(); await waitFor(b, () => reliquia.state.phase === 'playing');

  await a.evaluate(() => { const g = reliquia.room.game; g.encargo = { kind: 'turno', state: 'paid', until: g.time + 95 }; g.delivered = g.quota + 200; reliquia.room.publish(); });
  await waitFor(b, () => reliquia.state.delivered > reliquia.state.quota);
  await a.keyboard.down('Tab');
  await waitFor(a, () => /Sobretiempo \+7/.test(document.getElementById('quota-label').textContent) && /Cumplido · \d+ s/.test(document.getElementById('encargo-state').textContent));
  const fits = await a.evaluate(() => { const l = document.getElementById('quota-label').getBoundingClientRect(), box = document.getElementById('intel').getBoundingClientRect(); return l.left >= box.left && l.right <= box.right; });
  assert.ok(fits, 'the figure stays inside the panel');
  await a.screenshot({ path: path.join(output, 'sobretiempo-tab.png') });
  await a.keyboard.up('Tab');
  check('the Tab panel shows the running figure and the clock left');

  const before = await a.evaluate(() => reliquia.room.game.mangos);
  // The banner lives 1.8 s: note every one as it appears, so a slow page can't miss it.
  await a.evaluate(() => {
    window.shouts = [];
    new MutationObserver(list => { for (const m of list) for (const n of m.addedNodes) if (n.classList?.contains('pk-banner')) window.shouts.push(n.textContent); }).observe(document.body, { childList: true, subtree: true });
    const g = reliquia.room.game; g.encargo.until = g.time + 90; g.completeLevel(); reliquia.room.publish();
  });
  for (const page of [a, b]) await waitFor(page, () => /Sobretiempo: \+7 mangos/.test(document.getElementById('toast').textContent));
  await waitFor(a, () => window.shouts.some(text => /Sobretiempo \+7/.test(text)));
  await a.screenshot({ path: path.join(output, 'sobretiempo-level.png') });
  assert.equal(await a.evaluate(() => reliquia.room.game.mangos), before + 7);
  check('the jornada\'s line names the bonus on both screens and the mangos arrive');

  await a.evaluate(() => { const g = reliquia.room.game; g.time = 300; g.haul = 1000; g.finish('extracted'); reliquia.room.publish(); });
  for (const page of [a, b]) {
    await waitFor(page, () => reliquia.state.phase === 'results');
    await waitFor(page, () => /Sobretiempo: \+7 mangos\./.test(document.getElementById('result-copy').textContent));
    assert.equal(await page.locator('#result-payout').innerText(), '1.070');
  }
  await a.screenshot({ path: path.join(output, 'sobretiempo-results.png') });
  check('the results card shows the total, counted in the payout');

  await a.locator('#again').click(); await waitFor(b, () => reliquia.state.phase === 'playing');
  await a.evaluate(() => { const g = reliquia.room.game; g.finish('wipe'); reliquia.room.publish(); });
  await waitFor(b, () => reliquia.state.phase === 'results');
  for (const page of [a, b]) await waitFor(page, () => document.getElementById('result-copy').textContent && !/Sobretiempo/.test(document.getElementById('result-copy').textContent));
  check('a dive without it does not mention it');
} finally { await browser.close(); }
