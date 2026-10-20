// The expedition's map, renderer-free: the camp with the truck, and the
// jornada's floor dealt from a shuffled room deck, so two never match. Each
// jornada is one floor; `depth` (the jornada's number) makes it harder,
// richer and darker. Everyone builds the same run from the same seed, so snapshots carry
// only what changed (opened seals, lifted loot), never the map itself.
//
// Floors sit side by side (SPACING apart in x) at the same height; the one
// montacargas rides between them: its stops (`run.lifts`) are the camp's
// mine mouth and an alcove off each floor's entrance room. Rooms lie on a 3 × 4
// grid of CELL metres; the path goes from the entrance (south, row 0) to the
// exit (north), with side rooms and sometimes a hidden one off it.
import { rng } from '../../../engine/random.js';
import { SMALL, BIG_POOL, ARTIFACTS } from './items.js';

export const CELL = 26, SPACING = 220, ROWS = 4, COLS = [-1, 0, 1], HEIGHT = 4.6;
export const CAMP = { x: 0, z: 12 }, TRUCK = { x: 9, z: 20, h: -Math.PI / 2 }, TRUCK_RADIUS = 4.6;
export const TABLE = { x: -7, z: 9 };
const CAMP_RECT = [-18, -2, 18, 30], STUB = 6.2;
// The montacargas cage: 3.2 m square around a stop's centre.
export const CAGE = 1.6;

export const ROOM_NAMES = {
  entrada: 'La bajada', tesoro: 'Cámara del tesoro', columnas: 'Sala de columnas', trampas: 'Pasillo de las losas',
  idolo: 'El altar del ídolo', veta: 'La veta de oro', cripta: 'La cripta', santuario: 'El santuario', puente: 'El abismo',
  ruedas: 'Las dos ruedas', guardian: 'El trono del guardián', boveda: 'La bóveda de oro', oculta: 'La sala escondida',
};
export const FLOOR_NAMES = ['El campamento', 'Las afueras de la mina', 'Las cámaras trampa', 'Las ruinas malditas', 'La bóveda del jaguar', 'El oro profundo'];
const SIZES = { entrada: [16, 14], tesoro: [16, 14], columnas: [18, 16], trampas: [16, 16], idolo: [14, 14], veta: [16, 14], cripta: [16, 16],
  santuario: [12, 12], puente: [18, 18], ruedas: [18, 16], guardian: [20, 18], boveda: [22, 22], oculta: [12, 12] };
const DECK = ['tesoro', 'columnas', 'trampas', 'idolo', 'veta', 'cripta', 'santuario', 'puente'];

export const rectOf = r => [r.x - r.w / 2, r.z - r.d / 2, r.x + r.w / 2, r.z + r.d / 2];
export const inRect = (x, z, [x0, z0, x1, z1], pad = 0) => x > x0 - pad && x < x1 + pad && z > z0 - pad && z < z1 + pad;
export const floorOf = x => Math.max(0, Math.round(x / SPACING));
// Which seal opens each floor's way down; the last floor holds the vault.
// Every third jornada ends in the jaguar's vault; the others in a sealed
// treasure chamber behind the two wheels or the sun guardian.
export const sealKind = depth => depth % 3 === 0 ? 'boveda' : depth % 2 ? 'ruedas' : 'guardian';

const cache = new Map();
export function generateRun(seed = 1, { depth = 1 } = {}) {
  const floors = 1, key = `${seed}:${depth}`;
  if (cache.has(key)) return cache.get(key);
  const run = { seed, floors, depth, rooms: [], corridors: [], stubs: [], lifts: [], carts: [], cargo: [], seals: [], hidden: [], loot: [], chests: [], plates: [],
    sleepers: [], obstacles: [], lights: [], decor: [], pits: [], bridges: [] };
  const id = { loot: 0, chest: 0, plate: 0, sleeper: 0 };
  // ---- Camp: outdoors, the truck and the mine mouth at its north edge.
  run.rooms.push({ id: 'camp', floor: 0, kind: 'camp', x: 0, z: 14, w: 36, d: 32, name: FLOOR_NAMES[0], rect: CAMP_RECT });
  // The mine mouth is a short gallery with the montacargas at its end.
  const campStub = { id: 'stub-camp', kind: 'shaft', floor: 0, rect: [-2.2, -9.2, 2.2, -1.9], axis: 'z', a: -2, b: -9.2, from: 0, to: 0 };
  run.lifts.push({ id: 'stop-0', floor: 0, x: 0, z: -6.6, h: 0 });
  // The cargo lift's top end, beside the truck: the carrito's load lands here.
  run.cargo.push({ id: 'cargo-0', floor: 0, x: TRUCK.x - 6, z: TRUCK.z + 5 });
  // The shop stall on the camp's west side (rules.js SHOP_AT).
  run.obstacles.push({ x: -12.5, z: 5, r: 1.3, floor: 0 }, { x: -12.5, z: 7, r: 1.3, floor: 0 });
  run.stubs.push(campStub);
  run.decor.push({ kind: 'table', floor: 0, x: TABLE.x, z: TABLE.z, h: 0 });
  // The truck is long: three circles along it (it faces -x).
  run.obstacles.push({ x: TABLE.x, z: TABLE.z, r: 1.2, floor: 0 }, ...[-1.8, 0, 1.8].map(dx => ({ x: TRUCK.x + dx, z: TRUCK.z, r: 1.6, floor: 0 })), { x: -9, z: 22, r: 2.2, floor: 0 }, { x: 3, z: 26, r: 1.2, floor: 0 });
  // The starting kit waits on the expedition table.
  for (const [kind, x] of [['farol', -.8], ['farol', 0], ['honda', .8]]) run.loot.push({ id: id.loot++, kind, floor: 0, room: 'camp', x: TABLE.x + x, z: TABLE.z, y: 1.02, h: 0 });
  for (let f = 1; f <= floors; f++) {
    const R = rng((seed * 2654435761 + depth * 40503) >>> 0), pick = list => list[Math.floor(R() * list.length)];
    const OX = f * SPACING, at = (c, r) => ({ x: OX + c * CELL, z: -18 - r * CELL });
    // Main path: a random walk north that never revisits a cell.
    const path = [[pick(COLS), 0]], seen = new Set([path[0].join()]);
    while (path.at(-1)[1] < ROWS - 1 || path.length < 5) {
      const [c, r] = path.at(-1);
      const options = [[c, r + 1, r < ROWS - 1 ? 2 : 0], [c - 1, r, 1], [c + 1, r, 1]].filter(([cc, rr, w]) => w && COLS.includes(cc) && !seen.has(`${cc},${rr}`));
      if (!options.length) break;
      let roll = R() * options.reduce((n, o) => n + o[2], 0), next = options[0];
      for (const o of options) { roll -= o[2]; if (roll <= 0) { next = o; break; } }
      path.push([next[0], next[1]]); seen.add(`${next[0]},${next[1]}`);
      if (next[1] === ROWS - 1 && path.length >= 5) break;
    }
    const deck = [...DECK]; for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    if (!deck.slice(0, path.length - 2).includes('idolo')) deck[Math.floor(R() * Math.max(1, path.length - 2))] = 'idolo';
    const kinds = path.map((_, i) => i === 0 ? 'entrada' : i === path.length - 1 ? sealKind(depth) : deck[(i - 1) % deck.length]);
    const rooms = path.map(([c, r], i) => {
      const [w, d] = SIZES[kinds[i]], p = at(c, r);
      return { id: `f${f}-r${i}`, floor: f, kind: kinds[i], cell: [c, r], x: p.x, z: p.z, w, d, name: ROOM_NAMES[kinds[i]], index: i };
    });
    // Side rooms: one hidden (needs the echo mask), one extra.
    const free = [];
    for (const [c, r] of path) for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const cc = c + dc, rr = r + dr;
      if (COLS.includes(cc) && rr >= 0 && rr < ROWS && !seen.has(`${cc},${rr}`) && !free.some(q => q.cell.join() === `${cc},${rr}`)) free.push({ cell: [cc, rr], from: path.findIndex(q => q[0] === c && q[1] === r) });
    }
    const sides = [];
    for (const kind of [R() < .8 ? 'oculta' : null, pick(['tesoro', 'santuario', 'veta'])]) {
      if (!kind || !free.length) continue;
      const spot = free.splice(Math.floor(R() * free.length), 1)[0], p = at(...spot.cell), [w, d] = SIZES[kind];
      seen.add(spot.cell.join());
      sides.push({ room: { id: `f${f}-s${sides.length}`, floor: f, kind, cell: spot.cell, x: p.x, z: p.z, w, d, name: ROOM_NAMES[kind], side: true }, from: rooms[spot.from] });
    }
    for (const r of [...rooms, ...sides.map(s => s.room)]) { r.rect = rectOf(r); run.rooms.push(r); }
    // Corridors: 4 m wide between facing walls, nudged off-centre.
    const corridor = (a, b, hidden = null) => {
      const horizontal = a.cell[1] === b.cell[1], [first, second] = horizontal ? (a.x < b.x ? [a, b] : [b, a]) : (a.z < b.z ? [a, b] : [b, a]);
      const room = Math.min(horizontal ? first.d : first.w, horizontal ? second.d : second.w) / 2 - 3, offset = Math.round((R() - .5) * 2 * Math.max(0, Math.min(2, room)));
      const rect = horizontal ? [first.x + first.w / 2 - .5, first.z + offset - 2, second.x - second.w / 2 + .5, first.z + offset + 2]
        : [first.x + offset - 2, first.z + first.d / 2 - .5, first.x + offset + 2, second.z - second.d / 2 + .5];
      const c = { id: `c${run.corridors.length}`, floor: f, rect, a: a.id, b: b.id, horizontal, hidden };
      run.corridors.push(c); return c;
    };
    for (let i = 1; i < rooms.length; i++) corridor(rooms[i - 1], rooms[i]);
    for (const s of sides) {
      const hidden = s.room.kind === 'oculta' ? `h${run.hidden.length}` : null, c = corridor(s.from, s.room, hidden);
      if (!hidden) continue;
      // The fake wall stands in the corridor mouth on the path room's side.
      const a = s.from, [x0, z0, x1, z1] = c.rect;
      const wall = c.horizontal ? (s.room.x > a.x ? [a.x + a.w / 2 - .3, z0, a.x + a.w / 2 + .9, z1] : [a.x - a.w / 2 - .9, z0, a.x - a.w / 2 + .3, z1])
        : (s.room.z > a.z ? [x0, a.z + a.d / 2 - .3, x1, a.z + a.d / 2 + .9] : [x0, a.z - a.d / 2 - .9, x1, a.z - a.d / 2 + .3]);
      run.hidden.push({ id: hidden, floor: f, room: s.room.id, corridor: c.id, rect: wall, x: (wall[0] + wall[2]) / 2, z: (wall[1] + wall[3]) / 2, horizontal: c.horizontal });
      s.room.hidden = hidden;
    }
    // The montacargas stops in an alcove off the entrance's south wall. The
    // exit room's seal (wheels or the guardian) keeps a treasure chamber shut.
    const entry = rooms[0], exit = rooms.at(-1), down = exit.kind !== 'boveda';
    const alcove = { id: `stub-${f}`, kind: 'shaft', floor: f, rect: [entry.x - 2.2, entry.z + entry.d / 2 - .1, entry.x + 2.2, entry.z + entry.d / 2 + STUB], axis: 'z', a: entry.z + entry.d / 2, b: entry.z + entry.d / 2 + STUB, from: 0, to: 0 };
    run.stubs.push(alcove);
    run.lifts.push({ id: `stop-${f}`, floor: f, x: entry.x, z: entry.z + entry.d / 2 + STUB / 2 + .3, h: Math.PI });
    if (down) {
      const vault = { id: `vault-${f}`, kind: 'vault', floor: f, rect: [exit.x - 2.6, exit.z - exit.d / 2 - STUB, exit.x + 2.6, exit.z - exit.d / 2 + .1], axis: 'z', a: exit.z - exit.d / 2, b: exit.z - exit.d / 2 - STUB, from: 0, to: 0 };
      run.stubs.push(vault);
      const seal = { id: `seal-${f}`, floor: f, kind: exit.kind, room: exit.id, x: exit.x, z: exit.z - exit.d / 2 - .4, rect: [exit.x - 2.7, exit.z - exit.d / 2 - .9, exit.x + 2.7, exit.z - exit.d / 2 + .1], vault: vault.id };
      // Behind the seal: a big treasure and a scatter of gold.
      const mid = (vault.rect[1] + vault.rect[3]) / 2 - .6;
      run.loot.push({ id: id.loot++, kind: BIG_POOL[Math.min(2, depth - 1)][Math.floor(R() * 3)], floor: f, room: vault.id, x: exit.x, z: mid - .8, h: 0 });
      for (const [dx, dz] of [[-1.6, 1.4], [1.6, 1.4], [-1.6, -2.2], [1.6, -2.2]]) run.loot.push({ id: id.loot++, kind: SMALL[Math.min(3, Math.floor(R() * (2 + depth)))], floor: f, room: vault.id, x: exit.x + dx, z: mid + dz, h: R() * 6 });
      if (exit.kind === 'ruedas') {
        seal.winches = [-1, 1].map(s => ({ id: `${seal.id}-${s < 0 ? 'w' : 'e'}`, x: exit.x + s * (exit.w / 2 - 2.6), z: exit.z - exit.d / 2 + 3 }));
        for (const w of seal.winches) run.obstacles.push({ x: w.x, z: w.z, r: .65, floor: f });
      }
      run.seals.push(seal);
    }
    for (const r of [...rooms, ...sides.map(s => s.room)]) furnish(run, r, f, depth, R, id);
  }
  // Nothing rests inside a pillar, a brazier or a coffin placed after it.
  for (const item of run.loot) for (const o of run.obstacles) {
    if (o.floor !== item.floor || item.y) continue;
    const dx = item.x - o.x, dz = item.z - o.z, d = Math.hypot(dx, dz) || 1, min = o.r + .55;
    if (d < min) { item.x = o.x + dx / d * min; item.z = o.z + dz / d * min; }
  }
  cache.set(key, run);
  return run;
}

// Contents of one room: obstacles, loot, chests, traps, sleepers and decor.
function furnish(run, room, f, depth, R, id) {
  // `f` places things on the floor; `d` (the jornada's depth) decides how much.
  const [x0, z0, x1, z1] = room.rect, cx = room.x, cz = room.z, d = depth, deep = Math.min(1, d / 4);
  const taken = [];
  // Keep every doorway and stair mouth clear for three metres into the room.
  const mouths = [...run.corridors.filter(c => c.a === room.id || c.b === room.id), ...run.stubs.filter(s => inRect(s.rect[0] + 2.2, s.a, room.rect, .2))]
    .map(c => c.horizontal ? [c.rect[0] - 3, c.rect[1] - .6, c.rect[2] + 3, c.rect[3] + .6] : [c.rect[0] - .6, c.rect[1] - 3, c.rect[2] + .6, c.rect[3] + 3]);
  const seal = run.seals.find(s => s.room === room.id);
  if (seal) mouths.push([seal.x - 3.3, seal.z - .5, seal.x + 3.3, seal.z + 3.5], ...(seal.winches || []).map(w => [w.x - 1.6, w.z - 1.6, w.x + 1.6, w.z + 1.6]));
  const free = (x, z, r) => !mouths.some(m => inRect(x, z, m, r)) && !run.obstacles.some(o => o.floor === f && Math.hypot(o.x - x, o.z - z) < o.r + r) && !taken.some(t => Math.hypot(t.x - x, t.z - z) < t.r + r)
    && !run.pits.some(p => p.floor === f && inRect(x, z, p.rect, r) && !run.bridges.some(b => inRect(x, z, b.rect)));
  const spot = (r = .7, margin = 1.6) => {
    for (let i = 0; i < 40; i++) {
      const x = x0 + margin + R() * (room.w - margin * 2), z = z0 + margin + R() * (room.d - margin * 2);
      if (free(x, z, r)) { taken.push({ x, z, r }); return { x, z }; }
    }
    return null;
  };
  const loot = (kind, p = spot(.5)) => { if (p) run.loot.push({ id: id.loot++, kind, floor: f, room: room.id, x: p.x, z: p.z, h: R() * 6.28 }); };
  const small = n => { for (let i = 0; i < n; i++) loot(SMALL[Math.min(SMALL.length - 1, Math.floor(R() * (2 + d)))]); };
  const chest = () => { const p = spot(.8); if (p) run.chests.push({ id: id.chest++, floor: f, room: room.id, x: p.x, z: p.z, h: Math.round(R() * 4) * Math.PI / 2 }); if (p) run.obstacles.push({ x: p.x, z: p.z, r: .6, floor: f, chest: true }); };
  const sleeper = (kind = 'mummy', p = spot(.6)) => { if (p) run.sleepers.push({ id: id.sleeper++, kind, floor: f, room: room.id, x: p.x, z: p.z }); };
  // A cuaima coils up beside a piece of this room's loot; spiders wait above.
  const guard = () => { const l = run.loot.filter(l => l.room === room.id && !l.y); const near = l[Math.floor(R() * l.length)]; if (near) sleeper('snake', { x: near.x + (R() < .5 ? -1 : 1), z: near.z + .4 }); };
  const ceiling = n => { for (let i = 0; i < n; i++) sleeper('spider'); };
  const decor = (kind, x, z, h = 0, extra = {}) => run.decor.push({ kind, floor: f, room: room.id, x, z, h, ...extra });
  const pillar = (x, z, r = .75, kind = 'column') => { if (mouths.some(m => inRect(x, z, m, r))) return; run.obstacles.push({ x, z, r, floor: f }); decor(kind, x, z, R() * 6.28); taken.push({ x, z, r }); };
  const big = kind => { const p = { x: cx + (R() - .5) * 2, z: cz + (R() - .5) * 2 }; if (free(p.x, p.z, 1.3)) { taken.push({ ...p, r: 1.6 }); run.loot.push({ id: id.loot++, kind, floor: f, room: room.id, x: p.x, z: p.z, h: Math.round(R() * 4) * Math.PI / 2 }); } };
  const light = (x, z, kind = 'brazier') => { if (mouths.some(m => inRect(x, z, m, .5))) return; run.lights.push({ floor: f, x, z, kind }); decor(kind, x, z); run.obstacles.push({ x, z, r: .45, floor: f }); taken.push({ x, z, r: .6 }); };
  // Torches in two opposite corners light every room a little.
  const corner = (sx, sz) => ({ x: cx + sx * (room.w / 2 - 1.2), z: cz + sz * (room.d / 2 - 1.2) });
  const lit = R() < .5 ? [[-1, -1], [1, 1]] : [[1, -1], [-1, 1]];
  for (const [sx, sz] of lit) { const p = corner(sx, sz); light(p.x, p.z, d === 1 ? 'mineLamp' : 'brazier'); }
  if (d > 1 || R() < .5) decor('stalactites', cx + (R() - .5) * room.w * .5, cz + (R() - .5) * room.d * .5, R() * 6);
  switch (room.kind) {
    case 'entrada':
      // The cargo lift's pad and the jornada's carrito, beside the montacargas.
      for (const s of [1, -1]) {
        const x = cx + s * (room.w / 2 - 2.3), z = cz + room.d / 2 - 2.3;
        if (!free(x, z, 1.7) && s === -1 && !run.cargo.some(c => c.floor === f)) { run.cargo.push({ id: `cargo-${f}`, floor: f, x, z, bx: x - s * 1.7, bz: z }); taken.push({ x, z, r: 2 }); break; }
        if (!free(x, z, 1.7)) continue;
        run.cargo.push({ id: `cargo-${f}`, floor: f, x, z, bx: x - s * 1.7, bz: z }); taken.push({ x, z, r: 2 }); break;
      }
      { const pad = run.cargo.find(c => c.floor === f); run.carts.push({ id: 'cart-0', floor: f, x: pad.x + (pad.x > cx ? -3.2 : 3.2), z: pad.z - 2.4, h: Math.PI }); }
      loot(d === 1 ? 'machete' : 'botiquin'); small(2);
      break;
    case 'tesoro':
      chest(); if (R() < .6) chest(); small(4 + d);
      if (R() < .55 + deep * .3) big(BIG_POOL[Math.min(2, d - 1)][Math.floor(R() * 3)]);
      decor('statue', cx + (R() < .5 ? -1 : 1) * (room.w / 2 - 1.5), cz, 0);
      if (R() < .6) guard();
      break;
    case 'columnas':
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) pillar(cx + sx * room.w * .28, cz + sz * room.d * .28);
      if (room.w > 16) { pillar(cx, cz - room.d * .28, .75); pillar(cx, cz + room.d * .28, .75); }
      for (let i = 0; i < 1 + d; i++) sleeper(); small(3); loot('idol');
      decor('fallenColumn', cx + (R() - .5) * 6, cz + (R() - .5) * 6, R() * 6);
      if (d > 1 || R() < .4) ceiling(1 + Math.floor(R() * 2));
      break;
    case 'trampas': {
      // Dart heads hang on the west and east walls, never in a doorway.
      const doors = run.corridors.filter(c => c.horizontal && (c.a === room.id || c.b === room.id)).map(c => [c.rect[1] - .8, c.rect[3] + .8]);
      const lanes = [-.36, -.2, .2, .36].map(t => cz + t * room.d).filter(z => !doors.some(([a, b]) => z > a && z < b));
      for (const z of lanes.slice(0, 2 + Math.min(2, d))) {
        const x = cx + (R() - .5) * (room.w - 6);
        run.plates.push({ id: id.plate++, floor: f, room: room.id, x, z, darts: [{ x: x0 + .3, z, dx: 1 }, { x: x1 - .3, z, dx: -1 }], len: room.w });
        taken.push({ x, z, r: 1.1 });
      }
      loot('mask', { x: cx + (R() < .5 ? -1 : 1) * (room.w / 2 - 2.5), z: cz + (R() < .5 ? -1 : 1) * (room.d / 2 - 2.5) }); small(4);
      break;
    }
    case 'idolo':
      decor('altar', cx, cz, 0); run.obstacles.push({ x: cx, z: cz, r: 1.1, floor: f }); taken.push({ x: cx, z: cz, r: 1.6 });
      run.loot.push({ id: id.loot++, kind: ARTIFACTS[Math.floor(R() * ARTIFACTS.length)], floor: f, room: room.id, x: cx, z: cz + 1.6, h: 0, cursed: true });
      for (let i = 0; i < 2; i++) sleeper(); small(2);
      break;
    case 'veta':
      for (const s of [-1, 1]) decor('vein', cx + s * (room.w / 2 - .4), cz + (R() - .5) * 6, s < 0 ? Math.PI / 2 : -Math.PI / 2);
      decor('ore', cx - room.w * .25, cz + room.d * .25, 0); run.obstacles.push({ x: cx - room.w * .25, z: cz + room.d * .25, r: 1.4, floor: f }); taken.push({ x: cx - room.w * .25, z: cz + room.d * .25, r: 2 });
      if (R() < .7) big('cart'); small(5); loot('emerald');
      if (R() < .5) guard();
      break;
    case 'cripta':
      for (let i = 0; i < 3; i++) { const p = spot(1.1); if (p) { decor('coffin', p.x, p.z, Math.round(R()) * Math.PI / 2); run.obstacles.push({ x: p.x, z: p.z, r: 1, floor: f }); } }
      for (let i = 0; i < 2 + d; i++) sleeper(); small(3); loot(R() < .5 ? 'cup' : 'idol');
      decor('candles', cx, cz, 0);
      ceiling(d > 1 ? 2 : 1);
      break;
    case 'santuario':
      light(cx, cz, 'brazier'); loot('botiquin'); loot(R() < .5 ? 'machete' : 'honda'); if (d > 1) loot('farol'); small(1);
      break;
    case 'puente': {
      // A pit fills the middle; a rope bridge reaches the island with the treasure.
      const pit = [x0 + 3.2, z0 + 3.2, x1 - 3.2, z1 - 3.2], island = [cx - 2.4, cz - 2.4, cx + 2.4, cz + 2.4];
      const north = R() < .5, bridge = north ? [cx - 1.2, pit[1] - .2, cx + 1.2, island[1] + .2] : [cx - 1.2, island[3] - .2, cx + 1.2, pit[3] + .2];
      run.pits.push({ floor: f, room: room.id, rect: pit, island });
      run.bridges.push({ floor: f, room: room.id, rect: bridge, axis: 'z' });
      run.loot.push({ id: id.loot++, kind: BIG_POOL[Math.min(2, d - 1)][Math.floor(R() * 3)], floor: f, room: room.id, x: cx, z: cz, h: 0 });
      small(3);
      break;
    }
    case 'ruedas':
      small(2); for (let i = 0; i < d; i++) sleeper();
      break;
    case 'guardian':
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) pillar(cx + sx * room.w * .3, cz + sz * room.d * .3, .8);
      run.sleepers.push({ id: id.sleeper++, kind: 'guardian', floor: f, room: room.id, x: cx, z: cz - room.d * .15 });
      small(3); chest();
      break;
    case 'boveda':
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) pillar(cx + sx * room.w * .32, cz + sz * room.d * .32, .9);
      run.sleepers.push({ id: id.sleeper++, kind: 'jaguar', floor: f, room: room.id, x: cx, z: cz - room.d * .25 });
      run.loot.push({ id: id.loot++, kind: 'altar', floor: f, room: room.id, x: cx, z: cz - room.d * .32, h: 0 });
      run.loot.push({ id: id.loot++, kind: 'goldJaguar', floor: f, room: room.id, x: cx - room.w * .2, z: cz + 1, h: Math.PI / 2 });
      taken.push({ x: cx, z: cz - room.d * .32, r: 2.2 }, { x: cx - room.w * .2, z: cz + 1, r: 1.8 });
      for (const s of [-1, 1]) light(cx + s * 4, cz - room.d / 2 + 1.4, 'brazier');
      chest(); chest(); small(10); loot('emerald'); loot('emerald');
      break;
    case 'oculta':
      chest(); chest(); small(5); big('emeraldChest');
      loot(ARTIFACTS[Math.floor(R() * ARTIFACTS.length)]);
      guard(); ceiling(1);
      break;
  }
}
