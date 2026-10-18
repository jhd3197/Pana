// Metres, +Z toward the calce. Shared by the full game and Bululú.
// Rendering never advances these rules; callers feed fixed STEP increments.
export const STEP = 1 / 120;
export const COURT = Object.freeze({ halfWidth: 5.5, halfLength: 12, launchZ: 9.8, radius: .25, mingoRadius: .14, drag: 2.8 });
export const TEAM_COLORS = ['#ed5949', '#299e72'];
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const copy = value => JSON.parse(JSON.stringify(value));

export function createPitch(x = 0, z = -6) {
  return { balls: [{ id: 0, owner: -1, x, z, vx: 0, vz: 0, radius: COURT.mingoRadius, out: false }], nextId: 1 };
}
export const moving = pitch => pitch.balls.some(b => !b.out && Math.hypot(b.vx, b.vz) > 0);
export function shotSpeed(power, mode = 'arrime') {
  return Math.sqrt(2 * COURT.drag * (3 + power * 21)) * (mode === 'boche' ? 1.32 : 1);
}
export function validShot({ angle, power, mode = 'arrime' } = {}) {
  return Number.isFinite(angle) && Math.abs(angle) <= .65 && Number.isFinite(power)
    && power >= .1 && power <= 1 && ['arrime', 'boche'].includes(mode);
}
export function throwBall(pitch, owner, shot, x = 0) {
  if (!validShot(shot) || !Number.isInteger(owner) || owner < 0 || !Number.isFinite(x) || Math.abs(x) > 4) return false;
  const speed = shotSpeed(shot.power, shot.mode);
  const b = { id: pitch.nextId++, owner, x, z: COURT.launchZ, vx: Math.sin(shot.angle) * speed,
    vz: -Math.cos(shot.angle) * speed, radius: COURT.radius, out: false };
  pitch.balls.push(b); return b;
}
export function landing(shot, x = 0) {
  const distance = shotSpeed(shot.power, shot.mode) ** 2 / (2 * COURT.drag);
  return { x: x + Math.sin(shot.angle) * distance, z: COURT.launchZ - Math.cos(shot.angle) * distance };
}
export function aimAt(x, z, originX = 0, mode = 'arrime') {
  const dx = x - originX, dz = COURT.launchZ - z;
  return { angle: clamp(Math.atan2(dx, dz), -.65, .65),
    power: clamp((Math.hypot(dx, dz) / (mode === 'boche' ? 1.32 ** 2 : 1) - 3) / 21, .1, 1), mode };
}
function boundary(b) {
  if (Math.abs(b.x) + b.radius > COURT.halfWidth || Math.abs(b.z) + b.radius > COURT.halfLength) {
    b.out = true; b.vx = b.vz = 0;
  }
}
export function stepPitch(pitch) {
  for (const b of pitch.balls) {
    if (b.out) continue;
    const speed = Math.hypot(b.vx, b.vz);
    if (speed) {
      const next = Math.max(0, speed - COURT.drag * STEP), scale = next / speed;
      b.x += b.vx * (1 + scale) * .5 * STEP; b.z += b.vz * (1 + scale) * .5 * STEP;
      b.vx *= scale; b.vz *= scale;
    }
    boundary(b);
  }
  for (let i = 0; i < pitch.balls.length; i++) for (let j = i + 1; j < pitch.balls.length; j++) {
    const a = pitch.balls[i], b = pitch.balls[j];
    if (a.out || b.out) continue;
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), reach = a.radius + b.radius;
    if (d >= reach) continue;
    const nx = d > 1e-9 ? dx / d : 1, nz = d > 1e-9 ? dz / d : 0;
    const ia = a.owner < 0 ? 3 : 1, ib = b.owner < 0 ? 3 : 1;
    const overlap = reach - d + .00001;
    a.x -= nx * overlap * ia / (ia + ib); a.z -= nz * overlap * ia / (ia + ib);
    b.x += nx * overlap * ib / (ia + ib); b.z += nz * overlap * ib / (ia + ib);
    const approach = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
    if (approach < 0) {
      const impulse = -1.72 * approach / (ia + ib);
      a.vx -= impulse * ia * nx; a.vz -= impulse * ia * nz;
      b.vx += impulse * ib * nx; b.vz += impulse * ib * nz;
    }
    boundary(a); boundary(b);
  }
}
// Measure the surface gap; every playing ball has the same radius.
export function distance(pitch, b) {
  const m = pitch.balls[0];
  return b.out || m.out ? Infinity : Math.max(0, Math.hypot(b.x - m.x, b.z - m.z) - b.radius - m.radius);
}
export function closest(pitch, owner) {
  return Math.min(Infinity, ...pitch.balls.filter(b => b.owner === owner).map(b => distance(pitch, b)));
}
export function measure(pitch, teamOf = owner => owner % 2) {
  const balls = pitch.balls.filter(b => b.owner >= 0 && !b.out).map(b => ({ id: b.id, team: teamOf(b.owner), distance: distance(pitch, b) }))
    .sort((a, b) => a.distance - b.distance || a.id - b.id);
  if (!balls.length || !Number.isFinite(balls[0].distance)) return { team: null, points: 0, ids: [] };
  const first = balls[0], opponent = balls.find(b => b.team !== first.team);
  if (opponent && Math.abs(opponent.distance - first.distance) <= .005) return { team: null, points: 0, ids: [] };
  const ids = balls.filter(b => b.team === first.team && b.distance < (opponent?.distance ?? Infinity) - .005).map(b => b.id);
  return { team: first.team, points: ids.length, ids };
}
// Deterministic variety, independent of visual randomness and client frame rate.
export function botShot(pitch, serial, originX = 0) {
  const m = pitch.balls[0], a = serial * 2.399963;
  return aimAt(m.x + Math.sin(a) * (.35 + serial % 3 * .12), m.z + Math.cos(a) * .6, originX);
}
