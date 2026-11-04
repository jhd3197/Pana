// Everyone reads one search: the way to the nearest target, around walls.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FlowField, flowFromField } from '../play/flow-field.js';
import { bakeDistanceField } from '../play/distance-field.js';

// Two 10 x 10 rooms joined by a door in the wall at x = 10..11, z = 4..6.
const open = (x, z) => x > 0 && z > 0 && z < 10 && x < 21 && (x < 10 || x > 11 || (z > 4 && z < 6));
const flow = new FlowField({ w: 42, h: 20, cell: .5, free: (i, j) => open((i + .5) * .5, (j + .5) * .5) });
const walk = (x, z, f = flow, steps = 500) => { for (let i = 0; i < steps; i++) { if (f.toward(x, z) <= 0) break; x += f.dx * .2; z += f.dz * .2; assert.ok(open(x, z), `walked into a wall at ${x},${z}`); } return { x, z, left: f.toward(x, z) }; };

test('from the other room the way leads through the door, not at the wall', () => {
  flow.reset(); assert.ok(flow.add(18, 8)); flow.compute();
  assert.ok(flow.toward(2, 8) > 0, 'reachable');
  const end = walk(2, 8); assert.equal(end.left, 0); assert.ok(Math.hypot(end.x - 18, end.z - 8) < 1, `ended at ${end.x},${end.z}`);
});

test('several targets: each walker goes to the nearest', () => {
  flow.reset(); flow.add(2, 2); flow.add(19, 8); flow.compute();
  const a = walk(4, 4), b = walk(16, 8);
  assert.ok(Math.hypot(a.x - 2, a.z - 2) < 1, 'west'); assert.ok(Math.hypot(b.x - 19, b.z - 8) < 1, 'east');
});

test('walled off: no way, and no direction', () => {
  const f = new FlowField({ w: 20, h: 20, cell: 1, free: i => i !== 10 });
  f.reset(); f.add(2, 2); f.compute();
  assert.equal(f.toward(15, 5), -1); assert.equal(f.dx, 0); assert.equal(f.dz, 0);
  assert.ok(f.toward(5, 5) > 0);
});

test('a target against a wall counts from the nearest open cell; none at all is refused', () => {
  const f = new FlowField({ w: 20, h: 20, cell: 1, free: i => i < 10 });
  f.reset(); assert.ok(f.add(11.5, 5)); f.compute(); assert.ok(f.toward(2, 5) > 0);
  f.reset(); assert.ok(!f.add(19.5, 5, 2));
});

test('built from a distance field, the margin keeps it off the walls', () => {
  const field = bakeDistanceField({ w: 40, h: 40, cell: .5, solid: (i, j) => i < 4 || j < 4 || i >= 36 || j >= 36 });
  const f = flowFromField(field, { cell: .5, margin: 1 });
  assert.equal(f.cellAt(2.2, 10), -1, 'too close to the wall');
  assert.ok(f.cellAt(4, 10) >= 0);
});
