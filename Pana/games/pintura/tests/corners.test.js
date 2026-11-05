// Pepazo's panas get round the corners of the cover, on every court, through the real room.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Arena, VARIANTS, RADIUS, blocked, coverFor } from '../public/rules.js';
import { PAINT_ARENAS } from '../../../engine/worlds/arena-layouts.js';

const arena = (id, variant) => {
  const g = new Arena(id, 'normal', {}); g.add(1, { name: 'A', avatar: {} }); g.start(); g.go(); g.variant = variant;
  return { g, p: g.players[0] };
};

test('walking straight past a box you only graze goes round its corner', () => {
  let walked = 0;
  for (const { id } of PAINT_ARENAS) for (let variant = 0; variant < VARIANTS; variant++) {
    const clear = (x, z) => !blocked(x, z, RADIUS, id, variant), { g, p } = arena(id, variant);
    for (const o of coverFor(id, variant).filter((_, i) => i % 3 === 0)) {
      // Going east along the box's north face, overlapping its corner by 20 cm.
      const z = o.z - o.d / 2 - RADIUS + .2, from = o.x - o.w / 2 - RADIUS - 1, to = o.x;
      let open = true;
      for (let x = from; x <= to; x += .25) if (!clear(x, o.z - o.d / 2 - RADIUS - .1)) open = false;
      if (!open || !clear(from, z)) continue;
      Object.assign(p, { x: from, z, stamina: 1 });
      const t = (to - from) / 4 + 1;
      for (let s = 0; s < t; s += 1 / 30) g.step(1 / 30, new Map([[1, { x: 1, z: 0 }]]));
      assert.ok(p.x > o.x - o.w / 2, `${id}:${variant} stuck at ${p.x.toFixed(2)},${p.z.toFixed(2)} on the box at ${o.x},${o.z}`);
      assert.ok(clear(p.x, p.z), 'never inside the cover');
      walked++;
    }
  }
  assert.ok(walked > 50, `enough corners tried: ${walked}`);
});
