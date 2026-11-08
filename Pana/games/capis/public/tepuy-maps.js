// Tepuyes: maps built on a W / V rhythm of flat-topped mesas and the valleys
// between them, seen from the side. Pure and deterministic like map-rules.js
// (no Math.random, no clock): the same seed, size and style build the same
// cells in the browser, in Node and on a server that only sends the seed.
//
// Styles (`TEPUY_STYLES`):
//   w     six tepuyes in a row, one per capi in a free-for-all; their heights
//         follow a seeded pattern (W, M, saw, waves) and each valley between
//         them is its own V: deep, notched, flat-bottomed, or a pond under an arch
//   v     two teams: the tallest tepuyes stand at both ends and step down
//         towards a deep middle valley with a pond and a rock arch across
//   fosa      La Fosa, the inside of a tepuy: a W floor under a broken roof
//             (a big mouth and sometimes a small one), balconies with chambers
//             on the walls, a rock column with a doorway, stalagmites, stalactites
//   guacharo  Cueva del Guácharo: a long low gallery, a stream on its floor,
//             terraces stepped up both walls (stairs between them, nests in
//             the walls), columns, a forest of stalactites, light through cracks
//   sima      Sima Humboldt: a sinkhole open to the sky, its floor a bowl of
//             jungle round a pond, ledges up its sheer walls
//   cristal   Cueva de Cristal: a quartz cave over an underground river, its
//             floor islands joined by arches, crystals everywhere, a high vault
// Every cave keeps room overhead for a lob: its roof stands well over the floor.
//
// Every tepuy is built the same way:
//   a sandstone cap (rock in the painter) with a crown of crags and boulders,
//   two flanks that come down from it: two short cap risers and a ledge, the
//   steep wall below (steps no higher than a hop), then a gentler talus skirt
//   (steps again, or terraces where it is gentle). A valley too deep for the
//   room its flanks have comes up instead, so the tops keep their height,
//   a refugio: a sima (sinkhole) in its top, a ramp down at 45° to a room
//   under the cap. The opening is narrow enough to hop over, and its near edge
//   has no lip, so the way across the top stays open both ways.
// Overhangs (arches, the pond's walls, its grotto) stand off the walking
// routes: a pond valley is crossed on its arch.
//
// This is a design tool's generator: its balance is not measured like
// map-rules.js (FAIR); `inspect()` reports the numbers a test would read.
import { createMask, fillHeights, carve, carveLine, fill, solidAt, surfaceY, groundBelow } from '../../../engine/play/terrain-mask.js';
import { fbm2, smoothstep, lerp, clamp } from '../../../engine/random.js';
import { seededStream, dropFloating } from '../../../engine/play/terrain-gen.js';
import { buildRuins } from './ruins.js';
import { locKey } from '../../../engine/i18n.js';

export const TEPUY_WATER = 4.2, TEPUY_CELL = .1;
export const TEPUY_STYLES = Object.freeze({
  w: Object.freeze({ title: 'Tepuyes', label: locKey('Tepuyes en W · todos contra todos'), mesas: 6, teams: false }),
  archipielago: Object.freeze({ title: locKey('Archipiélago'), label: locKey('Archipiélago · ocho tepuyes y lagunas'), mesas: 8, teams: false }),
  v: Object.freeze({ title: locKey('La Gran V'), label: locKey('Gran V · equipos'), mesas: 6, teams: true }),
  fosa: Object.freeze({ title: locKey('La Fosa'), label: locKey('La Fosa · interior del tepuy'), mesas: 4, teams: false, cave: true }),
  guacharo: Object.freeze({ title: locKey('Cueva del Guácharo'), label: locKey('Fosa · Cueva del Guácharo'), mesas: 5, teams: false, cave: true }),
  sima: Object.freeze({ title: 'Sima Humboldt', label: locKey('Fosa · Sima Humboldt (a cielo abierto)'), mesas: 4, teams: false, cave: true }),
  cristal: Object.freeze({ title: locKey('Cueva de Cristal'), label: locKey('Fosa · Cueva de Cristal (río subterráneo)'), mesas: 5, teams: false, cave: true }),
});
export const TEPUY_SIZES = Object.freeze({
  small: Object.freeze({ width: 150, height: 48 }),
  medium: Object.freeze({ width: 180, height: 52 }),
  large: Object.freeze({ width: 220, height: 56 }),
});
// The most a step rises: a capi hops ~1.36 (rules.js), the checks count a little less.
const STEP = .95;
// A sima's ramp: its radius (room for a capi of radius .7) and its fall per unit across.
const RAMP = { radius: 1.05, slope: 1.15 };
// The patterns of tepuy heights along the row (0..1 of the style's range).
const PATTERNS = Object.freeze({
  W: [1, .45, .85, .85, .45, 1],
  M: [.55, 1, .7, .7, 1, .55],
  sierra: [.95, .55, 1, .5, .9, .6],
  olas: [.7, .95, .55, 1, .6, .85],
});
// The caves: how many tepuyes stand on the floor and how the shell around them is built.
//   end     room by each wall (× scale)      base, range  the floor and the tops over it
//   ponds   which inner valleys hold water   wall         the wall's thickness
//   roof    'mouth' | 'cracks' | 'high' | 'open'          low  the roof's lowest line
const CAVES = Object.freeze({
  fosa: { end: 18, base: [9, 10.5], range: [10, 17], ponds: [1], wall: 6, roof: 'mouth', low: [40, 43], balconies: 2, columns: 1, mites: 7, drips: 18 },
  guacharo: { end: 27, base: [9, 10], range: [5.5, 11.5], ponds: [2], wall: 5, roof: 'cracks', low: [40, 42.5], tiers: true, columns: 2, mites: 14, drips: 34 },
  sima: { end: 20, base: [8, 9.5], range: [6, 13.5], ponds: [1], wall: 11, roof: 'open', balconies: 3, columns: 0, mites: 0, drips: 0 },
  cristal: { end: 15, base: [6, 7], range: [5, 12], ponds: [0, 3], wall: 5, roof: 'high', low: [39, 42], balconies: 1, columns: 1, mites: 10, drips: 22 },
});
const NAMES = [locKey('Kukenán'), 'Roraima', locKey('Auyán'), locKey('Sarisariñama'), locKey('Chimantá'), 'Autana', locKey('Yuruaní'), locKey('Wadakapiapué'), locKey('Ilú'), 'Tramen', locKey('Karaurín'), 'Uei'];

// ---------- the plan ----------

// `shape` pins what a figure needs and leaves the rest to the seed:
//   heights  one 0..1 per tepuy (its share of the style's range of heights)
//   valleys  one kind per inner valley: 'v' | 'notch' | 'flat' | 'pond'
//   ruins    { style, amount } builds ruins on the land (ruins.js): masonry that is drawn,
//            breaks and falls apart from earth; `map.ruin` flags its cells
//   perched  ponds stand above the sea in basins of their own (for liquids that flow:
//            `plan.pools` says where each lake is and how high it fills)
export function planTepuy(seed, size = 'medium', style = 'w', shape = {}) {
  const S = TEPUY_STYLES[style] ? style : 'w', { width } = TEPUY_SIZES[size] || TEPUY_SIZES.medium, C = CAVES[S] || null;
  // A cave needs more room overhead than an open range.
  const height = (TEPUY_SIZES[size] || TEPUY_SIZES.medium).height + (C ? 4 : 0);
  const r = seededStream(`tepuy-map:${seed}:${size}:${S}`), between = (a, b) => a + (b - a) * r(), chance = k => r() < k;
  const fosa = !!C, scale = width / 180;
  const p = { seed, size, style: S, width, height, water: TEPUY_WATER, detail: between(0, 900), mesas: [], valleys: [], arches: [], boulders: [], rocks: [], caves: [], balconies: [], drips: [] };
  const n = TEPUY_STYLES[S].mesas;
  // The ends: a shoulder and a shore down to the sea or, inside La Fosa, the cavern's walls.
  const end = fosa ? C.end * scale : between(9, 12);
  const slot = (width - 2 * end) / n;
  const base = fosa ? between(...C.base) : between(8.5, 10.5);
  const range = fosa ? C.range : S === 'v' ? [3.5, 16] : [6.5, 12.5];
  let heights;
  if (S === 'v') {
    // Mirrored macro shape (the teams' halves match), the seed's own wobble.
    const half = [1, between(.5, .62), between(.05, .18)];
    heights = [...half, ...half.slice().reverse()].map(k => clamp(k + between(-.05, .05)));
  } else if (S === 'fosa') {
    heights = [between(.55, .75), between(.2, .4), between(.2, .4), between(.55, .75)];
    if (chance(.5)) heights = [heights[1], heights[0], heights[3], heights[2]];
  } else if (S === 'sima') {
    // A bowl: high by the walls, low round the pond in the middle.
    heights = [between(.8, 1), between(.25, .45), between(.25, .45), between(.8, 1)];
  } else if (fosa) {
    heights = Array.from({ length: n }, () => between(.2, 1));
  } else if (S === 'archipielago') {
    // Eight small tepuyes, no pattern: each its own height.
    heights = Array.from({ length: n }, () => between(.15, 1));
  } else {
    const keys = Object.keys(PATTERNS), pattern = PATTERNS[keys[Math.floor(r() * keys.length)]];
    heights = (chance(.5) ? pattern : pattern.slice().reverse()).map(k => clamp(k + between(-.08, .08)));
    p.pattern = keys.find(k => PATTERNS[k] === pattern);
  }
  if (shape.heights) heights = Array.from({ length: n }, (_, i) => clamp((shape.heights[i] ?? heights[i]) + between(-.03, .03)));
  if (shape.heights) p.pattern = null;
  const names = NAMES.slice(); for (let i = names.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [names[i], names[j]] = [names[j], names[i]]; }
  for (let i = 0; i < n; i++) {
    // The V opens its middle valley wide: the inner tepuyes lean out towards their ends.
    const lean = S === 'v' ? [0, -.06, -.16, .16, .06, 0][i] : 0;
    const cx = end + slot * (i + .5 + lean) + between(-.05, .05) * slot;
    const tw = slot * (S === 'v' ? between(.24, .3) * (i === 0 || i === n - 1 ? 1.15 : 1) : between(.19, .24));
    const T = base + lerp(range[0], range[1], heights[i]) * (size === 'small' ? .85 : size === 'large' ? 1.08 : 1);
    p.mesas.push({ i, cx, tw, T, name: names[i],
      // Crags on the top, knots of rock that stand a little proud.
      crags: Array.from({ length: 1 + Math.floor(r() * 3) }, () => ({ at: between(-.85, .85), height: between(.25, .7), width: between(.6, 1.4) })),
      // The sima: which side its mouth opens to and how deep its room lies.
      sima: { dir: chance(.5) ? -1 : 1, depth: between(3.9, 4.6), room: between(3.4, 4.6) },
      // A crest rock near one rim (cover a capi crouches behind, low enough to hop).
      crest: chance(.7) ? { side: chance(.5) ? -1 : 1, height: between(.9, 1.25), width: between(.9, 1.4) } : null,
      flanks: [] });
  }
  // The valleys: one at each end (a shoulder, then steps down to the beach;
  // inside La Fosa, the cavern's wall) and one between each pair of tepuyes,
  // its floor some way under the lower of the two tops.
  const sizeK = size === 'small' ? .85 : size === 'large' ? 1.08 : 1;
  const ends = () => ({ y: fosa ? base : base + between(-.6, .8), wall: fosa, end: true, shore: fosa ? 0 : end * between(.8, .9) });
  p.valleys.push({ x: 0, ...ends() });
  for (let i = 0; i + 1 < n; i++) {
    const a = p.mesas[i], b = p.mesas[i + 1], gap = (b.cx - b.tw) - (a.cx + a.tw);
    const x = lerp(a.cx + a.tw, b.cx - b.tw, between(.45, .55));
    const y = Math.max(base - 1.5, Math.min(a.T, b.T) - between(5, 9) * sizeK);
    p.valleys.push({ x, y, y0: y, floor: between(.4, 2.2), kind: 'v', gap });
  }
  p.valleys.push({ x: width, ...ends() });
  // Some valleys become ponds under a rock arch: the middle one in the V, one or two in a W, one in La Fosa.
  const inner = p.valleys.slice(1, -1);
  const ponds = S === 'v' ? [inner[Math.floor(inner.length / 2)]] : inner.filter(() => false);
  if (S === 'archipielago') inner.forEach((v, i) => { if (i % 2 === 0 || chance(.25)) ponds.push(v); });
  if (S === 'w') { const pick = 1 + Math.floor(r() * 3); ponds.push(inner[pick]); if (chance(.3)) ponds.push(inner[pick === 1 ? 3 : 1]); }
  if (fosa) for (const k of C.ponds) if (inner[k]) ponds.push(inner[k]);
  // A valley of a kind: a pond under an arch, a sharp V, a notch (a step down
  // into a narrow cleft) or a flat floor with talus boulders.
  const shapeValley = (v, kind) => {
    v.kind = kind; v.y = v.y0; delete v.arch;
    if (kind === 'pond') { v.y = shape.perched ? Math.max(TEPUY_WATER + 2.5, base + between(-.8, 0)) : TEPUY_WATER - 1.7; v.floor = between(4.2, 6) * scale; v.arch = { radius: between(.85, 1.05), arc: between(.9, 1.9), at: between(.32, .45) }; return; }
    if (kind === 'v') v.floor = between(.2, .6);
    else if (kind === 'notch') { v.floor = between(.9, 1.4); v.y -= between(.8, 1.4); }
    else v.floor = between(2.2, 3.6);
    if (kind !== 'notch') for (let k = 0, nb = Math.floor(r() * 3); k < nb; k++) p.boulders.push({ x: v.x + between(-1, 1) * v.floor * .6, r: between(.4, .7), sink: between(.2, .45) });
  };
  for (const v of ponds) shapeValley(v, 'pond');
  for (const v of inner) if (v.kind === 'v') { const k = r(); shapeValley(v, k < .35 ? 'v' : k < .6 ? 'notch' : 'flat'); }
  // A figure pins its valleys (the boulders of a valley that became a pond go).
  if (shape.valleys) {
    inner.forEach((v, i) => { const kind = shape.valleys[i]; if (kind && kind !== v.kind) shapeValley(v, kind); });
    p.boulders = p.boulders.filter(b => !inner.some(v => v.kind === 'pond' && Math.abs(b.x - v.x) < v.floor + 1.5));
  }
  // How far a flank can fall over the room it has: about 1.7 on average under the cap.
  const most = room => 2.4 + Math.max(0, room - 2.6) * 1.7;
  const roomOf = (m, side, v) => Math.abs(v.x - (m.cx + side * m.tw)) - (v.end ? v.shore + (v.wall ? 7 : 0) : (v.floor || 0) / 2);
  // A valley too deep for the room its flanks have comes up instead (the tepuyes keep their height).
  for (const [k, v] of p.valleys.entries()) {
    if (v.kind === 'pond') continue;
    for (const [m, side] of [[p.mesas[k - 1], 1], [p.mesas[k], -1]]) if (m) v.y = Math.max(v.y, m.T - most(roomOf(m, side, v)));
  }
  // Each flank of each tepuy, from the top edge out to its valley (and on to the sea at the ends).
  for (const [i, m] of p.mesas.entries()) for (const side of [-1, 1]) {
    const v = p.valleys[side < 0 ? i : i + 1], room = Math.max(3, roomOf(m, side, v));
    const stop = v.kind === 'pond' ? Math.max(lerp(m.T, v.y, v.arch.at), m.T - most(room - .9)) : v.y;
    m.flanks[side < 0 ? 0 : 1] = flankProfile(r, m.T, stop, room, { pond: v.kind === 'pond' ? v : null, shore: v.end && !v.wall ? v.shore : 0 });
  }
  // The rock of every tepuy's cap shows in the painter.
  for (const m of p.mesas) p.rocks.push({ x0: m.cx - m.tw - 3, x1: m.cx + m.tw + 3, y0: m.T - 4.2, y1: m.T - .3, mesa: m.i });
  if (fosa) {
    p.cave = { kind: C.roof, wall: C.wall, tiers: [], columns: [], mites: [] };
    if (C.roof !== 'open') p.roof = { low: between(...C.low), mouths: [] };
    if (C.roof === 'mouth') {
      // The big mouth over the middle, and often a small one off to a side.
      p.roof.mouths.push([width * between(.36, .4), width * between(.6, .64)]);
      if (chance(.7)) { const at = width * (chance(.5) ? between(.18, .24) : between(.76, .82)), w = between(3, 4.5) * scale; p.roof.mouths.push([at - w, at + w]); }
    } else if (C.roof === 'cracks') {
      // Two or three cracks: thin blades of daylight.
      for (let k = 0, nc = 2 + Number(chance(.5)); k < nc; k++) { const at = width * (.25 + .5 * (k + between(.2, .8)) / nc), w = between(.7, 1.4); p.roof.mouths.push([at - w, at + w]); }
    } else if (C.roof === 'high' && chance(.6)) {
      const at = width * between(.3, .7), w = between(2, 3); p.roof.mouths.push([at - w, at + w]);
    }
    // Balconies jut from both walls, one over the other (the sima's climb the whole wall).
    const top = C.roof === 'open' ? height - 13 : p.roof.low - 6;
    for (const side of [-1, 1]) for (let k = 0; k < (C.balconies || 0); k++) {
      const y = lerp(base + 9, top, C.balconies === 1 ? between(.35, .55) : k / (C.balconies - 1)) + between(-.8, .8);
      p.balconies.push({ side, y, out: between(4.5, 7) * scale });
    }
    // Terraces up both walls (the guácharo's): a low wide one and a narrow one on it, stairs to each.
    if (C.tiers) for (const side of [-1, 1]) {
      const low = { side, y: base + between(5, 6.5), out: end - C.wall - between(4.5, 6.5) }, high = { side, y: 0, out: low.out * between(.45, .58) };
      high.y = low.y + between(5, 6.2); p.cave.tiers.push(low, high);
    }
    for (let k = 0; k < C.drips; k++) p.drips.push({ x: between(.05, .95) * width, len: between(1.2, 4.8), r: between(.3, .7) });
    // Columns stand in some dry valleys, each with a doorway through its foot.
    const dry = inner.filter(v => v.kind !== 'pond');
    for (let k = 0; k < C.columns && dry.length; k++) { const v = dry.splice(Math.floor(r() * dry.length), 1)[0]; p.cave.columns.push({ x: v.x, w: between(3, 4.2) }); }
    // Stalagmites (crystals in the cristal cave): short enough to hop.
    for (let k = 0; k < C.mites; k++) p.cave.mites.push({ x: between(.08, .92) * width, h: between(.5, 1.1), r: between(.35, .55) });
  }
  return p;
}

// The flank from the top edge (d = 0) out to `room` across, falling from T to
// `stop`: a list of [d, y] points. Two short cap risers and a ledge, the wall,
// the talus. A pond's flank stops where the arch meets it and falls sheer to
// the water; an end flank goes on over a shoulder and steps down to the beach.
function flankProfile(r, T, stop, room, { pond = null, shore = 0 } = {}) {
  const between = (a, b) => a + (b - a) * r(), pts = [[0, T]];
  let d = 0, h = T;
  const step = (run, rise, shelf, sag = .04) => { d += run; h -= rise; pts.push([d, h]); if (shelf > 0) { d += shelf; h -= sag; pts.push([d, h]); } };
  const cap = [between(.7, 1), between(.6, .95)];
  step(.22, cap[0], between(.45, .8));
  step(.22, cap[1], between(1.1, 1.9), .08);
  let drop = h - stop, run = Math.max(1, room - d - (pond ? .9 : 0));
  // The wall of the tepuy (steep, most of the fall) and the talus skirt at its foot (gentler).
  const wallShare = pond ? 1 : between(.55, .68), wallRun = pond ? run : run * between(.34, .44);
  const part = (drop, run) => {
    if (drop <= .01) return;
    if (drop / run <= .6) {
      // Gentle: terraces, a short steeper face then a flatter tread.
      const k = Math.max(1, Math.round(run / 1.4)), per = run / k, fall = drop / k;
      for (let i = 0; i < k; i++) { const j = between(.85, 1.15); step(per * .38, fall * .68 * j, per * .62, fall * (1 - .68 * j)); }
    } else {
      // Steep: steps no higher than a hop, a riser and a tread each.
      const k = Math.max(1, Math.ceil(drop / STEP)), per = run / k, fall = drop / k;
      for (let i = 0; i < k; i++) { const riser = Math.min(.3, per * .4); step(riser, fall * between(.9, 1.1), per - riser, 0); }
    }
  };
  const h0 = h;
  part(drop * wallShare, wallRun);
  h = h0 - drop * wallShare; pts[pts.length - 1][1] = h;
  part(h - stop, Math.max(.5, run - wallRun));
  // Land exactly on the stop height.
  pts[pts.length - 1][1] = stop;
  if (pond) { d = room; pts.push([d, pond.y]); pond.attach = Math.max(pond.attach ?? -Infinity, stop); }
  if (shore) {
    // The end: a shoulder, steps or terraces down to the dunes, then the sand into the sea.
    d = room; pts.push([d, stop]);
    d += shore * .12; h = stop; pts.push([d, h]);
    part(h - (TEPUY_WATER + .8), shore * .55);
    d += shore * .33; pts.push([d, TEPUY_WATER - 2.4]);
  }
  return { pts, room, stop, end: !!shore };
}

// Height of a flank profile `d` out from the top edge (past its end: its last height).
function along(f, d) {
  const pts = f.pts;
  if (d <= 0) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (d <= pts[i][0]) {
    const [a, ya] = pts[i - 1], [b, yb] = pts[i], t = (d - a) / ((b - a) || 1);
    // Risers bow out a little at the lip, so they read as worn rock, not a ruler.
    return lerp(ya, yb, t < .5 ? t * t * 2 * .9 + t * .1 : t);
  }
  return pts[pts.length - 1][1];
}

const noise = (p, x, k = 1) => (fbm2(x * .35 * k + p.detail, 3.1, { octaves: 2 }) - .5);

// Ground height at x: the heightfield before any cell work (simas, arches, caves).
export function tepuyHeightAt(p, x) {
  // Which tepuy's ground x stands on: the one between the valleys around it.
  let i = p.mesas.findIndex((m, k) => x < p.valleys[k + 1].x || k === p.mesas.length - 1);
  if (i < 0) i = p.mesas.length - 1;
  const m = p.mesas[i], side = x < m.cx ? -1 : 1, d = Math.abs(x - m.cx) - m.tw;
  let h;
  if (d <= 0) {
    // The top: level sandstone with crags, worn lower towards its rims.
    h = m.T + noise(p, x, 2) * .5 + noise(p, x, .5) * .4 - .35 * smoothstep(clamp((d + 1.2) / 1.2));
    for (const c of m.crags) { const at = m.cx + c.at * m.tw; h += c.height * Math.exp(-(((x - at) / c.width) ** 2)); }
    if (m.crest) {
      const at = m.cx + m.crest.side * (m.tw - 1.1), k = clamp(1 - Math.abs(x - at) / m.crest.width);
      h = Math.max(h, m.T + m.crest.height * smoothstep(k * 1.8) + noise(p, x, 4) * .2);
    }
  } else {
    const f = m.flanks[side < 0 ? 0 : 1], v = p.valleys[side < 0 ? i : i + 1];
    h = along(f, d) + noise(p, x, 3) * .12;
    if (d > f.room && !f.end) {
      // The valley floor (or, inside La Fosa, the foot of the cavern's wall).
      if (v.end) h = v.y + noise(p, x) * .4;
      else if (v.kind === 'pond') h = v.y + noise(p, x) * .3;
      else h = f.stop + noise(p, x, 2) * (v.kind === 'flat' ? .25 : .1);
    }
    if (v.kind === 'notch' && Math.abs(x - v.x) < v.floor / 2) h = Math.min(h, v.y + noise(p, x) * .15);
  }
  return clamp(h, -1, p.height - 2);
}

// A span of rock (an arch, a balcony) from a to b, its line bowed up by `arc`.
function span(mask, a, b, radius, arc, thick = .5) {
  const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / .15);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const wob = .14 * Math.sin(t * 23 + a.x) + .08 * Math.sin(t * 57 + b.x);   // rough rock, not a pipe
    fill(mask, lerp(a.x, b.x, t), lerp(a.y, b.y, t) + Math.sin(t * Math.PI) * arc + wob * .5, radius + thick * Math.abs(t - .5) ** 1.5 * 2.8 + wob);
  }
}

export function buildTepuy(p) {
  const mask = createMask({ width: p.width, height: p.height, cell: TEPUY_CELL });
  fillHeights(mask, x => tepuyHeightAt(p, x));
  const before = mask.solid.slice();
  p.spans = []; p.refugios = []; p.pools = [];
  // Arches across the pond valleys, flush with the flanks at the stop height.
  for (const [k, v] of p.valleys.entries()) if (v.kind === 'pond') {
    const a = p.mesas[k - 1], b = p.mesas[k], ax = a.cx + a.tw + a.flanks[1].room - .4, bx = b.cx - b.tw - b.flanks[0].room + .4;
    // Each end flush with its own flank's ledge (the two tepuyes may stand at different heights).
    const s = { a: { x: ax, y: a.flanks[1].stop - v.arch.radius }, b: { x: bx, y: b.flanks[0].stop - v.arch.radius }, radius: v.arch.radius, arc: v.arch.arc };
    span(mask, s.a, s.b, s.radius, s.arc, .55); p.spans.push(s); p.rocks.push({ x0: ax - .5, x1: bx + .5, span: s });
    // A grotto at the waterline in one of the pond's walls.
    const wall = (k + p.seed) % 2 ? { x: ax + .2, dir: -1 } : { x: bx - .2, dir: 1 }, gy = v.y + 2.8;
    carveLine(mask, wall.x, gy, wall.x + wall.dir * 2.6, gy + .2, 1.15);
    p.caves.push({ x: wall.x + wall.dir * 1.6, y: gy - .9, what: 'grotto' });
    // The lake: from wall to wall, filled to a little under the arch.
    p.pools.push({ x0: ax - 3, x1: bx + 3, level: Math.max(v.y + 1, Math.min(a.flanks[1].stop, b.flanks[0].stop) - 2 * v.arch.radius - .5), y: v.y });
  }
  // Talus boulders on the valley floors (low enough to walk or hop over).
  for (const b of p.boulders) { const y = surfaceY(mask, b.x); if (y !== null) { fill(mask, b.x, y + b.r - b.sink - .2, b.r); p.rocks.push({ x0: b.x - b.r, x1: b.x + b.r, y0: y - .4, y1: y + b.r * 2, boulder: true }); } }
  // Every tepuy's refugio: a sima in its top, a ramp down to a room under the cap.
  for (const m of p.mesas) {
    const s = m.sima, dir = s.dir, open = m.cx - dir * (m.tw - 1.5);
    const top = surfaceY(mask, open) ?? m.T, floor = Math.round((m.T - s.depth) / TEPUY_CELL) * TEPUY_CELL;
    const rampEnd = open + dir * (top - floor) / RAMP.slope;
    // The room runs on under the cap while there is rock enough over it for a roof.
    let far = rampEnd;
    while (Math.abs(far - rampEnd) < s.room && tepuyHeightAt(p, far + dir * 1.6) > floor + 3.9) far += dir * .1;
    const room = [rampEnd, far];
    // The ramp (its floor at 45°), the room (flat floor, rounded ends), a little alcove at its far end.
    carveLine(mask, open, top + RAMP.radius - .5, rampEnd, floor + RAMP.radius - .1, RAMP.radius);
    carveLine(mask, room[0], floor + 1.15, room[1], floor + 1.15, 1.2);
    carve(mask, room[1] - dir * .4, floor + 1.5, 1.1);
    // The floor of the room levelled (the carve leaves its ends round).
    for (let x = Math.min(...room) - .4; x <= Math.max(...room) + .4; x += TEPUY_CELL) fill(mask, x, floor - .25, .25);
    p.refugios.push({ mesa: m.i, x: (room[0] + room[1]) / 2, y: floor, open, dir, name: m.name });
    p.rocks.push({ x0: Math.min(open, ...room) - 1, x1: Math.max(open, ...room) + 1, y0: floor - .6, y1: floor + .1, floor: true });
  }
  // ---- small things on the land (their own stream, so the layout above stays as it was) ----
  const d = seededStream(`tepuy-detail:${p.seed}:${p.size}:${p.style}`), dv = (a, b) => a + (b - a) * d();
  const nearSima = x => p.refugios.some(r => r.open !== undefined && Math.abs(x - r.open) < 3.2);
  // Drips of rock under each pond's arch (short: they never reach the water).
  for (const s of p.spans) for (let k = 0, n = 3 + Math.floor(d() * 4); k < n; k++) {
    const t = dv(.15, .85), x = lerp(s.a.x, s.b.x, t), under = ceilingAt(mask, x, lerp(s.a.y, s.b.y, t) - s.radius * 3);
    if (under === null) continue;
    const len = dv(.4, 1.1); for (let j = 0; j < 5; j++) fill(mask, x, under - len * j / 5, .3 * (1 - j / 5.5));
  }
  // On every top: a rock garden, knobs low enough for a capi to hop (the tall spires and windows are decor behind the line).
  p.gardens = [];
  for (const m of p.mesas) {
    for (let k = 0, n = 1 + Math.floor(d() * 3); k < n; k++) {
      const x = m.cx + dv(-.85, .85) * m.tw; if (nearSima(x)) continue;
      const y = surfaceY(mask, x); if (y === null || y < m.T - 1.5) continue;
      const h = dv(.5, .85), w = dv(.35, .55);
      for (let j = 0; j < 6; j++) fill(mask, x + Math.sin(j * 1.7 + x) * .08, y - .15 + h * j / 6, w * (1 - j / 7));
      p.rocks.push({ x0: x - w, x1: x + w, y0: y - .4, y1: y + h + .3, boulder: true }); p.gardens.push({ x, y, h });
    }
    // A boulder or two resting on the flank's treads.
    for (const side of [-1, 1]) if (d() < .6) {
      const f = m.flanks[side < 0 ? 0 : 1], dd = dv(2.5, Math.max(2.6, f.room * .8)), x = m.cx + side * (m.tw + dd), y = surfaceY(mask, x);
      // Only on a flat tread: at the foot of a riser it would make the step too tall to hop.
      if (y === null || nearSima(x) || [-1, -.5, .5, 1].some(o => Math.abs((surfaceY(mask, x + o) ?? -9) - y) > .12)) continue;
      const r = dv(.25, .38); fill(mask, x, y + r - .2, r); p.rocks.push({ x0: x - r, x1: x + r, y0: y - .3, y1: y + 2 * r, boulder: true });
    }
  }
  if (p.cave) buildCave(p, mask);
  const loose = dropFloating(mask, 1500);
  mask.hollow = new Uint8Array(mask.solid.length);
  for (let i = 0; i < before.length; i++) if (before[i] && !mask.solid[i]) mask.hollow[i] = 1;
  return { mask, loose };
}

// A solid box of cells, x0..x1 by y0..y1 (world units).
function box(mask, x0, x1, y0, y1, value = 1) {
  const { cols, rows, cell } = mask;
  for (let c = Math.max(0, Math.floor(Math.min(x0, x1) / cell)); c <= Math.min(cols - 1, Math.floor(Math.max(x0, x1) / cell)); c++)
    for (let r = Math.max(0, Math.floor(y0 / cell)); r < Math.min(rows, Math.ceil(y1 / cell)); r++) mask.solid[r * cols + c] = value;
}
// The underside of the rock over (x, y): the first solid cell above, or null.
export function ceilingAt(mask, x, y) {
  const c = Math.floor(x / mask.cell); if (c < 0 || c >= mask.cols) return null;
  for (let r = Math.max(0, Math.floor(y / mask.cell)); r < mask.rows; r++) if (mask.solid[r * mask.cols + c]) return r * mask.cell;
  return null;
}
// The roof line at x (Infinity under a mouth or an open sky).
function roofAt(p, x) {
  const roof = p.roof;
  if (!roof || roof.mouths.some(([a, b]) => x > a && x < b)) return Infinity;
  return roof.low - 4 * Math.sin(Math.PI * x / p.width) + noise(p, x, .8) * 2.4 + noise(p, x, 4) * .6;
}

// The caves: the shell around the W floor (walls, a roof or the open sky),
// then what stands in it: columns, terraces, balconies, stalagmites, stalactites.
function buildCave(p, mask) {
  const { cols, rows, cell } = mask, w = p.width, c = p.cave, wall = c.wall;
  // The floor under the cave's air at x (the highest ground under its roof).
  const floorAt = x => groundBelow(mask, x, Math.min(p.height, roofAt(p, x) - 1.5));
  const wallAt = x => wall + noise(p, x * 3) * 1.5 + (c.kind === 'open' ? noise(p, x * .3, 2) * 2 : 0);
  for (let k = 0; k < cols; k++) {
    const x = (k + .5) * cell, e = Math.min(x, w - x);
    // The walls are solid out to about `wall` from each side; past them, rock from the roof line up.
    const from = e < wallAt(x) ? 0 : roofAt(p, x);
    if (from === Infinity) continue;
    for (let r = Math.max(0, Math.floor(from / cell)); r < rows; r++) mask.solid[r * cols + k] = 1;
  }
  // A sima's walls lean back a little as they rise, with a lip of rock at the rim.
  if (c.kind === 'open') for (const side of [-1, 1]) for (let y = p.height - 7; y < p.height; y += .5) {
    const x = side < 0 ? wall + (y - p.height + 7) * .25 : w - wall - (y - p.height + 7) * .25;
    fill(mask, x, y, 1.1);
  }
  // Columns from floor to roof, waisted, a doorway through the foot (cover that a blast wears away).
  for (const col of c.columns) {
    const floor = floorAt(col.x), top = roofAt(p, col.x);
    if (floor === null || top === Infinity) continue;
    for (let y = floor - 1; y < top + 1; y += .25) { const t = clamp((y - floor) / (top - floor)); fill(mask, col.x + noise(p, y, 2) * .5, y, col.w / 2 * (1 - .38 * Math.sin(Math.PI * t)) + .5 * (1 - t) ** 6); }
    carveLine(mask, col.x - col.w, floor + 1.2, col.x + col.w, floor + 1.2, 1.25);
    box(mask, col.x - col.w, col.x + col.w, floor - .6, floor);
    p.rocks.push({ x0: col.x - col.w, x1: col.x + col.w, y0: floor - .5, y1: top + .5, column: true });
  }
  // Terraces stepped up the walls: a solid shelf out from the wall, stairs down from its tip.
  const tipOf = t => (t.side < 0 ? 0 : w) + (t.side < 0 ? 1 : -1) * (wall + t.out);
  for (const t of c.tiers) {
    const out = t.side < 0 ? 1 : -1, x0 = t.side < 0 ? 0 : w, tip = tipOf(t);
    box(mask, x0, tip, 0, t.y);
    for (let k = 1; k < 40; k++) {
      const a = tip + out * (k - 1) * .85, b = tip + out * k * .85, y = t.y - k * .9, ground = floorAt((a + b) / 2) ?? 0;
      if (y <= ground + .25) break;
      box(mask, a, b, 0, y);
    }
    p.rocks.push({ x0: Math.min(x0, tip) - .5, x1: Math.max(x0, tip) + .5, y0: t.y - 1.2, y1: t.y - .2 });
  }
  // A nest at the back of each terrace (the wall, or the face of the terrace over it): its refugio.
  for (const t of c.tiers) {
    const out = t.side < 0 ? 1 : -1, above = c.tiers.find(u => u.side === t.side && u.y > t.y);
    const back = above ? tipOf(above) : (t.side < 0 ? 0 : w) + out * wall;
    carveLine(mask, back + out * .6, t.y + 1.2, back - out * 2.6, t.y + 1.3, 1.2);
    p.refugios.push({ x: back - out * 1.2, y: t.y, name: `Nido ${t.side < 0 ? 'oeste' : 'este'} ${above ? 'bajo' : 'alto'}`, wall: true, side: t.side });
  }
  // Stalactites from the roof (not over a mouth); the mouths' rims hang down a little.
  for (const d of p.drips) {
    const floor = floorAt(d.x) ?? 0, top = ceilingAt(mask, d.x, Math.max(floor + 6, p.mesas[0].T));
    if (top === null || top > p.height - 1) continue;
    d.y = top;
    for (let k = 0; k < 8; k++) fill(mask, d.x + Math.sin(k) * .1, top - d.len * k / 8, d.r * (1 - k / 9));
  }
  // Balconies: rock shelves from the walls, a capi stands on each (the refugios of the walls).
  for (const b of p.balconies) {
    const x0 = b.side < 0 ? wall - 1 : w - wall + 1, x1 = x0 - b.side * b.out;
    span(mask, { x: x0, y: b.y }, { x: x1, y: b.y + .2 }, .7, -.15, .15);
    // A chamber in the wall behind the balcony.
    carveLine(mask, x0 + b.side * .6, b.y + 1.95, x0 + b.side * 3.2, b.y + 1.95, 1.2);
    p.rocks.push({ x0: Math.min(x0, x1) - .5, x1: Math.max(x0, x1) + .5, y0: b.y - .9, y1: b.y + .9 });
    p.refugios.push({ x: lerp(x0, x1, .45), y: b.y + .9, name: b.side < 0 ? locKey('Balcón oeste') : locKey('Balcón este'), wall: true, side: b.side });
  }
  // A balcony the wall swallowed (a thick, noisy wall on a small map) is no refugio.
  p.refugios = p.refugios.filter(r => !r.wall || !solidAt(mask, r.x, r.y + 1));
  // Stalagmites on the floor, kept off the ponds, the simas' mouths and the doorways.
  const clear = x => p.valleys.some(v => v.kind === 'pond' && Math.abs(x - v.x) < v.floor) || p.refugios.some(r => r.open !== undefined && Math.abs(x - r.open) < 3)
    || c.columns.some(col => Math.abs(x - col.x) < col.w + 1.5) || Math.min(x, w - x) < wall + 2;
  for (const m of c.mites) {
    if (clear(m.x)) continue;
    const y = floorAt(m.x); if (y === null) continue;
    m.y = y;
    for (let k = 0; k < 6; k++) fill(mask, m.x, y - .1 + m.h * k / 6, m.r * (1 - k / 6.5));
    p.rocks.push({ x0: m.x - m.r, x1: m.x + m.r, y0: y - .3, y1: y + m.h + .3, boulder: true });
  }
}

// ---------- the map ----------

export function generateTepuyMap(seed = 1, size = 'medium', style = 'w', shape = {}) {
  const p = planTepuy(seed, size, style, shape), { mask, loose } = buildTepuy(p);
  p.ruins = shape.ruins ? buildRuins(p, mask, shape.ruins) : null;
  const spawns = spawnsOf(p, mask);
  const start = mask.solid.slice(); for (let i = 0; i < start.length; i++) start[i] |= mask.hollow[i];
  const map = { id: `tepuy-${p.style}`, name: TEPUY_STYLES[p.style].title, seed, size, width: mask.width, height: mask.height, cell: TEPUY_CELL,
    water: TEPUY_WATER, kind: p.cave ? 'fosa' : 'terrazas', style: p.style, cave: !!p.cave, plan: p, spawns, start, loose: loose.removed, ruin: p.ruins?.cells || null };
  return { map, mask };
}

// Six spawns: a free-for-all puts one capi in each tepuy's refugio; the V
// gives the left three tepuyes to team 0 and the right three to team 1; La
// caves use up to four refugios in their walls (two a side, the lowest first)
// and the simas of their highest floors for the rest.
function spawnsOf(p, mask) {
  const stand = (x, y) => { const g = solidAt(mask, x, y - .05) ? y : (surfaceY(mask, x) ?? y); return g; };
  if (p.cave) {
    const walls = [-1, 1].flatMap(side => p.refugios.filter(r => r.wall && r.side === side && !solidAt(mask, r.x, r.y + 1)).sort((a, b) => a.y - b.y).slice(0, 2));
    const tops = p.refugios.filter(r => !r.wall).sort((a, b) => p.mesas[b.mesa].T - p.mesas[a.mesa].T).slice(0, 6 - walls.length);
    return [...walls, ...tops].sort((a, b) => a.x - b.x).map((r, i) => ({ x: r.x, y: r.y, team: i, shelter: r.wall ? r.name : `Sima de ${r.name}` })); // i18n-ignore: authored place name
  }
  // More refugios than capis (the archipiélago's eight): six spread along the row, both ends kept.
  const pick = p.refugios.length > 6 ? [0, 1, 2, 3, 4, 5].map(k => p.refugios[Math.round(k * (p.refugios.length - 1) / 5)]) : p.refugios;
  return pick.map((r, i) => ({ x: r.x, y: stand(r.x, r.y + .05), team: p.style === 'v' ? (i < 3 ? 0 : 1) : i, shelter: `Sima de ${r.name}` })); // i18n-ignore: authored place name
}

// 0..1 rock at (x, y) for the painter: the caps, arches, boulders, the floors of the refugios.
export function tepuyRockAt(map, x, y) {
  if (map.ruin && map.ruin[Math.floor(y / map.cell) * Math.round(map.width / map.cell) + Math.floor(x / map.cell)]) return 1;
  let k = 0;
  for (const b of map.plan.rocks) {
    if (x < b.x0 || x > b.x1) continue;
    if (b.span) { const s = b.span, t = clamp((x - s.a.x) / (s.b.x - s.a.x)), sy = lerp(s.a.y, s.b.y, t) + Math.sin(t * Math.PI) * s.arc; if (Math.abs(y - sy) < s.radius + .45) k = Math.max(k, .8); }
    else if (y > b.y0 && y < b.y1) k = Math.max(k, (b.boulder ? .9 : .85) * clamp((b.y1 - y) * 3) * clamp((y - b.y0) * .8));
  }
  // Inside a cave the walls and the roof are the tepuy's own rock.
  const c = map.plan.cave;
  if (c) { const e = Math.min(x, map.width - x); if (e < c.wall + 1 || (map.plan.roof && y > map.plan.roof.low - 6)) k = Math.max(k, .78); }
  return k;
}

const STRATA_OF = {
  w: { topsoil: [64, 46, 38], ash: [214, 184, 160], clay: [176, 106, 82], pumice: [226, 204, 182], ochre: [196, 140, 92], loam: [150, 92, 72], base: [96, 58, 48], seam: [78, 58, 56] },
  fosa: { topsoil: [47, 56, 49], ash: [143, 148, 135], clay: [111, 117, 104], pumice: [153, 156, 140], ochre: [88, 91, 73], loam: [95, 105, 93], base: [44, 52, 50], seam: [53, 60, 55] },
  // Guano-dark earth and ochre limestone.
  guacharo: { topsoil: [46, 34, 26], ash: [168, 138, 104], clay: [130, 90, 60], pumice: [186, 160, 124], ochre: [158, 112, 66], loam: [108, 78, 56], base: [52, 38, 30], seam: [80, 56, 40] },
  // Mossy sandstone, the sinkhole's wet walls.
  sima: { topsoil: [44, 46, 32], ash: [190, 172, 150], clay: [150, 102, 82], pumice: [206, 196, 176], ochre: [168, 138, 92], loam: [118, 96, 74], base: [70, 60, 50], seam: [62, 74, 50] },
  // Blue-grey quartzite with violet seams.
  cristal: { topsoil: [38, 44, 56], ash: [138, 150, 172], clay: [96, 106, 130], pumice: [170, 180, 200], ochre: [116, 112, 150], loam: [82, 92, 114], base: [34, 38, 52], seam: [92, 70, 138] },
};
STRATA_OF.v = STRATA_OF.w;

// The cut face's layers: Roraima quartzite (pinkish sandstone, grey beds,
// dark algae seams) over red laterite at the foot.
export function tepuyStrata(seed, style = 'w') {
  const r = seededStream(`tepuy-strata:${seed}:${style}`), warm = (r() - .5) * .06;
  const base = STRATA_OF[style] || STRATA_OF.w;
  const out = {};
  for (const [key, rgb] of Object.entries(base)) out[key] = rgb.map((v, i) => Math.round(clamp(v * (1 + warm * (1 - i)) * (1 + (r() - .5) * .06), 0, 255)));
  return Object.assign(out, { period: +(3.4 + r() * 1.4).toFixed(3), fold: CAVES[style] && style !== 'sima' ? .06 : +(.12 + r() * .12).toFixed(3), tilt: +((r() - .5) * .03).toFixed(4), phase: +(r() * 100).toFixed(2) });
}

// ---------- figures: maps with a name and a purpose ----------
// A figure is a style, a seed and the shape it pins: the same figure always
// builds the same layout, so a designer (or a playlist) can ask for "El Cañón"
// and know what it gets. The ambient (sky, colours, particles) is chosen apart.
//   ambient  the look it was made with (the studio uses it when the ambient is automatic)
export const TEPUY_FIGURES = Object.freeze([
  { id: 'corona', name: locKey('La Corona'), style: 'w', seed: 1201, ambient: 'atardecer', play: locKey('Tres picos y dos hondonadas: el del medio domina, las puntas lo vigilan.'), shape: { heights: [1, .3, .95, .95, .3, 1], valleys: ['v', 'v', 'notch', 'v', 'v'] } },
  { id: 'escalera', name: locKey('La Escalera'), style: 'w', seed: 3307, ambient: 'mediodia', play: locKey('Sube de un lado al otro: quien empieza abajo dispara cuesta arriba.'), shape: { heights: [.05, .25, .45, .65, .85, 1], valleys: ['flat', 'notch', 'flat', 'notch', 'flat'] } },
  { id: 'canon', name: locKey('El Cañón'), style: 'w', seed: 4410, ambient: 'atardecer', play: locKey('Dos mesetas altas y una laguna honda al medio, cruzada por un arco.'), shape: { heights: [.55, .75, 1, 1, .75, .55], valleys: ['v', 'flat', 'pond', 'flat', 'v'] } },
  { id: 'sierra', name: locKey('Dientes de Sierra'), style: 'w', seed: 5150, ambient: 'tormenta', play: locKey('Alto, bajo, alto: cada capi alto tiene uno bajo al lado para emboscar.'), shape: { heights: [1, .2, 1, .2, 1, .2], valleys: ['v', 'v', 'v', 'v', 'v'] } },
  { id: 'caroni', name: locKey('Islas del Caroní'), style: 'w', seed: 6208, ambient: 'noche', play: locKey('Tres lagunas con arcos: los puentes son los únicos pasos.'), shape: { heights: [.5, .4, .65, .45, .6, .5], valleys: ['pond', 'v', 'pond', 'v', 'pond'] } },
  { id: 'lomo', name: locKey('El Lomo'), style: 'w', seed: 7777, ambient: 'neblina', play: locKey('El centro es un lomo alto: quien lo toma ve todo el mapa.'), shape: { heights: [.25, .55, 1, 1, .55, .25], valleys: ['flat', 'notch', 'v', 'notch', 'flat'] } },
  { id: 'granv', name: locKey('La Gran V'), style: 'v', seed: 8008, ambient: 'atardecer', play: locKey('Dos equipos en lo alto, el valle con laguna al medio.'), shape: { heights: [1, .58, .12, .12, .58, 1], valleys: ['v', 'notch', 'pond', 'notch', 'v'] } },
  { id: 'murallas', name: 'Doble Muralla', style: 'v', seed: 9119, ambient: 'candela', play: locKey('Cada base tiene una muralla delante: hay que tirar por encima.'), shape: { heights: [.55, 1, .15, .15, 1, .55], valleys: ['flat', 'v', 'pond', 'v', 'flat'] } },
  { id: 'fosa', name: locKey('La Fosa'), style: 'fosa', seed: 6, ambient: 'esmeralda', play: locKey('Cuatro mesetas bajo la abertura de luz, balcones en las paredes.'), shape: { heights: [.7, .3, .3, .7], valleys: ['notch', 'pond', 'v'] } },
  { id: 'hormiguero', name: locKey('El Hormiguero'), style: 'guacharo', seed: 2424, ambient: 'ambar', play: locKey('Terrazas con escaleras en las paredes y un arroyo al medio.'), shape: { heights: [.9, .3, .6, .3, .9], valleys: ['notch', 'flat', 'pond', 'flat'] } },
  { id: 'rio', name: locKey('Río de Cristal'), style: 'cristal', seed: 1313, ambient: 'cristal', play: locKey('Islas sobre el río y arcos entre ellas: casi todo es agua.'), shape: { heights: [.4, .8, .5, .8, .4], valleys: ['pond', 'notch', 'pond', 'pond'] } },
  { id: 'olla', name: locKey('La Olla'), style: 'sima', seed: 5005, ambient: 'mediodia', play: locKey('Un hoyo a cielo abierto: los balcones arriba, la selva abajo.'), shape: { heights: [1, .2, .2, 1], valleys: ['flat', 'pond', 'flat'] } },
  // La Ciudad Perdida: figures that come with their ruins
  { id: 'ciudad', name: locKey('La Ciudad Perdida'), style: 'w', seed: 1919, ambient: 'perdida', ruins: { style: 'colosal', amount: 'muchas' }, play: locKey('Plazas de piedra sobre los tepuyes y torres en las puntas, a los pies de una ciudad de gigantes.'), shape: { heights: [.9, .5, .75, .75, .5, .9], valleys: ['flat', 'notch', 'flat', 'notch', 'flat'] } },
  { id: 'saladorada', name: locKey('La Sala Dorada'), style: 'fosa', seed: 2020, ambient: 'dorado', ruins: { style: 'colosal', amount: 'muchas' }, play: locKey('Dentro del tepuy, un salón de columnas, cadenas y una puerta de engranajes bajo la luz.'), shape: { heights: [.75, .3, .3, .75], valleys: ['flat', 'pond', 'flat'] } },
  { id: 'escalinata', name: locKey('La Gran Escalinata'), style: 'v', seed: 2121, ambient: 'dorado', ruins: { style: 'colosal', amount: 'muchas' }, play: locKey('Dos equipos en lo alto de escalinatas de piedra, la laguna al medio y el guardián mirando.'), shape: { heights: [1, .62, .2, .2, .62, 1], valleys: ['flat', 'notch', 'pond', 'notch', 'flat'] } },
  // Todos contra todos
  { id: 'morochos', name: locKey('Los Morochos'), style: 'w', seed: 1515, ambient: 'mediodia', play: locKey('Dos picos gemelos y una laguna entre ellos: dos reyes, un trono.'), shape: { heights: [.3, 1, .35, .35, 1, .3], valleys: ['v', 'v', 'pond', 'v', 'v'] } },
  { id: 'hamaca', name: locKey('La Hamaca'), style: 'w', seed: 2626, ambient: 'atardecer', play: locKey('Las puntas altas y el medio colgando: todos tiran hacia abajo.'), shape: { heights: [1, .7, .25, .25, .7, 1], valleys: ['flat', 'v', 'flat', 'v', 'flat'] } },
  { id: 'serrucho', name: locKey('El Serrucho'), style: 'w', seed: 3737, ambient: 'tormenta', play: locKey('Dientes que suben: cada pico es más alto que el de atrás.'), shape: { heights: [.15, .45, .25, .7, .5, 1], valleys: ['notch', 'notch', 'notch', 'notch', 'notch'] } },
  { id: 'sabana', name: locKey('La Sabana'), style: 'w', seed: 4848, ambient: 'mediodia', play: locKey('Tepuyes bajos y valles anchos: el mapa para aprender a tirar.'), shape: { heights: [.15, .2, .1, .2, .15, .1], valleys: ['flat', 'flat', 'flat', 'flat', 'flat'] } },
  { id: 'abismos', name: locKey('Los Abismos'), style: 'w', seed: 5959, ambient: 'neblina', play: locKey('Todo alto y grietas hondas entre cada tepuy: un mal salto cuesta caro.'), shape: { heights: [1, .85, 1, .9, 1, .85], valleys: ['notch', 'v', 'notch', 'v', 'notch'] } },
  { id: 'archipielago', name: locKey('Archipiélago'), style: 'archipielago', seed: 6060, ambient: 'mediodia', play: locKey('Ocho islotes: cuatro lagunas con arcos y sitio para esconderse.'), shape: { heights: [.6, .35, .8, .3, .7, .4, .9, .5], valleys: ['pond', 'v', 'pond', 'flat', 'pond', 'v', 'pond'] } },
  { id: 'rosario', name: locKey('El Rosario'), style: 'archipielago', seed: 7171, ambient: 'noche', play: locKey('Cuentas de un collar: ocho tepuyes iguales unidos por siete arcos.'), shape: { heights: [.5, .5, .5, .5, .5, .5, .5, .5], valleys: ['pond', 'pond', 'pond', 'pond', 'pond', 'pond', 'pond'] } },
  // Equipos
  { id: 'embudo', name: locKey('El Embudo'), style: 'v', seed: 8282, ambient: 'ambar', play: locKey('Tres escalones parejos por equipo bajando a un valle seco.'), shape: { heights: [1, .66, .33, .33, .66, 1], valleys: ['flat', 'flat', 'flat', 'flat', 'flat'] } },
  { id: 'disputado', name: locKey('El Cerro Disputado'), style: 'v', seed: 9393, ambient: 'candela', play: locKey('Al revés de la V: las bases abajo y un cerro alto al medio que todos quieren.'), shape: { heights: [.25, .55, 1, 1, .55, .25], valleys: ['flat', 'v', 'notch', 'v', 'flat'] } },
  { id: 'enfrentadas', name: 'Islas Enfrentadas', style: 'v', seed: 1717, ambient: 'cristal', play: locKey('Cada equipo en sus islas, tres lagunas con arcos de por medio.'), shape: { heights: [.8, .5, .3, .3, .5, .8], valleys: ['pond', 'v', 'pond', 'v', 'pond'] } },
  // Cuevas
  { id: 'catedral', name: locKey('La Catedral'), style: 'fosa', seed: 2828, ambient: 'esmeralda', play: locKey('Dos torres junto a las paredes y dos lagunas abajo, bajo la luz.'), shape: { heights: [1, .15, .15, 1], valleys: ['pond', 'v', 'pond'] } },
  { id: 'tunel', name: locKey('El Túnel'), style: 'guacharo', seed: 3939, ambient: 'noche', play: locKey('Piso bajo y parejo, terrazas altas: la pelea es de pared a pared.'), shape: { heights: [.15, .25, .2, .25, .15], valleys: ['flat', 'flat', 'flat', 'flat'] } },
  { id: 'geoda', name: locKey('La Geoda'), style: 'cristal', seed: 4040, ambient: 'rumba', play: locKey('Una isla alta al centro rodeada de río: quien la toma brilla.'), shape: { heights: [.15, .55, 1, .55, .15], valleys: ['notch', 'pond', 'pond', 'notch'] } },
  { id: 'colina', name: locKey('La Colina del Hoyo'), style: 'sima', seed: 5151, ambient: 'neblina', play: locKey('Dentro de la sima, una colina alta al medio y los balcones mirando.'), shape: { heights: [.45, 1, 1, .45], valleys: ['flat', 'notch', 'flat'] } },
]);
export const tepuyFigure = id => TEPUY_FIGURES.find(f => f.id === id) || null;

// What a test or the studio reads: the tepuyes, the valleys, the refugios.
export function describeTepuy(map) {
  const p = map.plan;
  return {
    style: p.style, pattern: p.pattern || null,
    tepuyes: p.mesas.map(m => ({ name: m.name, x: +m.cx.toFixed(1), top: +m.T.toFixed(1) })),
    valleys: p.valleys.filter(v => !v.end).map(v => v.kind),
    refugios: p.refugios.length, caves: p.caves.length, arches: p.spans.length,
  };
}
