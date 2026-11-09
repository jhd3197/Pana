// Every capi's floating tag shows the health it has left, read from the live
// match each frame: a hit lowers the number and turns its chip yellow then
// red, a painted-out capi's tag goes, tags never cover each other (two capis
// side by side), and a phone shows only the chip.
// Run: npm run test:browser -- health-tags   (CAPIS_SHOTS=<folder> also saves screenshots)
import assert from 'node:assert/strict';
import path from 'node:path';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const browser = await launch(), shots = process.env.CAPIS_SHOTS;
const shot = (page, name) => shots ? page.screenshot({ path: path.join(shots, `capis-${name}.png`) }) : null;
// The visible tags: capi id → its number, colour band, whether the name shows, and its box.
const tags = page => page.evaluate(() => [...document.querySelectorAll('#labels .capi-tag')].filter(t => !t.hidden).map(t => {
  const r = t.getBoundingClientRect();
  return { id: t.dataset.capy, hp: t.querySelector('.tag-hp').textContent, band: t.dataset.hp, name: getComputedStyle(t.querySelector('.tag-name')).display !== 'none', box: [r.left, r.top, r.right, r.bottom] };
}));
const overlaps = list => list.some((a, i) => list.slice(i + 1).some(b => a.box[0] < b.box[2] && b.box[0] < a.box[2] && a.box[1] < b.box[3] && b.box[1] < a.box[3]));
// Holds the match on our turn (no clock, no wind) and sets each capi's paint.
const hold = (page, paint) => page.evaluate(paint => {
  const m = capisDebug.match; m.shells = []; m.shot = null; m.phase = 'aim'; m.turn.team = 0; m.turn.time = 999; m.wind = 0;
  m.turn.capy = m.capys.find(c => c.team === 0 && !c.out).id;
  for (const c of m.capys) if (c.id in paint) c.paint = paint[c.id];
}, paint);

try {
  const page = await openGame(browser, 'capis', { name: 'Ana', query: 'debug&seed=6' });
  await page.locator('#start').click();
  await waitFor(page, () => capisDebug.playing && capisDebug.match.phase === 'aim' && capisDebug.match.turn.team === 0);
  const ids = await page.evaluate(() => capisDebug.match.capys.map(c => c.id));
  await hold(page, {});
  await waitFor(page, n => document.querySelectorAll('#labels .capi-tag:not([hidden])').length === n, ids.length);
  for (const t of await tags(page)) assert.deepEqual([t.hp, t.band, t.name], ['100', 'ok', true], `${t.id} starts full`);

  // Different health on every capi, ours and the machine's.
  const paint = Object.fromEntries(ids.map((id, i) => [id, [0, 25, 45, 62, 80, 93][i]]));
  await hold(page, paint);
  await waitFor(page, want => [...document.querySelectorAll('#labels .capi-tag')].every(t => t.querySelector('.tag-hp').textContent === String(want[t.dataset.capy])),
    Object.fromEntries(ids.map(id => [id, 100 - paint[id]])));
  const bands = Object.fromEntries((await tags(page)).map(t => [t.hp, t.band]));
  assert.deepEqual(bands, { 100: 'ok', 75: 'ok', 55: 'low', 38: 'low', 20: 'bad', 7: 'bad' });
  // The side list says the same numbers.
  assert.equal(await page.evaluate(id => [...document.querySelectorAll('.team-list li')].find(li => li.querySelector('b')?.textContent === capisDebug.match.capys.find(c => c.id === id).name).querySelector('span').textContent, ids[3]), '38');
  await shot(page, 'health-tags');

  // A real hit from the rules lowers the number on the next frame.
  const before = await page.evaluate(id => { const c = capisDebug.match.capys.find(k => k.id === id); return c.paint; }, ids[0]);
  await page.evaluate(id => { const c = capisDebug.match.capys.find(k => k.id === id); c.paint += 30; }, ids[0]);
  await waitFor(page, ({ id, hp }) => document.querySelector(`#labels .capi-tag[data-capy="${id}"] .tag-hp`).textContent === String(hp), { id: ids[0], hp: 100 - before - 30 });

  // Painted out: its tag goes.
  await page.evaluate(id => { const c = capisDebug.match.capys.find(k => k.id === id); c.paint = 100; c.out = 'paint'; }, ids[5]);
  await waitFor(page, id => document.querySelector(`#labels .capi-tag[data-capy="${id}"]`).hidden, ids[5]);

  // Two capis side by side: their tags stack instead of covering each other.
  await page.evaluate(([a, b]) => { const m = capisDebug.match, ca = m.capys.find(c => c.id === a), cb = m.capys.find(c => c.id === b); cb.x = ca.x + .4; cb.y = ca.y; cb.vx = cb.vy = 0; }, [ids[0], ids[1]]);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const close = await tags(page);
  assert.equal(overlaps(close), false, `no tag covers another: ${JSON.stringify(close.map(t => t.box.map(Math.round)))}`);
  await shot(page, 'health-tags-stacked');
  assert.deepEqual(page.errors, []);

  // A phone: only the health chip, still readable.
  const phone = await openGame(browser, 'capis', { name: 'Ana', query: 'debug&seed=6', mobile: true });
  await phone.evaluate(() => capisDebug.start());
  await waitFor(phone, () => capisDebug.playing && capisDebug.match.phase === 'aim');
  await hold(phone, paint);
  await waitFor(phone, () => document.querySelectorAll('#labels .capi-tag:not([hidden])').length > 0);
  await waitFor(phone, () => [...document.querySelectorAll('#labels .capi-tag')].some(t => t.querySelector('.tag-hp').textContent !== '100'));
  const small = await tags(phone);
  assert.ok(small.every(t => !t.name && Number(t.hp) >= 0), 'only the number on a phone');
  assert.equal(overlaps(small), false, 'no tag covers another on a phone');
  await shot(phone, 'health-tags-phone');
  assert.deepEqual(phone.errors, []);
  console.log('PASS capis health tags: every capi shows its health left, bands by colour, a hit and a knock-out update it, tags stack, a phone shows only the number.');
} finally {
  await browser.close();
}
