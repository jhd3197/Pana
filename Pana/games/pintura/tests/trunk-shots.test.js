// Pellets mark a thin tree only where their own ray meets the trunk; a wall takes them all.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Arena, SHOT_HEIGHT, coverFor } from '../public/rules.js';
import { launch, segmentBox, segmentCircle } from '../../../engine/play/projectile.js';

const SPREAD = .28, TRUNK = coverFor('plaza', 0).find(o => o.kind === 'tree');
// La Corneta fired once from `d` metres along the unit aim (ax, az), at a point (tx, tz).
function fire(tx, tz, ax, az, d, offset = 0) {
  const g = new Arena('plaza', 'normal', {}); g.add(1, { name: 'A', avatar: {} }); g.start(); g.go();
  const p = g.players[0]; p.kit = { ...p.kit, weapon: 'blunderbuss' }; g.refill(p);
  Object.assign(p, { x: tx - ax * d - az * offset, z: tz - az * d + ax * offset, shield: 0, cooldown: 0, reload: 0, swap: 0 });
  assert.equal(p.weapon, 'blunderbuss');
  g.step(.02, new Map([[1, { ax, az, fire: true }]]));
  assert.equal(g.balls.length + g.splats.length, 5, 'five pellets left');
  for (let i = 0; i < 15; i++) g.step(.02, new Map([[1, { ax, az }]]));
  return { g, p, marks: g.splats };
}
// The pellets whose own ray crosses the trunk's circle, from the fan alone.
const expected = (p, ax, az) => [-1, -.5, 0, .5, 1].filter(k => {
  const { vx, vz } = launch(ax, az, 1, SPREAD * k);
  return segmentCircle(p.x, p.z, vx * 20, vz * 20, TRUNK, TRUNK.trunk) !== null;
}).length;

// Nothing else stands between the shooter and the tree, on any pellet's way.
const lane = (p, ax, az, d) => !coverFor('plaza', 0).some(o => o !== TRUNK && (o.h ?? Infinity) > SHOT_HEIGHT && [-1, -.5, 0, .5, 1].some(k => {
  const { vx, vz } = launch(ax, az, d + .5, SPREAD * k); return segmentBox(p.x, p.z, vx, vz, o, .12) !== null;
}));

test('the five pellets leave five marks only when all five rays meet the trunk', () => {
  const a = Math.SQRT1_2; let tried = 0;
  for (const [ax, az] of [[1, 0], [0, 1], [a, a], [-a, a]]) for (const d of [1, 1.5, 2, 3, 5, 8]) for (const offset of [0, .15, .4]) {
    const { p, marks } = fire(TRUNK.x, TRUNK.z, ax, az, d, offset), on = marks.filter(s => Math.hypot(s.x - TRUNK.x, s.z - TRUNK.z) < TRUNK.trunk + .02);
    if (!lane(p, ax, az, d)) continue;
    assert.equal(on.length, expected(p, ax, az), `aim ${ax.toFixed(1)},${az.toFixed(1)} from ${d} m, ${offset} aside`);
    tried++;
  }
  assert.ok(tried > 30, `enough shots tried: ${tried}`);
});

test('from 2 m on a diagonal, one pellet hits, not all five', () => {
  const a = Math.SQRT1_2, { marks } = fire(TRUNK.x, TRUNK.z, a, a, 2);
  assert.equal(marks.filter(s => Math.hypot(s.x - TRUNK.x, s.z - TRUNK.z) < .5).length, 1);
});

test('each mark sits on the trunk at its own ray, small enough to stay on it', () => {
  const { marks } = fire(TRUNK.x, TRUNK.z, 1, 0, 1);
  assert.equal(marks.length, 3, 'three of the five reach it from a metre');
  for (const s of marks) { assert.ok(Math.abs(Math.hypot(s.x - TRUNK.x, s.z - TRUNK.z) - TRUNK.trunk) < .02, `on the bark: ${s.x},${s.z}`); assert.ok(s.radius < .5); }
  assert.ok(new Set(marks.map(s => s.z.toFixed(2))).size === 3, 'three different spots');
});

test('a pellet that misses the trunk flies on to what is behind it', () => {
  // Square on to a stall, with the tree in the way: the middle pellet stops on the bark.
  const wall = coverFor('plaza', 0).find(o => o.kind === 'stall' && o.w > 3);
  const open = fire(wall.x, wall.z + wall.d / 2, 0, -1, 1).marks.length;
  assert.equal(open, 5, 'with nothing in between, all five reach the stall');
  const tree = { ...TRUNK, x: wall.x, z: wall.z + wall.d / 2 + .6 }, g = new Arena('plaza', 'normal', {}), cover = [...g.cover, tree];
  Object.defineProperty(g, 'cover', { get: () => cover });
  g.add(1, { name: 'A', avatar: {} }); g.start(); g.go();
  const p = g.players[0]; p.kit = { ...p.kit, weapon: 'blunderbuss' }; g.refill(p);
  Object.assign(p, { x: wall.x, z: wall.z + wall.d / 2 + 2, shield: 0, cooldown: 0, reload: 0, swap: 0 });
  g.step(.02, new Map([[1, { ax: 0, az: -1, fire: true }]])); for (let i = 0; i < 15; i++) g.step(.02, new Map([[1, { ax: 0, az: -1 }]]));
  const onTree = g.splats.filter(s => s.radius), onWall = g.splats.filter(s => !s.radius);
  assert.equal(onTree.length + onWall.length, 5, 'every pellet landed somewhere');
  assert.ok(onTree.length >= 1 && onWall.length >= 1, `${onTree.length} on the bark, ${onWall.length} on the stall behind`);
  assert.ok(onWall.every(s => Math.abs(s.z - (wall.z + wall.d / 2)) < .2), 'those flew on to the stall');
});

test('a wall takes every pellet, with its marks apart', () => {
  // The kiosk's wide face, close up.
  const wall = coverFor('plaza', 0).find(o => o.kind === 'stall' && o.w > 3), z = wall.z + wall.d / 2;
  const { marks } = fire(wall.x, z, 0, -1, .5);
  assert.equal(marks.length, 5, 'all five on the wall'); assert.equal(new Set(marks.map(s => s.x.toFixed(2))).size, 5);
  assert.ok(marks.every(s => !s.radius), 'full-size marks on a wall');
});
