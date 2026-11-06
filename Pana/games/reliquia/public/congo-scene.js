// How a Congo floor looks past what scene.js builds for every place: vines on every
// solid and every wall, the forest standing beyond them, lily pads and low mist on the
// channels, and the whirlpool in the pit. Nothing collides; layout.js only reads the deck.
// Loaded when a Congo floor is first built: the first-load budget has no room for it.
import { rng } from '/engine/random.js';
import { vineWalls, jungleBackdrop, lilyPads, whirlpool } from '/engine/models/props/congo.js';
import { groundMist } from '/engine/models/props/reliquia-library.js';
import { inRect } from './deck.js';

const WALL_REACH = .22, FOREST_STEP = 11, FOREST_PAD = 3.5;
// Each room wall as hanging strips, broken wherever a corridor, stub, or seal opens it.
function wallStrips(run, f) {
  const openings = [...run.corridors, ...run.stubs].filter(c => c.floor === f).map(c => c.rect).concat(run.seals.filter(s => s.floor === f).map(s => s.rect)), strips = [];
  const split = (a, b, fixed, alongX) => {
    let parts = [[a, b]];
    for (const o of openings) {
      const hit = alongX ? fixed > o[1] - .4 && fixed < o[3] + .4 : fixed > o[0] - .4 && fixed < o[2] + .4; if (!hit) continue;
      const lo = alongX ? o[0] : o[1], hi = alongX ? o[2] : o[3];
      parts = parts.flatMap(([u, v]) => [[u, Math.min(v, lo - .1)], [Math.max(u, hi + .1), v]]).filter(([u, v]) => v - u > .8);
    }
    return parts;
  };
  for (const r of run.rooms.filter(q => q.floor === f)) {
    const [x0, z0, x1, z1] = r.rect;
    for (const z of [z0, z1]) for (const [u, v] of split(x0, x1, z, true)) strips.push([u, z === z0 ? z0 : z1 - WALL_REACH, v, z === z0 ? z0 + WALL_REACH : z1]);
    for (const x of [x0, x1]) for (const [u, v] of split(z0, z1, x, false)) strips.push([x === x0 ? x0 : x1 - WALL_REACH, u, x === x0 ? x0 + WALL_REACH : x1, v]);
  }
  return strips;
}
// Open water for a lily pad: over a floor cell and clear of everything solid.
function padSpots(run, L, f, R) {
  const out = [];
  for (const r of run.rooms.filter(q => q.floor === f && !q.hidden)) for (let i = 0; i < 16; i++) {
    const x = r.x + (R() - .5) * (r.w - 1.5), z = r.z + (R() - .5) * (r.d - 1.5);
    if (L.footprint(f) && !L.overPit(x, z) && L.walkable(x, z, {}, .25)) out.push([x, z]);
  }
  return out;
}
// Trees on a loose grid, wherever it is not a room or a corridor.
function forestSpots(run, f, R) {
  const rects = [...run.rooms, ...run.corridors, ...run.stubs].filter(q => q.floor === f).map(q => q.rect), out = [];
  const x0 = Math.min(...rects.map(q => q[0])) - 16, z0 = Math.min(...rects.map(q => q[1])) - 16, x1 = Math.max(...rects.map(q => q[2])) + 16, z1 = Math.max(...rects.map(q => q[3])) + 16;
  for (let x = x0; x < x1; x += FOREST_STEP) for (let z = z0; z < z1; z += FOREST_STEP) {
    const px = x + R() * FOREST_STEP * .7, pz = z + R() * FOREST_STEP * .7;
    if (!rects.some(q => inRect(px, pz, q, FOREST_PAD))) out.push([px, pz]);
  }
  return out;
}

export function dressCongo({ run, L, f, root, floor, seed = 1 }) {
  const R = rng((seed * 48271 + f * 131) >>> 0), parts = [];
  const add = model => { root.add(model); parts.push(model); return model; };
  add(vineWalls({ solids: run.solids.filter(s => s.floor === f && s.kind === 'vine').map(s => s.rect), curtains: wallStrips(run, f), seed: (seed + f) | 0 }));
  add(jungleBackdrop({ spots: forestSpots(run, f, R), seed: (seed + 2) | 0 }));
  add(lilyPads({ spots: padSpots(run, L, f, R), seed: (seed + 3) | 0 }));
  const swirls = run.pits.filter(p => p.floor === f).map(p => add(whirlpool({ rect: p.rect, y: -.56, seed: (seed + 5) | 0 })));
  // The river's breath: low mist in the open rooms, in the look's own colour.
  const mistRooms = run.rooms.filter(r => r.floor === f && !r.hidden).map(r => ({ x: r.x, z: r.z, w: r.w, d: r.d }));
  if (mistRooms.length) floor.mist = add(groundMist(mistRooms));
  // scene.js ticks this; the world's dispose walks the floor and frees all of it.
  floor.congo = { tick: t => { for (const s of swirls) s.userData.tick(t); }, vines: parts[0].userData.counts, swirls: swirls.length, pads: parts[2].count, trees: parts[1].children[0].count };
  return floor.congo;
}
