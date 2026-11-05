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
import { locKey } from '../../../engine/i18n.js';
import { SMALL, BIG_POOL, ARTIFACTS, ITEMS, valueOf } from './items.js';
import { dealHidingSpots } from '../../../engine/play/hiding-spots.js';

export const CELL = 26, SPACING = 220, ROWS = 4, COLS = [-1, 0, 1], HEIGHT = 4.6;
export const CAMP = { x: 0, z: 12 }, TRUCK = { x: 9, z: 20, h: -Math.PI / 2 }, TRUCK_RADIUS = 4.6;
export const TABLE = { x: -7, z: 9 };
const CAMP_RECT = [-18, -2, 18, 30], STUB = 6.2;
// The montacargas cage: 3.2 m square around a stop's centre.
export const CAGE = 1.6;

// Shown with loc() where they are drawn; the run itself keeps the Spanish key.
export const ROOM_NAMES = {
  entrada: locKey('La bajada'), tesoro: locKey('Cámara del tesoro'), columnas: locKey('Sala de columnas'), trampas: locKey('Pasillo de las losas'),
  idolo: locKey('El altar del ídolo'), veta: locKey('La veta de oro'), cripta: locKey('La cripta'), santuario: locKey('El santuario'), puente: locKey('El abismo'),
  ruedas: locKey('Las dos ruedas'), guardian: locKey('El trono del guardián'), boveda: locKey('La bóveda de oro'), oculta: locKey('La sala escondida'),
  estanterias: locKey('Las estanterías'), lectura: locKey('La sala de lectura'), archivo: locKey('El archivo prohibido'), copistas: locKey('El taller de los copistas'),
  sima: locKey('La sima'), cornisa: locKey('La cornisa'), cuerdas: locKey('Los puentes de cuerda'), cisterna: locKey('La cisterna'), bosque: locKey('El bosque de hongos'), atrio: locKey('El atrio caído'), dorada: locKey('La cámara dorada'),
};
// La biblioteca sepultada names the rooms it shares with the mine its own way.
const LIBRARY_NAMES = {
  entrada: locKey('El vestíbulo'), idolo: locKey('El atril maldito'), trampas: locKey('El pasillo de los dardos'), santuario: locKey('El rincón del bibliotecario'),
  puente: locKey('El sótano hundido'), ruedas: locKey('Las ruedas del archivo'), guardian: locKey('El guardián de los libros'), oculta: locKey('Detrás del estante'),
};
export const LIBRARY_NAME = locKey('La biblioteca sepultada');
// The biomes' own names for a whole jornada.
export const THEME_NAMES = { inundada: locKey('Los túneles inundados'), hongos: locKey('La gruta de los hongos'), templo: locKey('El templo caído') };
export const FLOOR_NAMES = [locKey('El campamento'), locKey('Las afueras de la mina'), locKey('Las cámaras trampa'), locKey('Las ruinas malditas'), locKey('La bóveda del jaguar'), locKey('El oro profundo')];
const SIZES = { entrada: [16, 14], tesoro: [16, 14], columnas: [18, 16], trampas: [16, 16], idolo: [14, 14], veta: [16, 14], cripta: [16, 16],
  santuario: [12, 12], puente: [18, 18], ruedas: [18, 16], guardian: [20, 18], boveda: [22, 22], oculta: [12, 12],
  estanterias: [22, 18], lectura: [20, 18], archivo: [16, 14], copistas: [18, 16],
  sima: [20, 20], cornisa: [20, 18], cuerdas: [24, 18], cisterna: [18, 18], bosque: [20, 18], atrio: [20, 18], dorada: [12, 12] };
const DECK = ['tesoro', 'columnas', 'trampas', 'idolo', 'veta', 'cripta', 'santuario', 'puente', 'sima', 'cuerdas'];
// Each biome leans on its own rooms; the idol and the Silbón's pit are always dealt (below).
const BIOME_DECKS = {
  inundada: ['cisterna', 'cisterna', 'sima', 'tesoro', 'cripta', 'veta', 'cuerdas', 'idolo', 'puente'],
  hongos: ['bosque', 'bosque', 'bosque', 'cornisa', 'sima', 'tesoro', 'santuario', 'idolo', 'puente'],
  templo: ['atrio', 'atrio', 'cornisa', 'columnas', 'trampas', 'cripta', 'cuerdas', 'idolo', 'puente'],
};
const LIBRARY_DECK = ['estanterias', 'lectura', 'archivo', 'estanterias', 'copistas', 'idolo', 'trampas', 'santuario', 'puente'];
// Each jornada has a theme: the mine or the buried library. The room's
// "Lugar" option (`place`) picks it: always one, or alternating with the
// library first (jornada 1, 3, 5…). Pure, so every client deals the same one.
export const THEMES = ['biblioteca', 'mina', 'inundada', 'hongos', 'templo'];
export const PLACES = ['alternar', ...THEMES];
// With an expedition's `origin` seed, Alternar walks all five in an order of its
// own, so no two expeditions start alike and a biome only repeats after the other
// four. Without one (nothing dealt yet) it swaps library and mine.
const rotations = new Map();
function rotation(origin) {
  if (rotations.has(origin)) return rotations.get(origin);
  const R = rng((Math.imul(origin, 2246822519) ^ 0x5bd1e995) >>> 0), order = [...THEMES];
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  rotations.set(origin, order); return order;
}
export const themeFor = (depth, place = 'alternar', origin = 0) => THEMES.includes(place) ? place : origin ? rotation(origin)[(depth - 1) % THEMES.length] : depth % 2 ? 'biblioteca' : 'mina';
// The theme of a state's (or an expedition's) current jornada.
export const themeOf = s => themeFor(s?.level || 1, s?.options?.place, s?.origin || 0);
export const roomName = (kind, theme = 'mina') => (theme === 'biblioteca' && LIBRARY_NAMES[kind]) || ROOM_NAMES[kind];
// What the HUD calls a jornada.
export const jornadaName = (level, theme = themeFor(level)) => theme === 'biblioteca' ? LIBRARY_NAME : THEME_NAMES[theme] || FLOOR_NAMES[Math.min(FLOOR_NAMES.length - 1, level)];
// One extra job per jornada, from its own hash so the deck never notices (rules.js pays it).
export const ENCARGOS = ['pedido', 'turno', 'sinBajas', 'todos'];
export const encargoFor = (seed, depth) => ENCARGOS[((Math.imul(seed, 31) + Math.imul(depth, 2654435761)) >>> 7) % ENCARGOS.length];
// Bookcases are solid rectangles cut out of the walkable bitmap (layout.js).
const SHELF = .8;
// Hiding spots (engine/play/hiding-spots.js): what a pana searches in the
// library. `r` is the obstacle (0: a solid rect or an existing desk), `need`
// the seconds of holding E, `hard` how tucked away it is (treasures prefer
// the hard ones). Wall pieces (`wall`) stand in a solid rect against a wall.
export const SPOTS = {
  trunk: { r: .55, need: .8, hard: .15 },
  drawer: { r: .65, need: .7, hard: .25 },
  sheet: { r: .75, need: .9, hard: .35 },
  wardrobe: { wall: [1.3, .62], need: 1, hard: .5 },
  debris: { r: .5, need: 1.2, hard: .6 },
  shelf: { wall: [2.6, .5], need: 1.1, hard: .8 },
  ladder: { wall: [2.2, .5], need: .9, hard: .7 },
  lantern: { r: .3, need: .7, hard: .9 },
};
// Relics worth at least this much hide in the library's spots; cheaper
// pieces, tools, big treasures and the cursed altar piece stay in sight.
const HIDE_FROM = 60;

export const rectOf = r => [r.x - r.w / 2, r.z - r.d / 2, r.x + r.w / 2, r.z + r.d / 2];
export const inRect = (x, z, [x0, z0, x1, z1], pad = 0) => x > x0 - pad && x < x1 + pad && z > z0 - pad && z < z1 + pad;
export const floorOf = x => Math.max(0, Math.round(x / SPACING));
// Which seal opens each floor's way down; the last floor holds the vault.
// Every third jornada ends in the jaguar's vault; the others in a sealed
// treasure chamber behind the two wheels or the sun guardian.
export const sealKind = depth => depth % 3 === 0 ? 'boveda' : depth % 2 ? 'ruedas' : 'guardian';

const cache = new Map();
export function generateRun(seed = 1, { depth = 1, theme = themeFor(depth) } = {}) {
  const floors = 1, key = `${seed}:${depth}:${theme}`, library = theme === 'biblioteca';
  if (cache.has(key)) return cache.get(key);
  const run = { seed, floors, depth, theme, solids: [], spots: [], nooks: [], rooms: [], corridors: [], stubs: [], lifts: [], carts: [], cargo: [], seals: [], hidden: [], loot: [], chests: [], plates: [],
    sleepers: [], obstacles: [], lights: [], decor: [], pits: [], bridges: [], ropes: [], puffs: [], cracks: [], twins: [], encargo: encargoFor(seed, depth) };
  const id = { loot: 0, chest: 0, plate: 0, sleeper: 0, spot: 0 };
  // ---- Camp: a cavern (camp-cave.js), the truck and the mine mouth at its north edge.
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
    const deck = [...(library ? LIBRARY_DECK : BIOME_DECKS[theme] || DECK)]; for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    if (!deck.slice(0, path.length - 2).includes('idolo')) deck[Math.floor(R() * Math.max(1, path.length - 2))] = 'idolo';
    // Every jornada has its pit: it is the Silbón's arena (dealLair).
    if (!deck.slice(0, path.length - 2).includes('puente')) deck[Math.max(0, deck.slice(0, path.length - 2).findIndex(k => k !== 'idolo'))] = 'puente';
    const kinds = path.map((_, i) => i === 0 ? 'entrada' : i === path.length - 1 ? sealKind(depth) : deck[(i - 1) % deck.length]);
    const rooms = path.map(([c, r], i) => {
      const [w, d] = SIZES[kinds[i]], p = at(c, r);
      return { id: `f${f}-r${i}`, floor: f, kind: kinds[i], cell: [c, r], x: p.x, z: p.z, w, d, name: roomName(kinds[i], theme), index: i };
    });
    // Side rooms: one hidden (needs the echo mask), one extra.
    const free = [];
    for (const [c, r] of path) for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const cc = c + dc, rr = r + dr;
      if (COLS.includes(cc) && rr >= 0 && rr < ROWS && !seen.has(`${cc},${rr}`) && !free.some(q => q.cell.join() === `${cc},${rr}`)) free.push({ cell: [cc, rr], from: path.findIndex(q => q[0] === c && q[1] === r) });
    }
    const sides = [];
    // The hidden one is now and then the rare golden chamber, behind twin plates
    // (its own roll: the rest of the deal does not notice).
    const golden = rng((seed * 1597334677 + depth * 3812015801 + 53) >>> 0)() < .22;
    for (const kind of [R() < .8 ? (golden ? 'dorada' : 'oculta') : null, pick(library ? ['archivo', 'santuario', 'estanterias'] : ['tesoro', 'santuario', 'veta'])]) {
      if (!kind || !free.length) continue;
      const spot = free.splice(Math.floor(R() * free.length), 1)[0], p = at(...spot.cell), [w, d] = SIZES[kind];
      seen.add(spot.cell.join());
      sides.push({ room: { id: `f${f}-s${sides.length}`, floor: f, kind, cell: spot.cell, x: p.x, z: p.z, w, d, name: roomName(kind, theme), side: true }, from: rooms[spot.from] });
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
      const hidden = s.room.kind === 'oculta' || s.room.kind === 'dorada' ? `h${run.hidden.length}` : null, c = corridor(s.from, s.room, hidden);
      if (!hidden) continue;
      // The fake wall stands in the corridor mouth on the path room's side.
      const a = s.from, [x0, z0, x1, z1] = c.rect;
      const wall = c.horizontal ? (s.room.x > a.x ? [a.x + a.w / 2 - .3, z0, a.x + a.w / 2 + .9, z1] : [a.x - a.w / 2 - .9, z0, a.x - a.w / 2 + .3, z1])
        : (s.room.z > a.z ? [x0, a.z + a.d / 2 - .3, x1, a.z + a.d / 2 + .9] : [x0, a.z - a.d / 2 - .9, x1, a.z - a.d / 2 + .3]);
      run.hidden.push({ id: hidden, floor: f, room: s.room.id, corridor: c.id, rect: wall, x: (wall[0] + wall[2]) / 2, z: (wall[1] + wall[3]) / 2, horizontal: c.horizontal, twin: s.room.kind === 'dorada' });
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
  // ...nor inside a bookcase: out through the nearer long face.
  for (const item of run.loot) for (const s of run.solids) {
    if (s.floor !== item.floor || item.y || !inRect(item.x, item.z, s.rect, .55)) continue;
    const [x0, z0, x1, z1] = s.rect;
    if (x1 - x0 > z1 - z0) item.z = item.z < (z0 + z1) / 2 ? z0 - .6 : z1 + .6; else item.x = item.x < (x0 + x1) / 2 ? x0 - .6 : x1 + .6;
  }
  if (library) libraryHaunts(run, seed, depth);
  dealExtras(run, seed, depth);
  dealLair(run, seed, depth);
  dealEcology(run, seed, depth);
  cache.set(key, run);
  return run;
}

// The library's own two: El Lector (a blind librarian, a sleeper in a stacks,
// archive or copyists' room) and La Estatua (a stone scholar standing against
// a wall of a library room). Dealt last, from their own seeded stream, so the
// rest of the deck is exactly what it was without them. One Lector a floor
// (sometimes two from jornada 5), one Estatua (sometimes two from jornada 5),
// never in the entrance, a sealed room or a corridor's mouth.
export const LECTOR_ROOMS = ['estanterias', 'archivo', 'copistas'];
export const ESTATUA_ROOMS = ['lectura', 'estanterias', 'archivo', 'copistas'];
const rectGap = (x, z, [x0, z0, x1, z1]) => Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1));
function libraryHaunts(run, seed, depth) {
  const R = rng((seed * 2246822519 + depth * 3266489917 + 77) >>> 0);
  let next = run.sleepers.reduce((n, s) => Math.max(n, s.id + 1), 0);
  const clear = (room, x, z) => {
    const f = room.floor;
    if (!inRect(x, z, room.rect, -.85)) return false;
    if (run.solids.some(q => q.floor === f && inRect(x, z, q.rect, .75))) return false;
    if (run.obstacles.some(o => o.floor === f && Math.hypot(o.x - x, o.z - z) < o.r + .8)) return false;
    if ([...run.loot, ...run.chests, ...run.spots, ...run.sleepers].some(q => q.floor === f && Math.hypot(q.x - x, q.z - z) < 1.1)) return false;
    if (run.corridors.some(c => (c.a === room.id || c.b === room.id) && rectGap(x, z, c.rect) < 3.2)) return false;
    if (run.stubs.some(q => q.floor === f && rectGap(x, z, q.rect) < 3.2) || run.hidden.some(h => h.floor === f && rectGap(x, z, h.rect) < 2.5)) return false;
    return true;
  };
  for (let f = 1; f <= run.floors; f++) {
    const rooms = run.rooms.filter(r => r.floor === f && !r.hidden && !run.seals.some(q => q.room === r.id));
    const pick = (kinds, taken) => { const list = rooms.filter(r => kinds.includes(r.kind) && !taken.includes(r.id)); return list.length ? list[Math.floor(R() * list.length)] : null; };
    const used = [];
    // La Estatua: against a wall, facing into the room.
    for (let n = 0; n < (depth >= 5 && R() < .6 ? 2 : 1); n++) {
      const room = pick(ESTATUA_ROOMS, used); if (!room) break;
      for (let i = 0; i < 40; i++) {
        const side = Math.floor(R() * 4), alongX = side < 2, span = (alongX ? room.w : room.d) / 2 - 2.5, t = (R() * 2 - 1) * span;
        const x = alongX ? room.x + t : room.x + (side === 2 ? -1 : 1) * (room.w / 2 - 1), z = alongX ? room.z + (side === 0 ? -1 : 1) * (room.d / 2 - 1) : room.z + t;
        if (!clear(room, x, z)) continue;
        run.sleepers.push({ id: next++, kind: 'estatua', floor: f, room: room.id, x, z, h: Math.atan2(room.x - x, room.z - z), pose: Math.floor(R() * 2) });
        used.push(room.id); break;
      }
    }
    // El Lector: somewhere inside a shelf, archive or copyists' room.
    for (let n = 0; n < (R() < .8 ? 1 : 0) + (depth >= 5 && R() < .5 ? 1 : 0); n++) {
      const room = pick(LECTOR_ROOMS, used) || pick(LECTOR_ROOMS, []); if (!room) break;
      for (let i = 0; i < 40; i++) {
        const x = room.x + (R() - .5) * (room.w - 4), z = room.z + (R() - .5) * (room.d - 4);
        if (!clear(room, x, z)) continue;
        run.sleepers.push({ id: next++, kind: 'lector', floor: f, room: room.id, x, z });
        used.push(room.id); break;
      }
    }
  }
}

// Hiding nooks: two stone slabs against a room's wall leave a gap a pana slips
// into and the Silbón (SILBON_BODY in silbon.js) never fits. `inner` is the gap,
// `mouth` the middle of its opening, `front` where the boss stands to look in.
// Edges sit on the 0.25 m collision grid, so the gap is exact.
export const NOOK = { gap: 1.25, slab: .5, depth: 1.5, front: 2.4 };
const nookWidth = NOOK.gap + NOOK.slab * 2;
export const nookAt = (run, x, z) => run.nooks.find(n => n.floor === floorOf(x) && inRect(x, z, n.inner)) || null;
// How far inside a pana stands, from the opening toward the back wall.
export const nookDepth = (n, p) => (n.mouth.x - p.x) * n.nx + (n.mouth.z - p.z) * n.nz;
const rectsGap = (a, b) => Math.hypot(Math.max(a[0] - b[2], 0, b[0] - a[2]), Math.max(a[1] - b[3], 0, b[1] - a[3]));
// The Silbón's lair, dealt last from its own stream: nooks along the walls (three
// in the pit room, sometimes one or two elsewhere; the same map on every
// difficulty), bats roosting on the ceilings, the boss asleep on the pit's rim.
function dealLair(run, seed, depth) {
  const R = rng((seed * 3266489917 + depth * 668265263 + 131) >>> 0);
  let sleeper = run.sleepers.reduce((n, s) => Math.max(n, s.id + 1), 0), nook = 0;
  const freeNook = (room, rect, front) => {
    const f = room.floor, near = (list, gap) => list.some(q => q.floor === f && rectGap(q.x, q.z, rect) < gap);
    if (run.solids.some(s => s.floor === f && (rectsGap(s.rect, rect) < .6 || inRect(front.x, front.z, s.rect, .9)))) return false;
    if (run.obstacles.some(o => o.floor === f && (rectGap(o.x, o.z, rect) < o.r + .5 || Math.hypot(o.x - front.x, o.z - front.z) < o.r + .95))) return false;
    if (near(run.sleepers, .9) || near(run.loot, .7) || near(run.chests, 1) || near(run.spots, 1.1) || near(run.plates, 1.6) || near(run.carts, 2.2) || near(run.lifts, 3) || near(run.cargo, 3) || near(run.puffs, 1.6) || near(run.cracks, 1.6) || run.twins.some(t => near(t.plates.map(q => ({ ...q, floor: f })), 1.6))) return false;
    if (run.decor.some(d => d.floor === f && d.kind !== 'stalactites' && d.kind !== 'chandelier' && rectGap(d.x, d.z, rect) < 1.4)) return false;
    if ([...run.corridors, ...run.stubs].some(c => c.floor === f && rectsGap(c.rect, rect) < 2.2) || run.hidden.some(h => h.floor === f && rectsGap(h.rect, rect) < 2.2)) return false;
    if (run.seals.some(s => s.floor === f && (rectsGap(s.rect, rect) < 3.5 || (s.winches || []).some(w => rectGap(w.x, w.z, rect) < 2.2)))) return false;
    if (run.plates.some(p => p.room === room.id && p.darts.some(d => Math.abs(d.z - (rect[1] + rect[3]) / 2) < (rect[3] - rect[1]) / 2 + 1))) return false;
    if (run.pits.some(p => p.floor === f && (rectsGap(p.rect, rect) < .4 || rectGap(front.x, front.z, p.rect) < .75))) return false;
    return !run.nooks.some(n => n.floor === f && rectsGap(n.rect, rect) < 2.5);
  };
  const dig = room => {
    const [x0, z0, x1, z1] = room.rect;
    for (let i = 0; i < 60; i++) {
      const side = Math.floor(R() * 4), alongX = side < 2, n = [[0, 1], [0, -1], [1, 0], [-1, 0]][side], span = (alongX ? room.w : room.d) / 2 - nookWidth / 2 - .6;
      if (span <= 0) return false;
      // Offset an eighth so slab and gap edges both land on the grid.
      const c = Math.round(((alongX ? room.x : room.z) + (R() * 2 - 1) * span) * 4) / 4 + .125, wall = alongX ? (side === 0 ? z0 : z1) : (side === 2 ? x0 : x1), far = wall + (alongX ? n[1] : n[0]) * NOOK.depth;
      const lo = Math.min(wall, far), hi = Math.max(wall, far), a = c - nookWidth / 2, b = c + nookWidth / 2, g0 = c - NOOK.gap / 2, g1 = c + NOOK.gap / 2;
      const box = (u0, u1) => alongX ? [u0, lo, u1, hi] : [lo, u0, hi, u1], rect = box(a, b);
      const mouth = alongX ? { x: c, z: far } : { x: far, z: c }, front = { x: mouth.x + n[0] * (NOOK.front - NOOK.depth), z: mouth.z + n[1] * (NOOK.front - NOOK.depth) };
      if (!freeNook(room, rect, front)) continue;
      run.nooks.push({ id: `n${nook++}`, floor: room.floor, room: room.id, x: alongX ? c : (lo + hi) / 2, z: alongX ? (lo + hi) / 2 : c, h: Math.atan2(n[0], n[1]), nx: n[0], nz: n[1], rect, slabs: [box(a, g0), box(g1, b)], inner: box(g0, g1), mouth, front });
      return true;
    }
    return false;
  };
  for (const room of run.rooms.filter(r => r.floor > 0 && r.kind !== 'oculta' && r.kind !== 'dorada' && r.kind !== 'boveda' && r.kind !== 'entrada')) {
    const pit = room.kind === 'puente', count = pit ? 3 : R() < .55 ? 1 + Math.floor(R() * 2) : 0, f = room.floor;
    for (let i = 0; i < count; i++) dig(room);
    // Bats roost clear of the walls; the pit room always keeps a colony.
    const roost = pit ? 2 + Math.min(4, depth) : R() < .4 ? 1 + Math.min(2, depth) : 0;
    for (let i = 0; i < roost; i++) for (let t = 0; t < 20; t++) {
      const x = room.x + (R() - .5) * (room.w - 2.4), z = room.z + (R() - .5) * (room.d - 2.4);
      if (run.pits.some(p => p.floor === f && inRect(x, z, p.rect, .6)) || run.solids.some(s => s.floor === f && inRect(x, z, s.rect, .6)) || run.nooks.some(n => n.floor === f && inRect(x, z, n.rect, .6)) || run.obstacles.some(o => o.floor === f && Math.hypot(o.x - x, o.z - z) < o.r + .6)) continue;
      run.sleepers.push({ id: sleeper++, kind: 'bat', floor: f, room: room.id, x, z }); break;
    }
    if (!pit) continue;
    // The boss: on the rim, across the pit from the rope bridge.
    const bridge = run.bridges.find(b => b.room === room.id), pitRect = run.pits.find(p => p.room === room.id).rect;
    const z = bridge && bridge.rect[1] < room.z ? pitRect[3] + 1.6 : pitRect[1] - 1.6;
    const at = [0, -2, 2, -4, 4, -6, 6].map(dx => ({ x: room.x + dx, z })).find(p => !run.obstacles.some(o => o.floor === f && Math.hypot(o.x - p.x, o.z - p.z) < o.r + 1) && !run.solids.some(s => s.floor === f && inRect(p.x, p.z, s.rect, .8)) && !run.nooks.some(n => n.floor === f && inRect(p.x, p.z, n.rect, .8)));
    if (at) run.sleepers.push({ id: sleeper++, kind: 'silbon', floor: f, room: room.id, x: at.x, z: at.z });
  }
}

// Where the food chain lives (ecology.js), dealt last from its own stream so the
// rest of the deck never notices: mushroom patches and root thickets a pana can
// walk into and hide in, a roost per colony of bats, a lair per cuaima. Nothing
// here collides. `hides` is what a pana can use; every site is for the creatures.
const ECO_CHANCE = { hongos: [.95, .25], inundada: [.5, .65], biblioteca: [.35, .2], templo: [.5, .45], mina: [.55, .35] };
function dealEcology(run, seed, depth) {
  const R = rng((seed * 2654435761 + depth * 40503 + 977) >>> 0), sites = [], [mush, roots] = ECO_CHANCE[run.theme] || ECO_CHANCE.mina;
  const rooms = run.rooms.filter(r => r.floor > 0 && !r.hidden && !['oculta', 'dorada', 'boveda', 'entrada'].includes(r.kind));
  const free = (room, x, z, r) => {
    const f = room.floor, near = (list, gap) => list.some(q => q.floor === f && Math.hypot(q.x - x, q.z - z) < gap + r);
    if (run.solids.some(s => s.floor === f && inRect(x, z, s.rect, r * .7))) return false;
    if (run.obstacles.some(o => o.floor === f && Math.hypot(o.x - x, o.z - z) < o.r + r * .7)) return false;
    if (run.pits.some(p => p.floor === f && inRect(x, z, p.rect, r + .4)) || [...run.corridors, ...run.stubs].some(c => c.floor === f && inRect(x, z, c.rect, r + .6))) return false;
    if (run.nooks.some(n => n.floor === f && rectGap(x, z, n.rect) < r + 1) || run.seals.some(q => q.floor === f && rectGap(x, z, q.rect) < r + 2)) return false;
    return !(near(run.lifts, 3) || near(run.cargo, 3) || near(run.carts, 1.5) || near(run.plates, 1) || near(run.chests, .3) || near(run.spots, .3) || near(run.loot, 0) || near(run.puffs, .8) || near(run.cracks, .8) || near(sites, 1.2));
  };
  const place = (room, kind, r) => {
    for (let i = 0; i < 24; i++) {
      const x = room.x + (R() - .5) * Math.max(0, room.w - 2 * r - 1.2), z = room.z + (R() - .5) * Math.max(0, room.d - 2 * r - 1.2);
      if (!free(room, x, z, r)) continue;
      sites.push({ id: `eco${sites.length}`, kind, floor: room.floor, room: room.id, x, z, r, hides: true, plant: kind === 'mushroom', cover: kind === 'mushroom' ? .72 : .62, light: kind === 'mushroom' ? 1 : .1, seed: Math.floor(R() * 1e6) });
      return true;
    }
    return false;
  };
  for (const room of rooms) {
    if (R() < mush) place(room, 'mushroom', 1.7 + R() * .7);
    if (R() < roots) place(room, 'roots', 1.5 + R() * .5);
  }
  // Every floor keeps enough of each for the chain, and for somewhere to hide.
  for (const [kind, least, r] of [['mushroom', 3, 1.8], ['roots', 1, 1.6]]) for (const room of rooms) if (sites.filter(s => s.kind === kind).length < least) place(room, kind, r);
  // A roost over each colony, a lair for each cuaima.
  for (const room of rooms) {
    const bats = run.sleepers.filter(s => s.kind === 'bat' && s.room === room.id);
    if (bats.length) sites.push({ id: `eco${sites.length}`, kind: 'roost', floor: room.floor, room: room.id, x: bats[0].x, z: bats[0].z, r: 2.4, hides: false, plant: false, cover: .9, light: .1 });
  }
  for (const s of run.sleepers.filter(q => q.kind === 'snake')) sites.push({ id: `eco${sites.length}`, kind: 'lair', floor: s.floor, room: s.room, x: s.x, z: s.z, r: 1.2, hides: false, plant: false, cover: .25, light: .05 });
  run.ecoSites = sites;
}

// Dealt after the rooms, from their own stream: the twin plates that open the
// golden chamber, the coil of rope a floor with something to tie always offers,
// and el encargo's parcel, far from the way in.
function dealExtras(run, seed, depth) {
  const R = rng((seed * 668265263 + depth * 2246822519 + 211) >>> 0);
  let next = run.loot.reduce((n, l) => Math.max(n, l.id + 1), 0);
  const open = (room, x, z, r) => inRect(x, z, room.rect, -r) && !run.obstacles.some(o => o.floor === room.floor && Math.hypot(o.x - x, o.z - z) < o.r + r) && !run.solids.some(s => s.floor === room.floor && inRect(x, z, s.rect, r))
    && !run.pits.some(p => p.floor === room.floor && inRect(x, z, p.rect, r)) && !run.plates.some(p => p.room === room.id && Math.hypot(p.x - x, p.z - z) < r + 1.2);
  const entry = run.rooms.find(r => r.index === 0 && r.floor > 0);
  for (const wall of run.hidden.filter(h => h.twin)) {
    const c = run.corridors.find(q => q.id === wall.corridor), room = run.rooms.find(r => !r.hidden && (c.a === r.id || c.b === r.id));
    // Two plates in the room in front of the false wall, too far apart for one pana.
    const plates = [];
    for (let i = 0; i < 80 && room && plates.length < 2; i++) {
      const x = room.x + (R() - .5) * (room.w - 3), z = room.z + (R() - .5) * (room.d - 3);
      if (!open(room, x, z, 1) || plates.some(p => Math.hypot(p.x - x, p.z - z) < 5)) continue;
      if ([...run.corridors, ...run.stubs].some(q => q.floor === room.floor && inRect(x, z, q.rect, 1.2))) continue;
      plates.push({ x, z });
    }
    // No room for them: the chamber stays behind the plain false wall.
    if (plates.length === 2) run.twins.push({ id: wall.id, floor: wall.floor, room: room.id, wall: wall.id, plates }); else wall.twin = false;
  }
  if (run.bridges.some(b => b.needs) || run.ropes.some(q => q.needs)) {
    for (const [dx, dz] of [[2, -2], [-2, -2], [3, 0], [-3, 0], [0, -3], [4, -3], [-4, -3]]) {
      const x = entry.x + dx, z = entry.z + dz;
      if (!open(entry, x, z, .6) || run.carts.some(q => Math.hypot(q.x - x, q.z - z) < 1.6) || run.cargo.some(q => q.floor && Math.hypot(q.x - x, q.z - z) < 2.2)) continue;
      run.loot.push({ id: next++, kind: 'cuerda', floor: entry.floor, room: entry.id, x, z, h: R() * 6 }); break;
    }
  }
  // A flare or two: on a shrine's floor, or by the way in when the deck dealt no shrine.
  const shrines = run.rooms.filter(r => r.kind === 'santuario' && !r.hidden), shelves = shrines.length ? shrines : [entry];
  for (const room of shelves) if (R() < .7) for (let i = 0; i < 30; i++) {
    const x = room.x + (R() - .5) * (room.w - 3), z = room.z + (R() - .5) * (room.d - 3);
    if (!open(room, x, z, .7) || run.carts.some(q => Math.hypot(q.x - x, q.z - z) < 1.6) || run.cargo.some(q => q.floor && Math.hypot(q.x - x, q.z - z) < 2.2)) continue;
    run.loot.push({ id: next++, kind: 'bengala', floor: room.floor, room: room.id, x, z, h: R() * 6 }); break;
  }
  if (run.encargo === 'pedido') {
    // Somewhere late on the path, on open floor: never behind a seal or across a pit.
    const rooms = run.rooms.filter(r => r.floor > 0 && r.index > 0 && !r.hidden && !run.seals.some(q => q.room === r.id) && r.kind !== 'boveda').sort((a, b) => b.index - a.index);
    let placed = false;
    for (const room of rooms) {
      for (let i = 0; i < 40 && !placed; i++) {
        const x = room.x + (R() - .5) * (room.w - 3), z = room.z + (R() - .5) * (room.d - 3);
        if (!open(room, x, z, .8) || [...run.loot, ...run.chests].some(q => q.floor === room.floor && Math.hypot(q.x - x, q.z - z) < 1)) continue;
        run.loot.push({ id: next++, kind: 'encomienda', floor: room.floor, room: room.id, x, z, h: R() * 6 }); placed = true;
      }
      if (placed) break;
    }
    if (!placed) run.encargo = 'sinBajas';
  }
}

// Contents of one room: obstacles, loot, chests, traps, sleepers and decor.
function furnish(run, room, f, depth, R, id) {
  // `f` places things on the floor; `d` (the jornada's depth) decides how much.
  const [x0, z0, x1, z1] = room.rect, cx = room.x, cz = room.z, d = depth, deep = Math.min(1, d / 4), library = run.theme === 'biblioteca';
  const taken = [], desks = [], caps = [];
  // Keep every doorway and stair mouth clear for three metres into the room.
  const mouths = [...run.corridors.filter(c => c.a === room.id || c.b === room.id), ...run.stubs.filter(s => inRect(s.rect[0] + 2.2, s.a, room.rect, .2))]
    .map(c => c.horizontal ? [c.rect[0] - 3, c.rect[1] - .6, c.rect[2] + 3, c.rect[3] + .6] : [c.rect[0] - .6, c.rect[1] - 3, c.rect[2] + .6, c.rect[3] + 3]);
  const seal = run.seals.find(s => s.room === room.id);
  if (seal) mouths.push([seal.x - 3.3, seal.z - .5, seal.x + 3.3, seal.z + 3.5], ...(seal.winches || []).map(w => [w.x - 1.6, w.z - 1.6, w.x + 1.6, w.z + 1.6]));
  const free = (x, z, r) => !mouths.some(m => inRect(x, z, m, r)) && !run.obstacles.some(o => o.floor === f && Math.hypot(o.x - x, o.z - z) < o.r + r) && !taken.some(t => Math.hypot(t.x - x, t.z - z) < t.r + r)
    && !run.solids.some(s => s.floor === f && inRect(x, z, s.rect, r)) && !run.pits.some(p => p.floor === f && inRect(x, z, p.rect, r) && !run.bridges.some(b => inRect(x, z, b.rect)));
  const spot = (r = .7, margin = 1.6) => {
    for (let i = 0; i < 40; i++) {
      const x = x0 + margin + R() * (room.w - margin * 2), z = z0 + margin + R() * (room.d - margin * 2);
      if (free(x, z, r)) { taken.push({ x, z, r }); return { x, z }; }
    }
    return null;
  };
  // In the library a relic worth searching for goes into a hiding spot (dealt
  // at the end of the room); what stays in sight is cheap.
  const stash = [], hides = kind => library && !ITEMS[kind].tool && ITEMS[kind].size !== 'big' && valueOf(kind) >= HIDE_FROM;
  const loot = (kind, p) => { if (hides(kind)) { stash.push(kind); return; } p ??= spot(.5); if (p) run.loot.push({ id: id.loot++, kind, floor: f, room: room.id, x: p.x, z: p.z, h: R() * 6.28 }); };
  const tableLoot = (kind, x, z, y) => { if (hides(kind)) stash.push(kind); else run.loot.push({ id: id.loot++, kind, floor: f, room: room.id, x, z, y, h: R() * 6 }); };
  const small = n => { for (let i = 0; i < n; i++) loot(SMALL[Math.min(SMALL.length - 1, Math.floor(R() * (2 + d)))]); };
  // A spot inside a sub-rectangle of the room (the stacks' nave).
  const spotIn = ([a, b, c, e], r = .8) => { for (let i = 0; i < 40; i++) { const x = a + R() * (c - a), z = b + R() * (e - b); if (free(x, z, r)) { taken.push({ x, z, r }); return { x, z }; } } return null; };
  const chest = (p = spot(.8)) => { if (p) run.chests.push({ id: id.chest++, floor: f, room: room.id, x: p.x, z: p.z, h: Math.round(R() * 4) * Math.PI / 2 }); if (p) run.obstacles.push({ x: p.x, z: p.z, r: .6, floor: f, chest: true }); };
  const sleeper = (kind = 'mummy', p = spot(.6)) => { if (p && inRect(p.x, p.z, room.rect, -.5) && !run.solids.some(s => s.floor === f && inRect(p.x, p.z, s.rect, .5)) && !run.obstacles.some(o => o.floor === f && Math.hypot(o.x - p.x, o.z - p.z) < o.r + .4)) run.sleepers.push({ id: id.sleeper++, kind, floor: f, room: room.id, x: p.x, z: p.z }); };
  // A cuaima coils up beside a piece of this room's loot; spiders wait above.
  const guard = () => { const l = run.loot.filter(l => l.room === room.id && !l.y); const near = l[Math.floor(R() * l.length)]; if (near) sleeper('snake', { x: near.x + (R() < .5 ? -1 : 1), z: near.z + .4 }); };
  const ceiling = n => { for (let i = 0; i < n; i++) sleeper('spider'); };
  const decor = (kind, x, z, h = 0, extra = {}) => run.decor.push({ kind, floor: f, room: room.id, x, z, h, ...extra });
  const pillar = (x, z, r = .75, kind = 'column') => { if (mouths.some(m => inRect(x, z, m, r))) return; run.obstacles.push({ x, z, r, floor: f }); decor(kind, x, z, R() * 6.28); taken.push({ x, z, r }); };
  const big = kind => { const p = { x: cx + (R() - .5) * 2, z: cz + (R() - .5) * 2 }; if (free(p.x, p.z, 1.3)) { taken.push({ ...p, r: 1.6 }); run.loot.push({ id: id.loot++, kind, floor: f, room: room.id, x: p.x, z: p.z, h: Math.round(R() * 4) * Math.PI / 2 }); } };
  // A bookcase (or a table) as a solid rectangle: skipped where it would
  // block a doorway; `axis` is the long side, `kind` what scene.js draws.
  const solid = (rect, kind = 'shelf', extra = {}) => {
    if (mouths.some(m => rect[0] < m[2] + .2 && rect[2] > m[0] - .2 && rect[1] < m[3] + .2 && rect[3] > m[1] - .2)) return false;
    run.solids.push({ floor: f, room: room.id, rect, kind, axis: rect[2] - rect[0] >= rect[3] - rect[1] ? 'x' : 'z', ...extra });
    taken.push({ x: (rect[0] + rect[2]) / 2, z: (rect[1] + rect[3]) / 2, r: .2 }); return true;
  };
  // A row of bookcases along x, cut back where a doorway's clear mouth crosses it.
  const shelfX = (xa, xb, z, extra) => {
    let pieces = [[xa, xb]];
    for (const m of mouths) if (z + SHELF / 2 > m[1] - .2 && z - SHELF / 2 < m[3] + .2) pieces = pieces.flatMap(([a, b]) => [[a, Math.min(b, m[0] - .2)], [Math.max(a, m[2] + .2), b]]).filter(([a, b]) => b - a >= 1.2);
    for (const [a, b] of pieces) solid([a, z - SHELF / 2, b, z + SHELF / 2], 'shelf', extra);
  };
  const light = (x, z, kind = 'brazier') => { if (mouths.some(m => inRect(x, z, m, .5))) return; run.lights.push({ floor: f, x, z, kind }); decor(kind, x, z); run.obstacles.push({ x, z, r: .45, floor: f }); taken.push({ x, z, r: .6 }); };
  // Torches in two opposite corners light every room a little.
  // (Hard against the walls on a narrow ledge, so a carrito still rounds the corner.)
  const corner = (sx, sz) => { const m = room.kind === 'cornisa' ? .6 : 1.2; return { x: cx + sx * (room.w / 2 - m), z: cz + sz * (room.d / 2 - m) }; };
  const lit = R() < .5 ? [[-1, -1], [1, 1]] : [[1, -1], [-1, 1]];
  // The library keeps a candelabrum in two corners; the other two stay dark.
  for (const [sx, sz] of lit) { const p = corner(sx, sz); light(p.x, p.z, library ? 'candelabra' : d === 1 && run.theme === 'mina' ? 'mineLamp' : 'brazier'); }
  // What stays on an island: laid by hand, as spot() keeps clear of pits.
  const onIsle = (kind, [a, b, c, e]) => run.loot.push({ id: id.loot++, kind, floor: f, room: room.id, x: a + .7 + R() * (c - a - 1.4), z: b + .7 + R() * (e - b - 1.4), h: R() * 6.28 });
  if (!library && (d > 1 || R() < .5)) decor('stalactites', cx + (R() - .5) * room.w * .5, cz + (R() - .5) * room.d * .5, R() * 6);
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
      decor(library ? 'bigLectern' : 'altar', cx, cz, 0); run.obstacles.push({ x: cx, z: cz, r: 1.1, floor: f }); taken.push({ x: cx, z: cz, r: 1.6 });
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
      light(cx, cz, library ? 'candelabra' : 'brazier'); loot('botiquin'); loot(R() < .5 ? 'machete' : 'honda'); if (d > 1) loot('farol'); small(1);
      break;
    case 'puente': {
      // A pit fills the middle; a rope bridge reaches the island with the treasure.
      const pit = [x0 + 3.2, z0 + 3.2, x1 - 3.2, z1 - 3.2], island = [cx - 2.4, cz - 2.4, cx + 2.4, cz + 2.4];
      const north = R() < .5, bridge = north ? [cx - 1.2, pit[1] - .2, cx + 1.2, island[1] + .2] : [cx - 1.2, island[3] - .2, cx + 1.2, pit[3] + .2];
      run.pits.push({ floor: f, room: room.id, rect: pit, island });
      run.bridges.push({ floor: f, room: room.id, rect: bridge, axis: 'z' });
      run.loot.push({ id: id.loot++, kind: BIG_POOL[Math.min(2, d - 1)][Math.floor(R() * 3)], floor: f, room: room.id, x: cx, z: cz, h: 0 });
      small(3); if (library) { loot('pearl'); loot('emerald'); loot('mask'); }
      break;
    }
    case 'sima': {
      // The drop with a platform hanging off its wall, 4.2 m down: only a rope
      // goes there and only hands bring anything back (or a good throw).
      const north = R() < .5, pit = [x0 + 3.2, z0 + 3.2, x1 - 3.2, z1 - 3.2], low = 4.2;
      const island = north ? [cx - 3.4, z0 + 3.9, cx + 3.4, z0 + 8.3] : [cx - 3.4, z1 - 8.3, cx + 3.4, z1 - 3.9];
      run.pits.push({ floor: f, room: room.id, rect: pit, island, low });
      run.ropes.push({ id: `rope${run.ropes.length}`, floor: f, room: room.id, x: cx, z: north ? pit[1] - .75 : pit[3] + .75, bx: cx, bz: north ? island[1] + .75 : island[3] - .75, low, h: north ? 0 : Math.PI, needs: R() < .35 });
      for (const kind of ['cup', 'emerald', R() < .5 ? 'mask' : 'idol', R() < .4 + deep * .3 ? 'mask' : 'coins']) onIsle(kind, island);
      if (R() < .3 + deep * .3) onIsle(ARTIFACTS[Math.floor(R() * ARTIFACTS.length)], island);
      small(2); ceiling(1);
      break;
    }
    case 'cornisa': {
      // Nearly all drop: a ledge two metres wide round the walls (a carrito still
      // fits) and one plank to the island. Mummies cannot take the plank; you can.
      const pit = [x0 + 2.2, z0 + 2.2, x1 - 2.2, z1 - 2.2], island = [cx - 2.4, cz - 2.4, cx + 2.4, cz + 2.4], north = R() < .5;
      run.pits.push({ floor: f, room: room.id, rect: pit, island });
      run.bridges.push({ floor: f, room: room.id, rect: north ? [cx - .55, pit[1] - .2, cx + .55, island[1] + .2] : [cx - .55, island[3] - .2, cx + .55, pit[3] + .2], axis: 'z', beam: true });
      for (const kind of ['mask', 'cup', 'emerald', 'coins', R() < .5 ? 'idol' : 'pearl']) onIsle(kind, island);
      for (let i = 0; i < 1 + d; i++) { const s = i % 4, u = (R() - .5) * (s < 2 ? room.w - 6 : room.d - 6); sleeper('mummy', s === 0 ? { x: cx + u, z: z0 + 1.1 } : s === 1 ? { x: cx + u, z: z1 - 1.1 } : s === 2 ? { x: x0 + 1.1, z: cz + u } : { x: x1 - 1.1, z: cz + u }); }
      break;
    }
    case 'cuerdas': {
      // Two pits and a causeway between them. One island has its rope bridge; the
      // other's is lying in a heap, waiting for someone with a cuerda.
      const flip = R() < .5 ? -1 : 1;
      for (const s of [-1, 1]) {
        const ix = cx + s * 5, pit = s < 0 ? [x0 + 3.2, z0 + 3.2, cx - 1.2, z1 - 3.2] : [cx + 1.2, z0 + 3.2, x1 - 3.2, z1 - 3.2], island = [ix - 2.4, cz - 2.4, ix + 2.4, cz + 2.4], north = R() < .5, broken = s === flip;
        run.pits.push({ floor: f, room: room.id, rect: pit, island });
        run.bridges.push({ id: `span${run.bridges.length}`, floor: f, room: room.id, rect: north ? [ix - 1.2, pit[1] - .2, ix + 1.2, island[1] + .2] : [ix - 1.2, island[3] - .2, ix + 1.2, pit[3] + .2], axis: 'z', needs: broken, x: ix, z: north ? pit[1] - .75 : pit[3] + .75 });
        if (broken) { chest({ x: ix, z: cz }); for (const kind of ['mask', 'emerald', 'cup', 'coins']) onIsle(kind, island); }
        else run.loot.push({ id: id.loot++, kind: BIG_POOL[Math.min(2, d - 1)][Math.floor(R() * 3)], floor: f, room: room.id, x: ix, z: cz, h: 0 });
      }
      small(2); if (d > 1) ceiling(1);
      break;
    }
    case 'cisterna': {
      // A drowned cistern: black water round a dry island, one plank across and
      // cuaimas along the rim.
      const pit = [x0 + 3.2, z0 + 3.2, x1 - 3.2, z1 - 3.2], island = [cx - 2.4, cz - 2.4, cx + 2.4, cz + 2.4], north = R() < .5;
      run.pits.push({ floor: f, room: room.id, rect: pit, island, water: true });
      run.bridges.push({ floor: f, room: room.id, rect: north ? [cx - .55, pit[1] - .2, cx + .55, island[1] + .2] : [cx - .55, island[3] - .2, cx + .55, pit[3] + .2], axis: 'z', beam: true });
      chest({ x: cx, z: cz }); for (const kind of ['pearl', 'pearl', 'cup', 'idol']) onIsle(kind, island);
      small(3); guard(); if (d > 1) guard();
      break;
    }
    case 'bosque': {
      // Mushrooms for columns, puffballs among them, spiders overhead.
      for (let i = 0; i < 5 + Math.min(3, d); i++) { const p = spot(1.3, 2.2); if (!p) continue; run.obstacles.push({ x: p.x, z: p.z, r: .55, floor: f }); decor('giantMushroom', p.x, p.z, R() * 6.28); }
      for (let i = 0; i < 3 + Math.min(3, d); i++) { const p = spot(.9, 1.8); if (p) { run.puffs.push({ id: `puff${run.puffs.length}`, floor: f, room: room.id, x: p.x, z: p.z }); decor('puffball', p.x, p.z, R() * 6.28); } }
      small(4 + d); loot(R() < .5 ? 'idol' : 'cup'); ceiling(1 + Math.floor(R() * 2)); for (let i = 0; i < d; i++) sleeper();
      break;
    }
    case 'atrio': {
      // A hall coming down: broken columns, cracks on the floor under a loose ceiling.
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) if (R() < .75) pillar(cx + sx * room.w * .28, cz + sz * room.d * .28);
      // A fallen drum is solid; keep them to the sides, clear of the middle of the hall.
      for (const side of [-1, 1]) { const x = cx + side * (room.w / 2 - 3.2), z = cz + (R() - .5) * (room.d - 8); if (free(x, z, 1.4)) { run.obstacles.push({ x, z, r: 1.2, floor: f }); taken.push({ x, z, r: 1.6 }); decor('fallenColumn', x, z, R() * 6); } }
      decor('rubble', cx + (R() - .5) * 8, cz + (R() - .5) * 8, R() * 6);
      for (let i = 0; i < 3 + Math.min(4, d); i++) { const p = spot(1, 1.8); if (p) { run.cracks.push({ id: `crack${run.cracks.length}`, floor: f, room: room.id, x: p.x, z: p.z }); decor('crack', p.x, p.z, R() * 6.28); } }
      small(4); loot('mask'); for (let i = 0; i < 1 + d; i++) sleeper();
      break;
    }
    case 'dorada':
      // The rare one: gold everywhere and nothing guarding it but the door.
      chest(); chest(); chest(); small(8 + d); loot('mask'); loot('emerald'); big(BIG_POOL[Math.min(2, d)][Math.floor(R() * 3)]);
      break;
    case 'ruedas':
      small(2); for (let i = 0; i < d; i++) sleeper();
      break;
    case 'guardian':
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) pillar(cx + sx * room.w * .3, cz + sz * room.d * .3, .8);
      run.sleepers.push({ id: id.sleeper++, kind: 'guardian', floor: f, room: room.id, x: cx, z: cz - room.d * .15 });
      taken.push({ x: cx, z: cz - room.d * .15, r: 1.6 });
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
    // ---- La biblioteca sepultada ----
    case 'estanterias': {
      // Double bookcases in rows along x, 3 m apart, so every 2.2 m aisle
      // has its centre on the 1 m path grid (enemies path through them). A
      // 4 m nave crosses the middle; some aisles end against a bookcase.
      for (const row of [-6, -3, 0, 3, 6]) {
        const z = cz + row, gap = R() < .45 ? (R() < .5 ? -1 : 1) : 0;
        for (const [a, b] of [[-8, -2], [2, 8]]) {
          // A side gap (2 m) in some rows: a shortcut a pana can squeeze through.
          if (gap && Math.sign(a + b) === gap) { const at = gap < 0 ? -6 : 4; shelfX(cx + a, cx + at, z, { tall: R() < .5 }); shelfX(cx + at + 2, cx + b, z, { tall: R() < .5 }); }
          else shelfX(cx + a, cx + b, z, { tall: R() < .5 });
        }
      }
      for (const aisle of [-4.5, -1.5, 1.5, 4.5]) for (const s of [-1, 1]) if (R() < .35 && solid([cx + s * 8.4 - SHELF / 2, cz + aisle - 1.5, cx + s * 8.4 + SHELF / 2, cz + aisle + 1.5], 'shelf', { tall: true })) caps.push({ s, aisle });
      for (let i = 0; i < 4; i++) decor('ladder', cx + (R() < .5 ? -1 : 1) * (3 + R() * 4), cz + [-6, -3, 0, 3, 6][Math.floor(R() * 5)] + (R() < .5 ? -.75 : .75), 0);
      for (let i = 0; i < 1 + d; i++) sleeper(); sleeper('phantom'); ceiling(2);
      small(4 + d); loot(R() < .5 ? 'mask' : 'cup'); if (R() < .5) { const z = cz + [-6, -3, 3, 6][Math.floor(R() * 4)]; chest(spotIn([cx - .3, z - .1, cx + .3, z + .1])); }
      break;
    }
    case 'lectura': {
      // Long reading tables either side of a central walkway, lecterns at the ends.
      for (const sz of [-1, 1]) for (const sx of [-1, 1]) {
        const x = cx + sx * 5, z = cz + sz * 3.5;
        if (!solid([x - 2.6, z - .6, x + 2.6, z + .6], 'table')) continue;
        for (let i = 0; i < 2; i++) if (R() < .7) tableLoot(SMALL[Math.min(SMALL.length - 1, Math.floor(R() * (2 + d)))], x + (R() - .5) * 4, z + (R() - .5) * .5, .86);
      }
      for (const sz of [-1, 1]) { const z = cz + sz * (room.d / 2 - 2.2); if (!mouths.some(m => inRect(cx, z, m, .6))) { run.obstacles.push({ x: cx, z, r: .5, floor: f }); decor('lectern', cx, z, sz < 0 ? 0 : Math.PI); taken.push({ x: cx, z, r: .9 }); } }
      decor('chandelier', cx, cz, 0);
      for (let i = 0; i < 1 + d; i++) sleeper(); ceiling(1); small(3); loot('idol');
      if (d > 2) chest();
      break;
    }
    case 'archivo':
      // The forbidden archive: two short rows of cases and the chests between.
      for (const sz of [-1, 1]) { shelfX(cx - 6, cx - 1.5, cz + sz * 3.5, { tall: true }); shelfX(cx + 1.5, cx + 6, cz + sz * 3.5, { tall: true }); }
      chest(); chest(); small(4 + d);
      if (R() < .5) loot(ARTIFACTS[Math.floor(R() * ARTIFACTS.length)]); else big(BIG_POOL[Math.min(2, d - 1)][Math.floor(R() * 3)]);
      guard(); ceiling(1); sleeper();
      break;
    case 'copistas':
      // The copyists' desks: each a small table with a candle and scattered pages.
      for (const sz of [-1, 1]) for (const sx of [-6.5, -3, 3, 6.5]) {
        const x = cx + sx, z = cz + sz * 3.5;
        if (!solid([x - .8, z - .45, x + .8, z + .45], 'desk', { h: sz < 0 ? 0 : Math.PI })) continue;
        if (R() < .3) tableLoot(SMALL[Math.min(SMALL.length - 1, Math.floor(R() * (2 + d)))], x + (R() - .5) * .8, z, .8);
        desks.push({ x, z, h: sz < 0 ? 0 : Math.PI });
      }
      for (let i = 0; i < 2 + d; i++) sleeper(); small(3); loot(R() < .5 ? 'cup' : 'idol'); chest();
      break;
    case 'oculta':
      chest(); chest(); small(5); big('emeraldChest');
      loot(ARTIFACTS[Math.floor(R() * ARTIFACTS.length)]);
      guard(); ceiling(1);
      break;
  }
  if (library) hideSpots();

  // ---- Hiding spots: places to search, dealt with the room's relics ----
  function hideSpots() {
    const places = [], facing = p => Math.atan2(cx - p.x, cz - p.z);
    const add = (kind, p, extra = {}) => { if (p) places.push({ id: `sp${id.spot++}`, kind, floor: f, room: room.id, x: p.x, z: p.z, h: p.h ?? facing(p), need: SPOTS[kind].need, hard: SPOTS[kind].hard, ...extra }); return !!p; };
    // A free-standing piece: an obstacle circle, like a chest, with room around it.
    // In the stacks a free-standing piece sits in the nave on a row line, never
    // in an aisle mouth (enemies path into every aisle).
    const anywhere = r => room.kind === 'puente' ? null : room.kind === 'estanterias' ? (() => { const z = cz + [-6, -3, 3, 6][Math.floor(R() * 4)]; return spotIn([cx - .3, z - .1, cx + .3, z + .1], r); })() : spot(r, 2);
    const loose = (kind, p = anywhere(SPOTS[kind].r + .75), extra) => {
      if (!p) return false;
      // A pana must fit where they stand to search it.
      const h = extra?.h ?? facing(p), d = SPOTS[kind].r + .9;
      if (!run.obstacles.every(o => o.floor !== f || Math.hypot(o.x - p.x - Math.sin(h) * d, o.z - p.z - Math.cos(h) * d) > o.r + .6)) return false;
      run.obstacles.push({ x: p.x, z: p.z, r: SPOTS[kind].r, floor: f, spot: true }); return add(kind, p, extra); };
    // A wall piece (wardrobe, shelf, ladder): a solid rect with its back to a
    // wall, never across a doorway, a dart lane or another piece, and a pana's
    // width clear in front of it.
    const wallPiece = kind => {
      const [len, dep] = SPOTS[kind].wall;
      for (let i = 0; i < 30; i++) {
        const side = Math.floor(R() * 4), alongX = side < 2, t = (R() - .5) * Math.max(0, (alongX ? room.w : room.d) - len - 3.4);
        const n = [[0, 1], [0, -1], [1, 0], [-1, 0]][side], wx = alongX ? cx + t : side === 2 ? x0 : x1, wz = alongX ? (side === 0 ? z0 : z1) : cz + t;
        const rect = alongX ? [wx - len / 2, Math.min(wz, wz + n[1] * dep), wx + len / 2, Math.max(wz, wz + n[1] * dep)] : [Math.min(wx, wx + n[0] * dep), wz - len / 2, Math.max(wx, wx + n[0] * dep), wz + len / 2];
        const mx = (rect[0] + rect[2]) / 2, mz = (rect[1] + rect[3]) / 2, front = { x: mx + n[0] * (dep / 2 + .8), z: mz + n[1] * (dep / 2 + .8) };
        if (!alongX && run.plates.some(p => p.room === room.id && Math.abs(p.z - mz) < len / 2 + 1)) continue;
        if (run.sleepers.some(s => s.floor === f && inRect(s.x, s.z, rect, .4))) continue;
        if (!free(mx, mz, len / 2) || !free(front.x, front.z, .7) || !solid(rect, 'spot')) continue;
        taken.push({ x: mx, z: mz, r: len / 2 }, { ...front, r: .7 });
        return add(kind, { x: mx, z: mz, h: Math.atan2(n[0], n[1]) }, { wall: true, rect, len });
      }
      return false;
    };
    // An old lantern in one of the two dark corners: lit, it shows what lies
    // in the corner behind it.
    const dark = [[-1, -1], [1, 1], [1, -1], [-1, 1]].filter(([a, b]) => !lit.some(([c, e]) => a === c && b === e));
    const lantern = () => {
      for (const [sx, sz] of dark) {
        const p = corner(sx, sz), reveal = { x: p.x + sx * .55, z: p.z + sz * .55 };
        if (!free(p.x, p.z, .9) || !free(reveal.x, reveal.z, .3)) continue;
        run.obstacles.push({ x: p.x, z: p.z, r: SPOTS.lantern.r, floor: f, spot: true }); taken.push({ ...p, r: .9 }, { ...reveal, r: .4 });
        return add('lantern', p, { reveal });
      }
      return false;
    };
    switch (room.kind) {
      case 'entrada': loose('trunk', undefined, { hard: 0 }); if (R() < .5) loose('sheet'); break;
      case 'estanterias':
        // Dead ends: a heap of fallen books where a capped aisle ends.
        for (const c of caps.slice(0, 2)) { const p = { x: cx + c.s * 7.3, z: cz + c.aisle }; if (free(p.x, p.z, .55)) { taken.push({ ...p, r: .55 }); loose('debris', p, { h: c.s > 0 ? -Math.PI / 2 : Math.PI / 2, hard: .85 }); } }
        lantern(); wallPiece(R() < .5 ? 'ladder' : 'shelf');
        loose('trunk');
        break;
      case 'lectura': loose('sheet'); loose('sheet'); loose('drawer'); wallPiece('wardrobe'); if (R() < .6) lantern(); break;
      case 'archivo': wallPiece('wardrobe'); wallPiece('wardrobe'); loose('trunk'); loose('debris'); if (R() < .5) wallPiece('shelf'); break;
      case 'copistas':
        for (const desk of desks.sort(() => R() - .5).slice(0, 3)) add('drawer', desk, { desk: true });
        loose('debris'); wallPiece('wardrobe');
        break;
      case 'idolo': loose('debris'); loose('sheet'); break;
      case 'santuario': if (!wallPiece('wardrobe')) loose('trunk'); break;
      // Around the sunken pit only the rim's dark corners have room.
      case 'puente': for (const [sx, sz] of dark) { const p = corner(sx, sz); if (free(p.x, p.z, 1)) { taken.push({ ...p, r: 1 }); loose(R() < .5 ? 'trunk' : 'debris', p); } } break;
      case 'oculta': loose('trunk'); wallPiece('wardrobe'); break;
      default: loose('trunk'); loose('debris');
    }
    // A place per relic up to what the room holds (big rooms more), and always
    // one to search in vain; extra relics share a place with another.
    const cap = Math.max(2, Math.round(room.w * room.d / 70));
    for (let i = 0; i < 8 && places.length < Math.min(cap, stash.length + 1); i++) loose(['debris', 'trunk', 'sheet'][Math.floor(R() * 3)]);
    const { spots, left } = dealHidingSpots(R, places, { treasures: stash.sort((a, b) => valueOf(b) - valueOf(a)), lesser: ['coins', 'pearl'], junk: ['oldBook'], traps: ['spider', 'mummy'] });
    run.spots.push(...spots);
    for (const kind of left) { const p = spot(.5); if (p) run.loot.push({ id: id.loot++, kind, floor: f, room: room.id, x: p.x, z: p.z, h: R() * 6.28 }); }
    // An old book or two lie about in plain sight: worth next to nothing.
    if (R() < .6) loot('oldBook');
    // Beside the bookcase that hides a secret room: a lantern that, lit, shows the way.
    for (const wall of run.hidden.filter(h => h.floor === f && h.room !== room.id && !h.twin)) {
      const c = run.corridors.find(c => c.id === wall.corridor); if (!c || (c.a !== room.id && c.b !== room.id)) continue;
      for (const s of [-1, 1]) {
        const p = c.horizontal ? { x: wall.x < cx ? x0 + .7 : x1 - .7, z: s < 0 ? c.rect[1] - 1.1 : c.rect[3] + 1.1 } : { x: s < 0 ? c.rect[0] - 1.1 : c.rect[2] + 1.1, z: wall.z < cz ? z0 + .7 : z1 - .7 };
        if (!inRect(p.x, p.z, room.rect, -.4) || !free(p.x, p.z, .35)) continue;
        run.obstacles.push({ x: p.x, z: p.z, r: SPOTS.lantern.r, floor: f, spot: true }); taken.push({ ...p, r: .6 });
        run.spots.push({ id: `sp${id.spot++}`, kind: 'lantern', floor: f, room: room.id, x: p.x, z: p.z, h: facing(p), need: SPOTS.lantern.need, hard: 1, content: [], decoy: false, trap: null, reveals: wall.id });
        break;
      }
    }
  }
}
