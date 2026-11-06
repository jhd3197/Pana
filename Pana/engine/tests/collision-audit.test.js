import test from 'node:test';
import assert from 'node:assert/strict';
import { auditColliders, measure } from '../play/collision-audit.js';

// A solid box as the triangle boxes collision-debug.js would collect from it.
const solid = (x, z, w, d, h) => [x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2];
const crate = { id: 'crate', x: 0, z: 0, w: 2, d: 2, h: 2 };

test('a collider filled by its mesh is fine', () => {
  const m = measure(crate, solid(0, 0, 2, 2, 2));
  assert.equal(m.coverage, 1); assert.equal(m.top, 2);
  assert.deepEqual(auditColliders([crate], solid(0, 0, 2, 2, 2)).flagged, []);
});

test('an orphan collider is flagged for removal', () => {
  const { flagged } = auditColliders([crate], solid(10, 10, 2, 2, 2));
  assert.deepEqual(flagged[0].flags, ['no-mesh']); assert.equal(flagged[0].fix.action, 'remove');
});

test('a collider much larger than its mesh is flagged with a box fitted to the mesh', () => {
  const big = { ...crate, id: 'big', w: 6, d: 6 }, { flagged } = auditColliders([big], solid(1, 0, 2, 2, 2));
  assert.deepEqual(flagged[0].flags, ['oversized']);
  assert.deepEqual(flagged[0].fix, { action: 'refit', reason: 'collider larger than its mesh', box: { x: 1, z: 0, w: 2, d: 2, h: 2 } });
});

test('separate pieces under one box are split into a box each', () => {
  const group = { id: 'drums', x: 0, z: 0, w: 3, d: 1, h: 1 }, { flagged } = auditColliders([group], [...solid(-1.25, 0, .5, .5, .9), ...solid(1.25, 0, .5, .5, .9)]);
  assert.equal(flagged[0].fix.action, 'split');
  assert.deepEqual(flagged[0].fix.boxes, [{ x: -1.25, z: 0, w: .5, d: .5, h: .9 }, { x: 1.25, z: 0, w: .5, d: .5, h: .9 }]);
});

test('a box that stops shots over a mesh lower than their flight is an invisible wall', () => {
  const sandbags = { id: 'sandbags', x: 0, z: 0, w: 6, d: 1, h: .7, blocksShots: true }, { flagged } = auditColliders([sandbags], solid(0, 0, 6, 1, .7), { shotHeight: 1.1 });
  assert.deepEqual(flagged[0].flags, ['under-shot']); assert.equal(flagged[0].fix.action, 'unblock-shots');
});

test('broken pieces stop blocking shots, destroyed ones go', () => {
  const { flagged } = auditColliders([{ ...crate, id: 'cracked', health: .4 }, { ...crate, id: 'gone', x: 5, health: 0 }], [...solid(0, 0, 2, 2, 2), ...solid(5, 0, 2, 2, 2)]);
  assert.deepEqual(flagged.map(c => [c.id, c.fix.action]), [['cracked', 'unblock-shots'], ['gone', 'remove']]);
});

test('low cover a shot flies over, ground paint and allowlisted bounds are never flagged', () => {
  const low = { id: 'sandbags', x: 0, z: 0, w: 6, d: 1, h: .7 }, wall = { id: 'edge', source: 'court-bounds', x: 0, z: 20, w: 40, d: 1, h: Infinity };
  const r = auditColliders([low, wall], [-20, 0, -20, 20, .02, 20, ...solid(0, 0, 6, 1, .7)], { shotHeight: 1.1, allow: ['court-bounds'] });
  assert.deepEqual(r.flagged, []);
  assert.equal(r.colliders[0].blocksShots, false); assert.equal(r.colliders[1].allowed, true);
  assert.equal(measure(crate, [-5, 0, -5, 5, .02, 5]).coverage, 0, 'court paint is not a mesh');
});
