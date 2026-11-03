// The library's own two in the real game: El Lector and La Estatua spawned
// next to the pana on jornada 2 (?debug&jornada=2, Lugar: Biblioteca) render without page
// errors; the statue's drawn position holds still while it is in view and
// moves once the pana looks away; the Lector comes to a noise. Leaves
// screenshots in Pana/games/reliquia/qa.
import assert from 'node:assert/strict';
import path from 'node:path';
import { launch, openGame, waitFor, qaDir } from '../../../tests/browser-kit.js';

const output = qaDir(import.meta.url), room = `reliquia-enemies-${Date.now().toString(36)}`;
const check = text => console.log(`ok  ${text}`);
const browser = await launch();
try {
  const page = await openGame(browser, 'reliquia', { name: 'Juan', room, query: 'debug&jornada=2' });
  page.setDefaultTimeout(90_000);
  await waitFor(page, () => window.reliquia?.room.connected);
  await page.evaluate(() => reliquia.room.action('configure', { options: { place: 'biblioteca' } }));
  await waitFor(page, () => reliquia.state.options.place === 'biblioteca');
  await page.locator('#start').click();
  await waitFor(page, () => reliquia.state.phase === 'playing' && reliquia.state.level === 2 && reliquia.view.world.run.theme === 'biblioteca');
  // Stand in the entrance hall, looking north into it, nothing else awake.
  const me = await page.evaluate(() => {
    const g = reliquia.room.game, stop = g.layout.run.lifts.find(l => l.floor === 1);
    g.enemies = []; for (const r of g.layout.run.rooms) g.woke[r.id] = 1; g.director.duration = 1e6; g.players[0].invulnerable = 1e6;
    reliquia.place(reliquia.room.id, stop.x, stop.z - 5, Math.PI); reliquia.face(Math.PI, -.05);
    return { x: stop.x, z: stop.z - 5 };
  });
  await waitFor(page, ({ x, z }) => Math.hypot(reliquia.me.x - x, reliquia.me.z - z) < .3, me);

  // El Lector, three metres ahead.
  const lector = await page.evaluate(() => reliquia.spawn('lector', 3.2, -.6));
  assert.ok(lector, 'a Lector spawns');
  await waitFor(page, id => reliquia.view.enemies.get(id)?.model.name === 'El Lector', lector.id);
  await waitFor(page, t => reliquia.state.time > t + .6, await page.evaluate(() => reliquia.state.time));
  await page.screenshot({ path: path.join(output, 'lector.png') });
  check('El Lector renders in the library');

  // La Estatua beside it: in view, its drawn position never moves.
  const statue = await page.evaluate(() => reliquia.spawn('estatua', 4.5, 1.2));
  assert.ok(statue, 'a statue spawns');
  await waitFor(page, id => reliquia.view.enemies.get(id)?.model.name === 'La Estatua', statue.id);
  await waitFor(page, id => reliquia.state.enemies.find(e => e.id === id)?.frozen === true, statue.id);
  const drawn = () => page.evaluate(id => { const p = reliquia.view.enemies.get(id).root.position; return { x: p.x, z: p.z }; }, statue.id);
  const before = await drawn(), t0 = await page.evaluate(() => reliquia.state.time);
  for (let i = 0; i < 6; i++) {
    await waitFor(page, t => reliquia.state.time > t, t0 + i * .4);
    const now = await drawn();
    assert.ok(Math.hypot(now.x - before.x, now.z - before.z) < 1e-6, `held still in view (${JSON.stringify(now)})`);
  }
  await page.screenshot({ path: path.join(output, 'estatua.png') });
  check('La Estatua holds still while it is in view');

  // The model itself: every pose is finite, moves the hands and the head,
  // stays within the draw budget, and setShade only scales its albedo.
  const model = await page.evaluate(async id => {
    const { Vector3 } = await import('three'), m = reliquia.view.enemies.get(id).model, v = new Vector3(), poses = [];
    let finite = true, draws = 0;
    for (let i = 0; i < 5; i++) {
      m.userData.setPose(i); m.updateMatrixWorld(true);
      const points = [];
      let count = 0;
      m.traverseVisible(o => { if (o.isMesh) { count++; o.getWorldPosition(v); points.push(v.toArray()); o.matrixWorld.elements.forEach(x => { finite &&= Number.isFinite(x); }); } });
      draws = Math.max(draws, count); poses.push(points);
    }
    const tinted = []; m.traverse(o => { if (o.isMesh && o.material.vertexColors) tinted.push(o.material); });
    m.userData.setShade(.5); const shaded = tinted.every(t => Math.abs(t.color.r - .5) < 1e-6); m.userData.setShade(1);
    m.userData.setPose(reliquia.state.enemies.find(e => e.id === id)?.pose ?? 0);
    return { finite, draws, poses, shaded };
  }, statue.id);
  assert.ok(model.finite, 'finite transforms in every pose');
  assert.ok(model.draws >= 12 && model.draws <= 20, `${model.draws} draws per statue`);
  assert.ok(model.shaded, 'setShade scales the tinted albedo');
  for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) {
    const a = model.poses[i], b = model.poses[j], moved = a.filter((p, k) => b[k] && Math.hypot(p[0] - b[k][0], p[1] - b[k][1], p[2] - b[k][2]) > .1).length;
    assert.ok(moved >= 4, `poses ${i} and ${j} differ (${moved} parts moved)`);
  }
  check(`La Estatua: five distinct finite poses in ${model.draws} draws`);

  // Look away (south): it strides closer; look back: it has moved, and holds again.
  await page.evaluate(() => reliquia.face(0, 0));
  await waitFor(page, id => (reliquia.state.enemies.find(e => e.id === id)?.steps || 0) >= 2, statue.id);
  await page.evaluate(() => reliquia.face(Math.PI, -.05));
  await waitFor(page, id => reliquia.state.enemies.find(e => e.id === id)?.frozen === true, statue.id);
  const after = await drawn();
  assert.ok(Math.hypot(after.x - before.x, after.z - before.z) > 1, 'it moved while nobody looked');
  await page.screenshot({ path: path.join(output, 'estatua-closer.png') });
  check('unseen it strides closer, seen again it stops');

  // A noise (a sprint) brings the Lector: it stops to listen, then comes.
  await page.evaluate(id => { const e = reliquia.room.game.enemies.find(e => e.id === id); e.pause = 0; }, lector.id);
  await page.keyboard.down('Shift'); await page.keyboard.down('d');
  await waitFor(page, id => ['listen', 'hunt'].includes(reliquia.state.enemies.find(e => e.id === id)?.mode), lector.id);
  await page.keyboard.up('d'); await page.keyboard.up('Shift');
  await page.screenshot({ path: path.join(output, 'lector-listens.png') });
  check('a run is heard: the Lector stops to listen');

  assert.deepEqual(page.errors, []);
  check('no page errors');
} finally { await browser.close(); }
