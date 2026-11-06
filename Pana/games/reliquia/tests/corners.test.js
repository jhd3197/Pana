// Fosa's walls and its collision agree at corners, and a body gets round them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutFor } from '../public/layout.js';
import { inRect } from '../public/deck.js';

const BODY = .42, THEMES = ['mina', 'biblioteca', 'inundada', 'hongos', 'templo'];
const open = L => ({ lift: { floor: 1, moving: false }, revealed: Object.fromEntries(L.run.hidden.map(h => [h.id, 1])), open: Object.fromEntries(L.run.seals.map(s => [s.id, 1])) });
const layouts = function* () { for (const theme of THEMES) for (let seed = 1; seed <= 5; seed++) yield layoutFor(seed, 2, theme); };

test('a walk straight at a door jamb goes through, however little it overlaps', () => {
  let walked = 0;
  for (const L of layouts()) {
    const state = open(L);
    for (const c of L.run.corridors.filter(c => c.floor === 1 && !c.horizontal)) {
      // From the room south of the corridor, walking north, at both jambs.
      const [x0, , x1, z1] = c.rect, mouth = z1 - .5, clear = (x, z) => !L.run.solids.some(s => s.floor === 1 && inRect(x, z, s.rect, BODY + .1)) && !L.run.nooks.some(n => n.floor === 1 && inRect(x, z, n.rect, BODY + .1)) && !L.run.pits.some(p => p.floor === 1 && inRect(x, z, p.rect, BODY + .1)) && !L.run.obstacles.some(o => o.floor === 1 && Math.hypot(o.x - x, o.z - z) < o.r + BODY + .1);
      for (let off = .02; off < BODY; off += .05) for (const x of [x0 + off, x1 - off]) {
        const lane = [1.5, 1, .5, 0, -.5, -1].every(d => clear(x, mouth + d) && clear(x0 + .5, mouth + d) && clear(x1 - .5, mouth + d));
        if (!lane) continue;
        const b = { x, z: mouth + 1.5 };
        for (let t = 0; t < 1.2; t += 1 / 60) L.moveBody(b, 0, -4.6 / 60, state, BODY);
        assert.ok(b.z < mouth - .6, `seed ${L.run.seed} ${c.id}: stuck at ${b.x.toFixed(2)},${b.z.toFixed(2)} (mouth ${mouth})`);
        walked++;
      }
    }
  }
  assert.ok(walked > 100, `enough jambs tried: ${walked}`);
});

test('collision follows the shell: floor on the same 1 m cells the walls are built around', () => {
  for (const L of layouts()) {
    const state = open(L), { run } = L, f = 1;
    const shellFloor = (x, z) => [...run.rooms, ...run.corridors, ...run.stubs].some(q => q.floor === f && inRect(x, z, q.rect));
    for (const q of [...run.corridors, ...run.stubs].filter(q => q.floor === f)) {
      const [a, b, c, d] = q.rect;
      for (let z = Math.floor(b) - 1; z <= Math.ceil(d) + 1; z++) for (let x = Math.floor(a) - 1; x <= Math.ceil(c) + 1; x++) {
        if (shellFloor(x + .5, z + .5)) continue;
        for (const [u, v] of [[.125, .125], [.875, .125], [.125, .875], [.875, .875]]) assert.equal(L.walkable(x + u, z + v, state, 0), false, `${q.id}: walkable inside the brick at ${x + u},${z + v}`);
      }
    }
    // A mouth's floor runs right up to its walls: nothing invisible stands in front of the brick.
    for (const q of run.stubs.filter(s => s.floor === f && s.kind === 'vault')) {
      const left = Math.floor(q.rect[0] - .5) + 1, z = (q.rect[1] + q.rect[3]) / 2;
      assert.equal(L.walkable(left + .1, z, state, 0), true, `${q.id}: an invisible wall before the brick`);
    }
  }
});
