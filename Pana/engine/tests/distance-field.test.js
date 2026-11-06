// The baked distance field: signs, sub-cell accuracy, the way out, line of sight.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bakeDistanceField } from '../play/distance-field.js';

// A 10 x 10 m room (walls 1 m thick) with a 2 x 2 m pillar in the middle, 0.25 m cells.
const cell = .25, w = 48, h = 48, x0 = -1, z0 = -1;
const solid = (i, j) => { const x = x0 + (i + .5) * cell, z = z0 + (j + .5) * cell; return x < 0 || z < 0 || x > 10 || z > 10 || (x > 4 && x < 6 && z > 4 && z < 6); };
const field = bakeDistanceField({ w, h, cell, x0, z0, solid });
const near = (a, b, tolerance, text) => assert.ok(Math.abs(a - b) <= tolerance, `${text}: ${a} vs ${b}`);

test('positive in the open, negative in a wall, about the true distance', () => {
  near(field.at(1.5, 5), 1.5, .05, 'a metre and a half from the wall');
  near(field.at(5, 3), 1, .05, 'a metre from the pillar');
  near(field.at(.5, 5), .5, .05, 'half a metre from the wall');
  assert.ok(field.at(5, 5) < 0, 'inside the pillar');
  near(field.at(5, 5), -1, .15, 'a metre deep in the pillar');
  assert.ok(field.at(-.5, 5) < 0, 'inside the outer wall');
});

test('bilinear between cells: no steps along a straight run', () => {
  let last = field.at(.5, 2);
  for (let x = .52; x < 1.5; x += .02) { const d = field.at(x, 2); near(d - last, .02, .002, `slope at ${x}`); last = d; }
});

test('the gradient points the way out, in and out of a wall', () => {
  field.sample(.4, 5); near(field.gx, 1, .01, 'away from the west wall');
  field.sample(-.3, 5); near(field.gx, 1, .01, 'back in through the west wall');
  field.sample(5, 4.2); near(field.gz, -1, .01, 'north out of the pillar');
  assert.equal(field.sample(1.3, 1.7), field.at(1.3, 1.7), 'sample and at agree');
});

test('following the gradient gets a point out of any wall', () => {
  for (const [x, z] of [[-.8, -.8], [5, 5], [4.1, 4.1], [10.5, 3], [-5, 5]]) {
    let px = x, pz = z;
    for (let i = 0; i < 40; i++) { const d = field.sample(px, pz); if (d >= .1) break; px += field.gx * (.1 - d); pz += field.gz * (.1 - d); }
    assert.ok(field.at(px, pz) >= .05, `from ${x},${z} stopped at ${px},${pz}: ${field.at(px, pz)}`);
  }
});

test('past the edge of the grid the distance keeps falling', () => {
  const edge = field.sample(-1, 5), beyond = field.sample(-11, 5);
  assert.ok(beyond < edge - 9, `${beyond} vs ${edge}`);
  assert.ok(field.gx > .9, 'and the way out is back toward the grid');
});

test('clear() sees walls, and a margin narrows the way', () => {
  assert.ok(field.clear(1, 2, 9, 2), 'along the open north side');
  assert.ok(!field.clear(1, 5, 9, 5), 'through the pillar');
  assert.ok(!field.clear(1, 2, 12, 2), 'into the outer wall');
  assert.ok(field.clear(1, 3.5, 9, 3.5), 'half a metre clear of the pillar');
  assert.ok(!field.clear(1, 3.5, 9, 3.5, .8), 'but not with a body that wide');
});

test('all open and all solid still give sane numbers', () => {
  const open = bakeDistanceField({ w: 8, h: 8, solid: () => false }), rock = bakeDistanceField({ w: 8, h: 8, solid: () => true });
  assert.ok(open.at(4, 4) > 0 && Number.isFinite(open.at(4, 4)));
  assert.ok(rock.at(4, 4) < 0 && Number.isFinite(rock.at(4, 4)));
  assert.throws(() => bakeDistanceField({ w: 1, h: 4, solid: () => false }));
});

test('a single solid cell: exact distances (the transform, not an approximation)', () => {
  const f = bakeDistanceField({ w: 21, h: 21, solid: (i, j) => i === 10 && j === 10 });
  for (const [i, j] of [[0, 0], [10, 3], [3, 15], [20, 11]]) {
    near(f.at(i + .5, j + .5), Math.hypot(i - 10, j - 10) - .5, 1e-4, `cell ${i},${j}`);
  }
});
