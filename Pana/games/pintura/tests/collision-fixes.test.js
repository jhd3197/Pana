import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCollisionFixes, COLLISION_FIXES } from '../public/collision-fixes.js';
import { coverFor, blocked, shotCover } from '../public/rules.js';
import { sweep } from '../../../engine/play/projectile.js';

const row = { x: 0, z: 0, w: 3, d: 2, h: 1, height: 1, kind: 'barrels' };
const from = { x: 0, z: 0, w: 3, d: 2, h: 1 };

test('fixes split, refit, remove or unblock a row, and skip a row that has changed', () => {
  const fixes = {
    'm:0:0': { from, action: 'split', boxes: [{ x: -1, z: 0, w: .6, d: .6, h: .9 }, { x: 1, z: 0, w: .6, d: .6, h: .9 }] },
    'm:0:1': { from, action: 'refit', box: { x: 0, z: 0, w: 2, d: 1, h: .9 } },
    'm:0:2': { from, action: 'remove' },
    'm:0:3': { from, action: 'unblock-shots' },
    'm:0:4': { from: { ...from, w: 9 }, action: 'remove' },
  };
  const cover = applyCollisionFixes('m', 0, [row, row, row, row, row], fixes);
  assert.deepEqual(cover.map(o => o.ref), ['m:0:0.0', 'm:0:0.1', 'm:0:1', 'm:0:3', 'm:0:4']);
  assert.deepEqual([cover[0].w, cover[0].height, cover[0].kind], [.6, .9, 'barrels'], 'a piece keeps its kind and gets the new height');
  assert.equal(cover[2].w, 2);
  assert.equal(cover[3].shots, false);
  assert.equal(cover[4].w, 3, 'a stale fix leaves the row alone');
  assert.ok(sweep({ x: -5, z: 0, vx: 100, vz: 0 }, .1, { boxes: [cover[3]] }).t > 1, 'shots fly through an unblocked piece');
  assert.deepEqual(shotCover([cover[3]]), []);
});

test('every recorded fix still matches its row', () => {
  for (const [key, fix] of Object.entries(COLLISION_FIXES)) {
    const [map, variant] = key.split(':'), refs = coverFor(map, Number(variant)).map(o => o.ref);
    if (fix.action === 'split') assert.equal(refs.filter(r => r.startsWith(`${key}.`)).length, fix.boxes.length, `${key} is split`);
    else if (fix.action === 'remove') assert.ok(!refs.includes(key), `${key} is gone`);
    else assert.ok(coverFor(map, Number(variant)).some(o => o.ref === key && (fix.action !== 'refit' || o.w === fix.box.w)), `${key} is ${fix.action}`);
  }
});

test("El Puerto's barrels collide drum by drum: the empty corners of their old box are open", () => {
  const drums = coverFor('terminal', 0).filter(o => o.kind === 'barrels');
  assert.equal(drums.length, 12, 'four groups of three drums');
  for (const d of drums) assert.ok(d.w < .7 && d.d < .7, `${d.ref} is one drum`);
  // The old 3 x 2.6 m box at (-45.1, -8) reached (-46.5, -9.2); the drums leave that corner open.
  assert.equal(blocked(-46.2, -9.1, .3, 'terminal', 0), false);
  assert.equal(blocked(-45.1, -8, .3, 'terminal', 0), true, 'a drum still stops a pana');
});
