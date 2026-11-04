// The camp's cavern in the real game: the frame stays inside its budget, it reads
// from the views that matter, and the lift really goes down and comes back up into it.
// PANA_CAVERN_SHOTS=<folder> saves the views (cavern-<PANA_CAVERN_TAG>-<name>.png).
import assert from 'node:assert/strict';
import path from 'node:path';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const shots = process.env.PANA_CAVERN_SHOTS, tag = process.env.PANA_CAVERN_TAG || 'after', check = text => console.log(`ok  ${text}`);
const MAX_TRIANGLES = 95_000, MAX_DRAWS = 260;
const frames = (page, n = 6) => page.evaluate(n => new Promise(r => { const f = () => --n <= 0 ? r() : requestAnimationFrame(f); f(); }), n);
const browser = await launch();
try {
  const page = await openGame(browser, 'reliquia', { name: 'Juan', room: `fosa-cavern-${Date.now().toString(36)}`, query: 'debug' });
  page.setDefaultTimeout(180_000);
  await waitFor(page, () => window.reliquia?.room.connected && reliquia.room.isHost);
  await waitFor(page, () => { if (reliquia.state.phase === 'playing') return true; document.getElementById('start').click(); return false; });
  const shot = async name => { if (shots) await page.screenshot({ path: path.join(shots, `cavern-${tag}-${name}.png`) }); };
  // Stand somewhere and look: a heading (0 is +z, Math.PI is -z) and a pitch.
  const view = async (name, x, z, h, pitch = 0) => {
    await page.evaluate(([x, z, h, pitch]) => { reliquia.place(reliquia.room.id, x, z, h); reliquia.face(h, pitch); }, [x, z, h, pitch]);
    await waitFor(page, ([x, z]) => Math.hypot(reliquia.me.x - x, reliquia.me.z - z) < .1, [x, z]);
    await frames(page);
    await shot(name);
  };

  // The frame at spawn, looking where a new diver looks.
  await frames(page, 10);
  const info = await page.evaluate(() => ({ look: reliquia.view.lookName, far: reliquia.view.camera.far, triangles: reliquia.view.renderer.info.render.triangles, calls: reliquia.view.renderer.info.render.calls, x: reliquia.me.x, z: reliquia.me.z, h: reliquia.view.heading }));
  console.log(`spawn view: ${info.triangles} triangles, ${info.calls} draws, far plane ${info.far}, at ${info.x.toFixed(1)}, ${info.z.toFixed(1)}`);
  assert.equal(info.look, 'caverna');
  assert.ok(info.triangles <= MAX_TRIANGLES, `triangles at spawn: ${info.triangles}`);
  assert.ok(info.calls <= MAX_DRAWS, `draws at spawn: ${info.calls}`);
  await shot('spawn');
  check('the spawn view stays inside the frame budget');

  await view('far', 16, 27, -2.45, .32);
  await view('edge', 15.5, -1, 2.4, -.34);
  await view('ceiling', 0, 12, Math.PI, 1.15);
  if (tag !== 'before') {
    await view('wide', 15, 28, -2.2, .26);
    await view('falls', 15, 3, 2.2, .18);
    await view('mushrooms', 8, 29.4, .3, -.04);
    await view('gear', 9.5, 3.2, -2.75, .42);
    await view('hero', 6, 2, 2.2, .3);
    await view('shore', -13, 29.5, -.2, -.1);
    await view('pit', 16.2, -1.5, -2.72, -.78);
  }
  check('the views render');

  // Down the real lift: the look turns to the shaft's dark and the cage takes you below.
  const stop = await page.evaluate(() => reliquia.view.world.run.lifts.find(l => l.floor === 0));
  await page.evaluate(() => { const b = reliquia.room.game.layout.run.lifts.find(l => l.floor === 0), p = reliquia.room.game.players.find(p => p.id === reliquia.room.id); Object.assign(p, { x: b.x, z: b.z, h: Math.PI }); reliquia.room.publish(); reliquia.face(0, -.1); });
  await waitFor(page, ([x, z]) => Math.hypot(reliquia.me.x - x, reliquia.me.z - z) < .1, [stop.x, stop.z]);
  await frames(page);
  await page.evaluate(() => reliquia.room.game.depart(1, true));
  await waitFor(page, () => reliquia.state.lift.moving && reliquia.state.lift.riders.includes(reliquia.room.id) && reliquia.state.lift.t > .2);
  await shot('descent');
  await waitFor(page, () => !reliquia.state.lift.moving && reliquia.me.x > 50);
  await waitFor(page, () => reliquia.view.lookName !== 'caverna');
  check('the lift goes down out of the cavern');

  // And back up: it ends on the camp's stop, in the cavern, looking out of the gallery.
  await page.evaluate(() => reliquia.face(Math.PI / 2, -.05));
  await page.evaluate(() => reliquia.room.game.depart(0, true));
  await waitFor(page, () => reliquia.state.lift.moving && reliquia.state.lift.switched && reliquia.state.lift.t / reliquia.state.lift.duration > .8);
  await shot('rising');
  await waitFor(page, () => !reliquia.state.lift.moving && reliquia.me.x < 25);
  await waitFor(page, () => reliquia.view.lookName === 'caverna');
  await shot('return-arrive');
  await frames(page, 30);
  const back = await page.evaluate(() => ({ h: reliquia.view.heading, x: reliquia.me.x, z: reliquia.me.z, far: reliquia.view.camera.far }));
  await shot('return');
  assert.ok(Math.abs(back.x - stop.x) < 2.5 && Math.abs(back.z - stop.z) < 2.5, `arrives at the camp's stop: ${back.x}, ${back.z}`);
  check('the lift brings you back up into the cavern');
  assert.deepEqual(page.errors, []);
  check('no errors in the real loop');
} finally { await browser.close(); }
