// A table flip seen by two real clients: `flipper` holds the turn, `watcher`
// doesn't. Used by each table game's table-flip.browser.js.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { waitFor } from './browser-kit.js';

// The real transforms of the table and every piece, and the state that must not move.
const read = name => {
  const { room, world } = window[name], list = [world.table, ...(world.cards ? [...world.cards.values()].map(c => c.model) : world.tiles ? [...world.tiles.values()].map(t => t.model) : world.pawns.map(p => p.model))];
  const { revision, turn, phase } = room.state;
  return { state: { revision, turn, phase }, game: JSON.stringify(room.state), objects: list.map(o => ({ auto: o.matrixAutoUpdate, position: o.position.toArray(), quaternion: o.quaternion.toArray(), scale: o.scale.toArray(), matrix: [...o.matrixWorld.elements] })) };
};

// Dealt pieces spring into place: wait for them, so before and after compare.
const settle = (page, name) => page.evaluate(async ({ name, source }) => {
  const read = eval(source), matrices = () => read(name).objects.flatMap(o => o.matrix);
  for (let last = matrices(), still = 0; still < 20;) {
    await new Promise(requestAnimationFrame);
    const now = matrices(), moved = Math.max(...now.map((v, i) => Math.abs(v - last[i])));
    still = moved < .001 ? still + 1 : 0; last = now;
  }
}, { name, source: `(${read})` });

export async function proveFlip(flipper, watcher, name, { shot } = {}) {
  assert.equal(await flipper.locator('#flip').isDisabled(), false, 'on for the seat whose turn it is');
  assert.equal(await watcher.locator('#flip').isDisabled(), true, 'off for everyone else');
  await watcher.evaluate(() => document.activeElement?.blur()); await watcher.keyboard.press('f');
  assert.equal(await watcher.evaluate(name => window[name].world.flipping, name), false, 'the key does nothing out of turn');

  await settle(flipper, name); await settle(watcher, name);
  const before = await flipper.evaluate(read, name), watched = await watcher.evaluate(read, name);
  // What the renderer is handed: the table's pose at the start of each draw of the flip.
  await flipper.evaluate(name => {
    const { world } = window[name], draw = world.renderer.render.bind(world.renderer), rest = world.table.matrix.elements[13];
    window.flipLift = 0;
    world.renderer.render = (...args) => {
      window.flipLift = Math.max(window.flipLift, Math.abs(world.table.matrix.elements[13] - rest));
      const drawn = draw(...args);
      // A page screenshot takes longer than the flip, so read the canvas right here.
      if (window.flipLift > 3 && !window.flipShot) window.flipShot = world.renderer.domElement.toDataURL('image/jpeg', .85);
      return drawn;
    };
  }, name);
  // Counted at the call: under load the two-second flip can start and end between polls.
  for (const page of [flipper, watcher]) await page.evaluate(name => {
    const { world } = window[name], flip = world.flip;
    window.flips = 0;
    world.flip = (...args) => { window.flips++; queueMicrotask(() => { window.flipCooling = document.querySelector('#flip').disabled; }); return flip(...args); };
  }, name);
  await flipper.locator('#flip').click();
  for (const page of [flipper, watcher]) await waitFor(page, name => window.flips === 1 && !window[name].world.flipping, name);
  assert.equal(await flipper.evaluate(() => window.flipCooling), true, 'cooling down');
  assert.ok(await flipper.evaluate(() => window.flipLift) > 1, 'the table really went over');
  const picture = await flipper.evaluate(() => window.flipShot);
  if (shot && picture) fs.writeFileSync(shot, Buffer.from(picture.split(',')[1], 'base64'));

  // A rendered frame later, every transform is the one it had before.
  for (const [page, was] of [[flipper, before], [watcher, watched]]) {
    await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    const after = await page.evaluate(read, name);
    assert.deepEqual(after.state, was.state, 'no state, turn or phase moved');
    assert.equal(after.game, was.game, 'the whole game state is the same');
    assert.ok(after.objects.every(o => o.auto), 'no object left posed');
    // The table is exact; the idle pieces still breathe by a hair (Ludo's pulse).
    assert.deepEqual(after.objects[0], was.objects[0], 'the table is exactly where it was');
    after.objects.forEach((o, i) => {
      for (let k = 0; k < 16; k++) assert.ok(Math.abs(o.matrix[k] - was.objects[i].matrix[k]) < .15, `object ${i} is back (${k}): ${o.matrix[k]} vs ${was.objects[i].matrix[k]}`);
    });
  }
}
