// Two real clients at the 3D table: the guest takes a bot's chair, the host
// picks Stop rápido, the wheel gives a letter, both write in secret (the host
// never even receives the guest's sheet before pencils-down), the host's
// ¡STOP! ends writing for both, the guest votes on the host's doubtful word
// through the HUD, and both agree on every score and the winner.
// Run: npm run test:browser -- stop
import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const browser = await launch(), room = `stop-${Date.now()}`;
const state = (page) => page.evaluate(() => stopDebug.room.state);
const click = (page, selector) => page.locator(selector).first().evaluate(el => el.click());
// Types into the notebook like a pana would: value plus an input event per box.
const write = (page, words) => page.evaluate((words) => {
  document.querySelectorAll('#sheet-rows input').forEach((input, i) => { if (words[i] !== undefined) { input.value = words[i]; input.dispatchEvent(new Event('input', { bubbles: true })); } });
}, words);
try {
  const host = await openGame(browser, 'stop', { name: 'Ana', room, query: 'debug' });
  const guest = await openGame(browser, 'stop', { name: 'Bruno', room, query: 'debug' });
  await waitFor(host, () => stopDebug.room.state.players.filter(p => p.id !== null).length === 2);
  assert.equal(await host.evaluate(() => stopDebug.world.camera.isPerspectiveCamera), true, 'the table is a 3D scene');
  assert.equal(await host.evaluate(() => stopDebug.world.seats.filter(s => s.character).length), 8, 'eight panas at the table');

  // Room options through the shared panel: Stop rápido, three rounds.
  await host.locator('[data-room-option="mode"][data-value="rapido"]').click();
  await host.locator('#pana-room-more').click();
  await host.locator('[data-room-option="rounds"][data-value="3"]').click();
  await host.locator('#pana-room-done').click();
  await waitFor(guest, () => stopDebug.room.state.options.mode === 'rapido' && stopDebug.room.state.options.rounds === 3);
  // Hold interactive fixtures before entering them: a slow renderer must not
  // use up the writing/voting window between observing state and clicking.
  await host.evaluate(() => {
    const room = stopDebug.room, step = room.step;
    room.step = function(dt) {
      const g = this.game;
      if (g.phase === 'write' || (g.phase === 'review' && g.review.index === 0 && g.review.stage === 'vote')) return false;
      return step.call(this, dt);
    };
  });
  await click(host, '#start');
  await waitFor(guest, () => ['spin', 'letter', 'write'].includes(stopDebug.room.state.phase));

  // The turn pana stops the wheel with ¡Para! (a bot stops it by itself).
  for (const page of [host, guest]) {
    const s = await state(page);
    if (s.phase === 'spin' && s.players[s.spinner].id === await page.evaluate(() => stopDebug.room.id)) await click(page, '#para');
  }
  await waitFor(host, () => stopDebug.room.state.phase === 'write', undefined, 30_000);
  await waitFor(guest, () => stopDebug.room.state.phase === 'write');
  const { letter, categories } = await state(host);
  assert.equal(categories.length, 3);
  const guestSeat = await guest.evaluate(() => stopDebug.room.seat), hostSeat = await host.evaluate(() => stopDebug.room.seat);

  // The guest writes two boxes; the host sees only the progress, never the words.
  await write(guest, [`${letter}uzzuriaga`, `${letter}ombrita`]);
  await waitFor(host, (seat) => stopDebug.room.state.players[seat].filled === 2, guestSeat);
  const leak = await host.evaluate((seat) => ({ shared: stopDebug.room.state.players[seat].sheet, held: stopDebug.room.game.players[seat].sheet }), guestSeat);
  assert.deepEqual(leak, { shared: null, held: null }, 'the guest sheet stays on the guest screen');

  // The host fills every box (the first one a word nobody knows) and yells ¡STOP!.
  const invented = `${letter}ochimbirulo`;
  await write(host, [invented, `${letter}aaa`, `${letter}eee`]);
  await waitFor(host, () => !document.getElementById('stop').disabled);
  await click(host, '#stop');
  await waitFor(guest, () => ['basta', 'collect', 'review'].includes(stopDebug.room.state.phase));
  assert.equal(await guest.evaluate((seat) => stopDebug.room.state.players[seat].sheet, hostSeat), null, 'the stopper sheet stays hidden during ¡Basta!');
  // ¡STOP! ends writing for both: after the countdown the guest's pencil is down.
  await waitFor(guest, () => ['collect', 'review'].includes(stopDebug.room.state.phase), undefined, 15_000);
  assert.equal(await guest.locator('#box-2').evaluate(el => el.readOnly), true, 'the guest cannot write after pencils-down');
  await waitFor(host, () => stopDebug.room.state.phase === 'review', undefined, 15_000);
  const sheets = await guest.evaluate(() => stopDebug.room.state.players.map(p => p.sheet));
  assert.deepEqual(sheets[guestSeat], [`${letter}uzzuriaga`, `${letter}ombrita`, ''], 'the guest handed in what they wrote');
  assert.equal(sheets[hostSeat][0], invented, 'the review shows the host sheet');

  // The first category: the invented word goes to "¿Eso cuenta?"; the author
  // can't vote, the guest votes through the HUD.
  await waitFor(guest, () => stopDebug.room.state.review?.index === 0 && stopDebug.room.state.review.stage === 'vote');
  const group = await guest.evaluate((seat) => stopDebug.room.state.review.items[seat].group, hostSeat);
  assert.notEqual(group, null, 'an unknown word is yellow');
  assert.equal(await host.locator(`.card[data-seat="${hostSeat}"] .vote-yes`).evaluate(el => el.disabled), true, 'the author cannot vote');
  await guest.locator(`.card[data-seat="${hostSeat}"] .vote-yes`).evaluate(el => el.click());
  await waitFor(host, ([seat, g]) => stopDebug.room.state.review?.groups?.[g]?.votes?.[seat] === true || stopDebug.room.state.review?.index > 0, [guestSeat, group]);
  await host.evaluate(() => { delete stopDebug.room.step; });
  await waitFor(host, () => stopDebug.room.state.review?.stage !== 'vote' || stopDebug.room.state.review.index > 0, undefined, 20_000);
  await waitFor(guest, () => stopDebug.room.state.review?.stage !== 'vote' || stopDebug.room.state.review.index > 0 || stopDebug.room.state.phase !== 'review', undefined, 20_000);
  const verdict = await host.evaluate(() => stopDebug.room.state.review?.index === 0 ? stopDebug.room.state.review.groups : null);
  if (verdict) assert.notEqual(verdict[group].accepted, null, 'the vote resolved');

  // Both agree on the scores after the round.
  await waitFor(host, () => stopDebug.room.state.phase === 'tally', undefined, 120_000);
  await waitFor(guest, () => stopDebug.room.state.phase === 'tally');
  const totals = (page) => page.evaluate(() => stopDebug.room.state.players.map(p => p.total));
  assert.deepEqual(await totals(guest), await totals(host), 'both screens show the same scores');
  assert.ok((await guest.locator('#tally-roster').textContent()).includes('Ana'));

  // The rest of the game: each pana stops the wheel on their turn, yells
  // ¡STOP! with a full sheet and votes yes on everything they may.
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
  await waitFor(host, () => stopDebug.room.state.phase === 'finished', undefined, 300_000);
  await waitFor(guest, () => stopDebug.room.state.phase === 'finished');
  assert.equal(await guest.evaluate(() => stopDebug.room.state.winner), await host.evaluate(() => stopDebug.room.state.winner));
  assert.deepEqual(await totals(guest), await totals(host));
  assert.ok(await guest.locator('#results').isVisible(), 'the results card shows');
  assert.ok((await guest.locator('#result-roster').textContent()).includes('Cuarto bate'), 'titles are on the results card');
  assert.equal(await guest.locator('#recap li').count(), 3, 'Lo mejor de la noche lists every round');
  // Words the table voted in stay in both browsers, and the host's next
  // table (a new room, same browser) counts them from the start.
  const voted = await host.evaluate(() => stopDebug.room.state.dictionary.map(d => d.word));
  assert.ok(voted.length > 0, 'the table voted words in');
  const kept = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('pana.stop.mesa') || '[]').map(d => d.word));
  for (const page of [host, guest]) { const words = await kept(page); assert.deepEqual(voted.filter(w => !words.includes(w)), [], `saved in every browser (has ${JSON.stringify(words)})`); }
  const next = await host.context().newPage();
  await next.goto(host.url().replace(/room=[^&]+/, `room=${room}-next`), { waitUntil: 'domcontentloaded' });
  await waitFor(next, (words) => window.stopDebug?.room?.isHost && words.every(w => stopDebug.room.state.dictionary?.some(d => d.word === w)), voted);
  await next.close();
  assert.deepEqual([...host.errors, ...guest.errors], []);
  console.log('PASS stop: two clients write in secret, STOP ends writing for both, a yellow vote resolves, the scores agree and voted words carry over.');
} finally { await browser.close(); }
