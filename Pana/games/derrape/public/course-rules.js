// How a car stays on (or leaves) the course, as plain math: checkpoint laps,
// shortcut planks, open edges you can fall off, when the zamuro comes to
// carry a car back, and open water where cars run as lanchas. track-runtime.js and game.js use these;
// tests/course-rules.test.js checks them. No Three.js, no DOM.

// The lap is split into checkpoint sectors. Crossing the line forward only
// counts when the car saw nearly all of them, so a shortcut (which skips at
// most one) still counts but driving back and forth over the line does not.
export const SECTORS = 8;
export const ALL_SECTORS = (1 << SECTORS) - 1;
const bits = (n) => { let k = 0; for (; n; n &= n - 1) k++; return k; };
export const sectorOf = (prog, total) => Math.min(SECTORS - 1, Math.max(0, Math.floor(prog / total * SECTORS)));

// Updates c.lap and c.sectors for a move from prevProg to prog (metres from
// the line). Returns +1 / -1 when the lap changed, else 0.
export function advanceLap(c, prevProg, prog, total) {
  c.sectors = (c.sectors ?? ALL_SECTORS) | (1 << sectorOf(prog, total));
  if (prevProg > total * 0.75 && prog < total * 0.25) {
    if (bits(c.sectors) >= SECTORS - 1) { c.lap++; c.sectors = 1 << sectorOf(prog, total); return 1; }
    return 0;
  }
  if (prevProg < total * 0.25 && prog > total * 0.75) { c.lap--; c.sectors = ALL_SECTORS; return -1; }
  return 0;
}

// Closest point on segment a→b to p: { t (0..1), d (distance) }.
export function segmentPoint(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, len = dx * dx + dz * dz;
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len)) : 0;
  return { t, d: Math.hypot(px - ax - dx * t, pz - az - dz * t) };
}

// A shortcut plank road from a to b ({x, z, y}) of width w, with a gentle
// arch in the middle. Returns the deck height at (x, z), or null when off it.
export function plankHeight(sc, x, z) {
  const { t, d } = segmentPoint(x, z, sc.a.x, sc.a.z, sc.b.x, sc.b.z);
  if (d > sc.w / 2 || t <= 0 || t >= 1) return null;
  return sc.a.y + (sc.b.y - sc.a.y) * t + Math.sin(Math.PI * t) * (sc.arch ?? 1.2);
}

// Open edges: { u0, u1, side } ranges (fractions of the lap) where there is
// no wall and the ground drops away. `u` is the car's lap fraction, `side`
// the sign of its offset from the centreline.
export function isOpenEdge(drops, u, side) {
  return (drops || []).some(d => (d.side === 0 || d.side === side) &&
    (d.u0 <= d.u1 ? u >= d.u0 && u <= d.u1 : u >= d.u0 || u <= d.u1));
}

// Rescue: the zamuro lifts the car for RESCUE_TIME seconds and sets it back
// on the last safe stretch of road.
export const RESCUE_TIME = 1.7;
export const OUT_TIME = 0.45;            // seconds off the course before the pickup
export const STUCK_TIME = 3;             // seconds stuck before an automatic pickup
export const OPEN_MARGIN = 2.5;          // past HW + this the car is off the course

// Off the course: beyond an open edge, or far past the road (only reachable
// by flying off a shortcut).
export const offCourse = (absOff, hw, openEdge, onPlank) => !onPlank && (absOff > hw + OPEN_MARGIN || (openEdge && absOff > hw + 0.6));

// Stuck: barely moving while it should be driving.
export const stuckStep = (stuckT, speed, trying, dt) => trying && Math.abs(speed) < 1.5 ? stuckT + dt : 0;

// ---------- open water ----------
// A transform gate is a stretch of the lap where cars run as lanchas
// (transform-gates.js). Most gates keep the road as the driving surface. An
// `open: true` gate is a real lagoon instead: the route dips under the water
// between two slipways, and the track's `lagoonAt(x, z)` (surface height, or
// null where there is no water) says where a boat floats. Inside it there
// are no tire walls and no zamuro; banks, islets and the edge of the region
// bounce the boat back. track-runtime.js builds T.openWater; drive.js and
// transform-gates.js read it.

export const WATER_MARGIN = 40;   // metres of open water past each end of an open run
const FLOAT_DEPTH = 0.15;        // shallower than this is ground, not water

// Route gates in arc length, from the definition's fractions. A gate may
// name world points instead (`fromAt` / `toAt: [x, z]`, e.g. a waterfall):
// it starts (or ends) where the route passes closest, `lead` metres early.
// `below: y` is where the route itself dips under y (a lagoon's waterline).
export function gateRuns(T) {
  return (T.def.transformGates || []).map(g => {
    if (g.below != null) return { ...g, ...underRun(T, g.below) };
    const s0 = g.fromAt ? T.nearest(g.fromAt[0], g.fromAt[1]).s - (g.lead ?? 0) : g.from * T.TOTAL;
    const s1 = g.toAt ? T.nearest(g.toAt[0], g.toAt[1]).s : g.to * T.TOTAL;
    return { ...g, s0, len: ((s1 - s0) % T.TOTAL + T.TOTAL) % T.TOTAL };
  }).filter(g => g.len > 10);
}

// The longest stretch of route under height y, in metres.
function underRun(T, y) {
  const step = 1, n = Math.ceil(T.TOTAL / step), wet = i => T.heightAtS(i * step) < y;
  let start = 0;
  while (start < n && wet(start)) start++;   // begin the scan on dry road
  let best = { s0: 0, len: 0 }, from = -1;
  for (let k = 1; k <= n; k++) {
    const i = (start + k) % n;
    if (wet(i) && from < 0) from = start + k;
    if (!wet(i) && from >= 0) { if ((start + k - from) * step > best.len) best = { s0: (from % n) * step, len: (start + k - from) * step }; from = -1; }
  }
  return best;
}

// Metres from a run's start to route position s, wrapped into [0, TOTAL).
export const alongRun = (g, s, total) => ((s - g.s0) % total + total) % total;

// The open water of a track, or null when it has none.
export function openWater(T) {
  const runs = gateRuns(T).filter(g => g.open), lagoonAt = T.def.lagoonAt;
  if (!runs.length || !lagoonAt) return null;
  const inRegion = s => runs.some(g => {
    const a = alongRun(g, s, T.TOTAL);
    return a < g.len + WATER_MARGIN || a > T.TOTAL - WATER_MARGIN;
  });
  // The water surface where a boat floats at (x, z), else null: dry land,
  // an islet, a shallow bank or water outside the region.
  function surfaceAt(x, z, y) {
    const w = lagoonAt(x, z);
    if (w == null || !inRegion(T.paramOf(x, z, y))) return null;
    const floor = Math.abs(T.offsetOf(x, z, y)) < T.HW ? T.surfaceAt(x, z, y) : T.terrainAt(x, z);
    return floor < w - FLOAT_DEPTH ? w : null;
  }
  return { runs, surfaceAt };
}

// constrainMotion for open water: a boat that would leave the water (onto a
// bank, an islet, out of the region) goes back to where it was and bounces
// off the shore. Climbing a slipway onto the road is allowed. Returns the
// speed it hit the shore with, or 0.
export function keepAfloat(water, T, c, previous) {
  if (water.surfaceAt(previous.x, previous.z, c.y) == null || water.surfaceAt(c.x, c.z, c.y) != null) return 0;
  if (Math.abs(T.offsetOf(c.x, c.z, c.y)) < T.HW - 1) return 0;
  // The shore's normal: the sum of the dry directions around the new spot.
  let nx = 0, nz = 0;
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4, dx = Math.cos(a), dz = Math.sin(a);
    if (water.surfaceAt(c.x + dx * 2.5, c.z + dz * 2.5, c.y) == null) { nx += dx; nz += dz; }
  }
  let l = Math.hypot(nx, nz);
  if (l < 1e-6) { nx = c.x - previous.x; nz = c.z - previous.z; l = Math.hypot(nx, nz) || 1; }
  nx /= l; nz /= l;
  c.x = previous.x; c.z = previous.z;
  const vn = c.vx * nx + c.vz * nz;
  if (vn <= 0) return 0;
  c.vx -= 1.5 * vn * nx;
  c.vz -= 1.5 * vn * nz;
  return vn;
}

// A solid round obstacle on the water (an anchored boat, a peñero going
// round): pushes the car out and bounces it. Returns the impact speed or 0.
export function bumpObstacle(c, o, carRadius = 1.8) {
  const dx = c.x - o.x, dz = c.z - o.z, d = Math.hypot(dx, dz), reach = o.r + carRadius;
  if (d >= reach || d < 1e-6) return 0;
  const nx = dx / d, nz = dz / d;
  c.x = o.x + nx * reach; c.z = o.z + nz * reach;
  const ovx = (o.vx || 0), ovz = (o.vz || 0);
  const vn = (c.vx - ovx) * nx + (c.vz - ovz) * nz;
  if (vn >= 0) return 0;
  c.vx -= 1.6 * vn * nx;
  c.vz -= 1.6 * vn * nz;
  return -vn;
}

// Inside the wake behind a moving boat (heading h, speed v): a strip a few
// metres back that widens as it trails off. Crossing it kicks a hop.
export function inWake(c, o) {
  if (!o.v) return false;
  const fx = Math.sin(o.h), fz = Math.cos(o.h), dx = c.x - o.x, dz = c.z - o.z;
  const back = -(dx * fx + dz * fz), side = Math.abs(dx * fz - dz * fx);
  return back > 4 && back < 18 && side < 1.6 + back * 0.15;
}
