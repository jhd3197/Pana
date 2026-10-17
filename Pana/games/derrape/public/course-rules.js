// How a car stays on (or leaves) the course, as plain math: checkpoint laps,
// shortcut planks, open edges you can fall off, and when the zamuro comes to
// carry a car back. track-runtime.js and game.js use these;
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
