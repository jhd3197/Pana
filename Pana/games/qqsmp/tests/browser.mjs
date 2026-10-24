// Two real clients: both prepare the 3D studio, the guest takes a bot's
// podium, the host starts, answers stay secret until the reveal, comodines and
// the final bet go through the room, and both agree on the winner.
// Run: npm run test:browser -- qqsmp
import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const browser = await launch(), room = `qqsmp-${Date.now()}`;
try {
  const host = await openGame(browser, 'qqsmp', { name: 'Ana', room, query: 'debug' });
  const guest = await openGame(browser, 'qqsmp', { name: 'Bruno', room, query: 'debug' });
  await waitFor(host, () => qqsmpDebug.room.state.players.filter(p => p.id !== null).length === 2);
  assert.equal(await host.evaluate(() => qqsmpDebug.world.camera.isPerspectiveCamera), true, 'the studio is a 3D scene');
  assert.equal(await host.evaluate(() => qqsmpDebug.room.state.options.seconds), 30);
  for (const page of [host, guest]) await page.evaluate(async () => {
    window.quizAudioCalls = [];
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function() {
      window.quizAudio = this; window.quizAudioCalls.push(this.src);
      return play.call(this);
    };
    (await import('/engine/settings.js')).setSettings({ sound: true, volume: .4 });
  });
  await host.locator('[data-room-option="questions"][data-value="8"]').click();
  await host.locator('[data-room-option="seconds"][data-value="20"]').click();
  await waitFor(guest, () => qqsmpDebug.room.state.options.questions === 8 && qqsmpDebug.room.state.options.seconds === 20);
  // Keep the first question open while both clients exercise its controls.
  await host.evaluate(() => {
    const step = qqsmpDebug.room.step;
    qqsmpDebug.room.step = function(dt) { return this.game.phase === 'question' ? false : step.call(this, dt); };
  });
  await host.locator('#start').click();
  await waitFor(guest, () => qqsmpDebug.room.state.phase === 'question');
  for (const page of [host, guest]) {
    await waitFor(page, () => quizAudioCalls.length > 0 && quizAudio.readyState >= 2);
    assert.match(await page.evaluate(() => quizAudio.src), /\/audio\/[a-f0-9]+\.mp3$/);
    assert.equal(await page.evaluate(() => quizAudio.volume), .4);
  }
  await guest.locator('#read-question').focus();
  await guest.keyboard.press('Enter');
  await waitFor(guest, () => !quizAudio.paused);
  await guest.evaluate(async () => (await import('/engine/settings.js')).setSettings({ sound: false }));
  assert.equal(await guest.evaluate(() => quizAudio.paused), true, 'mute stops the narration immediately');
  assert.equal(await guest.locator('#read-question').isDisabled(), true);

  // The guest locks an answer by clicking while the host copies the guest
  // (Copiarse); the host sees the lock, never the letter. The buttons' own
  // handlers run through el.click(): software WebGL draws a few frames a
  // second in game, too few for Playwright's stability checks.
  await Promise.all([
    guest.locator('#answers .answer[data-choice="1"]').evaluate(el => el.click()),
    host.locator('[data-comodin="copy"]').evaluate(el => el.click()).then(() => host.locator('#copy-list button', { hasText: 'Bruno' }).evaluate(el => el.click())),
  ]);
  await waitFor(host, () => qqsmpDebug.room.state.players[qqsmpDebug.room.seat === 0 ? 1 : 0].locked);
  const leaked = await host.evaluate(() => {
    const { room } = qqsmpDebug, other = room.state.players.find(p => p.id !== null && p.id !== room.id);
    return room.state.phase === 'question' ? other.answer : null;
  });
  assert.equal(leaked, null, 'answers stay secret until the reveal');
  assert.equal(await guest.locator('#answers .answer.picked').count(), 1, 'the guest still sees their own pick');
  await guest.locator('#answers .answer[data-choice="2"]').evaluate(el => el.click());
  await waitFor(host, () => qqsmpDebug.room.game.players.find(p => p.name === 'Bruno').answer === 2);
  assert.equal(await guest.locator('#answers .answer[data-choice="2"]').getAttribute('class').then(c => c.includes('picked')), true);
  await guest.locator('#cancel-answer').evaluate(el => el.click());
  await waitFor(host, () => !qqsmpDebug.room.state.players.find(p => p.name === 'Bruno').locked);
  assert.equal(await guest.locator('#answers .answer.picked').count(), 0);
  await guest.locator('#answers .answer[data-choice="3"]').evaluate(el => el.click());
  await waitFor(host, () => qqsmpDebug.room.game.players.find(p => p.name === 'Bruno').answer === 3);
  await waitFor(host, () => quizAudioCalls.length >= 9 && quizAudio.ended, undefined, 60_000);
  const sequence = await host.evaluate(async () => {
    const { narrationLines, voiceKey } = await import('./voice-key.js');
    return { expected: narrationLines(qqsmpDebug.room.state.question).map(voiceKey),
      actual: quizAudioCalls.map(url => url.match(/([a-f0-9]+)\.mp3$/)[1]) };
  });
  assert.deepEqual(sequence.actual, sequence.expected, 'native playback reads the question and every displayed choice in order');
  await host.evaluate(() => { delete qqsmpDebug.room.step; });

  // Then both answer every question and bet on the final.
  await waitFor(guest, () => qqsmpDebug.room.state.phase === 'reveal' && qqsmpDebug.room.state.reveal.done);
  assert.equal(await host.evaluate(() => quizAudio.paused), true, 'the recording stops outside the question phase');
  const copied = await guest.evaluate(() => qqsmpDebug.room.state.callouts.some(c => /Ana se copió de Bruno/.test(c.text)));
  assert.ok(copied, 'the reveal calls out who copied whom');
  for (const page of [host, guest]) {
    await page.evaluate(() => setInterval(() => {
      const { room } = window.qqsmpDebug, s = room.state, p = s.players[room.seat];
      if (!p) return;
      if (s.phase === 'question' && !p.locked) room.action('answer', { choice: s.question.correct, q: s.index });
      if (s.phase === 'bet' && !p.betLocked) room.action('bet', { choice: 2 });
    }, 200));
  }
  await waitFor(host, () => qqsmpDebug.room.state.phase === 'bet', undefined, 360_000);
  await waitFor(host, () => qqsmpDebug.room.state.phase === 'finished', undefined, 120_000);
  await waitFor(guest, () => qqsmpDebug.room.state.phase === 'finished');
  assert.equal(await guest.evaluate(() => qqsmpDebug.room.state.winner), await host.evaluate(() => qqsmpDebug.room.state.winner));
  assert.ok(await guest.locator('#results').isVisible(), 'the results card shows');
  assert.ok((await guest.locator('#result-roster').textContent()).includes('Cuarto bate'), 'titles are on the results card');
  const oldDeck = await host.evaluate(() => qqsmpDebug.room.state.deck.map(d => d.join(':')));
  await host.locator('#again').evaluate(el => el.click());
  await waitFor(guest, () => qqsmpDebug.room.state.round === 2);
  const newDeck = await guest.evaluate(() => qqsmpDebug.room.state.deck.map(d => d.join(':')));
  assert.ok(newDeck.every(key => !oldDeck.includes(key)), 'rematch questions are fresh for both clients');
  assert.deepEqual([...host.errors, ...guest.errors], []);
  console.log('PASS qqsmp: two clients answer in secret, copy, bet the final and agree on the Mango de oro.');
} finally { await browser.close(); }
