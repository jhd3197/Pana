// Solo panas: two real clients turn the bots off. Only their two chairs are
// filled at the 3D table, only they spin the wheel, write and get reviewed,
// and no bot ever votes.
// Run: npm run test:browser -- stop
import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const browser = await launch(), room = `stop-panas-${Date.now()}`;
const click = (page, selector) => page.locator(selector).first().evaluate(el => el.click());
try {
  const host = await openGame(browser, 'stop', { name: 'Ana', room, query: 'debug' });
  const guest = await openGame(browser, 'stop', { name: 'Bruno', room, query: 'debug' });
  await waitFor(host, () => stopDebug.room.state.players.filter(p => p.id !== null).length === 2);
  const off = '[data-room-option="withBots"][data-value="false"]';
  assert.equal(await guest.locator(off).isDisabled(), true, 'only the host turns the bots off');
  await click(host, off);
  await click(host, '[data-room-option="mode"][data-value="rapido"]');
  await waitFor(guest, () => stopDebug.room.state.options.withBots === false && stopDebug.room.state.options.mode === 'rapido');
  await waitFor(guest, () => stopDebug.world.seats.filter(s => s.character).length === 2);
  assert.equal(await guest.locator('#roster li').count(), 2, 'the lobby lists only the two panas');

  // Each pana stops the wheel on their turn, the host yells ¡STOP! with a full
  // sheet and both vote on any doubtful word.
  for (const page of [host, guest]) {
    await page.evaluate(() => setInterval(() => {
      const { room } = window.stopDebug, s = room.state, p = s.players[room.seat];
      if (!p || !room.connected) return;
      if (s.phase === 'spin' && s.spinner === room.seat) room.action('para', { round: s.round });
      if (s.phase === 'write' && room.isHost) room.action('stop', { round: s.round, sheet: s.categories.map((_, i) => `${s.letter}uzz${i}`) });
      if (s.phase === 'review' && s.review.stage === 'vote') s.review.groups.forEach((g, i) => {
        if (!g.authors.includes(p.seat) && !(p.seat in g.votes)) room.action('vote', { round: s.round, index: s.review.index, group: i, yes: true });
      });
    }, 250));
  }
  // Remember what the guest saw in each review, however fast the host moves on.
  await guest.evaluate(() => { window.reviews = []; setInterval(() => {
    const s = stopDebug.room.state; if (s.phase !== 'review' || !s.review) return;
    window.reviews.push({ seats: s.review.items.map(i => i.seat).sort(), spinner: s.spinner, voters: s.review.groups.flatMap(g => Object.keys(g.votes).map(Number)) });
  }, 100); });
  await click(host, '#start');
  const humans = await host.evaluate(() => stopDebug.room.state.players.filter(p => p.id !== null).map(p => p.seat).sort());
  await waitFor(guest, () => window.reviews.length > 0, undefined, 60_000);
  const review = await guest.evaluate(() => window.reviews.at(-1));
  assert.deepEqual(review.seats, humans, 'only the two sheets are reviewed');
  assert.ok(humans.includes(review.spinner), 'a pana spun the wheel');
  assert.ok(review.voters.every(seat => humans.includes(seat)), 'no bot votes');
  await waitFor(host, () => stopDebug.room.state.phase === 'finished', undefined, 300_000);
  await waitFor(guest, () => stopDebug.room.state.phase === 'finished');
  const seen = await guest.evaluate(() => window.reviews);
  assert.ok(seen.every(r => JSON.stringify(r.seats) === JSON.stringify(seen[0].seats)), 'every review shows the same two sheets');
  assert.equal(await guest.locator('#result-roster li').count(), 2, 'the results rank only the two panas');
  assert.deepEqual([...host.errors, ...guest.errors], []);
  console.log('PASS stop panas: bots off, two chairs, only panas spin, write, vote and rank.');
} finally { await browser.close(); }
