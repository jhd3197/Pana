// The lobby's libreta with two real clients: the host walks the pack picker
// and writes an own category in the Categorías dialog, the guest sees both
// (read-only) in the sala summary and the dialog, the game deals the own
// category first, and the guest votes the host's answer in it through the HUD.
// Run: npm run test:browser -- stop
import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const browser = await launch(), room = `libreta-${Date.now()}`;
const click = (page, selector) => page.locator(selector).first().evaluate(el => el.click());
try {
  const host = await openGame(browser, 'stop', { name: 'Ana', room, query: 'debug' });
  const guest = await openGame(browser, 'stop', { name: 'Bruno', room, query: 'debug' });
  await waitFor(host, () => stopDebug.room.isHost && stopDebug.room.state.players.filter(p => p.id !== null).length === 2);

  // The pack picker: ‹ › like Carreritas' map, host only.
  await host.locator('[data-pack-step="1"]').click();
  await waitFor(guest, () => stopDebug.room.state.options.set === 'criollas');
  await waitFor(guest, () => document.getElementById('pack-name').textContent === 'Criollas');
  assert.equal(await guest.locator('[data-pack-step="1"]').isDisabled(), true, 'guests cannot change the pack');
  await host.locator('[data-pack-step="-1"]').click(); await host.locator('[data-pack-step="-1"]').click();
  await waitFor(guest, () => stopDebug.room.state.options.set === 'azar', undefined, 10_000);
  await host.locator('[data-pack-step="1"]').click();
  await waitFor(host, () => stopDebug.room.state.options.set === 'clasicas');

  // Categorías (the sala's kit button): the host's own category reaches the guest.
  await host.locator('#sala-kit').click();
  await host.locator('[data-own="0"]').fill('Profe del liceo');
  await host.locator('[data-own="0"]').press('Enter');
  await host.locator('#libreta-done').click();
  await waitFor(guest, () => stopDebug.room.state.custom?.[0] === 'Profe del liceo');
  await waitFor(guest, () => document.querySelector('.sala-summary')?.textContent.includes('1 tuya'));
  await guest.locator('#sala-kit').click();
  assert.equal(await guest.locator('[data-own="0"]').inputValue(), 'Profe del liceo');
  assert.equal(await guest.locator('[data-own="0"]').evaluate(el => el.readOnly), true, 'guests only read the own categories');
  await guest.locator('#libreta-done').click();

  // Stop rápido deals the own category first; hold writing and voting so a
  // slow renderer can't use the window up.
  await host.locator('[data-room-option="mode"][data-value="rapido"]').click();
  await host.evaluate(() => {
    const room = stopDebug.room, step = room.step;
    room.step = function(dt) { const g = this.game; if (g.phase === 'write' || (g.phase === 'review' && g.review.index === 0 && g.review.stage === 'vote')) return false; return step.call(this, dt); };
  });
  await click(host, '#start');
  for (const page of [host, guest]) await page.evaluate(() => { const t = setInterval(() => { const { room } = stopDebug, s = room.state; if (s.phase === 'spin' && s.spinner === room.seat) room.action('para', { round: s.round }); if (s.phase === 'write') clearInterval(t); }, 250); });
  await waitFor(host, () => stopDebug.room.state.phase === 'write', undefined, 30_000);
  const { letter, categories } = await host.evaluate(() => stopDebug.room.state);
  assert.equal(categories[0], '+Profe del liceo');
  assert.equal(await guest.locator('label[for="box-0"] .row-cat-long').textContent(), 'Profe del liceo', 'the sheet labels the own category');

  const answer = `${letter}rofe Chimbirulo`;
  await host.evaluate((words) => document.querySelectorAll('#sheet-rows input').forEach((input, i) => { input.value = words[i]; input.dispatchEvent(new Event('input', { bubbles: true })); }), [answer, `${letter}aaa`, `${letter}eee`]);
  await waitFor(host, () => !document.getElementById('stop').disabled);
  await click(host, '#stop');
  await waitFor(guest, () => stopDebug.room.state.review?.index === 0 && stopDebug.room.state.review.stage === 'vote', undefined, 30_000);
  const hostSeat = await host.evaluate(() => stopDebug.room.seat), guestSeat = await guest.evaluate(() => stopDebug.room.seat);
  const item = await guest.evaluate((seat) => stopDebug.room.state.review.items.find(i => i.seat === seat), hostSeat);
  assert.deepEqual([item.answer, item.reason], [answer, 'libre'], 'an own category always goes to a vote');
  assert.ok((await guest.locator('#review-title').textContent()).startsWith('Profe del liceo'));
  await guest.locator(`.card[data-seat="${hostSeat}"] .vote-yes`).evaluate(el => el.click());
  await waitFor(host, ([seat, g]) => stopDebug.room.state.review?.groups?.[g]?.votes?.[seat] === true, [guestSeat, item.group]);
  assert.deepEqual([...host.errors, ...guest.errors], []);
  console.log('PASS stop libreta: the pack picker and own categories sync to the guest, the own category is dealt first and voted through the HUD.');
} finally { await browser.close(); }
