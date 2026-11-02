// The Llanos, a new stretch of it every match: generated from a seed and a
// size, pure and deterministic (no Math.random, no clock), so the same seed
// builds the same cells in the browser, in Node tests, for the bot and on a
// future server that only sends the seed.
//
// The land runs across the whole map, like a range of hills seen from the
// side: the sea is only under it (the shores at both ends, a pond or a gap
// between islands), never a river that splits every map. The seed picks one
// of five kinds (`KINDS`), each with its own silhouette:
//   cerros    rolling hills with a mesa or two away from the middle (a flat
//             top, a steep face often overhung by its cap, a cave at its
//             foot), sometimes a pond under a natural bridge
//   cuevas    a craggy massif with sheer sides and a tunnel right through
//             its foot, often with a room or two inside
//   islas     tall islands at different heights, undercut by the sea, joined
//             by rock bridges and arches over the water
//   valle     two high sides with sheer cliffs, a natural arch across the
//             valley between them, a pond on its floor and a ledge on a cliff
//   terrazas  a stepped tepuy near the middle, each side its own steps
// plus caves dug into the slopes that fall towards the shores.
//
// Seen from the side, anything that overhangs the only way across (a cave
// mouth, a ledge, a cap) blocks a walker going one way, so the way between
// the teams is always ground a capi can walk both ways: slopes, bridges and
// arches over water or a pit, and tunnels with a mouth at the foot of a sheer
// face. The overhangs and caves stand off that way.
//
// Nothing is mirrored. Fairness is measured instead: after building, each
// team's spawns are compared (height, open sky, cover towards the rivals,
// distance to them, the walk there and back, which capis have a shot) and a
// map outside `FAIR` is built again from the next attempt of the same seed (a
// replayed seed gives the same map). So is a map that is bland (`interest`),
// has a floating piece, a cave no capi can walk into, or teams that cannot
// walk (or hop) to each other. The last attempt is a mirrored range of gentle
// hills, which always passes.
import { createMask, fillHeights, carve, fill, solidAt, surfaceY } from '../../../engine/play/terrain-mask.js';
import { fbm2, smoothstep, lerp, clamp } from '../../../engine/random.js';
import { seededStream, bumps, dropFloating, walkSpans, walkTo, topLine, skyExposure, floorGraph, coverToward, relief } from '../../../engine/play/terrain-gen.js';
import { simulateFlight, aimVelocity } from '../../../engine/play/ballistic.js';
import { RULES, muzzle } from './rules.js';

export const MAP_SIZES = Object.freeze({
  small: Object.freeze({ width: 100, height: 46 }),
  medium: Object.freeze({ width: 140, height: 52 }),
  large: Object.freeze({ width: 180, height: 58 }),
});
export const DEFAULT_SIZE = 'medium';
export const WATER = 4.2, CELL = .1, ATTEMPTS = 10;
export const MAP_NAME = 'Llano adentro'; // i18n-ignore: a place name
// The kinds of map and how often the seed picks each (the last attempt is always 'suave').
export const KINDS = Object.freeze(['cerros', 'cuevas', 'islas', 'valle', 'terrazas']);
const KIND_ODDS = [.24, .2, .18, .2, .18];
// Seeds are 1..99999, short enough to read out ("Mapa #12345").
export const SEED_LIMIT = 100000;
export const mapSeed = value => { const n = Math.floor(Math.abs(Number(value))); return Number.isFinite(n) && n > 0 ? (n % SEED_LIMIT || 1) : null; };
export const mapSize = id => Object.hasOwn(MAP_SIZES, id) ? id : DEFAULT_SIZE;

// What the checks accept (tested over hundreds of seeds in tests/map-rules.test.js).
//   meanHeight  the two teams' mean spawn height
//   front       the two front capis' heights
//   exposure    mean open sky over the spawns
//   cover       mean cover towards the rivals
//   distance    mean distance from each capi to its nearest rival
//   walk        the walk one way over the walk back (ratio)
//   shots       capis with a shot at a rival, one team minus the other
//   span        ground every spawn can walk on, at least
//   reach       a shot that lands this near counts as a shot
//   interest    the least interest score a map needs (see `interestOf`)
export const FAIR = Object.freeze({ meanHeight: 2.6, front: 3.2, exposure: .2, cover: .3, distance: 6, walk: 1.6, shots: 1, span: 6, reach: 2.6, interest: 3.2 });
const SPREAD = .4;       // a team's three capis cover this share of the half map, from the front back
const GAP = { small: 5, medium: 7, large: 8 };   // the least room between two capis of a team
const INNER = { small: 14.5, medium: 16, large: 18 };   // a front capi stands at least this far from the middle

// ---------- the plan: every number the map is built from ----------

export function planMap(seed, size, attempt = 0) {
  const { width, height } = MAP_SIZES[size], r = seededStream(`capis-map:${seed}:${size}:${attempt}`);
  const between = (a, b) => a + (b - a) * r(), scale = width / 140, chance = k => r() < k;
  // The kind belongs to the seed: a re-roll keeps it, only the last attempt is the safe one.
  const k = seededStream(`capis-kind:${seed}:${size}`)();
  let kind = KINDS[KIND_ODDS.findIndex((_, i) => k < KIND_ODDS.slice(0, i + 1).reduce((a, b) => a + b, 0))] || KINDS[0];
  if (attempt >= ATTEMPTS - 1) kind = 'suave';
  const roof = height - 13;   // the highest ground: room above for a lob
  const p = { seed, size, attempt, kind, width, height, scale, mid: width / 2, roof, detail: between(0, 900),
    lf: { a: between(0, 90), b: between(0, 90), amp: between(4, 7), freq: between(.035, .05) },
    hills: [], features: [], bridges: [], tunnels: [], ledges: [], rocks: [] };
  const end = () => chance(.55) ? { style: 'beach', run: between(9, 12) * Math.min(1, .7 + .3 * scale), fall: between(15, 20) }
    : { style: 'cliff', run: between(5.5, 7.5), bar: between(1.5, 2.1), top: between(.6, 1.1), fall: between(6, 12) };
  p.ends = [end(), end()];
  const hillsAlong = (from, to, n, amp) => { for (let i = 0; i < n; i++) { const h = between(-amp * .6, amp); p.hills.push({ at: between(from, to), height: h, width: Math.max(5, 1.6 * Math.abs(h)) + between(0, 6) }); } };
  const lo = p.ends[0].run + 4, hi = width - p.ends[1].run - 4;
  if (kind === 'suave') {
    p.lf.amp = 0;
    p.mirror = true;
    p.base = between(13, 16);
    for (let i = 0, n = 2 + Math.floor(r() * 2); i < n; i++) { const h = between(2.5, 4.5); p.hills.push({ at: between(10, p.mid - 14), height: h, width: 1.8 * h + between(3, 6) }); }
    p.knoll = { height: between(5, 7.5), width: between(9, 13) };
    p.ends[1] = p.ends[0];
  } else if (kind === 'cerros') {
    p.base = between(15, 19); p.lf.amp = between(3, 5.5);
    hillsAlong(lo, hi, 3 + Math.floor(r() * 3 * scale), 6.5);
    // A small map has room for one low mesa at most beside three capis a side.
    const mesas = size === 'small' ? Number(chance(.5)) : 1 + Math.floor(r() * 2.4);
    for (let i = 0, tries = 0; i < mesas && tries < 30; tries++) {
      const at = between(lo + 6, hi - 6);
      if (Math.abs(at - p.mid) < INNER[size] + 6 || p.features.some(f => Math.abs(f.at - at) < 22)) continue;
      p.features.push({ type: 'mesa', at, top: between(2.6, 4.2), rise: between(6, 9.5) * (size === 'small' ? .75 : 1), face: at < p.mid ? 1 : -1, cap: chance(.75), cave: chance(.6) ? between(3.5, 5) : 0 }); i++;
    }
    if (chance(.45)) p.features.push({ type: 'pond', at: between(p.mid - 9 * scale, p.mid + 9 * scale), half: between(2.4, 3.6) });
    p.outer = [chance(.45), chance(.45)];
  } else if (kind === 'cuevas') {
    // A broad massif over the middle: the front capis on its crest, sheer
    // outer faces, and a tunnel through its foot between the lowlands at
    // either end, with a room or two in it.
    p.base = between(9.5, 11.5); p.lf.amp = between(1.5, 3);
    hillsAlong(lo, hi, 2 + Math.floor(r() * 2 * scale), 2.5);
    const m = { at: p.mid + between(-.04, .04) * width, half: between(.27, .31) * width, top: Math.min(roof - 4, p.base + between(12, 15)), wall: between(.07, .1),
      peak: { at: between(-.3, .3), height: between(3, 6) } };
    p.features.push({ type: 'mountain', ...m });
    const rise = between(1.8, 3.4), rooms = [], room = Math.min(2.6, (m.top - p.base - rise - 3) / 2);
    for (let i = 0, n = 1 + Math.floor(r() * 2); i < n; i++) rooms.push({ at: n === 1 ? between(.35, .65) : i ? between(.6, .8) : between(.2, .4), radius: room });
    p.tunnels.push({ from: m.at - m.half - 1.5, to: m.at + m.half + 1.5, rise, radius: between(1.3, 1.4), rooms });
    p.outer = [chance(.5), chance(.5)];
  } else if (kind === 'islas') {
    p.base = WATER - 2.6;
    const n = size === 'small' ? 3 : size === 'medium' ? 3 + Math.floor(r() * 2) : 4 + Math.floor(r() * 2);
    const gaps = Array.from({ length: n - 1 }, () => between(4.5, 8) * Math.min(1.2, scale)), room = width - gaps.reduce((a, b) => a + b, 0);
    const shares = Array.from({ length: n }, () => between(.8, 1.25)), sum = shares.reduce((a, b) => a + b, 0);
    let x = 0, last = between(16, 24);
    for (let i = 0; i < n; i++) {
      const w = room * shares[i] / sum, top = clamp(last + between(-5, 5), 13, Math.min(roof, 28));
      p.features.push({ type: 'island', from: x, to: x + w, top, amp: between(1.5, 3.5), undercut: between(1.2, 2) });
      last = top; x += w + (gaps[i] || 0);
    }
    for (let i = 0; i + 1 < n; i++) p.bridges.push({ a: i, b: i + 1, radius: between(.75, .95), arc: chance(.6) ? between(.6, 1.8) : between(-.5, .3) });
    p.outer = [chance(.4), chance(.4)];
  } else if (kind === 'valle') {
    p.base = between(8.5, 11);
    const v = { at: p.mid + between(-.06, .06) * width, floor: between(9, 13) * Math.min(1.15, scale) };
    v.left = Math.min(roof - 1, p.base + between(12, 17)); v.right = clamp(v.left + between(-2.5, 2.5), p.base + 10, roof - 1);
    p.features.push({ type: 'valley', ...v });
    p.keepOut = [[v.at - v.floor - 3.5, v.at + v.floor + 3.5]];
    p.features.push({ type: 'pond', at: v.at + between(-.35, .35) * v.floor, half: between(2.2, 3.4), bare: true });
    p.arch = { radius: between(.95, 1.2), arc: between(.8, 2.6) };
    if (chance(.75)) p.ledges.push({ side: chance(.5) ? -1 : 1, up: between(.35, .6), out: between(2.6, 4) });
    p.outer = [chance(.5), chance(.5)];
  } else {
    p.base = between(11, 14);
    const t = { at: p.mid + (chance(.5) ? -1 : 1) * between(0, .07) * width, half: between(4, 6.5) * Math.min(1.2, scale), top: Math.min(roof, p.base + between(15, 20)), base0: p.base };
    // Each side its own steps: a shelf, then a riser a capi walks up.
    t.sides = [-1, 1].map(() => ({ steps: 2 + Math.floor(r() * (size === 'small' ? 1.5 : 2.5)), shelf: between(3.5, 6) * Math.min(1.2, scale), steep: between(.75, 1.05) }));
    p.features.push({ type: 'tepuy', ...t });
    hillsAlong(lo, hi, 2 + Math.floor(r() * 2), 3);
    p.outer = [chance(.55), chance(.55)];
  }
  return p;
}

// ---------- the ground's profile ----------

// Rolling ground along the whole map, not mirrored.
function rolling(p, x) {
  const at = p.mirror ? Math.abs(x - p.mid) : x;
  return p.base + (fbm2(at * p.lf.freq + p.lf.a, p.lf.b, { octaves: 3 }) - .5) * 2 * p.lf.amp + bumps(at, p.hills);
}

// Fine detail (two noise layers): the same on both halves of a mirrored map.
function detail(p, x) {
  const at = p.mirror ? Math.abs(x - p.mid) : x;
  return (fbm2(at * .3 + p.detail, 7.7, { octaves: 2 }) - .5) * .6 + (fbm2(at * .11 + p.detail, 2.3, { octaves: 2 }) - .5) * 1.4;
}

function mesaHeight(f, x, h) {
  const steep = f.at + f.face * f.top, ramp = f.at - f.face * f.top, T = f.T;
  if (Math.abs(x - f.at) <= f.top) return Math.max(h, T);
  if (Math.sign(x - f.at) === f.face) return Math.max(h, lerp(h, T, smoothstep(clamp(1 - Math.abs(x - steep) / 1.1))));
  return Math.max(h, T - Math.abs(x - ramp) * .62);
}

// The tepuy's profile at x: a flat top, then on each side shelves and risers
// a capi walks up.
function tepuyHeight(f, x, h) {
  const side = x < f.at ? 0 : 1, s = f.sides[side], d = Math.abs(x - f.at);
  if (d <= f.half) return Math.max(h, f.top);
  const rise = (f.top - f.base0) / (s.steps + 1), run = rise / s.steep;
  let y = f.top, at = f.half;
  for (let i = 0; i <= s.steps; i++) {
    // A riser: straight, rounded only at its lip and its foot.
    if (d < at + run) { const t = (d - at) / run; return Math.max(h, y - rise * (t * .75 + smoothstep(t) * .25)); }
    at += run; y -= rise;
    if (i < s.steps) { if (d < at + s.shelf) return Math.max(h, y + Math.sin((d - at) / s.shelf * Math.PI) * .25); at += s.shelf; }
  }
  // Past the last riser the slope runs on down into the ground around.
  return Math.max(h, y - (d - at) * s.steep);
}

// Ground height at x: the top of the heightfield (caps, bridges, caves and
// ledges come after, as cells).
export function heightAt(p, x) {
  let h = p.kind === 'islas' ? p.base : rolling(p, x) + detail(p, x);
  for (const f of p.features) {
    if (f.type === 'mesa') h = mesaHeight(f, x, h);
    else if (f.type === 'mountain') {
      // A massif with sheer sides and a craggy crest.
      const d = Math.abs(x - f.at), wall = smoothstep(clamp((f.half - d) / (f.half * f.wall)));
      const crag = (fbm2(x * .07 + p.detail, 4.4, { octaves: 3 }) - .5) * 10 + (fbm2(x * .3 + p.detail, 1.7, { octaves: 2 }) - .5) * 1.2;
      const peak = f.peak ? f.peak.height * Math.exp(-(((x - f.at - f.peak.at * f.half) / (f.half * .4)) ** 2)) : 0;
      if (wall > 0) h = Math.max(h, lerp(h, f.top + peak + crag * clamp((f.half - d) / (f.half * .3)), wall));
    } else if (f.type === 'island') {
      if (x >= f.from - 1.5 && x <= f.to + 1.5) {
        const inside = clamp(Math.min(x - f.from, f.to - x) / 1.1 + .5), top = f.top + (fbm2(x * .06 + p.lf.a, f.top, { octaves: 3 }) - .5) * 2 * f.amp + detail(p, x) * .6;
        // The outer ends of the first and last island are the map's shores.
        const edge = (x < f.from && f.from <= .01) || (x > f.to && f.to >= p.width - .01) ? 1 : smoothstep(inside);
        h = Math.max(h, lerp(p.base, top, edge));
      }
    } else if (f.type === 'valley') {
      const d = Math.abs(x - f.at) - f.floor, side = x < f.at ? f.left : f.right;
      h = lerp(p.base + detail(p, x) * .5, side + (rolling(p, x) - p.base) * .4 + detail(p, x) * .7, smoothstep(clamp(d / 2.2)));
    } else if (f.type === 'tepuy') h = tepuyHeight(f, x, h);
  }
  for (const f of p.features) if (f.type === 'pond') {
    // A pond: a bowl under the water.
    const d = Math.abs(x - f.at) - f.half;
    if (d < 3.5) h = Math.min(h, lerp(WATER - 1.8, h, smoothstep(clamp(d / 3.5))));
  }
  if (p.knoll) h += p.knoll.height * Math.exp(-(((x - p.mid) / p.knoll.width) ** 2));
  // The ends: the land falls towards the sea, into a beach or a cliff.
  for (const [i, s] of p.ends.entries()) {
    const e = i ? p.width - x : x;
    if (e > s.run + s.fall) continue;
    const low = s.style === 'beach' ? WATER + 3.2 : WATER + 7;
    // Mostly straight, so its steepest part is little steeper than its mean.
    const t = clamp((e - s.run) / s.fall);
    h = lerp(Math.min(h, low), h, t * .65 + smoothstep(t) * .35);
    if (s.style === 'beach') {
      const t = clamp((e - 1) / (s.run - 1)), u = clamp(t / .55);
      if (t < 1) h = Math.min(h, t < .55 ? WATER - 2.5 + 5.1 * (.75 * u + .25 * smoothstep(u)) : lerp(WATER + 2.6, h, smoothstep((t - .55) / .45)));
    } else {
      h = lerp(WATER - 2.6, h, clamp((e - s.run + .6) / .6));
      const bar = 1 - ((e - s.run * .5) / s.bar) ** 2;
      if (bar > 0) h = Math.max(h, WATER - 2.6 + (2.6 + s.top) * Math.sqrt(bar));
    }
  }
  return clamp(h, -1, p.height - 4);
}

// ---------- the cells ----------

// A span of rock (a bridge, an arch) from s.a to s.b, its centre line bowed
// up by s.arc: circles of s.radius along it, thicker towards its ends.
function span(mask, s, thick = .5) {
  const { a, b } = s, n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / .15);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    fill(mask, lerp(a.x, b.x, t), lerp(a.y, b.y, t) + Math.sin(t * Math.PI) * s.arc, s.radius + thick * Math.abs(t - .5) ** 1.5 * 2.8);
  }
}
const spanY = (s, x) => { const t = clamp((x - s.a.x) / (s.b.x - s.a.x)); return lerp(s.a.y, s.b.y, t) + Math.sin(t * Math.PI) * s.arc; };

// A tunnel along a path of points (its floor), carved with circles of `radius`.
function tunnel(mask, points, radius) {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / .2);
    for (let k = 0; k <= n; k++) carve(mask, lerp(a.x, b.x, k / n), lerp(a.y, b.y, k / n) + radius - .25, radius);
  }
}

// A cave into the slope that falls towards end `i` of the map: off the way
// between the teams, walked into from above (a capi drops off its roof to the
// mouth and walks in). Returns its floor spot, or null when no slope fits.
function outerCave(p, mask, i, limit) {
  const s = p.ends[i], out = i ? 1 : -1;
  let best = null;
  const depth = 4 + (s.run % 1) * 1.5;
  for (let e = s.run + 2; e < Math.min(s.run + s.fall + 12, limit - depth - 2.5); e += .5) {
    const x = i ? p.width - e : e, h = heightAt(p, x), fall = h - heightAt(p, x + out * 1.5);
    // A roof of at least two units over the cave's room.
    if (h > WATER + 5 && fall > .5 && fall < 2.2 && heightAt(p, x - out * depth) > h + 5.4 && (!best || h > best.h)) best = { x, h, e };
  }
  if (!best || best.e < 6) return null;
  const y = best.h - .2;
  tunnel(mask, [{ x: best.x + out * 1.2, y }, { x: best.x - out * depth, y: y + .3 }], 1.3);
  carve(mask, best.x - out * depth, y + 1.8, 1.8);
  return { x: best.x - out * depth * .6, y: y + .1, what: 'cave' };
}

export function buildGround(p) {
  const mask = createMask({ width: p.width, height: p.height, cell: CELL });
  // Each end falls to the sea gently enough to walk: longer where the land is high.
  const inland = { ...p, ends: [], features: p.features.filter(f => f.type !== 'mesa') };
  for (const [i, s] of p.ends.entries()) {
    const low = s.style === 'beach' ? WATER + 3.2 : WATER + 7;
    for (let k = 0; k < 4; k++) { const e = s.run + s.fall, h = heightAt(inland, i ? p.width - e : e); s.fall = Math.max(s.fall, (h - low) / .85); }
  }
  // A mesa stands on the ground under it, its top `rise` above.
  const bare = { ...p, features: [] };
  for (const f of p.features) if (f.type === 'mesa') { f.base = heightAt(bare, f.at); f.T = Math.min(p.roof, f.base + f.rise); }
  fillHeights(mask, x => heightAt(p, x));
  p.rocks = []; p.caveSpots = []; p.spans = [];
  // Overhangs first: open to the sky behind, so no back wall.
  for (const f of p.features) {
    if (f.type === 'mesa') {
      p.rocks.push({ x0: f.at - f.top - 1.8, x1: f.at + f.top + 1.8, y0: f.base - 1, y1: f.T - .35 });
      if (f.cap) {
        const edge = f.at + f.face * f.top;
        fill(mask, edge + f.face * 1.25, f.T - .5, .85); fill(mask, edge + f.face * .6, f.T - .3, .8);
        carve(mask, edge + f.face * 1.85, f.T - 2.4, 1.05);
      }
    }
    if (f.type === 'mountain') {
      // Rock shows in its sheer faces; inside, earth like the rest.
      for (const side of [-1, 1]) { const x = f.at + side * f.half; p.rocks.push({ x0: Math.min(x, x - side * 5) - 1, x1: Math.max(x, x - side * 5) + 1, y0: p.base + 1, y1: f.top - 2.5 }); }
      // Its sheer faces are overhung by the crest's lip (nobody climbs them anyway).
      for (const side of [-1, 1]) {
        let x = f.at + side * f.half * (1 - f.wall);
        const top = heightAt(p, x);
        for (let k = 0; k < 40 && heightAt(p, x + side * .2) > top - 1.5; k++) x += side * .2;
        fill(mask, x + side * .9, top - .6, 1); fill(mask, x + side * .2, top - .3, 1);
        carve(mask, x + side * 1.6, top - 3, 1.35);
      }
    }
    if (f.type === 'tepuy') p.rocks.push({ x0: f.at - f.half - 2, x1: f.at + f.half + 2, y0: f.top - 5, y1: f.top - .3 });
    if (f.type === 'valley') {
      for (const side of [-1, 1]) { const x = f.at + side * (f.floor + 1); p.rocks.push({ x0: Math.min(x, x + side * 3) - 1.5, x1: Math.max(x, x + side * 3), y0: p.base + 1, y1: (side < 0 ? f.left : f.right) - .8 }); }
      // The arch across the valley, from rim to rim, flush with the ground at both ends.
      const l = f.at - f.floor - 2.4, r = f.at + f.floor + 2.4, a = p.arch;
      a.a = { x: l, y: heightAt(p, l) - a.radius }; a.b = { x: r, y: heightAt(p, r) - a.radius };
      span(mask, a, .6); p.spans.push(a); p.rocks.push({ x0: l, x1: r, span: a });
      for (const ledge of p.ledges) {
        // A ledge on a cliff, under the arch: cover for a capi knocked into the valley.
        const top = ledge.side < 0 ? f.left : f.right, y = lerp(p.base, top, ledge.up), x = f.at + ledge.side * (f.floor + .9), toward = -ledge.side;
        for (let d = -1.5; d <= ledge.out; d += .2) fill(mask, x + toward * d, y - .7, .7 + .35 * clamp(1 - d / ledge.out));
        p.rocks.push({ x0: Math.min(x, x + toward * ledge.out) - 1.5, x1: Math.max(x, x + toward * ledge.out) + 1.5, y0: y - 1.6, y1: y + .2 });
        ledge.x = x; ledge.y = y;
      }
    }
    if (f.type === 'island') {
      // The sea has undercut each island's sides (not the map's shores).
      for (const [x, out] of [[f.from, -1], [f.to, 1]]) {
        if (x <= .01 || x >= p.width - .01) continue;
        const top = heightAt(p, x - out * 1.5);
        for (let y = WATER + .6; y < top - 4.5; y += .8) carve(mask, x - out * (f.undercut - 1.2), y, 1.25 + .3 * Math.sin(y * 1.7 + f.top));
        fill(mask, x + out * .5, top - .6, .7);
        p.rocks.push({ x0: x - 2.5, x1: x + 2, y0: WATER - 1, y1: top - 1.5 });
      }
    }
  }
  // Bridges between islands: a span from one island's edge top to the next.
  for (const s of p.bridges) {
    const A = p.features[s.a], B = p.features[s.b];
    s.a = { x: A.to - 1.8, y: heightAt(p, A.to - .6) - s.radius }; s.b = { x: B.from + 1.8, y: heightAt(p, B.from + .6) - s.radius };
    span(mask, s); p.spans.push(s); p.rocks.push({ x0: s.a.x, x1: s.b.x, span: s });
  }
  // A pond gets a natural bridge over it, flush with the ground at both banks.
  for (const f of p.features) if (f.type === 'pond' && !f.bare) {
    const l = f.at - f.half - 3.6, r = f.at + f.half + 3.6, s = { a: { x: l, y: heightAt(p, l) - .8 }, b: { x: r, y: heightAt(p, r) - .8 }, arc: .5, radius: .8 };
    span(mask, s, .3); p.spans.push(s); p.rocks.push({ x0: l, x1: r, span: s });
  }
  // The caves and tunnels are hollows: the scene gives them a back wall.
  const before = mask.solid.slice();
  for (const t of p.tunnels) {
    const a = { x: t.from, y: heightAt(p, t.from) }, b = { x: t.to, y: heightAt(p, t.to) };
    const points = [a, { x: lerp(t.from, t.to, .25), y: lerp(a.y, b.y, .25) + t.rise * .8 }, { x: lerp(t.from, t.to, .5), y: lerp(a.y, b.y, .5) + t.rise },
      { x: lerp(t.from, t.to, .75), y: lerp(a.y, b.y, .75) + t.rise * .8 }, b];
    // Each mouth opens a little outside the foot, onto the ground there.
    tunnel(mask, [{ x: t.from - 1.5, y: heightAt(p, t.from - 1.5) }, ...points, { x: t.to + 1.5, y: heightAt(p, t.to + 1.5) }], t.radius);
    for (const room of t.rooms || []) {
      const x = lerp(t.from, t.to, room.at), k = room.at < .5 ? room.at / .5 : (1 - room.at) / .5, y = lerp(a.y, b.y, room.at) + t.rise * (.8 + .2 * k);
      carve(mask, x, y + room.radius - .2, room.radius);
      p.caveSpots.push({ x, y, what: 'room' });
    }
    t.points = points;
    p.caveSpots.push({ x: lerp(t.from, t.to, .5), y: points[2].y, what: 'tunnel' });
  }
  for (const f of p.features) if (f.type === 'mesa' && f.cave) {
    // A cave at the foot of the mesa's steep face.
    const edge = f.at + f.face * (f.top + 1.6), y = heightAt(p, edge + f.face * .6);
    if (f.T - y < 5) continue;
    const out = edge + f.face * 1.4;
    tunnel(mask, [{ x: out, y: heightAt(p, out) }, { x: edge + f.face * .2, y }, { x: edge - f.face * f.cave, y: y + .2 }], 1.25);
    p.caveSpots.push({ x: edge - f.face * f.cave * .6, y: y + .1, what: 'cave' });
  }
  for (const [i, s] of p.ends.entries()) if (s.style === 'cliff') {
    // The sea has eaten a notch under each cliff, leaving its top as an overhang.
    const face = i ? p.width - s.run : s.run, out = i ? 1 : -1;
    carve(mask, face - out * .4, WATER + 2.3, 1.9);
    p.rocks.push({ x0: Math.min(face, face - out * 3), x1: Math.max(face, face - out * 3), y0: WATER - 1, y1: WATER + 5 });
  }
  mask.hollow = new Uint8Array(before.length);
  for (let i = 0; i < before.length; i++) mask.hollow[i] = before[i] & (1 - mask.solid[i]);
  for (const [i, s] of p.ends.entries()) if (s.style === 'cliff') {
    const face = i ? p.width - s.run : s.run, out = i ? 1 : -1;
    fill(mask, face - out * .5, heightAt(p, face - out * 1.4) - .6, .75);
  }
  const loose = dropFloating(mask, 1500);
  return { mask, loose };
}

// ---------- spawns and checks ----------

// Can a capi stand at x and start a match there? Open ground above the water,
// not steep, with sky over it and earth under it (not a thin bridge).
export function standable(mask, x) {
  const y = surfaceY(mask, x);
  if (y === null || y < WATER + 2.5) return null;
  const l = surfaceY(mask, x - .6), r = surfaceY(mask, x + .6);
  if (l === null || r === null || Math.abs(r - l) > 1.25 || Math.abs(surfaceY(mask, x - 1.4) - y) > 2 || Math.abs(surfaceY(mask, x + 1.4) - y) > 2) return null;
  for (let d = .3; d < 3; d += .5) if (!solidAt(mask, x, y - d)) return null;
  return skyExposure(mask, x, y + 1) >= .5 ? y : null;
}

// Three spawns a team, front to back: team 0 on the left, team 1 on the
// right; slot 0 is the front capi (nearest the middle), at least INNER from
// it, the three at least GAP apart within SPREAD of the half map. Team 0's
// spots come from the seed; team 1 takes the spots whose heights match them
// best (front capi first, then the mean). A mirrored map mirrors team 0.
export function spawnsFor(p, mask) {
  const r = seededStream(`capis-spawns:${p.seed}:${p.size}:${p.attempt}`), gap = GAP[p.size], inner = INNER[p.size];
  const out = x => (p.keepOut || []).some(([a, b]) => x >= a && x <= b);
  // Every spot each side can start on: distance from the middle and height.
  const sides = [0, 1].map(team => {
    const dir = team ? 1 : -1, outer = p.mid - p.ends[team].run - 3, spots = [], ys = new Map();
    for (let d = inner; d < outer; d += .25) { if (out(p.mid + dir * d)) continue; const y = standable(mask, p.mid + dir * d); if (y !== null) { spots.push(d); ys.set(d, y); } }
    return { dir, outer, spots, ys };
  });
  if (!sides[0].spots.length || !sides[1].spots.length) return null;
  // The front capis: the pair of spots near each side's first that stand at the most even height.
  const jitter = [r() * 2, r() * 2], firsts = sides.map((s, t) => s.spots.filter(d => d <= s.spots[0] + (p.mirror ? 2 : 10)));
  let pair = null;
  for (const a of firsts[0]) for (const b of p.mirror ? [a] : firsts[1]) {
    const cost = Math.abs(sides[0].ys.get(a) - sides[1].ys.get(b) || 0) + .08 * Math.abs(a - sides[0].spots[0] - jitter[0]) + .08 * Math.abs(b - sides[1].spots[0] - jitter[1]);
    if (!pair || cost < pair.cost) pair = { cost, a, b };
  }
  // A side's trios: the front capi at `first`, the back one near the end of
  // the side's stretch (leaning by the seed), the middle one near halfway.
  const trios = (side, first, count) => {
    const { spots, ys, outer } = side, back = Math.min(outer, spots[0] + SPREAD * p.mid + gap), inside = spots.filter(d => d <= back);
    const near = (target, keep) => { let best = null; for (const d of inside) if (keep(d) && (best === null || Math.abs(d - target) < Math.abs(best - target))) best = d; return best; };
    const lean = back - r() * 3, half = r() - .5, out = [];
    for (const last of inside.filter(d => d - first >= 2 * gap).sort((a, b) => Math.abs(a - lean) - Math.abs(b - lean))) {
      if (out.length >= count) break;
      for (const shift of [0, -3, 3]) {
        const middle = near((first + last) / 2 + half * 4 + shift, d => d - first >= gap && last - d >= gap);
        if (middle === null || out.some(o => o.list[1] === middle && o.list[2] === last)) continue;
        out.push({ list: [first, middle, last], mean: (ys.get(first) + ys.get(middle) + ys.get(last)) / 3, lean: Math.abs(last - lean) });
      }
    }
    return out;
  };
  const left = trios(sides[0], pair.a, p.mirror ? 1 : 12);
  if (!left.length) return null;
  if (p.mirror) { const xs = left[0].list.map(d => p.mid - d); return [xs, xs.map(x => p.width - x)]; }
  const right = trios(sides[1], pair.b, 24);
  let best = null;
  for (const a of left) for (const b of right) { const cost = Math.abs(a.mean - b.mean) + .03 * (a.lean + b.lean); if (!best || cost < best.cost) best = { cost, a, b }; }
  return best ? [best.a.list.map(d => p.mid - d), best.b.list.map(d => p.mid + d)] : null;
}

// The ground and spawns of a plan: buildGround, the spawns, then the caves
// that fall towards the shores, dug only past each team's back capi (a cave
// mouth in a slope blocks a walker climbing it, so none stands between capis).
export function buildMap(p) {
  const { mask, loose } = buildGround(p), spawns = spawnsFor(p, mask);
  if (spawns && p.outer) {
    const before = mask.solid.slice();
    for (const [i, wanted] of p.outer.entries()) {
      const back = i ? p.width - Math.max(...spawns[1]) : Math.min(...spawns[0]);
      const c = wanted && outerCave(p, mask, i, back - 4);
      if (c) p.caveSpots.push(c);
    }
    for (let i = 0; i < before.length; i++) if (before[i] && !mask.solid[i]) mask.hollow[i] = 1;
    const more = dropFloating(mask, 1500);
    loose.removed += more.removed; loose.floating = more.floating;   // every piece still floating, the tunnels' roofs included
  }
  return { mask, loose, spawns };
}

// The coarse shot search the checks use: does a shot from a capi standing at
// `from` land within `within` of `to`, with no wind? (The bot's search is finer.)
export function reachable(mask, from, to, { wind = 0, within = FAIR.reach, angles = .06, powers = .025 } = {}) {
  const facing = to.x >= from.x ? 1 : -1, shooter = { x: from.x, y: from.y };
  const options = { wind, solid: (x, y) => solidAt(mask, x, y), targets: [], radius: RULES.radius, bounds: { water: WATER - .3, left: -20, right: mask.width + 20 } };
  for (let angle = .1; angle <= 1.42; angle += angles) for (let power = .3; power <= 1.0001; power += powers) {
    const start = { ...muzzle(shooter, angle, facing), ...aimVelocity(angle, facing, power * RULES.speed) };
    const end = simulateFlight(start, options, { dt: 1 / 60, maxTime: 7, every: 1e9 });
    if (end.hit === 'ground' && Math.hypot(end.x - to.x, end.y - to.y) < within) return { angle, power };
  }
  return null;
}

// The numbers the checks read, per spawn: height, open sky, cover towards
// the rivals, room to walk, distance to the water, to the middle and to the
// nearest rival, and where it gets walking towards the rivals.
export function spawnStats(map, mask) {
  const spans = walkSpans(mask, { water: WATER }), top = topLine(mask);
  const waterAt = x => { for (let k = 0; k < 500; k++) for (const s of [-1, 1]) { const i = Math.floor((x + s * k * .2) / .2); if (i < 0 || i >= top.length || !(top[i] >= WATER)) return k * .2; } return 100; };
  const ys = map.spawns.map(xs => xs.map(x => surfaceY(mask, x)));
  return map.spawns.map((xs, team) => xs.map((x, slot) => {
    const y = ys[team][slot], id = spans.at(x), s = spans.spans[id], dir = team ? -1 : 1;
    const rival = Math.min(...map.spawns[1 - team].map((rx, i) => Math.hypot(rx - x, ys[1 - team][i] - y)));
    const front = walkTo(mask, x, dir, { water: WATER, top });
    return { x, y, exposure: skyExposure(mask, x, y + 1), cover: coverToward(mask, x, y + .8, -dir), span: s ? s.to - s.from : 0,
      water: waterAt(x), middle: Math.abs(x - map.width / 2), rival, front };
  }));
}

// How interesting the ground is: its relief (in units of 8), the share of the
// width with more than one floor (caves, bridges, ledges, overhangs) × 8, its
// bumpiness × 2, and 0.6 for each landmark (a mesa, a cave, a tunnel, a
// bridge, a ledge, a pond). A plain, near-flat map scores under 2; most maps 4–9.
export function interestOf(p, mask, graph) {
  const shape = relief(mask, { water: WATER });
  const landmarks = p.features.filter(f => f.type !== 'valley').length + p.spans.length + p.ledges.length + p.caveSpots.length + (p.knoll ? 1 : 0);
  const score = shape.relief / 8 + graph.layered * 8 + shape.bumpy * 2 + landmarks * .6;
  return { score, relief: shape.relief, layered: graph.layered, bumpy: shape.bumpy, landmarks, land: shape.land };
}

// Can each team walk (or hop) to the other's front capi, both ways, and how far is it?
function walkBetween(graph, spawns, ys) {
  const node = (team, slot) => graph.near(spawns[team][slot], ys[team][slot], .6);
  const a = node(0, 0), b = node(1, 0);
  const there = graph.distance(a, b), back = graph.distance(b, a);
  const foot = graph.distance(a, b, { hops: false }), footBack = graph.distance(b, a, { hops: false });
  return { there, back, foot: Number.isFinite(foot) && Number.isFinite(footBack), nodes: [0, 1].map(t => [0, 1, 2].map(s => node(t, s))) };
}

// Everything measured about an attempt (the tests and RESULTS read it too).
export function measure(p, mask, spawns) {
  const map = { width: p.width, spawns }, stats = spawnStats(map, mask), graph = floorGraph(mask, { water: WATER });
  const ys = stats.map(t => t.map(s => s.y)), walk = walkBetween(graph, spawns, ys);
  const mean = (list, k) => list.reduce((t, s) => t + s[k], 0) / list.length;
  // Who has a shot: each capi at its nearest rival first, then the others.
  // (A shell at full charge carries about speed² / gravity = 50 units on the flat, a little more from above.)
  const range = (s, r) => Math.abs(r.x - s.x) <= RULES.speed ** 2 / 18 + Math.max(0, s.y - r.y) * 1.2 + 2;
  const shots = stats.map((team, t) => team.map(s => {
    const rivals = stats[1 - t].filter(r => range(s, r)).sort((a, b) => Math.abs(a.x - s.x) - Math.abs(b.x - s.x));
    return rivals.some((r, i) => reachable(mask, s, { x: r.x, y: r.y + .35 }, i ? { angles: .09, powers: .05 } : {})) ? 1 : 0;
  }));
  const seen = graph.reach(walk.nodes.flat().filter(n => n >= 0));
  // Every capi can get into the fight on foot: to a floor within 32 of a rival (a comfortable lob), or it has a shot already.
  const moves = walk.nodes.map((team, t) => team.map(n => {
    if (n < 0) return false;
    const from = graph.reach(n), rivals = stats[1 - t];
    for (let i = 0; i < from.length; i++) if (from[i]) { const x = (graph.col[i] + .5) * graph.step; if (rivals.some(r => Math.abs(r.x - x) <= 32)) return true; }
    return false;
  }));
  const caves = p.caveSpots.map(c => { const n = graph.near(c.x, c.y, 1.4); return { ...c, reached: n >= 0 && !!seen[n] }; });
  return { stats, graph, walk, shots, moves, caves, interest: interestOf(p, mask, graph),
    diff: { meanHeight: Math.abs(mean(stats[0], 'y') - mean(stats[1], 'y')), front: Math.abs(stats[0][0].y - stats[1][0].y),
      exposure: Math.abs(mean(stats[0], 'exposure') - mean(stats[1], 'exposure')), cover: Math.abs(mean(stats[0], 'cover') - mean(stats[1], 'cover')),
      distance: Math.abs(mean(stats[0], 'rival') - mean(stats[1], 'rival')),
      walk: Math.max(walk.there, walk.back) / Math.max(1e-9, Math.min(walk.there, walk.back)),
      shots: Math.abs(shots[0].reduce((a, b) => a + b) - shots[1].reduce((a, b) => a + b)) } };
}

// Why a map is turned down (each is an id, reported by the tests):
//   floating      a piece of ground hangs in the air
//   cramped       no three spots a team to start on
//   boxed-in      a spawn with under FAIR.span of ground to walk
//   bland         the interest score is under FAIR.interest
//   apart         a team cannot walk (or hop) to the other's front capi, or back
//   cave-shut     a cave or tunnel no capi can walk into
//   uneven-<k>    the two teams differ by more than FAIR[k]
//   out-of-reach  the front capis cannot hit each other with no wind
//   no-shot       a team has no capi with a shot at a rival
//   walled-in     a capi can neither walk to within 32 of a rival nor hit one
function check(p, mask, loose, spawns) {
  if (loose.floating.length > p.tunnels.length || loose.floating.some(n => n < 4000)) return { failed: 'floating' };
  if (!spawns) return { failed: 'cramped' };
  const m = measure(p, mask, spawns);
  const fail = failed => ({ failed, measured: m });
  for (const s of m.stats.flat()) if (s.span < FAIR.span) return fail('boxed-in');
  if (m.interest.score < FAIR.interest) return fail('bland');
  if (!Number.isFinite(m.walk.there) || !Number.isFinite(m.walk.back)) return fail('apart');
  if (m.caves.some(c => !c.reached)) return fail('cave-shut');
  for (const k of ['meanHeight', 'front', 'exposure', 'cover', 'distance', 'walk', 'shots']) if (m.diff[k] > FAIR[k]) return fail(`uneven-${k}`);
  if (!m.shots[0].some(Boolean) || !m.shots[1].some(Boolean)) return fail('no-shot');
  for (let t = 0; t < 2; t++) for (let s = 0; s < 3; s++) if (!m.moves[t][s] && !m.shots[t][s]) return fail('walled-in');
  const at = (team, slot) => ({ x: spawns[team][slot], y: m.stats[team][slot].y });
  if (!reachable(mask, at(0, 0), { ...at(1, 0), y: at(1, 0).y + .35 }) || !reachable(mask, at(1, 0), { ...at(0, 0), y: at(0, 0).y + .35 })) return fail('out-of-reach');
  return { failed: null, measured: m };
}

// One attempt built and checked: { mask, loose, spawns, failed, measured }.
export function inspectPlan(p) {
  const built = buildMap(p);
  return { ...built, ...check(p, built.mask, built.loose, built.spawns) };
}

// The map for a seed and a size: { map, mask }. `map` describes it (seed,
// size, kind, spawns, the plan, which attempt passed and why the others
// failed, what was measured); `mask` is the ground for the match.
export function generateMap(seed = 1, size = DEFAULT_SIZE) {
  seed = mapSeed(seed) ?? 1; size = mapSize(size);
  const rejected = [];
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const p = planMap(seed, size, attempt), { mask, loose, spawns, failed, measured } = inspectPlan(p);
    if (failed && attempt < ATTEMPTS - 1) { rejected.push(failed); continue; }
    const start = mask.solid.slice(); for (let i = 0; i < start.length; i++) start[i] |= mask.hollow[i];
    const fair = measured ? { ...measured.diff, interest: measured.interest.score, foot: measured.walk.foot, route: [measured.walk.there, measured.walk.back], shooters: measured.shots, land: measured.interest.land,
      caves: measured.caves.map(c => ({ what: c.what, reached: c.reached })), heights: measured.stats.map(t => t.map(s => +s.y.toFixed(2))) } : null;
    const map = { id: 'llanos', name: MAP_NAME, seed, size, width: p.width, height: p.height, cell: CELL, water: WATER,
      kind: p.kind, plan: p, spawns, attempt, rejected, failed: failed || null, start, loose: loose.removed, fair };
    return { map, mask };
  }
  throw new Error('unreachable');
}

// ---------- what the earth is made of (for the painter) ----------

// 0..1 rock at (x, y): the mesas, the tepuy, the islands' undercut sides, the
// bridges and ledges and the cliffs at the ends. The soil's layers between
// them are the shader's strata (`strataPalette`).
export function rockAt(map, x, y) {
  const p = map.plan;
  let k = 0;
  for (const b of p.rocks) {
    if (x < b.x0 || x > b.x1) continue;
    if (b.span) { if (Math.abs(y - spanY(b.span, x)) < b.span.radius + .45) k = Math.max(k, .75); }
    else if (y > b.y0 && y < b.y1) k = Math.max(k, .85 * clamp((b.y1 - y) * 3) * clamp((y - b.y0) * .8));
  }
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

// ---------- the layers of the cut face (for the painter) ----------

// The soil profile under each kind of map, top to bottom: dark topsoil, pale
// ash, orange-brown clay, whitish pumice gravel, an ochre band, brown loam,
// a dark base, and the colour of the thin seams at some contacts (0..255 RGB).
const STRATA = Object.freeze({
  cerros: { topsoil: [78, 54, 36], ash: [204, 186, 152], clay: [170, 104, 62], pumice: [218, 208, 186], ochre: [198, 152, 76], loam: [130, 88, 54], base: [86, 58, 40], seam: [146, 66, 40] },
  cuevas: { topsoil: [62, 50, 40], ash: [196, 192, 180], clay: [138, 118, 100], pumice: [216, 214, 206], ochre: [174, 152, 114], loam: [112, 100, 90], base: [74, 68, 64], seam: [94, 82, 76] },
  islas: { topsoil: [74, 56, 38], ash: [226, 208, 166], clay: [172, 98, 60], pumice: [232, 224, 204], ochre: [212, 174, 106], loam: [156, 118, 80], base: [104, 72, 50], seam: [166, 74, 42] },
  valle: { topsoil: [66, 44, 30], ash: [208, 182, 152], clay: [160, 82, 54], pumice: [218, 204, 188], ochre: [192, 136, 72], loam: [126, 72, 48], base: [82, 48, 36], seam: [136, 48, 34] },
  terrazas: { topsoil: [64, 46, 36], ash: [222, 210, 194], clay: [152, 80, 64], pumice: [232, 226, 214], ochre: [194, 128, 92], loam: [130, 82, 66], base: [92, 54, 46], seam: [112, 46, 40] },
  suave: { topsoil: [78, 54, 36], ash: [202, 186, 152], clay: [166, 104, 64], pumice: [216, 208, 188], ochre: [194, 152, 82], loam: [128, 90, 58], base: [86, 60, 42], seam: [142, 70, 44] },
});
export const STRATA_KEYS = Object.freeze(['topsoil', 'ash', 'clay', 'pumice', 'ochre', 'loam', 'base', 'seam']);

// The look of the layers for a map: the kind's colours shifted a little by
// the seed (same seed and kind, same look), and how they lie:
//   period  world units of one run of bands (they repeat with a different mix)
//   fold    0..1 how much the bands drape over the land (the rest is level)
//   tilt    a gentle dip along x, units per unit
//   phase   where the seed's noise starts, so two maps don't share wiggles
export function strataPalette(seed, kind) {
  const base = STRATA[kind] || STRATA.cerros, r = seededStream(`capis-strata:${mapSeed(seed) ?? 1}:${kind}`);
  const warm = (r() - .5) * .08, light = 1 + (r() - .5) * .1;
  const out = {};
  for (const key of STRATA_KEYS) {
    const own = 1 + (r() - .5) * .08;
    out[key] = base[key].map((v, i) => Math.round(clamp(v * light * own * (1 + warm * (1 - i)), 0, 255)));
  }
  return Object.assign(out, { period: +(3.8 + r() * 1.8).toFixed(3), fold: +(.3 + r() * .25).toFixed(3), tilt: +((r() - .5) * .04).toFixed(4), phase: +(r() * 100).toFixed(2) });
}
