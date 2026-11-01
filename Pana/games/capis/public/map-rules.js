// The Llanos riverbank, a new one every match: generated from a seed and a
// size, pure and deterministic (no Math.random, no clock), so the same seed
// builds the same cells in the browser, in Node tests, for the bot and on a
// future server that only sends the seed.
//
// The design is a profile across the map, mirrored about the middle so neither
// team starts with better ground: a beach or a cliff with a sandbar at each
// end, a bank of rolling hills on each side, and a river in the middle that the
// shells must cross. The middle is one of three kinds (the seed decides):
//   tepuy  El Tepuyito: a rock tower with an overhanging cap on a mound, caves
//          dug into the mound from each side, a caño below the water each side
//   island a wide river with a sandbar or a rocky islet in the middle
//   river  a wide, plain river between the banks
// and each bank gets one to three mirrored landmarks: a mesa (a flat-topped
// butte with a steep, overhung face and a walkable ramp behind), a rock arch
// over a dip, or a knoll with a cave you can walk into. Small detail (the
// ripples of the ground, the tower's top) is not mirrored, so the two sides
// look natural, not copied.
//
// A map that fails its checks (a spawn without room, no channel, the sides
// unfair, the front capis unable to reach each other, a floating piece) is
// built again from the next attempt of the same seed, so a replayed seed
// always gives the same map; the last attempt is a plain river, which passes.
import { createMask, fillHeights, carve, fill, solidAt, surfaceY } from '../../../engine/play/terrain-mask.js';
import { fbm2, smoothstep, lerp, clamp } from '../../../engine/random.js';
import { seededStream, bumps, dropFloating, walkSpans, walkTo, topLine, skyExposure } from '../../../engine/play/terrain-gen.js';
import { simulateFlight, aimVelocity } from '../../../engine/play/ballistic.js';
import { RULES, muzzle } from './rules.js';

export const MAP_SIZES = Object.freeze({
  small: Object.freeze({ width: 100, height: 46 }),
  medium: Object.freeze({ width: 140, height: 52 }),
  large: Object.freeze({ width: 180, height: 58 }),
});
export const DEFAULT_SIZE = 'medium';
export const WATER = 4.2, CELL = .1, ATTEMPTS = 8;
export const MAP_NAME = 'Orilla del llano'; // i18n-ignore: a place name
// Seeds are 1..99999, short enough to read out ("Mapa #12345").
export const SEED_LIMIT = 100000;
export const mapSeed = value => { const n = Math.floor(Math.abs(Number(value))); return Number.isFinite(n) && n > 0 ? (n % SEED_LIMIT || 1) : null; };
export const mapSize = id => Object.hasOwn(MAP_SIZES, id) ? id : DEFAULT_SIZE;

// What the checks accept (tested over many seeds in tests/map-rules.test.js).
export const FAIR = Object.freeze({ height: 1.2, meanHeight: .8, exposure: .25, meanExposure: .12, span: 6, reach: 2.6 });
const SPREAD = .36;      // a team's three capis cover this share of the half map, from the front back
const GAP = { small: 5, medium: 7, large: 8 };   // the least room between two capis of a team

// ---------- the plan: every number the map is built from ----------

export function planMap(seed, size, attempt = 0) {
  const { width, height } = MAP_SIZES[size], half = width / 2, r = seededStream(`capis-map:${seed}:${size}:${attempt}`);
  const between = (a, b) => a + (b - a) * r(), scale = width / 140, fit = Math.min(1, .7 + .3 * scale);
  const plain = attempt >= ATTEMPTS - 1, roll = r();
  const kind = plain ? 'river' : roll < .45 ? 'tepuy' : roll < .75 ? 'island' : 'river';
  const p = { seed, size, attempt, width, height, half, mid: half, kind, bank: between(21.5, 24.5),
    lf: { a: between(0, 90), b: between(0, 90), amp: between(5, 7) }, detail: between(0, 900),
    valley: { depth: between(5, 8.5), run: between(26, 36) * fit } };
  p.shore = r() < .55 ? { style: 'beach', run: between(9.5, 12.5) * fit } : { style: 'cliff', run: between(6.5, 8.5) * fit, bar: between(1.5, 2.1), top: between(.6, 1.1) };
  if (kind === 'tepuy') {
    const c = { cano: between(11, 12.4), canoHalf: between(1.5, 1.9), slope: between(1.8, 2.3), foot: WATER + between(3.4, 4.4), mound: between(8, 10) };
    c.tower = { half: between(3, 3.6), top: p.bank + between(10, 13) };
    c.caves = r() < .85;
    p.center = c; p.inner = c.cano + c.canoHalf + (bankHeight(p, c.cano + 6) - WATER) / c.slope;
  } else {
    const c = { river: between(6.5, 9) + (scale - 1) * 2.2, run: between(14, 17) * fit };
    if (kind === 'island') c.island = r() < .5 ? { type: 'sandbar', half: between(3.2, 4.6), top: WATER + between(.9, 1.6) } : { type: 'islet', half: between(3, 4.2), top: WATER + between(3.2, 5) };
    p.center = c; p.inner = c.river + .71 * c.run;
  }
  const outer = half - p.shore.run - 2;
  // Rolling hills and hollows on the banks, mirrored.
  p.hills = [];
  for (let i = 0, n = 2 + Math.floor(r() * 3 * scale); i < n; i++) {
    const height = between(-4.5, 7.5) * fit, width = Math.max(5, 1.5 * Math.abs(height)) + between(0, 6);
    p.hills.push({ at: between(p.inner + 2, outer - 2), height, width });
  }
  // Landmarks on the banks, mirrored, kept apart from each other.
  p.features = [];
  const count = plain ? 0 : kind === 'tepuy' ? Math.floor(r() * 2) : 1 + Math.floor(r() * (size === 'small' ? 1.6 : 2.6));
  for (let i = 0, tries = 0; i < count && tries < 30; tries++) {
    // A small map has no room for a cave's knoll beside three capis.
    const types = size === 'small' ? ['mesa', 'arch'] : ['mesa', 'arch', 'cave'], type = types[Math.floor(r() * types.length)], at = between(p.inner + 4, outer - 5);
    // A mesa's ramp runs about 10 units behind it: keep it clear of the next landmark's face.
    if (p.features.some(f => Math.abs(f.at - at) < (f.type === 'mesa' || type === 'mesa' ? 17 : 11))) continue;
    if (type === 'mesa') p.features.push({ type, at, top: between(2.6, 4), rise: between(7.5, 11), steep: 'in', cap: r() < .7 });
    else if (type === 'arch') p.features.push({ type, at, span: between(5.4, 6.6), dip: between(3, 3.8), thick: between(.6, .7) });
    else {
      const f = { type, at, height: between(6, 7.4), width: between(5.6, 6.6), radius: between(1.15, 1.25), side: r() < .7 ? 1 : -1 };
      p.hills.push({ at, height: f.height, width: f.width }); p.features.push(f);
    }
    i++;
  }
  // Heights the landmarks stand on (before the landmarks themselves).
  for (const f of p.features) {
    if (f.type === 'mesa') { f.base = bankHeight(p, f.at); f.T = f.base + f.rise; }
    if (f.type === 'arch') f.y = Math.min(bankHeight(p, f.at - f.span / 2), bankHeight(p, f.at + f.span / 2)) - .9;
  }
  return p;
}

// The bank at distance d from the middle: rolling ground and hills (mirrored).
function bankHeight(p, d) {
  // The banks fall towards the river, so the back capis stand on the high ground.
  const valley = p.valley ? p.valley.depth * (1 - smoothstep(d / p.valley.run)) : 0;
  return p.bank - valley + (fbm2(d * .045 + p.lf.a, p.lf.b, { octaves: 3 }) - .5) * p.lf.amp + bumps(d, p.hills || []);
}

function mesaHeight(f, d, h) {
  const steepEdge = f.steep === 'in' ? f.at - f.top : f.at + f.top, rampEdge = f.steep === 'in' ? f.at + f.top : f.at - f.top;
  const out = Math.sign(steepEdge - rampEdge);
  if (Math.abs(d - f.at) <= f.top) return Math.max(h, f.T);
  if (Math.sign(d - f.at) === out) {
    const s = Math.abs(d - steepEdge), shoulder = clamp(1 - s / 1.1);
    return Math.max(h, lerp(h, f.T, smoothstep(shoulder)));
  }
  return Math.max(h, f.T - Math.abs(d - rampEdge) * .62);
}

// Ground height at x: the top of the heightfield (caps, the arch and the caves come after).
function heightAt(p, x) {
  const d = Math.abs(x - p.mid);
  // Detail of its own on each side (not mirrored), so the banks do not look copied.
  let h = bankHeight(p, d) + (fbm2(x * .3 + p.detail, 7.7, { octaves: 2 }) - .5) * .7 + (fbm2(x * .11 + p.detail, 2.3, { octaves: 2 }) - .5) * 1.6;
  for (const f of p.features) {
    if (f.type === 'mesa') h = mesaHeight(f, d, h);
    if (f.type === 'arch') h -= f.dip * Math.exp(-(((d - f.at) / (f.span * .48)) ** 2));
  }
  const c = p.center;
  if (p.kind === 'tepuy') {
    if (d < c.cano) {
      // The mound: never steeper than a capi climbs; El Tepuyito on top with near-vertical shoulders.
      const from = c.cano - c.canoHalf - .5, to = c.tower.half + 1.6, rise = clamp((from - d) / (from - to));
      h = c.foot + c.mound * (.6 * rise + .4 * smoothstep(rise)) + (fbm2(x * .25 + p.detail, 3.1) - .5) * .4;
      const shoulder = clamp((c.tower.half + 1.1 - d) / 1.1);
      h = Math.max(h, lerp(h, c.tower.top + (fbm2(x * .7, 3) - .5) * .8, smoothstep(shoulder)));
    }
    // The caño: a channel below the water, its banks at `slope`.
    // (On the mound's side it only steepens the foot, never the tower.)
    const dd = Math.abs(d - c.cano), channel = dd <= c.canoHalf ? WATER - 2.2 + 2.2 * (dd / c.canoHalf) ** 2 : d < c.cano && dd > c.canoHalf + 4 ? Infinity : WATER + (dd - c.canoHalf) * (d < c.cano ? 3 : c.slope);
    h = Math.min(h, channel);
  } else {
    h = lerp(WATER - 2.4, h, smoothstep((d - (c.river - .29 * c.run)) / c.run));
    const i = c.island;
    if (i?.type === 'sandbar') { const bar = 1 - (d / i.half) ** 2; if (bar > 0) h = Math.max(h, WATER - 2.4 + (i.top - WATER + 2.4) * Math.sqrt(bar)); }
    if (i?.type === 'islet') { const k = 1 - (d / (i.half + 1.6)) ** 2; if (k > 0) h = Math.max(h, WATER - 2.4 + (i.top - WATER + 2.4 + (fbm2(x * .6 + p.detail, 5) - .5) * .5) * k ** .45); }
  }
  // The ends: a soft beach into the water, or a cliff with a sandbar off it.
  const s = p.shore;
  if (s.style === 'beach') {
    // A sandy beach a capi can walk up from the water, then the bank's earth slope above it.
    const t = clamp((p.half - 1 - d) / (s.run - 1)), u = clamp(t / .55);
    if (t < 1) h = Math.min(h, t < .55 ? WATER - 2.5 + 5.1 * (.75 * u + .25 * smoothstep(u)) : lerp(WATER + 2.6, h, smoothstep((t - .55) / .45)));
  } else {
    const face = p.half - s.run;
    h = lerp(WATER - 2.6, h, clamp((face + .6 - d) / .6));
    const bar = 1 - ((d - (face + s.run * .55)) / s.bar) ** 2;
    if (bar > 0) h = Math.max(h, WATER - 2.6 + (2.6 + s.top) * Math.sqrt(bar));
  }
  return clamp(h, -1, p.height - 4);
}

// ---------- the cells ----------

export function buildGround(p) {
  const mask = createMask({ width: p.width, height: p.height, cell: CELL }), { mid } = p, c = p.center;
  fillHeights(mask, x => heightAt(p, x));
  const sides = [-1, 1];
  // El Tepuyito's cap juts out over both sides; under the lips the rock is cut back.
  if (p.kind === 'tepuy') for (const side of sides) {
    const t = c.tower;
    fill(mask, mid + side * (t.half + 1.3), t.top - .55, .95);
    fill(mask, mid + side * (t.half + .7), t.top - .3, .9);
    carve(mask, mid + side * (t.half + 1.9), t.top - 2.6, 1.15);
  }
  for (const f of p.features) for (const side of sides) {
    const at = d => mid + side * d;
    if (f.type === 'mesa' && f.cap) {
      // The mesa's steep face is overhung by its cap, like a tepuy.
      const edge = f.steep === 'in' ? f.at - f.top : f.at + f.top, out = f.steep === 'in' ? -1 : 1;
      fill(mask, at(edge + out * 1.25), f.T - .5, .85); fill(mask, at(edge + out * .6), f.T - .3, .8);
      carve(mask, at(edge + out * 1.85), f.T - 2.4, 1.05);
    }
    if (f.type === 'arch') for (let d = f.at - f.span / 2; d <= f.at + f.span / 2; d += .2) {
      // A thin span of rock over the dip, thickest at its ends.
      const t = (d - f.at + f.span / 2) / f.span, sag = Math.sin(t * Math.PI) * .7;
      fill(mask, at(d), f.y - sag, f.thick + .5 * Math.abs(t - .5) ** 1.5 * 4);
    }
  }
  // The caves and the river's notch are hollows: the scene gives them a back wall.
  const before = mask.solid.slice();
  if (p.kind === 'tepuy' && c.caves) for (const side of sides) {
    // A cave into the mound from each side, its mouth low on the mound's
    // flank, ending in a thin wall under the tower.
    const reach = c.tower.half + 5, floor = heightAt(p, mid + side * reach), radius = 1.15;
    for (let d = reach + .5; d >= .8 + radius; d -= .25) carve(mask, mid + side * d, floor + radius - .25, radius);
  }
  for (const f of p.features) if (f.type === 'cave') {
    // A cave into the knoll: its floor well under the knoll's top, its mouth
    // where the knoll's flank comes down to that floor, so it is walked into.
    const floor = heightAt(p, mid - f.at) - Math.max(3.8, f.height * .8);
    let mouth = null;
    for (let d = f.at; Math.abs(d - f.at) < f.width * 3; d += f.side * .25) if (heightAt(p, mid - d) <= floor + .4) { mouth = d; break; }
    if (mouth === null) continue;
    f.floor = floor; f.mouth = mouth;
    for (const side of sides) for (let d = mouth; f.side > 0 ? d >= f.at - f.width * .25 : d <= f.at + f.width * .25; d -= f.side * .25) {
      carve(mask, mid + side * d, floor + f.radius - .25, f.radius);
    }
  }
  if (p.shore.style === 'cliff') for (const side of sides) {
    // The river has eaten a notch under each cliff, leaving its top as an overhang.
    const face = p.half - p.shore.run;
    carve(mask, mid + side * (face - .4), WATER + 2.3, 1.9);
  }
  mask.hollow = before.map((v, i) => v & (1 - mask.solid[i]));
  if (p.shore.style === 'cliff') for (const side of sides) {
    const face = p.half - p.shore.run;
    fill(mask, mid + side * (face - .5), heightAt(p, mid + side * (face - 1.4)) - .6, .75);
  }
  const loose = dropFloating(mask, 1500);
  return { mask, loose };
}

// ---------- spawns and checks ----------

// Can a capi stand at x and start a match there? Open ground above the water,
// not steep, with sky over it.
export function standable(mask, x) {
  const y = surfaceY(mask, x);
  if (y === null || y < WATER + 2.5) return null;
  const l = surfaceY(mask, x - .6), r = surfaceY(mask, x + .6);
  if (l === null || r === null || Math.abs(r - l) > 1.25 || Math.abs(surfaceY(mask, x - 1.4) - y) > 2 || Math.abs(surfaceY(mask, x + 1.4) - y) > 2) return null;
  return skyExposure(mask, x, y + 1) >= .5 ? y : null;
}

// Three spawns a side, front to back, each mirrored on the other bank: slot 0
// is the front capi (nearest the river), so each team's first shot is a lob
// across the water.
export function spawnsFor(p, mask) {
  const r = seededStream(`capis-spawns:${p.seed}:${p.size}:${p.attempt}`), gap = GAP[p.size];
  const ok = d => standable(mask, p.mid - d) !== null && standable(mask, p.mid + d) !== null;
  let front = null;
  for (let d = p.inner; d < p.half - p.shore.run - 2; d += .25) if (ok(d) && ok(d + 1)) { front = d + .5; break; }
  if (front === null) return null;
  // Every spot both banks can stand on, from the front back; the front capi
  // takes the first, the back one the last within the team's stretch, the
  // middle one the spot nearest halfway (each a little jittered by the seed).
  const back = Math.min(p.half - p.shore.run - 2, front + SPREAD * p.half), spots = [];
  for (let d = front; d <= back; d += .25) if (ok(d)) spots.push(d);
  const near = (target, keep) => spots.filter(keep).sort((a, b) => Math.abs(a - target) - Math.abs(b - target))[0] ?? null;
  const first = near(front + r() * 1.5, () => true);
  if (first === null) return null;
  const lean = back - r() * 2, half = r() - .5;
  // The back spot nearest the end of the stretch that still leaves room for a middle one.
  for (const last of spots.filter(d => d - first >= 2 * gap).sort((a, b) => Math.abs(a - lean) - Math.abs(b - lean))) {
    const middle = near((first + last) / 2 + half * 3, d => d - first >= gap && last - d >= gap);
    if (middle !== null) return [[first, middle, last].map(d => p.mid - d), [first, middle, last].map(d => p.mid + d)];
  }
  return null;
}

// The coarse shot search the checks use: does a shot from a capi standing at
// `from` land within `within` of `to`, with no wind? (The bot's search is finer.)
export function reachable(mask, from, to, { wind = 0, within = FAIR.reach } = {}) {
  const facing = to.x >= from.x ? 1 : -1, shooter = { x: from.x, y: from.y };
  const options = { wind, solid: (x, y) => solidAt(mask, x, y), targets: [], radius: RULES.radius, bounds: { water: WATER - .3, left: -20, right: mask.width + 20 } };
  for (let angle = .1; angle <= 1.42; angle += .06) for (let power = .3; power <= 1.0001; power += .025) {
    const start = { ...muzzle(shooter, angle, facing), ...aimVelocity(angle, facing, power * RULES.speed) };
    const end = simulateFlight(start, options, { dt: 1 / 60, maxTime: 7, every: 1e9 });
    if (end.hit === 'ground' && Math.hypot(end.x - to.x, end.y - to.y) < within) return { angle, power };
  }
  return null;
}

// The numbers the checks read, per spawn: height, open sky, room to walk,
// distance to the water and to the middle.
export function spawnStats(map, mask) {
  const spans = walkSpans(mask, { water: WATER }), top = topLine(mask);
  const waterAt = x => { for (let k = 0; k < 400; k++) for (const s of [-1, 1]) { const y = surfaceY(mask, x + s * k * .25); if (y === null || y < WATER) return k * .25; } return 100; };
  return map.spawns.map(xs => xs.map(x => {
    const y = surfaceY(mask, x), id = spans.at(x), s = spans.spans[id];
    // Where this capi gets walking towards the river (down ledges included).
    const front = walkTo(mask, x, x < map.width / 2 ? 1 : -1, { water: WATER, top });
    return { x, y, exposure: skyExposure(mask, x, y + 1), span: s ? s.to - s.from : 0, water: waterAt(x), middle: Math.abs(x - map.width / 2), front };
  }));
}

// Why a map is turned down (each is an id, reported by the tests):
//   floating      a piece of ground hangs in the air
//   cramped       no three spots a side to start on
//   dry-middle    no water between the two front capis
//   boxed-in      a spawn with under FAIR.span of ground to walk
//   uneven-height, uneven-sky, unfair   the two sides differ too much
//   out-of-reach  the front capis cannot hit each other with no wind
//   walled-in     a back capi can neither walk to its front nor hit the rivals' front
function check(p, mask, loose, spawns) {
  if (loose.floating.length) return 'floating';
  if (!spawns) return 'cramped';
  const map = { width: p.width, spawns }, stats = spawnStats(map, mask), [a, b] = stats;
  let channel = false;
  for (let x = spawns[0][0]; x <= spawns[1][0] && !channel; x += .25) channel = surfaceY(mask, x) < WATER;
  if (!channel) return 'dry-middle';
  for (const s of stats.flat()) if (s.span < FAIR.span) return 'boxed-in';
  const mean = (list, k) => list.reduce((t, s) => t + s[k], 0) / list.length;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(a[i].y - b[i].y) > FAIR.height) return 'uneven-height';
    if (Math.abs(a[i].exposure - b[i].exposure) > FAIR.exposure) return 'uneven-sky';
  }
  if (Math.abs(mean(a, 'y') - mean(b, 'y')) > FAIR.meanHeight || Math.abs(mean(a, 'exposure') - mean(b, 'exposure')) > FAIR.meanExposure) return 'unfair';
  const at = (team, slot) => ({ x: spawns[team][slot], y: stats[team][slot].y });
  if (!reachable(mask, at(0, 0), { ...at(1, 0), y: at(1, 0).y + .35 }) || !reachable(mask, at(1, 0), { ...at(0, 0), y: at(0, 0).y + .35 })) return 'out-of-reach';
  // Every capi can walk to where its front capi stands (or past it), or shoot the rivals' front from where it gets.
  for (let team = 0; team < 2; team++) for (let slot = 1; slot < 3; slot++) {
    const s = stats[team][slot], front = stats[team][0], dir = team ? -1 : 1;
    if ((s.front - front.x) * dir >= -1) continue;
    const there = { x: s.front, y: surfaceY(mask, s.front) }, rival = at(1 - team, 0);
    if (!reachable(mask, there, { ...rival, y: rival.y + .35 })) return 'walled-in';
  }
  return null;
}

// The map for a seed and a size: { map, mask }. `map` describes it (seed,
// size, kind, spawns, the plan, which attempt passed and why the others
// failed); `mask` is the ground for the match.
export function generateMap(seed = 1, size = DEFAULT_SIZE) {
  seed = mapSeed(seed) ?? 1; size = mapSize(size);
  const rejected = [];
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const p = planMap(seed, size, attempt), { mask, loose } = buildGround(p), spawns = spawnsFor(p, mask);
    const failed = check(p, mask, loose, spawns);
    if (failed && attempt < ATTEMPTS - 1) { rejected.push(failed); continue; }
    const start = mask.solid.slice(); for (let i = 0; i < start.length; i++) start[i] |= mask.hollow[i];
    const map = { id: 'llanos', name: MAP_NAME, seed, size, width: p.width, height: p.height, cell: CELL, water: WATER,
      kind: p.kind, plan: p, spawns, attempt, rejected, failed: failed || null, start, loose: loose.removed };
    return { map, mask };
  }
  throw new Error('unreachable');
}

// ---------- what the earth is made of (for the painter) ----------

// 0..1 rock at (x, y): the tower, the mesas and the islet, the arches, the
// cliffs at the ends, and two wavy strata deep in the bank everywhere.
export function rockAt(map, x, y) {
  const p = map.plan, d = Math.abs(x - p.mid), c = p.center;
  let k = 0;
  if (p.kind === 'tepuy' && d < c.tower.half + 2.4 && y > c.foot + c.mound - .8) k = .85;
  if (c.island?.type === 'islet' && d < c.island.half + 1.4 && y > WATER - 1.5) k = Math.max(k, .8 * clamp((c.island.top - .3 - y) * 2));
  for (const f of p.features) {
    if (f.type === 'mesa' && y > f.base - 1) {
      // The butte's core is rock up to its steep face; under the ramp behind it, rock under a coat of earth.
      const out = d - f.at, toward = f.steep === 'in' ? -1 : 1, behind = Math.max(0, out * -toward - f.top);
      const inside = out * toward <= f.top + 1.6 && behind <= Math.max(0, (f.T - 1.6 - y) / .62);
      if (inside) k = Math.max(k, .85 * clamp((f.T - .35 - y) * 3) * clamp((y - f.base + 1) * .8));
    }
    if (f.type === 'arch' && Math.abs(d - f.at) < f.span / 2 + .6 && Math.abs(y - f.y) < 1.3) k = Math.max(k, .75);
  }
  if (p.shore.style === 'cliff') { const face = p.half - p.shore.run; k = Math.max(k, clamp((d - face + 3) / 2) * .9 * (y > WATER - 1 && d < face + .5 ? 1 : 0)); }
  const wave = Math.sin(x * .21) * .5 + Math.sin(x * .07 + 1) * .9;
  if (Math.abs(y - 7.6 - wave) < .45 || Math.abs(y - 2.9 - wave * .6) < .6 || Math.abs(y - 13.4 - wave * 1.3) < .35) k = Math.max(k, .7);
  return k;
}

// Grass grows only near the ground as it was at the start (caves counted as
// ground), so a crater's floor and the caves' floors are bare earth.
export function grassAt(map, x, y) {
  const { start, cell } = map, cols = Math.round(map.width / cell), rows = start.length / cols, c = Math.floor(x / cell);
  if (c < 0 || c >= cols) return true;
  for (let r = Math.max(0, Math.floor(y / cell) - 1); r <= Math.min(rows - 1, Math.floor((y + .9) / cell)); r++) {
    if (start[r * cols + c] && (r + 1 >= rows || !start[(r + 1) * cols + c])) return true;
  }
  return false;
}
