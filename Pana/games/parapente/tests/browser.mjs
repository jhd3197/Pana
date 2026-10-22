// Two real clients in one room over Galipán: both prepare the 3D world, host
// options reach the guest, the guest's held keys steer and accelerate its wing
// on the host, the guest predicts its own wing, host migration keeps the
// flight and both reach the results after a landing on the diana. Then a
// 390 px phone flies with the touch Acelerador button.
// Run: npm run test:browser -- parapente
import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const browser = await launch(), room = `parapente-${Date.now()}`;
const check = text => console.log(`ok: ${text}`);
try {
  const host = await openGame(browser, 'parapente', { name: 'Ana', room, query: 'debug' });
  const guest = await openGame(browser, 'parapente', { name: 'Bruno', room, query: 'debug' });
  await waitFor(host, () => parapenteDebug.state.players.length === 2, undefined, 90_000);
  assert.equal(await host.evaluate(() => parapenteDebug.world.camera.isPerspectiveCamera), true, 'Galipán is a 3D scene');
  assert.equal(await guest.locator('#start').isDisabled(), true, 'only the host starts');
  await host.locator('[data-room-option="rivals"][data-value="easy"]').click();
  await waitFor(guest, () => parapenteDebug.state.options.rivals === 'easy');
  check('host options reach the guest');
  await host.locator('#start').click();
  await waitFor(guest, () => parapenteDebug.state.phase === 'racing', undefined, 90_000);
  assert.equal(await guest.evaluate(() => parapenteDebug.state.pilots.length), 8, 'pilots from the cerro fill the deck to 8');
  const quiet = v => Promise.all([host, guest].map(p => p.evaluate(v => parapenteDebug.quiet(v), v)));
  await quiet(true);
  const id = await guest.evaluate(() => parapenteDebug.room.id);
  const before = await host.evaluate(id => parapenteDebug.state.pilots.find(p => p.id === id), id);
  await guest.locator('#world').click({ position: { x: 640, y: 400 } });
  await guest.keyboard.down('d');
  await waitFor(host, ({ id, h }) => { const p = parapenteDebug.state.pilots.find(p => p.id === id); return p.steer > .5 && Math.abs(p.h - h) > .3; }, { id, h: before.h }, 90_000);
  await guest.keyboard.up('d');
  await guest.keyboard.down('w');
  await waitFor(host, id => { const p = parapenteDebug.state.pilots.find(p => p.id === id); return p.bar === 1 && p.v > 19; }, id, 90_000);
  await guest.keyboard.up('w');
  await waitFor(host, id => parapenteDebug.state.pilots.find(p => p.id === id).bar === 0, id);
  check('the guest\'s keys steer and accelerate its wing on the host');
  // Prediction: with the host's snapshots held back, the guest's own wing
  // still answers the keys; once they flow again it lands where the host has it.
  await waitFor(guest, () => !!parapenteDebug.room.predicted);
  await host.evaluate(() => { parapenteDebug.room.publish = () => {}; });
  await guest.evaluate(() => new Promise(done => { let last = parapenteDebug.state, still = 0; const tick = () => { if (parapenteDebug.state === last) still++; else { last = parapenteDebug.state; still = 0; } if (still > 30) done(); else requestAnimationFrame(tick); }; tick(); }));
  const stalled = await guest.evaluate(id => ({ predicted: parapenteDebug.room.predicted.h, shown: parapenteDebug.state.pilots.find(p => p.id === id).h }), id);
  await guest.keyboard.down('a');
  await waitFor(guest, h => Math.abs(parapenteDebug.room.predicted.h - h) > .3, stalled.predicted, 60_000);
  await guest.keyboard.up('a');
  assert.equal(await guest.evaluate(id => parapenteDebug.state.pilots.find(p => p.id === id).h, id), stalled.shown, 'no snapshot arrived while predicting');
  await host.evaluate(() => { delete parapenteDebug.room.publish; });
  await waitFor(guest, id => { const p = parapenteDebug.state.pilots.find(p => p.id === id), q = parapenteDebug.room.predicted; return q && Math.hypot(p.x - q.x, p.z - q.z) < 2; }, id, 60_000);
  check('the guest flies its own wing at once and settles on the host position');
  // The host leaves mid-flight: the guest takes over with the race intact.
  const time = await guest.evaluate(() => parapenteDebug.state.time);
  await host.close();
  await waitFor(guest, () => parapenteDebug.room.isHost, undefined, 90_000);
  assert.equal(await guest.evaluate(() => parapenteDebug.state.phase), 'racing');
  await waitFor(guest, t => parapenteDebug.state.time > t + 1, time);
  assert.equal(await guest.evaluate(() => parapenteDebug.state.pilots.length), 7, 'the host\'s wing leaves with the host');
  check('host migration keeps the flight going');
  // Every beacon passed, just over the diana: the next ticks touch down and finish.
  await guest.evaluate(() => {
    const d = parapenteDebug, game = d.room.game, L = game.course.landing, p = game.pilotOf(d.room.id);
    Object.assign(p, { beacon: game.course.beacons.length, x: L.x + 2, z: L.z, y: L.y + .6, v: 11 });
    for (const q of game.pilots) if (q !== p) q.finish = 200;
    d.room.publish();
  });
  await guest.locator('#results').waitFor({ state: 'visible', timeout: 30_000 });
  const own = await guest.evaluate(id => parapenteDebug.state.pilots.find(p => p.id === id), id);
  assert.ok(own.finish !== null && own.penalty === 0, 'landed on the diana without a penalty');
  assert.equal(await guest.evaluate(() => document.querySelectorAll('#result-roster .pk-row').length), 7);
  check('landing on the diana and the results');
  assert.deepEqual([...host.errors, ...guest.errors], []);
  await guest.close();
  // Phone: the Acelerador button puts the bar on.
  const phone = await openGame(browser, 'parapente', { name: 'Móvil', room: `${room}-touch`, mobile: true, query: 'debug' });
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no sideways scroll at 390 px');
  await phone.locator('#start').click();
  await waitFor(phone, () => parapenteDebug.state.phase === 'racing', undefined, 90_000);
  await phone.evaluate(() => parapenteDebug.quiet(true));
  const box = await phone.locator('[data-input="bar"]').boundingBox(), cdp = await phone.context().newCDPSession(phone);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
  await waitFor(phone, () => { const d = parapenteDebug, p = d.state.pilots.find(p => p.id === d.room.id); return p.bar === 1 && p.v > 19; }, undefined, 90_000);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach();
  check('the touch Acelerador button flies on a 390 px phone');
  assert.deepEqual(phone.errors, []);
  console.log('PASS parapente: two clients fly over Galipán, guest keys steer on the host, prediction, migration, diana, results and touch.');
} finally { await browser.close(); }
