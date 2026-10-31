// The jugadas locas on two real clients: the host's pick travels in the
// state and both screens play the same jugada; the Pelota y bate option swaps
// the equipment on both; every jugada plays live and every Studio page builds
// without an error.
// Run: npm run test:browser -- chapita
import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const browser = await launch(), room = `chapita-jugadas-${Date.now()}`;
const ALL = ['hit', 'swing', 'miss', 'helicopter', 'pitch', 'argue', 'slip', 'boomerang', 'bean', 'window', 'catch', 'broken', 'home', 'dog', 'roof', 'drain', 'pinball', 'grandpa', 'car', 'dinner', 'dance'];
try {
  const host = await openGame(browser, 'chapita', { name: 'Ana', room, query: 'debug' });
  const guest = await openGame(browser, 'chapita', { name: 'Bruno', room, query: 'debug' });
  for (const page of [host, guest]) await waitFor(page, () => chapitaDebug.room.state.players.filter(p => p.id !== null).length === 2);
  await host.evaluate(() => chapitaDebug.room.action('options', { options: { houseRules: 'ninguna', equipo: 'pelota' } }));
  await waitFor(guest, () => chapitaDebug.room.state.options.equipo === 'pelota');
  await host.locator('#start').click();
  for (const page of [host, guest]) await waitFor(page, () => chapitaDebug.room.state.phase !== 'lobby' && !!chapitaDebug.world.scene.getObjectByName('Pelota'));
  assert.equal(await guest.evaluate(() => !!chapitaDebug.world.scene.getObjectByName('Bate de madera')), true, 'pelota y bate on the guest too');

  // The host's jonrón: both screens play the bat flip.
  await host.evaluate(() => {
    const r = chapitaDebug.room, g = r.game; r.step = () => false;
    g.pitcher = 1; g.fielders = [3, 5, 7]; g.newBatter(0); g.phase = 'hit';
    g.hit = { id: 901, at: g.clock, from: { x: 0, y: 1, d: .3 }, vel: { x: 0, y: 8, d: 20 }, q: .95, caught: null, chapazo: false, chance: null, end: { kind: 'jonron', t: 1, point: { x: 0, y: 5, d: 26 } } };
    g.finishPlay(); r.publish();
  });
  for (const page of [host, guest]) {
    await waitFor(page, () => chapitaDebug.room.state.result?.jugada === 'home');
    await waitFor(page, () => chapitaDebug.world.jugada.main === 'home');
  }
  // A strikeout: the jugada the host picked is the one both screens play.
  await host.evaluate(() => {
    const r = chapitaDebug.room, g = r.game;
    g.newBatter(2); g.strikes = 2; g.phase = 'flight';
    g.pitch = { id: 902, kind: 'cae', row: 1, col: 1, side: 1, cap: 'plana', miss: [0, 0], wobble: { a: 0, f: 3, ph: 0, tilt: 0 }, time: .86, at: g.clock, target: { x: 0, y: 1 }, arrives: 'medio', flavor: 'fuego' };
    g.strike('swinging'); r.publish();
  });
  const picked = await host.evaluate(() => chapitaDebug.room.state.result.jugada);
  assert(['miss', 'helicopter'].includes(picked), picked);
  for (const page of [host, guest]) await waitFor(page, (id) => chapitaDebug.world.jugada.main === id, picked);

  // The batter's timing ring: it closes on the plate and turns green right
  // when the chapita arrives; the palo picks the height by itself.
  const ring = await host.evaluate(() => {
    const r = chapitaDebug.room, g = r.game, c = chapitaDebug.clocks;
    g.newBatter(0); g.phase = 'flight';
    g.pitch = { id: 903, kind: 'planea', row: 1, col: 1, side: 1, cap: 'plana', miss: [0, 0], wobble: { a: 0, f: 3, ph: 0, tilt: 0 }, time: 1.2, at: g.clock, target: { x: 0, y: 1 }, arrives: 'medio', flavor: 'globito' };
    r.publish(); chapitaDebug.world.update(r.state, c, r.seat);
    const at = (u) => { c.pitchId = 903; c.pitch = performance.now() - u * 1200; chapitaDebug.world.frame(0); return chapitaDebug.world.aim; };
    return [at(.4), at(1)];
  });
  assert.equal(ring[0].visible, true, 'the batter sees the ring');
  assert(ring[0].scale > 2, 'the approach ring starts wide');
  assert.equal(ring[1].scale, 1); assert.equal(ring[1].color, '#8dff8a', 'green on arrival');
  assert.equal(await host.evaluate(() => chapitaDebug.world.scene.getObjectByName('Diamante de tiza')?.children.length >= 4), true, 'a chalk diamond');

  // Every jugada plays live on the guest, then every Studio page builds.
  for (const name of ALL) {
    await guest.evaluate(n => chapitaDebug.world.playJugada(n), name);
    await waitFor(guest, n => chapitaDebug.world.jugada.main === n, name);
    await guest.evaluate(() => new Promise(r => setTimeout(r, 250)));
  }
  const studio = await guest.evaluate(async (names) => {
    const { createChapitaJugadaPreview } = await import('/g/chapita/studio-preview.js'), bad = [];
    for (const jugada of names) {
      try { const g = createChapitaJugadaPreview({ jugada }); for (let t = 0; t < 9; t += .1) g.userData.tick(t); g.userData.dispose(); } catch (e) { bad.push(`${jugada}: ${e.message}`); }
    }
    return bad;
  }, ALL);
  assert.deepEqual(studio, [], 'every Studio jugada page builds and plays');
  assert.deepEqual([...host.errors, ...guest.errors], []);
  console.log('PASS chapita jugadas: both screens play the host\'s jugada, pelota y bate swaps on both, all 21 play live and in Studio.');
} finally { await browser.close(); }
