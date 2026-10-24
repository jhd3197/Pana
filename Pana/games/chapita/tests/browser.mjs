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

  // The host must retain a human catch through the full response grace.
  // Simulate a delayed snapshot; the guest still catches on its own clock.
  await host.evaluate(() => {
    const r = chapitaDebug.room, g = r.game;
    r.step = () => false; // Drive the delayed response explicitly, independent of WebGL speed.
    g.phase = 'hit'; g.half = 0; g.batter = 0; g.outs = 0;
    g.bases = [2, 4, 6]; g.teams[0].runs = 0; g.teams[0].hits = 0;
    g.hit = { id: 777, at: g.clock, from: { x: 0, y: 1, d: .3 }, vel: { x: 0, y: 2, d: 15 },
      caught: null, chapazo: false, chance: { seat: 1, t: 1, speed: 10, point: { x: 0, y: 1, d: 15 } },
      end: { kind: 'sencillo', t: 1.1, point: { x: 0, y: 0, d: 16 } } };
    g.advance(1.7); g.revision++; r.publish();
  });
  await waitFor(guest, () => chapitaDebug.room.state.hit?.id === 777);
  assert.equal(await guest.evaluate(() => chapitaDebug.room.state.phase), 'hit');
  await guest.evaluate(() => {
    // Deliver a catch timed to the guest's displayed flight after host landing.
    chapitaDebug.clocks.hit = performance.now() - 1000;
    document.getElementById('catch').click();
  });
  await waitFor(host, () => chapitaDebug.room.state.hit?.caught === true);
  await host.evaluate(() => { const r = chapitaDebug.room; r.game.advance(.05); r.publish(); });
  for (const page of [host, guest]) {
    await waitFor(page, () => chapitaDebug.room.state.result?.kind === 'caught');
    assert.deepEqual(await page.evaluate(() => {
      const s = chapitaDebug.room.state; return [s.outs, s.teams[0].runs, s.teams[0].hits, s.bases];
    }), [1, 0, 0, [2, 4, 6]], 'catch is an out with no runs on either client');
    assert.equal(await page.evaluate(() => [1, 2, 3].every(n => chapitaDebug.world.scene.getObjectByName(`base-${n}`)?.isMesh)), true);
  }

  // Resizing must resize the canvas, and the pitching controls must leave
  // home plate visible on both maps, including a portrait phone.
  for (const map of ['calle', 'cancha']) {
    await host.evaluate(map => {
      const r = chapitaDebug.room, g = r.game;
      g.options.map = map; g.pitcher = 1; g.newBatter(0);
      g.phase = 'pitch'; g.armPitch(); g.revision++; r.publish();
    }, map);
    await waitFor(guest, map => chapitaDebug.world.map === map, map);
    for (const [width, height] of [[1280, 800], [390, 844]]) {
      await guest.setViewportSize({ width, height });
      await waitFor(guest, () => {
        const c = chapitaDebug.world.camera;
        return Math.abs(c.aspect - innerWidth / innerHeight) < .001 && Math.abs(c.position.y - 4.2) < .02;
      });
      assert.equal(await guest.evaluate(async () => {
        const { Vector3 } = await import('three');
        const p = new Vector3(0, .06, 0).project(chapitaDebug.world.camera);
        const x = (p.x + 1) * innerWidth / 2, y = (1 - p.y) * innerHeight / 2;
        const panel = document.getElementById('pitch-panel').getBoundingClientRect();
        return x > 0 && x < innerWidth && y > 0 && y < innerHeight
          && !(x >= panel.left && x <= panel.right && y >= panel.top && y <= panel.bottom);
      }), true, `${map}: home plate remains visible at ${width}x${height}`);
    }
  }

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
