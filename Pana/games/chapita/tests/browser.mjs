// Two real clients on the street: both prepare the 3D scene, the guest takes a
// bot's seat on the other team, the host starts, a pana pitches in secret and
// the other swings on their own clock, and both screens agree on the score.
// Run: npm run test:browser -- chapita
import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const browser = await launch(), room = `chapita-${Date.now()}`;
try {
  const host = await openGame(browser, 'chapita', { name: 'Ana', room, query: 'debug' });
  const guest = await openGame(browser, 'chapita', { name: 'Bruno', room, query: 'debug' });
  for (const page of [host, guest]) await waitFor(page, () => chapitaDebug.room.state.players.filter(p => p.id !== null).length === 2);
  assert.equal(await host.evaluate(() => chapitaDebug.world.camera.isPerspectiveCamera), true, 'the street is a 3D scene');
  const teams = await guest.evaluate(() => chapitaDebug.room.state.players.filter(p => p.id !== null).map(p => p.team));
  assert.deepEqual([...teams].sort(), [0, 1], 'the first two panas play on opposite teams');
  await host.locator('#pana-room-more').click();
  await host.locator('[data-room-option="cpuSeconds"][data-value="0.5"]').click();
  await waitFor(guest, () => chapitaDebug.room.state.options.cpuSeconds === .5);
  await host.locator('#pana-room-done').click();
  await host.evaluate(() => chapitaDebug.room.action('options', { options: { houseRules: 'ninguna' } }));
  await waitFor(guest, () => chapitaDebug.room.state.options.houseRules === 'ninguna');
  await host.locator('#start').click();
  await waitFor(guest, () => chapitaDebug.room.state.phase !== 'lobby');

  // Ana (seat 0, the visitors) bats first; Bruno's team fields. Make Bruno the
  // pitcher of this half so the pitch crosses the network both ways.
  await host.evaluate(() => { const g = chapitaDebug.room.game, b = g.players.find(p => p.name === 'Bruno').seat; g.pitcher = b; g.fielders = g.fielders.filter(s => s !== b); g.newBatter(g.players.find(p => p.name === 'Ana').seat); g.phase = 'pitch'; g.armPitch(); g.revision++; chapitaDebug.room.publish(); });
  await waitFor(guest, () => { const s = chapitaDebug.room.state; return s.phase === 'pitch' && s.pitcher === chapitaDebug.room.seat; });
  await guest.locator('#pitch-panel').waitFor({ state: 'visible' });   // the pitcher gets the pitch panel
  await host.locator('#bat-panel').waitFor({ state: 'visible' });      // the batter gets the bat panel
  assert.equal(await host.evaluate(() => chapitaDebug.room.state.pitch), null, 'the pitch is secret until thrown');
  await guest.locator('[data-kind="planea"]').click();
  await guest.locator('#aim button[data-row="1"][data-col="1"]').click();
  await guest.locator('#throw').click();
  // The batter swings on their own clock, at the arrival height, right when
  // the chapita reaches the plate on their screen.
  await host.waitForFunction(() => new Promise(done => {
    const watch = () => {
      const s = chapitaDebug.room.state, { clocks, pick } = chapitaDebug;
      if (s.phase === 'flight' && clocks.pitchId === s.pitch.id && performance.now() - clocks.pitch >= s.pitch.time * 1000 - 8) {
        pick.height = s.pitch.arrives || 'medio';
        dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space' })); return done(true);
      }
      requestAnimationFrame(watch);
    };
    watch();
  }), undefined, { timeout: 30_000 });
  // The host judged the swing: the state carries it until the next pitch.
  await waitFor(host, () => chapitaDebug.room.state.swing || chapitaDebug.room.state.pitches > 1);

  // Bots play the rest: the host fast-forwards its rules; both screens agree.
  await host.evaluate(() => {
    const r = chapitaDebug.room, g = r.game;
    for (const p of g.players) p.id = null;
    for (let i = 0; i < 200000 && g.phase !== 'finished'; i++) g.advance(.05);
    r.publish();
  });
  await waitFor(guest, () => chapitaDebug.room.state.phase === 'finished');
  const score = (page) => page.evaluate(() => chapitaDebug.room.state.teams.map(t => t.runs));
  assert.deepEqual(await score(guest), await score(host));
  await guest.locator('#results').waitFor({ state: 'visible' });   // the results card shows the titles and the score
  assert.deepEqual([...host.errors, ...guest.errors], []);
  console.log('PASS chapita: two clients share the street, pitch in secret, swing on their own clock and agree on the score.');
} finally { await browser.close(); }
