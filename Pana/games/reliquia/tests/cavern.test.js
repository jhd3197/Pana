// The camp's far cavern is looks only: same rect, same deck, nothing solid-looking
// standing where a pana can walk, and the same hall every time.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildVista, ceilingAt, vistaPlan, wallRadius, CAMP_RECT, FALLS, GATE, HEAD, HOLE, LAKE_Y, LEDGE_MUSHROOMS, PIT, POOLS, PROP_SPOTS, ROAD, SEARCHLIGHT } from '../public/camp-vista.js';
import { roarFor } from '../public/options.js';
import { generateRun } from '../public/deck.js';
import { layoutFor } from '../public/layout.js';

const [X0, Z0, X1, Z1] = CAMP_RECT, inRect = (x, z, pad = 0) => x > X0 - pad && x < X1 + pad && z > Z0 - pad && z < Z1 + pad;

test('the rect here is the rect the deck deals, and the camp still walks the same', () => {
  const camp = generateRun(1).rooms.find(r => r.id === 'camp');
  assert.deepEqual(camp.rect, CAMP_RECT);
  const L = layoutFor(1);
  for (const [x, z] of [[0, 12], [-17, 1], [17, 29], [-17, 29], [17, 1]]) assert.ok(L.walkable(x, z, {}), `walkable ${x}, ${z}`);
  for (const [x, z] of [[-19.5, 10], [19.5, 10], [0, 31], [8, -3]]) assert.ok(!L.walkable(x, z, {}), `not walkable ${x}, ${z}`);
});

test('the hall is the same every time', () => {
  assert.deepEqual(vistaPlan(), vistaPlan());
  const a = buildVista();
  assert.ok(a.positions.length > 0 && a.positions.length === a.colors.length);
  assert.ok(a.mirrorPositions.length === a.mirrorColors.length);
  for (const n of a.colors) assert.ok(Number.isFinite(n));
});

test('nothing of the far hall stands in the walkable rect', () => {
  const { positions } = buildVista();
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    if (inRect(x, z)) assert.ok(y < -.01 || y > 20, `soup vertex at ${x}, ${y}, ${z}`);
  }
  const plan = vistaPlan();
  for (const c of plan.columns) assert.ok(!inRect(c.x, c.z, c.base * 1.3), 'column');
  for (const s of plan.spires) assert.ok(!inRect(s.x, s.z, s.radius), 'spire');
  for (const m of plan.shrooms) assert.ok(!inRect(m.x, m.z, m.size), 'fungus');
  for (const f of FALLS) assert.ok(!inRect(f.x, f.z, f.width), 'fall');
  for (const p of POOLS) assert.ok(!inRect(p.x, p.z), 'lantern');
  assert.ok(!inRect(GATE.x, GATE.z, GATE.r) && !inRect(HEAD.x, HEAD.z, HEAD.size));
  assert.ok(!inRect(SEARCHLIGHT.x, SEARCHLIGHT.z) && !inRect(PIT.x, PIT.z, PIT.r));
});

test('the camp\'s props and ledges stand past the rect', () => {
  for (const [kind, x, z] of PROP_SPOTS) assert.ok(!inRect(x, z, .3), `${kind} at ${x}, ${z}`);
  for (const [x, , z] of LEDGE_MUSHROOMS) assert.ok(!inRect(x, z, .3), `mushrooms at ${x}, ${z}`);
  // The road leaves through the gap, past the south edge.
  for (const [x, z] of ROAD) assert.ok(!inRect(x, z), `road at ${x}, ${z}`);
});

test('the roof is far overhead, and holds the head and the falls under it', () => {
  for (let x = X0; x <= X1; x += 4) for (let z = Z0; z <= Z1; z += 4) assert.ok(ceilingAt(x, z) > 90, `ceiling over the camp at ${x}, ${z}`);
  assert.ok(ceilingAt(HOLE.x, HOLE.z) > 100);
  assert.ok(ceilingAt(HEAD.x, HEAD.z) > HEAD.y + HEAD.size * 1.85, 'the crown clears the roof');
  for (const f of FALLS) { assert.ok(ceilingAt(f.x, f.z) > f.top + 10, 'a fall starts under the roof'); assert.ok(f.top > LAKE_Y + 60, 'and is tall'); }
  for (let a = 0; a < 6.28; a += .2) assert.ok(wallRadius(a) > 170, `the far wall is far at ${a}`);
});

test('the far roar is quiet, and quieter the softer the Sustos', () => {
  assert.ok(roarFor('normal') <= .05);
  assert.ok(roarFor('suaves') < roarFor('normal') && roarFor('apagados') < roarFor('suaves'));
});
