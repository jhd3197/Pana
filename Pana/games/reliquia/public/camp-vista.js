// The far cavern around the camp: a vast navy hall, its still lake, stalactite
// columns, the wall's carved faces, the road across the water and the expedition's
// shore. Renderer-free, so its placement can be tested: buildVista returns plain
// triangle soup, one colour per vertex, baked once and shared by every jornada.
//
// Nothing here is lit or fogged. Each thing takes the tone of its distance (darkest
// nearest, bluer as it recedes, the way a painted backdrop steps back) and its facets
// are shaded when built, so a single unlit draw can hold the whole vista. Warm pools
// are baked too: `POOLS` paints amber on what stands near them without a real light.
//
// Looks only: every footprint stands past CAMP_RECT and layout.js never reads this.
import { fbm2, rng } from '../../../engine/random.js';

export const LAKE_Y = -9;
export const CAMP_RECT = [-18, -2, 18, 30];
const CX = 10, CZ = 5;
// The cold shaft's hole, over the water and clear of any path of light.
export const HOLE = { x: 40, z: -22, r: 8 };
// The way down: the pit under the gantry, a timber-lined well in the lake's rock.
export const PIT = { x: 12, z: -11, r: 8, top: -6.5, bottom: -46 };
// The golden head in the far wall, and the searchlight on the camp's rim that finds it.
export const HEAD = { x: 138, y: 50, z: -176, size: 42 };
export const SEARCHLIGHT = { x: 19.7, y: 2.3, z: 1.2 };
export const DOME = { x: -214, z: 46, r: 74 };
export const GATE = { x: 66, y: 46, z: 262, r: 36 };
// The road: out of the camp's south gap, down to the shore, across the lake to the gate.
export const ROAD = [[-3.4, 31.4, -.02], [-3.8, 35, -3.2], [-8, 39.5, -7.4], [-16, 44, -7.8], [-22, 53, -7.6], [-15, 67, -7.4], [5, 78, -7.2], [22, 97, -7], [11, 121, -6.6], [-4, 141, -6], [13, 166, -5], [38, 182, -3.6], [64, 206, -1], [66, 232, 3], [66, 244, 7]];
// Amber baked on stone: lanterns on the shore and along the road.
export const POOLS = [
  { x: -24, y: -6, z: 72, r: 19, power: 1 }, { x: -6, y: -6, z: 67, r: 13, power: .8 }, { x: -64, y: -6, z: 28, r: 17, power: .8 }, { x: -60, y: -6, z: 6, r: 12, power: .55 },
  { x: 5, y: -5, z: 78, r: 13, power: 1 }, { x: 22, y: -5, z: 97, r: 10, power: .7 }, { x: 11, y: -4.5, z: 121, r: 12, power: .75 }, { x: 13, y: -3, z: 166, r: 13, power: .75 }, { x: 64, y: 1, z: 206, r: 15, power: .8 }, { x: 66, y: 10, z: 240, r: 18, power: .8 },
];
// The lanterns on the pit's rim.
const PIT_GLOW = { x: 12, y: -5, z: -11, r: 15, power: .36 };

// The searchlight's pool on the rock around the head.
const LIT = [...POOLS, PIT_GLOW, { x: HEAD.x, y: HEAD.y, z: HEAD.z, r: 92, power: .14 }];
// Bigger clumps on the crest of the berm, and shelves up the tower's faces: x, y, z, colour, scale, wall heading.
export const LEDGE_MUSHROOMS = [
  [-19.9, .5, 6.5, 'purple', 1.5], [-20.1, .6, 15, 'blue', 1.9], [-20.1, .5, 24, 'purple', 1.6], [-15, .5, 32.8, 'purple', 1.6], [-9, .6, 33, 'blue', 1.5], [3.5, .6, 33, 'purple', 1.7], [12, .6, 32.9, 'blue', 1.9], [20.1, .5, 22.5, 'blue', 1.7],
  [-7, 2.4, -3, 'blue', 1.5, 0], [-9.5, 3.8, -3.1, 'purple', 1.9, 0], [-13.4, 1.4, -3, 'blue', 1.7, 0], [-15.5, 4.6, -3.2, 'blue', 2.1, 0], [-17.5, 2.6, -3, 'purple', 1.7, 0], [4.7, 2.2, -5, 'blue', 1.6, Math.PI / 2], [4.7, 4.4, -8.5, 'purple', 2, Math.PI / 2], [4.7, 3, -12, 'blue', 1.7, Math.PI / 2],
];
// Every prop on the ground around the camp: x, z and what it is. All past the rect.
export const PROP_SPOTS = [
  ['crate', -18.7, 3.6], ['barrel', -18.75, 4.6], ['rope', -18.7, 5.6], ['crate', -18.7, 16.4], ['tools', -19, 17.6], ['barrel', -18.75, 18.6], ['barrel', -18.75, 19.4],
  ['crate', -18.7, 24.2], ['tnt', -18.7, 25.2], ['rope', -18.7, 27], ['crate', -13.6, 30.8], ['barrel', -12.6, 30.8], ['rope', -9.4, 30.7], ['tools', 7.4, 31], ['crate', 5.4, 30.8], ['barrel', 4.4, 30.8],
  ['crate', 14.8, 30.8], ['tnt', 15.8, 30.8], ['barrel', 18.75, 28], ['crate', 18.7, 26.6], ['rope', 18.7, 23.6], ['post', -18.8, 1], ['post', -18.8, 12], ['post', -18.8, 22], ['post', -16, 30.9], ['post', 11, 30.9], ['post', 18.8, 21],
];
const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const lin = hex => [hex >> 16 & 255, hex >> 8 & 255, hex & 255].map(c => { c /= 255; return c < .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; });
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
// The steps of distance: darkest nearest, a little lighter and bluer each one back.
const TONES = [0x040816, 0x050b1a, 0x071226, 0x0a1b30, 0x0c2539, 0x102e43].map(lin);
const RUST = lin(0x552419), AMBER = lin(0xffa24a), GOLD = lin(0xd8a040), PALE = lin(0x536f88), HAZE = lin(0x0e3044), BLACK = lin(0x010205), LANTERN = 0xffb35c;
const BLUE = lin(0x2f8dff), PURPLE = lin(0xa04dff);
const GLOW_COLOR = { blue: 0x1f7dff, purple: 0x9a35ff };
const toneAt = d => TONES[Math.min(TONES.length - 1, Math.floor(d / 52))];
const fromCamp = (x, z) => Math.hypot(x - CX, z - CZ);

// How high the roof is: a huge dome with slow swells, and a chimney up to the hole.
export function ceilingAt(x, z) {
  const hole = 1 - smooth((Math.hypot(x - HOLE.x, z - HOLE.z) - HOLE.r * .5) / (HOLE.r * .7));
  const crown = 1 - smooth(Math.hypot(x - HEAD.x, z - HEAD.z) / 110);
  return 96 + 46 * (1 - smooth(fromCamp(x, z) / 340)) + (fbm2(x * .012 + 7, z * .012) - .5) * 30 + (fbm2(x * .05, z * .05 + 3) - .5) * 7 + hole * 26 + crown * 26;
}
// How far the far wall stands at a compass angle (0 is north, -z), pulled in behind the head.
export function wallRadius(az) {
  const sx = Math.sin(az), cz = Math.cos(az), head = Math.atan2(HEAD.x - CX, -(HEAD.z - CZ)), near = 1 - smooth(Math.abs(Math.atan2(Math.sin(az - head), Math.cos(az - head))) / .7);
  return 318 + (fbm2(sx * 1.9 + 3, cz * 1.9) - .5) * 90 + (fbm2(sx * 7 + 9, cz * 7) - .5) * 24 - near * 72;
}
// Three tall falls pouring from high in the far wall: a compass angle, a top and a width.
export const FALLS = [[.3, 92, 12], [1.06, 84, 16], [-2.42, 74, 12]].map(([az, top, width]) => { const r = wallRadius(az) - 16; return { x: CX + Math.sin(az) * r, z: CZ - Math.cos(az) * r, top, width }; });
const clearOfCamp = (x, z, r = 0) => { const [a, b, c, d] = CAMP_RECT; return x + r < a - 1 || x - r > c + 1 || z + r < b - 1 || z - r > d + 1; };
const nearSegment = (x, z, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, k = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz))); return Math.hypot(x - ax - dx * k, z - az - dz * k); };
const nearRoad = (x, z) => { let best = Infinity; for (let i = 0; i + 1 < ROAD.length; i++) best = Math.min(best, nearSegment(x, z, ROAD[i][0], ROAD[i][1], ROAD[i + 1][0], ROAD[i + 1][1])); return best; };
const nearBeam = (x, z) => nearSegment(x, z, SEARCHLIGHT.x, SEARCHLIGHT.z, HEAD.x, HEAD.z);
const open = (x, z, r) => clearOfCamp(x, z, r + 26) && nearRoad(x, z) > r + 12 && nearBeam(x, z) > r + 16 && Math.hypot(x - HOLE.x, z - HOLE.z) > r + 16 && Math.hypot(x - PIT.x, z - PIT.z) > r + 14;

// A point of the road (t from 0 to 1, Catmull-Rom through its stops).
export function roadAt(t) {
  const n = ROAD.length - 1, s = Math.max(0, Math.min(.9999, t)) * n, i = Math.floor(s), k = s - i, at = j => ROAD[Math.max(0, Math.min(n, j))];
  const [a, b, c, d] = [at(i - 1), at(i), at(i + 1), at(i + 2)], cr = q => .5 * (2 * b[q] + (c[q] - a[q]) * k + (2 * a[q] - 5 * b[q] + 4 * c[q] - d[q]) * k * k + (3 * b[q] - a[q] - 3 * c[q] + d[q]) * k * k * k);
  return [cr(0), cr(2), cr(1)];
}

// Where things stand, separate from how they are drawn, so a test can read it.
export function vistaPlan() {
  const R = rng(4417), columns = [], spires = [], clusters = [], shrooms = [];
  for (let tries = 0; columns.length < 15 && tries < 400; tries++) {
    const a = R() * Math.PI * 2, r = 62 + R() * 196, x = CX + Math.sin(a) * r, z = CZ - Math.cos(a) * r, base = 11 + R() * 19 + r * .03;
    if (r + base * 1.3 > wallRadius(a) - 30 || !open(x, z, base) || columns.some(c => Math.hypot(c.x - x, c.z - z) < c.base + base + 24)) continue;
    columns.push({ x, z, base, waist: base * (.3 + R() * .22), tiers: 3 + Math.floor(R() * 6), rust: R() < .25, seed: Math.floor(R() * 1e4) });
  }
  for (let tries = 0; spires.length < 44 && tries < 500; tries++) {
    const a = R() * Math.PI * 2, r = 42 + R() * 210, x = CX + Math.sin(a) * r, z = CZ - Math.cos(a) * r, height = 9 + R() * R() * 58, radius = 2.2 + height * (.1 + R() * .08);
    if (!open(x, z, radius) || columns.some(c => Math.hypot(c.x - x, c.z - z) < c.base + radius + 3)) continue;
    spires.push({ x, z, height, radius, rust: R() < .26, seed: Math.floor(R() * 1e4) });
  }
  // Stalactites at several scales: wide clusters, a few of them vast.
  for (let i = 0; i < 40; i++) {
    const a = R() * Math.PI * 2, r = Math.sqrt(R()) * 290, x = CX + Math.sin(a) * r, z = CZ - Math.cos(a) * r, big = R() < .22;
    if (Math.hypot(x - HOLE.x, z - HOLE.z) < HOLE.r + 12) continue;
    const parts = [], n = 3 + Math.floor(R() * 5), spread = big ? 22 : 10;
    for (let k = 0; k < n; k++) {
      const px = x + (R() - .5) * spread * 2, pz = z + (R() - .5) * spread * 2, length = (big ? 22 : 6) + R() * R() * (big ? 34 : 18);
      parts.push({ x: px, z: pz, length, radius: length * (.12 + R() * .08), rust: R() < .2 });
    }
    clusters.push(parts);
  }
  // Giant fungi on the shore's lip, at the feet of the columns and along the water.
  const glowing = (x, y, z, size, color) => shrooms.push({ x, y, z, size, color });
  for (let i = 0; i < 34; i++) {
    const a = R() * Math.PI * 2, r = 46 + R() * 200, x = CX + Math.sin(a) * r, z = CZ - Math.cos(a) * r;
    if (clearOfCamp(x, z, 8) && nearRoad(x, z) > 7) glowing(x, LAKE_Y + .6, z, 2.4 + R() * R() * 11, R() < .55 ? 'blue' : 'purple');
  }
  for (const c of columns) for (let i = 0; i < 3; i++) { const a = R() * 6.28, r = c.base * 1.02 + R() * 3; glowing(c.x + Math.cos(a) * r, LAKE_Y + .6, c.z + Math.sin(a) * r, 2.2 + R() * 6, R() < .5 ? 'blue' : 'purple'); }
  for (const [x, z, size, color] of [[-52, 84, 6, 'blue'], [-44, 88, 3.4, 'purple'], [-62, 76, 4.6, 'purple'], [-30, 92, 3, 'blue'], [-78, 18, 5, 'blue'], [-70, 2, 3.6, 'purple'], [14, 86, 3.2, 'purple'], [20, 82, 5, 'blue'], [34, 100, 4, 'blue'], [-14, 128, 5, 'purple'], [24, 156, 5.6, 'blue']]) glowing(x, LAKE_Y + 1, z, size, color);
  return { columns, spires, clusters, shrooms };
}

function createSoup() {
  const pos = [], col = [], mpos = [], mcol = [];
  const tri = (a, b, c, ca, cb, cc, { mirror = false, shade = null } = {}) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const len = Math.hypot(nx, ny, nz); if (len < 1e-6) return; nx /= len; ny /= len; nz /= len;
    const mx = (a[0] + b[0] + c[0]) / 3, mz = (a[2] + b[2] + c[2]) / 3, dx = CX - mx, dz = CZ - mz, dl = Math.hypot(dx, dz) || 1;
    const k = shade ? shade(nx, ny, nz) : .58 + .52 * Math.max(0, (nx * dx + nz * dz) / dl) + .22 * Math.max(0, ny);
    for (const [p, q] of [[a, ca], [b, cb], [c, cc]]) { pos.push(p[0], p[1], p[2]); col.push(q[0] * k, q[1] * k, q[2] * k); }
    if (mirror && Math.max(a[1], b[1], c[1]) > LAKE_Y && Math.min(a[1], b[1], c[1]) < LAKE_Y + 30) for (const [p, q] of [[a, ca], [c, cc], [b, cb]]) { mpos.push(p[0], 2 * LAKE_Y - p[1], p[2]); mcol.push(q[0] * k * .55, q[1] * k * .55, q[2] * k * .62); }
  };
  // A sheet of quads from at(u, v). closeU joins the last column to the first.
  const grid = (nu, nv, at, paint, { closeU = false, flip = false, ...rest } = {}) => {
    const P = [], C = [], w = nv + 1;
    for (let u = 0; u <= nu; u++) for (let v = 0; v <= nv; v++) {
      if (closeU && u === nu) { P.push(P[v]); C.push(C[v]); continue; }
      const p = at(u, v); P.push(p); C.push(paint(p[0], p[1], p[2], u, v));
    }
    for (let u = 0; u < nu; u++) for (let v = 0; v < nv; v++) {
      const a = u * w + v, b = a + w, c = a + 1, d = b + 1;
      if (flip) { tri(P[a], P[b], P[c], C[a], C[b], C[c], rest); tri(P[b], P[d], P[c], C[b], C[d], C[c], rest); }
      else { tri(P[a], P[c], P[b], C[a], C[c], C[b], rest); tri(P[b], P[c], P[d], C[b], C[c], C[d], rest); }
    }
  };
  return { pos, col, mpos, mcol, tri, grid };
}

// Amber from the baked lanterns, stronger on pale stone.
function poolLight(x, y, z, c, take) {
  for (const p of LIT) { const d = Math.hypot(x - p.x, (y - p.y) * 1.2, z - p.z); if (d < p.r) { const k = (1 - d / p.r) ** 2 * p.power * take; c[0] += AMBER[0] * k; c[1] += AMBER[1] * k; c[2] += AMBER[2] * k; } }
  return c;
}
// Rock in the tone of its distance: streaks of lighter stone, rust where asked, a little haze near the water, dark up in the roof.
const rock = (tone, { rust = 0, take = .32 } = {}) => (x, y, z) => {
  const n = fbm2(x * .035 + y * .05, z * .035 - y * .04), streak = fbm2(Math.atan2(x - CX, z - CZ) * 34, y * .022);
  let c = scale(tone, .62 + n * .62 + Math.max(0, streak - .5) * 1.5);
  if (rust) { const s = smooth((fbm2(x * .022 + 40, y * .035 + z * .022) - .47) * 7) * rust; c = mix(c, mix(RUST, tone, .38), s); }
  c = mix(c, HAZE, smooth((LAKE_Y + 20 - y) / 22) * .16);
  c = scale(c, 1 - .45 * smooth((y - 88) / 50));
  return poolLight(x, y, z, c, take);
};

function lathe(S, { x, z, rings, sides = 9, wobble = .18, paint, seed = 0, mirror = false, sx = 1, sz = 1 }) {
  S.grid(sides, rings.length - 1, (u, v) => {
    const [y, r] = rings[v], a = u / sides * Math.PI * 2, w = 1 + wobble * (fbm2(Math.cos(a) * 1.6 + seed, y * .06 + Math.sin(a) * 1.6) - .5) * 2;
    return [x + Math.cos(a) * r * w * sx, y, z + Math.sin(a) * r * w * sz];
  }, paint, { closeU: true, mirror });
}
const box = (S, x, y, z, sx, sy, sz, yaw, paint, opts) => {
  const c = Math.cos(yaw), s = Math.sin(yaw), at = (u, v, w) => [x + u * sx / 2 * c + w * sz / 2 * s, y + v * sy / 2, z - u * sx / 2 * s + w * sz / 2 * c];
  const corners = [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1], [1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]].map(q => at(...q));
  for (const [a, b, e, d] of [[0, 1, 2, 3], [4, 5, 6, 7], [1, 4, 7, 2], [5, 0, 3, 6], [3, 2, 7, 6]]) {
    const [pa, pb, pe, pd] = [corners[a], corners[b], corners[e], corners[d]], [ca, cb, ce, cd] = [pa, pb, pe, pd].map(p => paint(p[0], p[1], p[2]));
    S.tri(pa, pb, pe, ca, cb, ce, opts); S.tri(pa, pe, pd, ca, ce, cd, opts);
  }
};
// A frame on a wall: u to the right, v up, w out toward the camp.
function wallFrame(ox, oy, oz) {
  const dx = CX - ox, dz = CZ - oz, l = Math.hypot(dx, dz), fx = dx / l, fz = dz / l;
  return (u, v, w) => [ox + fz * u + fx * w, oy + v, oz - fx * u + fz * w];
}
// Rings around the w axis at (cu, cv): each ring [w, radius]. rx/ry stretch them.
const disc = (S, F, cu, cv, rings, sides, paint, { rx = 1, ry = 1, mirror = true, shade = null } = {}) => S.grid(sides, rings.length - 1, (u, v) => {
  const a = u / sides * Math.PI * 2, [w, r] = rings[v]; return F(cu + Math.cos(a) * r * rx, cv + Math.sin(a) * r * ry, w);
}, paint, { closeU: true, flip: true, mirror, shade });
const ball = (rw, r, n = 5) => Array.from({ length: n + 1 }, (_, i) => { const k = i / n * 2 - 1; return [k * rw, r * Math.sqrt(Math.max(.002, 1 - k * k))]; });
const fbox = (S, F, u, v, w, su, sv, sw, paint, opts) => {
  const c = [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1], [-1, 1, -1], [1, 1, -1], [1, -1, -1], [-1, -1, -1]].map(([a, b, e]) => F(u + a * su / 2, v + b * sv / 2, w + e * sw / 2));
  for (const [a, b, e, d] of [[0, 1, 2, 3], [3, 2, 5, 4], [1, 6, 5, 2], [7, 0, 3, 4], [0, 7, 6, 1]]) { const pts = [c[a], c[b], c[e], c[d]], [ca, cb, ce, cd] = pts.map(p => paint(p[0], p[1], p[2])); S.tri(pts[0], pts[1], pts[2], ca, cb, ce, opts); S.tri(pts[0], pts[2], pts[3], ca, ce, cd, opts); }
};

function buildWalls(S) {
  const sides = 112, heights = [LAKE_Y - 3, 2, 14, 30, 50, 74, 100, 124, 152], tone = TONES[5];
  S.grid(sides, heights.length - 1, (u, v) => {
    const a = u / sides * Math.PI * 2, y = heights[v], flute = Math.abs(Math.sin(a * 17 + y * .012)) * 13 + Math.abs(Math.sin(a * 41 + 1)) * 5, r = wallRadius(a) + flute + (fbm2(a * 6 + y * .03, y * .05) - .5) * 26;
    return [CX + Math.sin(a) * r, y, CZ - Math.cos(a) * r];
  }, rock(tone, { rust: .32 }), { closeU: true, flip: true, mirror: true });
  // Layered ridges in front of it: each one lower, nearer and darker.
  for (const [radius, low, high, step, n, seed] of [[.74, 22, 62, 4, 96, 3], [.5, 12, 34, 2, 84, 8]]) {
    S.grid(n, 2, (u, v) => {
      const a = u / n * Math.PI * 2, r = wallRadius(a) * radius + (fbm2(Math.sin(a) * 3 + seed, Math.cos(a) * 3) - .5) * 70, head = Math.atan2(HEAD.x - CX, -(HEAD.z - CZ)), off = Math.abs(Math.atan2(Math.sin(a - head), Math.cos(a - head)));
      const crest = (low + (high - low) * fbm2(Math.sin(a) * 5 + seed, Math.cos(a) * 5 + 2) ** 1.5 + Math.abs(Math.sin(a * 37 + seed)) * 7) * (.35 + .65 * smooth((off - .1) / .3)), y = [LAKE_Y - 2, LAKE_Y + 3 + crest * .35, LAKE_Y + crest][v];
      return [CX + Math.sin(a) * (r + (2 - v) * 9), y, CZ - Math.cos(a) * (r + (2 - v) * 9)];
    }, rock(TONES[step], { rust: seed === 3 ? .3 : .18 }), { closeU: true, flip: true, mirror: true });
  }
}
function buildRoof(S) {
  const sides = 64, rows = 20, paint = (x, y, z) => { const c = rock(toneAt(fromCamp(x, z) * .8 + 56))(x, 92, z), rib = fbm2(x * .018 + 3, z * .018) > .56 ? 1.4 : 1; return scale(c, rib * .9); };
  S.grid(sides, rows, (u, v) => {
    const a = u / sides * Math.PI * 2, k = (v / rows) ** 1.25, r = k * (wallRadius(a) + 34), x = CX + Math.sin(a) * r, z = CZ - Math.cos(a) * r;
    return [x, ceilingAt(x, z), z];
  }, paint, { closeU: true, shade: (nx, ny) => .72 + .55 * Math.max(0, Math.abs(ny) < .92 ? 1 - Math.abs(ny) : 0) * 2 });
}
function buildColumns(S, plan) {
  for (const c of plan.columns) {
    const top = ceilingAt(c.x, c.z) + 6, h = top - LAKE_Y + 3, rings = Array.from({ length: 15 }, (_, i) => {
      const t = i / 14, y = LAKE_Y - 3 + t * h, flare = (1 - 2 * Math.min(t, 1 - t)) ** 1.8;
      return [y, (c.waist + (c.base - c.waist) * flare * (t > .5 ? .86 : 1)) * (1 + .17 * Math.abs(Math.sin(t * c.tiers * Math.PI)))];
    });
    lathe(S, { x: c.x, z: c.z, rings, sides: 9, wobble: .22, seed: c.seed, mirror: true, paint: rock(toneAt(fromCamp(c.x, c.z)), { rust: c.rust ? .45 : 0 }) });
  }
  for (const s of plan.spires) {
    const rings = [[LAKE_Y - 2, s.radius], [LAKE_Y + s.height * .3, s.radius * .62], [LAKE_Y + s.height * .68, s.radius * .28], [LAKE_Y + s.height, .01]];
    lathe(S, { x: s.x, z: s.z, rings, sides: 6, wobble: .24, seed: s.seed, mirror: true, paint: rock(toneAt(fromCamp(s.x, s.z)), { rust: s.rust ? .5 : .06 }) });
  }
  for (const parts of plan.clusters) for (const p of parts) {
    const top = ceilingAt(p.x, p.z) + 2, tone = toneAt(fromCamp(p.x, p.z) * .82 + 60), paint = rock(tone), tipRust = p.rust ? mix(RUST, tone, .25) : null, rings = [[top - p.length, .01], [top - p.length * .55, p.radius * .42], [top, p.radius]];
    lathe(S, { x: p.x, z: p.z, rings, sides: 5, wobble: .2, seed: p.x, paint: tipRust ? (x, y, z) => mix(paint(x, 88, z), tipRust, smooth((top - p.length * .35 - y) / (p.length * .6))) : (x, y, z) => paint(x, 88, z) });
  }
}
// Rock bridges high overhead, joining column to column and to the wall.
function buildArches(S) {
  const spans = [[-92, 40, -40, 96, 74, 84], [-170, -70, 40, -20, -150, 88], [70, 96, 80, 214, 56, 84], [214, -46, 40, 130, 102, 90]];
  for (const [ax, az, ay, bx, bz, by] of spans) {
    const rise = 24, thick = 7, n = 16, tone = toneAt(fromCamp((ax + bx) / 2, (az + bz) / 2)), mx = bx - ax, mz = bz - az, l = Math.hypot(mx, mz), sx = -mz / l, sz = mx / l;
    S.grid(n, 6, (u, v) => {
      const t = u / n, a = v / 6 * Math.PI * 2, w = thick * (1 + (2 * t - 1) ** 2 * .9) * (.86 + fbm2(t * 9, v) * .3), y = lerp(ay, by, t) + rise * 4 * t * (1 - t);
      return [ax + mx * t + sx * Math.cos(a) * w, y + Math.sin(a) * w * .8, az + mz * t + sz * Math.cos(a) * w];
    }, rock(tone, { rust: .25 }), { mirror: false });
  }
}
// The hero: a head as tall as a tower, its crown a ring of sun rays, lit by the beam.
function buildHead(S) {
  const { x, y, z, size: s } = HEAD, F = wallFrame(x, y, z), dx = SEARCHLIGHT.x - x, dy = SEARCHLIGHT.y - y, dz = SEARCHLIGHT.z - z, dl = Math.hypot(dx, dy, dz), L = [dx / dl, dy / dl + .55, dz / dl];
  const gold = (x2, y2, z2) => { const d = Math.hypot(x2 - x, y2 - y, z2 - z), k = .16 + 1.02 * Math.exp(-(d * d) / (s * s * 2.1)); return scale(GOLD, k); };
  const shade = (nx, ny, nz) => .36 + .82 * Math.max(0, (nx * L[0] + ny * L[1] + nz * L[2]) / 1.14);
  const dark = () => scale(BLACK, 1), rim = (x2, y2, z2) => scale(gold(x2, y2, z2), .62), opts = { mirror: true, shade };
  // The shoulders of rock it is carved from.
  { const off = Math.hypot(x - CX, z - CZ), ax = (x - CX) / off, az = (z - CZ) / off, back = s * 2.25;
    lathe(S, { x: x + ax * back, z: z + az * back, rings: [[LAKE_Y - 3, s * 2.3], [y - s, s * 2.05], [y + s * .4, s * 1.85], [y + s * 1.2, s * 1.4], [y + s * 2.2, s * .5]], sides: 12, wobble: .16, seed: 31, mirror: true, paint: rock(TONES[4], { rust: .3 }) }); }
  // Crown first, so it reads behind the face: a ring of rays and a band.
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI * (-.08 + i / 12 * 1.16), ca = Math.cos(a), sa = Math.sin(a), r0 = s * 1.02, r1 = s * (i % 2 ? 1.5 : 1.82), wd = s * .17, w = s * .02;
    const p = [F(ca * r0 - sa * wd, sa * r0 * 1.04 + ca * wd + s * .05, w), F(ca * r0 + sa * wd, sa * r0 * 1.04 - ca * wd + s * .05, w), F(ca * r1, sa * r1 * 1.04 + s * .05, w - s * .1), F(ca * r0 - sa * wd, sa * r0 * 1.04 + ca * wd + s * .05, w + s * .16), F(ca * r0 + sa * wd, sa * r0 * 1.04 - ca * wd + s * .05, w + s * .16)];
    const c = p.map(q => gold(q[0], q[1], q[2]));
    S.tri(p[3], p[4], p[2], c[3], c[4], c[2], opts); S.tri(p[0], p[3], p[2], c[0], c[3], c[2], opts); S.tri(p[4], p[1], p[2], c[4], c[1], c[2], opts);
  }
  disc(S, F, 0, s * .05, ball(s * .5, s * 1.06, 3).map(([w, r]) => [w - s * .15, r]), 18, rim, { ry: 1.03, shade });
  // The face: a broad mass, a jaw, then the features on top of it.
  disc(S, F, 0, 0, ball(s * .62, s * .9, 6), 16, gold, { ry: 1.12, shade });
  disc(S, F, 0, -s * .7, ball(s * .34, s * .56, 4), 12, gold, { rx: 1.1, ry: .66, shade });
  fbox(S, F, -s * .36, s * .42, s * .5, s * .56, s * .16, s * .3, gold, opts); fbox(S, F, s * .36, s * .42, s * .5, s * .56, s * .16, s * .3, gold, opts);
  for (const side of [-1, 1]) {
    disc(S, F, side * s * .36, s * .17, [[s * .42, s * .22], [s * .62, s * .22], [s * .66, s * .15], [s * .6, s * .12], [s * .66, s * .065], [s * .68, .01]], 10, (a, b, c) => { const k = Math.hypot(...[a - F(side * s * .36, s * .17, 0)[0], b - F(side * s * .36, s * .17, 0)[1], c - F(side * s * .36, s * .17, 0)[2]]); return k < s * .63 ? scale(gold(a, b, c), .4) : gold(a, b, c); }, { shade });
    disc(S, F, side * s * .95, s * .02, [[-s * .1, s * .26], [s * .22, s * .26], [s * .24, s * .13], [s * .12, .01]], 8, rim, { ry: 1.2, shade });
    disc(S, F, side * s * .58, -s * .24, [[s * .4, s * .13], [s * .55, s * .11], [s * .56, s * .05], [s * .52, .01]], 7, rim, { shade });
  }
  fbox(S, F, 0, -s * .02, s * .68, s * .24, s * .44, s * .3, gold, opts);
  // The mouth: a dark cave you could drive the crawlers into, teeth of cut stone.
  disc(S, F, 0, -s * .56, [[s * .58, s * .42], [s * .72, s * .4], [s * .68, s * .3], [s * .56, .02]], 12, (a, b, c) => { const q = F(0, -s * .56, s * .65), k = Math.hypot(a - q[0], b - q[1], c - q[2]); return k < s * .33 ? dark() : rim(a, b, c); }, { rx: 1.05, ry: .5, shade });
  for (let i = -3; i <= 3; i++) { fbox(S, F, i * s * .115, -s * .42, s * .68, s * .09, s * .1, s * .08, gold, opts); if (Math.abs(i) < 3) fbox(S, F, i * s * .12, -s * .71, s * .66, s * .09, s * .08, s * .08, rim, opts); }
}
// A dome half sunk in the far shore: ribs, bands and rows of studs.
function buildDome(S) {
  const { x, z, r } = DOME, tone = TONES[4], paint = rock(tone, { rust: .32 }), band = (a, b, c) => scale(paint(a, b, c), 1.7), base = LAKE_Y - 3, height = r * 1.02, top = base + height, sides = 24;
  const rings = Array.from({ length: 10 }, (_, i) => { const t = i / 9, a = t * Math.PI / 2; return [base + Math.sin(a) * height, Math.cos(a) * r + .01]; });
  lathe(S, { x, z, rings, sides, wobble: .018, seed: 2, mirror: true, paint });
  for (let m = 0; m < 12; m++) {
    const a = m / 12 * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), n = 9, off = (t, side, out) => { const q = t * Math.PI / 2, rad = Math.cos(q) * (r + out), y = base + Math.sin(q) * (height + out); return [x + ca * rad - sa * side, y, z + sa * rad + ca * side]; };
    S.grid(n, 3, (u, v) => off(u / n * .92, [-1.9, -1.9, 1.9, 1.9][v], [.2, 2.6, 2.6, .2][v]), band, { mirror: true });
    for (let k = 1; k < 8; k++) { const t = k / 9 + .03, c = off(t, 4.5, 2.5), d = off(t, -4.5, 2.5), e = off(t, 0, 5), p = band(c[0], c[1], c[2]); S.tri(c, e, d, p, p, p); S.tri(d, e, c, p, p, p); }
  }
  for (const k of [.35, .7]) { const y = base + height * k, rad = Math.sqrt(Math.max(0, 1 - k * k)) * r + 2.8; lathe(S, { x, z, rings: [[y - 2, rad - 2.6], [y - 1.4, rad], [y + 1.4, rad], [y + 2, rad - 2.6]], sides, wobble: 0, paint: band }); }
  lathe(S, { x, z, rings: [[top - 3, r * .24], [top + 2, r * .25], [top + 5, r * .16], [top + 9, r * .17], [top + 12, r * .09], [top + 20, r * .1], [top + 24, .01]], sides: 12, wobble: .02, paint: band, mirror: true });
}
// A carved round door: rings stepping in, blocks and studs around a black heart.
function buildGate(S, { x, y, z, r }, tone, rust, { mirror = true } = {}) {
  const F = wallFrame(x, y, z), paint = rock(tone, { rust }), raised = (a, b, c) => scale(paint(a, b, c), 1.7), heart = () => BLACK;
  disc(S, F, 0, 0, [[-r * .3, r * 1.45], [r * .1, r * 1.3], [r * .12, r * 1.08], [r * .24, r * .98], [r * .24, r * .8], [r * .1, r * .74], [r * .14, r * .6]], 22, raised, { mirror });
  disc(S, F, 0, 0, [[r * .14, r * .6], [r * .02, r * .54], [-r * .4, r * .3], [-r * .6, .01]], 16, heart, { mirror });
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * Math.PI * 2, u = Math.cos(a) * r * .9, v = Math.sin(a) * r * .9;
    fbox(S, F, u, v, r * .3, r * .14, r * .14, r * .1, i % 2 ? raised : paint);
    if (i % 2) { const q = F(Math.cos(a) * r * 1.2, Math.sin(a) * r * 1.2, r * .2), t = F(Math.cos(a + .06) * r * 1.2, Math.sin(a + .06) * r * 1.2, r * .13), e = F(Math.cos(a - .06) * r * 1.2, Math.sin(a - .06) * r * 1.2, r * .13), p = raised(q[0], q[1], q[2]); S.tri(t, q, e, p, p, p); }
  }
  // Rust drips of stone over the lintel.
  for (let i = 0; i < 12; i++) {
    const a = .2 + i / 11 * 2.74, b = F(Math.cos(a) * r * 1.42, Math.sin(a) * r * 1.3 + r * .12, r * .04), len = r * (.22 + ((i * 7) % 5) * .13), bw = r * .06;
    const tip = [b[0], b[1] - len, b[2]], l = [b[0] - bw, b[1], b[2]], m = [b[0] + bw, b[1], b[2]], red = mix(RUST, tone, .25);
    S.tri(l, tip, m, red, red, red); S.tri(m, tip, l, red, red, red);
  }
}
// A second face in the wall, dark and unlit: nobody's lamp reaches it.
function buildSilentFace(S, x, y, z, s) {
  const F = wallFrame(x, y, z), tone = TONES[5], paint = rock(tone, { rust: .3 }), up = (a, b, c) => scale(paint(a, b, c), 1.5), hole = () => BLACK;
  disc(S, F, 0, 0, ball(s * .5, s, 5), 14, paint, { rx: .8, ry: 1.1 });
  fbox(S, F, 0, s * .36, s * .42, s * 1.3, s * .14, s * .22, up); fbox(S, F, 0, -s * .08, s * .5, s * .2, s * .46, s * .22, up);
  for (const side of [-1, 1]) disc(S, F, side * s * .34, s * .14, [[s * .36, s * .19], [s * .5, s * .17], [s * .46, s * .06], [s * .3, .01]], 8, hole);
  disc(S, F, 0, -s * .56, [[s * .4, s * .34], [s * .5, s * .3], [s * .36, .01]], 10, hole, { ry: .5 });
}
// The way down: a collar of rock out of the lake, its well lined with dark and warmed from below.
function buildPit(S) {
  const { x, z, r, top, bottom } = PIT, tone = TONES[0];
  const well = (a, y, c) => { const n = fbm2(a * .5, y * .4 + c * .5); return mix(scale(tone, .9 + n), AMBER, Math.max(0, 1 - (y - bottom) / 40) ** 1.2 * .5); };
  const lip = (a, y, c) => poolLight(a, y, c, scale(mix(TONES[2], PALE, .55), .6 + fbm2(a * .6, c * .6) * .7), 1);
  lathe(S, { x, z, rings: [[LAKE_Y - 3, r + 7], [LAKE_Y + 1, r + 4.4], [top - .2, r + 2.4]], sides: 18, wobble: .1, seed: 11, paint: rock(TONES[1], { take: .7 }) });
  lathe(S, { x, z, rings: [[top - .2, r + 2.4], [top, r + 1.4], [top, r + .5], [top - .6, r]], sides: 18, wobble: .03, seed: 11, paint: lip });
  lathe(S, { x, z, rings: [[bottom, r * .9], [bottom + 16, r * .96], [bottom + 30, r], [top - .2, r]], sides: 18, wobble: .03, seed: 11, paint: well });
  const floor = () => scale(AMBER, .14); lathe(S, { x, z, rings: [[bottom, r * .9], [bottom - 1, .01]], sides: 18, wobble: 0, paint: floor });
  // Rings of timber going down the well, each one dimmer until the glow takes over.
  const timber = lin(0x2a1c12);
  for (let k = 0; k < 7; k++) {
    const y = top - 3 - k * 5, paint = (a, b, c) => { const n = Math.max(0, 1 - (b - bottom) / 26); return mix(scale(timber, .9 - k * .08), AMBER, n * n * .3); };
    lathe(S, { x, z, rings: [[y - .3, r * .9], [y + .3, r * .9], [y + .3, r * .97], [y - .3, r * .97]], sides: 14, wobble: 0, paint });
  }
}
// The road: a pale causeway on skirts of rock, winding across the water to the gate.
function buildRoad(S) {
  const n = 104, skirt = rock(TONES[1], { take: .4 }), pale = (x, y, z) => {
    const b = fbm2(Math.floor(x / 1.5) * 3.1, Math.floor(z / 1.5) * 2.7), far = smooth(fromCamp(x, z) / 240);
    return poolLight(x, y, z, scale(mix(PALE, HAZE, far * .4), (.5 + b * .7) * (1 - far * .1)), 1.3);
  };
  const at = (u, side) => { const a = roadAt(u / n), b = roadAt((u + 1) / n), dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz) || 1, w = (a[1] < -7 && a[2] < 50 ? 2.6 : 3.2) * side; return [a[0] - dz / l * w, a[1], a[2] + dx / l * w]; };
  S.grid(n, 1, (u, v) => at(u, v ? 1 : -1), pale, { flip: true, mirror: true });
  for (const side of [-1, 1]) S.grid(n, 1, (u, v) => { const p = at(u, side); if (!v) return p; const a = roadAt(u / n); return [a[0] + (p[0] - a[0]) * 2.2, LAKE_Y - 1, a[2] + (p[2] - a[2]) * 2.2]; }, skirt, { flip: side < 0, mirror: false });
}
// The expedition's shore, under the camp's cliff: a pale shelf, the old crawlers, tarps, stores and lanterns.
const shoreY = LAKE_Y + 1.1;
export function shoreEdge(x) { return 84 + fbm2(x * .05 + 3, 2) * 22; }
export function shoreWest(z) { return -74 - fbm2(z * .05 + 8, 5) * 22; }
function buildShore(S) {
  const stone = (x, y, z) => { const n = fbm2(x * .18, z * .18), far = fbm2(x * .04, z * .04); return poolLight(x, y, z, scale(mix(TONES[2], PALE, .4), .55 + n * .6 + far * .2), 1.1); };
  const shelf = (a, b) => (u, v) => { const p = a(u / 46), q = b(u / 46), k = v / 9, last = v === 9; return [lerp(p[0], q[0], k), last ? LAKE_Y - 1.4 : shoreY + (v === 0 ? .3 : 0), lerp(p[1], q[1], k)]; };
  S.grid(40, 9, shelf(t => [lerp(-98, 34, t), 31.5], t => { const x = lerp(-98, 34, t); return [x, shoreEdge(x)]; }), stone, { flip: true, mirror: false });
  S.grid(22, 9, shelf(t => [-21, lerp(-16, 34, t)], t => { const z = lerp(-16, 34, t); return [shoreWest(z), z]; }), stone, { flip: false, mirror: false });
}
function buildExpedition(S, glows) {
  const dull = hex => { const base = lin(hex); return (x, y, z) => poolLight(x, y, z, scale(base, .9), .55); };
  const hullTone = dull(0x2a1c20), plate = dull(0x4a2f2a), keel = dull(0x1a1218), glass = () => lin(0xffb860), canvas = dull(0x5a4c34), olive = dull(0x3a4228), wood = dull(0x4a3020), iron = dull(0x1a1c22);
  const y0 = shoreY;
  // A crawler's hull beached by the water: a riveted boat on tracks, turret and all.
  const crawler = (x, z, yaw, L, W, H) => {
    const c = Math.cos(yaw), s = Math.sin(yaw), at = (a, b, e) => [x + a * c + e * s, y0 + b, z - a * s + e * c], stations = [[-1, .34, .4], [-.84, .86, .9], [-.3, 1, 1], [.4, 1, 1], [.82, .72, .86], [1, .16, .46]];
    S.grid(stations.length - 1, 5, (u, v) => { const [t, sw, sh] = stations[u], q = [[-1, .08], [-1.02, .56], [-.72, 1], [.72, 1], [1.02, .56], [1, .08]][v]; return at(t * L / 2, q[1] * H * sh, q[0] * W / 2 * sw); }, (a, b, e) => { const st = Math.abs(Math.sin(a * .7 + e * .2)) > .92 ? 1.4 : 1; return scale(hullTone(a, b, e), st); }, { mirror: true });
    for (const t of [-.5, -.1, .3]) box(S, ...at(t * L / 2, H * 1.0, 0), L * .1, H * .22, W * .92, yaw, plate);
    for (const side of [-1, 1]) box(S, ...at(0, H * .1, side * W * .46), L * .86, H * .32, W * .16, yaw, keel, { mirror: true });
    box(S, ...at(-L * .1, H * 1.28, 0), L * .22, H * .5, W * .42, yaw, plate);
    box(S, ...at(-L * .1 + L * .115, H * 1.32, 0), L * .012, H * .16, W * .34, yaw, glass);
    for (const side of [-1, 1]) box(S, ...at(L * .2, H * .92, side * W * .3), L * .05, H * .14, W * .06, yaw, glass);
    glows.push({ x: at(L * .46, 0, 0)[0], y: y0 + H * .8, z: at(L * .46, 0, 0)[2], color: LANTERN, size: 4.5 });
  };
  crawler(-29, 74, .3, 19, 7, 4.6);
  crawler(5, 78, -1.1, 11, 5, 3);
  crawler(-65, 18, 1.45, 14, 5.6, 3.6);
  // A long flat barge riding on the still water, tied to the shore.
  S.grid(4, 3, (u, v) => { const t = u / 4, b = [1.1, 1, 1, 1][v], q = [[-1, 2.1], [-1, .1], [1, .1], [1, 2.1]][v]; return [-58 + t * 24 + q[0] * 3.4 * b * Math.sin(t * Math.PI) ** .4, LAKE_Y + q[1], 104 + t * 6]; }, keel, { mirror: true });
  // Tarps on poles: lean-to prisms over the stores.
  const tarp = (x, z, w, d, h, yaw, paint) => {
    const c = Math.cos(yaw), s = Math.sin(yaw), at = (a, b, e) => [x + a * c + e * s, y0 + b, z - a * s + e * c], p = [at(-w / 2, 0, -d / 2), at(w / 2, 0, -d / 2), at(w / 2, h, 0), at(-w / 2, h, 0), at(-w / 2, 0, d / 2), at(w / 2, 0, d / 2)], color = q => paint(q[0], q[1], q[2]), q = p.map(color);
    S.tri(p[0], p[1], p[2], q[0], q[1], q[2]); S.tri(p[0], p[2], p[3], q[0], q[2], q[3]); S.tri(p[5], p[4], p[3], q[5], q[4], q[3]); S.tri(p[5], p[3], p[2], q[5], q[3], q[2]);
    S.tri(p[1], p[5], p[2], q[1], q[5], q[2]); S.tri(p[4], p[0], p[3], q[4], q[0], q[3]);
  };
  for (const [x, z, w, d, h, yaw, paint] of [[-11, 76, 6, 5, 2.8, .2, canvas], [-20, 62, 7, 5, 3.1, -.4, olive], [-38, 66, 5, 4, 2.5, .8, canvas], [-58, 8, 6, 4.4, 2.8, 1.5, olive], [-62, -6, 5, 4, 2.4, 1.2, canvas], [-50, 80, 5, 4, 2.6, -.2, olive]]) tarp(x, z, w, d, h, yaw, paint);
  // Stores: stacks of crates and barrels (one lid each, nobody will count the staves).
  const R = rng(733);
  for (const [cx, cz, n] of [[-4, 62, 6], [-16, 68, 7], [-42, 72, 8], [-60, 26, 7], [-56, 0, 5], [-24, 82, 5], [14, 72, 5]]) for (let i = 0; i < n; i++) {
    const x = cx + (R() - .5) * 8, z = cz + (R() - .5) * 6, s = .9 + R() * .9;
    if (R() < .62) { box(S, x, y0 + s / 2, z, s, s, s, R() * 1.5, wood); if (R() < .4) box(S, x, y0 + s * 1.4, z, s * .8, s * .8, s * .8, R() * 1.5, wood); }
    else lathe(S, { x, z, rings: [[y0, s * .4], [y0 + s * .55, s * .5], [y0 + s * 1.1, s * .4], [y0 + s * 1.1, .01]], sides: 6, wobble: 0, paint: iron });
  }
  // Lantern poles along the shore and the whole road, thinning out with distance.
  const pole = (x, z, y, size = 5) => { box(S, x, y + 1.7, z, .16, 3.4, .16, 0, iron); box(S, x, y + 3.3, z, .34, .5, .34, 0, glass); glows.push({ x, y: y + 3.3, z, color: LANTERN, size }); };
  for (const p of POOLS) pole(p.x + 1.2, p.z + 1.4, p.z < 90 && p.x < 1 ? y0 : p.y - 2);
  for (let t = .22; t < 1; t += .052) { const [x, z, y] = roadAt(t); pole(x + 4.2, z, y, 3.6); }
}
// Fungi as tall as the panas' lanterns are small: a stem, a cap, a halo in the sky of dark.
function buildShrooms(S, plan, glows) {
  for (const m of plan.shrooms) {
    const tint = m.color === 'blue' ? BLUE : PURPLE, far = 1 - .55 * smooth(fromCamp(m.x, m.z) / 240), stem = () => scale(tint, .16 * far), cap = (x, y, z) => scale(tint, (.2 + .62 * smooth((y - m.y) / (m.size * 1.2))) * far);
    lathe(S, { x: m.x, z: m.z, rings: [[m.y - .4, m.size * .16], [m.y + m.size * .8, m.size * .1]], sides: 5, wobble: 0, paint: stem, mirror: false });
    lathe(S, { x: m.x, z: m.z, rings: [[m.y + m.size * .68, m.size * .62], [m.y + m.size * .92, m.size * .54], [m.y + m.size * 1.12, m.size * .26], [m.y + m.size * 1.2, .01]], sides: 7, wobble: .05, paint: cap, mirror: true, seed: m.x });
    glows.push({ x: m.x, y: m.y + m.size * .9, z: m.z, color: GLOW_COLOR[m.color], size: m.size * 3.6 });
  }
}
// A far string of lights climbing the wall, and a lit stage on a column, so the eye has a ruler.
function buildFarLights(glows) {
  const curve = (ax, ay, az, bx, by, bz, n, wave = 12) => { for (let i = 0; i <= n; i++) { const t = i / n; glows.push({ x: lerp(ax, bx, t) + Math.sin(t * 15) * wave * .4, y: lerp(ay, by, t), z: lerp(az, bz, t) + Math.cos(t * 13) * wave * .3, color: LANTERN, size: 4.6 }); } };
  curve(-188, -4, -162, -150, 62, -212, 22); curve(-150, 62, -212, -122, 74, -228, 6, 2);
  curve(212, -4, 120, 232, 44, 134, 14); curve(90, -6, -210, 112, 16, -196, 9, 4);
}

// Mist and glow where each fall lands, and the ledge it pours from.
function buildFalls(S, glows) {
  for (const f of FALLS) {
    const tone = TONES[4], F = wallFrame(f.x, f.top, f.z), paint = rock(tone), dark = () => scale(TONES[1], .8);
    fbox(S, F, 0, 3, -6, f.width * 3.2, 15, 16, dark);
    fbox(S, F, 0, -1.5, 1, f.width * 3.6, 3, 14, paint);
    glows.push({ x: f.x + (CX - f.x) * .02, y: LAKE_Y + 6, z: f.z + (CZ - f.z) * .02, color: 0x6fb4d8, size: f.width * 11 });
    glows.push({ x: f.x + (CX - f.x) * .024, y: LAKE_Y + 22, z: f.z + (CZ - f.z) * .024, color: 0x2f6f96, size: f.width * 15 });
  }
}

let built = null;
export function buildVista() {
  if (built) return built;
  const S = createSoup(), glows = [], plan = vistaPlan();
  buildWalls(S); buildRoof(S); buildColumns(S, plan); buildArches(S);
  buildHead(S); buildDome(S); buildGate(S, GATE, TONES[4], .5);
  buildGate(S, { x: 216, y: 44, z: 158, r: 32 }, TONES[5], .35); buildSilentFace(S, -132, 56, -240, 44); buildSilentFace(S, -258, 48, -56, 34);
  buildPit(S); buildRoad(S); buildShore(S); buildExpedition(S, glows); buildShrooms(S, plan, glows); buildFarLights(glows); buildFalls(S, glows);
  built = { positions: new Float32Array(S.pos), colors: new Float32Array(S.col), mirrorPositions: new Float32Array(S.mpos), mirrorColors: new Float32Array(S.mcol), glows, plan };
  return built;
}
