// Two real clients and pacts: the host's rank decides the menu, the guest sees the
// choice and the Calor chip, the expedition plays it and both are paid the bonus;
// the first finished Calor is a new rung of the Escalera, paid once.
import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const room = `fosa-pactos-${Date.now().toString(36)}`, check = text => console.log(`ok  ${text}`);
const browser = await launch();
const open = async name => { const p = await openGame(browser, 'reliquia', { name, room, query: 'debug' }); p.setDefaultTimeout(90_000); await waitFor(p, () => window.reliquia?.room.connected); return p; };
// Which pact cards this screen's menu shows.
const offered = page => page.evaluate(() => [...document.querySelectorAll('#pana-room-dialog fieldset')].filter(f => !f.hidden && f.querySelector('[data-room-option^="pacto:"]')).map(f => f.querySelector('button').dataset.roomOption));
const chip = page => page.evaluate(() => { const c = document.getElementById('calor-chip'); return c && c.style.display !== 'none' ? c.textContent : ''; });
const hasOption = (page, key, want) => waitFor(page, ([key, want]) => reliquia.state.options[key] === want, [key, want]);
try {
  const a = await open('Juan');
  // Rank 2 on the host's device.
  await a.evaluate(() => localStorage.setItem('pana:progress:reliquia', JSON.stringify({ xp: 30, dives: 1, receipts: [] })));
  await a.reload({ waitUntil: 'domcontentloaded' }); await waitFor(a, () => window.PANA_PREPARED === true && window.reliquia?.room.connected);
  const b = await open('Ana');
  await waitFor(a, () => reliquia.state.players.length === 2); await waitFor(b, () => reliquia.state.players.length === 2);
  assert.deepEqual(await offered(a), ['pacto:cuota']); assert.deepEqual(await offered(b), []);
  assert.equal(await chip(a), ''); assert.equal(await chip(b), '');
  check('the menu follows each screen\'s rank; no Calor without a pact');

  await a.evaluate(() => document.getElementById('pana-room-more').click());
  await a.locator('[data-room-option="pacto:cuota"][data-value="true"]').click();
  await hasOption(a, 'pacto:cuota', true); await hasOption(b, 'pacto:cuota', true);
  await a.evaluate(() => document.getElementById('pana-room-done').click());
  await waitFor(a, () => document.getElementById('calor-chip')?.textContent === 'Calor 1'); await waitFor(b, () => document.getElementById('calor-chip')?.textContent === 'Calor 1');
  assert.deepEqual(await offered(b), ['pacto:cuota'], 'the guest sees what the host chose');
  assert.equal(await b.locator('[data-room-option="pacto:cuota"][data-value="false"]').isDisabled(), true, 'and cannot change it');
  check('the host picks a pact; both screens show it and Calor 1');

  // The rules take any real pact, nothing else, and never from a guest.
  await a.evaluate(() => reliquia.room.action('configure', { options: { 'pacto:nope': true } }));
  await b.evaluate(() => reliquia.room.action('configure', { options: { 'pacto:silbon': true } }));
  await a.evaluate(() => reliquia.room.action('configure', { options: { 'pacto:turno': true } }));
  await hasOption(b, 'pacto:turno', true);
  await waitFor(b, () => document.getElementById('calor-chip')?.textContent === 'Calor 2');
  assert.deepEqual(await offered(a), ['pacto:cuota', 'pacto:turno'], 'a locked pact shows once it is on');
  assert.equal(await a.evaluate(() => reliquia.state.options['pacto:nope']), undefined); assert.equal(await a.evaluate(() => reliquia.state.options['pacto:silbon']), false);
  await a.evaluate(() => reliquia.room.action('configure', { options: { 'pacto:turno': false } }));
  await hasOption(b, 'pacto:turno', false); await waitFor(b, () => document.getElementById('calor-chip')?.textContent === 'Calor 1');
  check('the host\'s room validates ids and ignores a guest');

  await a.locator('#start').click(); await waitFor(b, () => reliquia.state.phase === 'playing');
  const quota = await b.evaluate(() => reliquia.state.quota);
  assert.equal(quota, 450, 'quota 350 for two panas, raised');
  await a.evaluate(() => { const g = reliquia.room.game; g.time = 300; g.haul = 1000; g.finish('extracted'); reliquia.room.publish(); });
  await waitFor(a, () => reliquia.state.phase === 'results'); await waitFor(b, () => reliquia.state.phase === 'results');
  for (const page of [a, b]) {
    await waitFor(page, () => document.getElementById('result-calor')?.textContent === 'Calor +10 %');
    assert.equal(await page.locator('#result-calor').isVisible(), true);
    // 66 for the dive, 10 for the first rung of the Escalera de Calor.
    assert.equal(await page.evaluate(() => document.querySelector('.pk-rank-gain').textContent), '+76 XP');
    await waitFor(page, () => document.getElementById('result-calor-max')?.textContent === 'Calor máx 1');
    await waitFor(page, () => document.getElementById('rank-toast')?.textContent.includes('Calor máximo: 1'));
    assert.equal(await page.evaluate(() => document.getElementById('result-payout').textContent.replace(/\D/g, '')), '1100');
    const fits = await page.evaluate(() => { const r = document.querySelector('.pk-rank').getBoundingClientRect(), c = document.querySelector('.pk-results-card').getBoundingClientRect(); return r.left >= c.left && r.right <= c.right; });
    assert.ok(fits, 'the line stays inside the card');
    assert.deepEqual(page.errors, []);
  }
  check('the expedition plays the pact and both are paid the bonus');

  await a.evaluate(() => reliquia.room.publish());   // another render of the same results
  assert.equal(await a.evaluate(() => JSON.parse(localStorage.getItem('pana:progress:reliquia')).receipts.filter(r => r === 'calor:1').length), 1);
  check('a new Calor máximo is kept and its rung paid once')
} finally { await browser.close(); }
