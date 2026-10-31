// Close-range weapons as data: a bat, a sandal, a frying pan. Pure and
// renderer-free, so a server room, local practice and Node tests run the same
// swing. A weapon is a plain definition:
//
//   { id, reach: 2.2, arc: .6,            // metres in front, half-angle of the cone (radians)
//     windup: .2, recovery: .5,           // seconds before contact, seconds after it
//     damage: 2, knockback: .6,           // what one hit does (the game reads them)
//     sweetSpot: { from: .7, bonus: 1 },  // optional: extra damage past 70% of the reach
//     throwable: { speed: 20, lift: .15, gravity: 9.8, radius: .3, damage: 3, life: 2.5,
//                  recall: 2.5, returns: 'recall' } }  // optional: it can be thrown
//
// A swing hits ONE person: the nearest inside the reach and the facing cone that
// no cover hides. Contact happens once, when the windup ends; the recovery after
// it is the rest of the interval (`swingInterval`).
//
//   const state = createMelee();
//   if (input.fire) startSwing(state, def);
//   if (stepMelee(state, def, dt) === 'strike') { const victim = swingHit(pana, rivals, def, { boxes }); ... }
//   const flying = input.alt && throwStart(state, def, { x, y, z, ax, az, pitch });
//   const r = stepThrown(flying, dt, { boxes, targets });   // r.victim / r.hit when it stops
//
// A thrown weapon leaves the hand (`state.phase === 'away'`). With `returns:
// 'recall'` it is back in the hand `recall` seconds after the throw whether it hit
// or not (stepMelee says 'return'); with 'pickup' it stays away until the game
// calls `recall(state)`.
import { segmentBox, sweepArc, stepArc } from './projectile.js';

const FIELDS = { reach: 2, arc: .6, windup: .2, recovery: .4, damage: 1, knockback: 0 };
const THROW = { speed: 18, lift: .15, gravity: 9.8, radius: .3, damage: 1, life: 2.5, recall: 2.5, returns: 'recall' };
// A weapon definition with every field filled in (a missing `throwable` stays absent).
export function meleeDef(def = {}) {
  const out = { ...FIELDS, ...def };
  if (def.throwable) out.throwable = { ...THROW, ...def.throwable };
  return out;
}
// Seconds from one swing to the next.
export const swingInterval = def => (def.windup ?? FIELDS.windup) + (def.recovery ?? FIELDS.recovery);

// phase: 'ready' | 'windup' | 'recover' | 'away' (thrown). `t` is what is left of
// the phase; `swings` and `throws` count up so clients can play each one once.
export function createMelee() { return { phase: 'ready', t: 0, swings: 0, throws: 0 }; }
export const canSwing = state => state.phase === 'ready';
export const inHand = state => state.phase !== 'away';
// Starts a swing when the weapon is ready; false while one is under way or it is thrown.
export function startSwing(state, def) {
  if (state.phase !== 'ready') return false;
  state.phase = 'windup'; state.t = def.windup; state.swings++; return true;
}
// Advances the swing or the throw by dt. Returns 'strike' on the step the windup
// ends (test for a hit then), 'return' when a thrown weapon is back in the hand,
// 'ready' when a recovery ends, else null.
export function stepMelee(state, def, dt) {
  if (state.phase === 'ready') return null;
  state.t -= dt;
  if (state.t > 1e-9) return null;
  if (state.phase === 'windup') { state.phase = 'recover'; state.t = Math.max(0, def.recovery + state.t); return 'strike'; }
  const was = state.phase; state.phase = 'ready'; state.t = 0;
  return was === 'away' ? 'return' : 'ready';
}
// A 'pickup' weapon is back in the hand (also how a game resets it on respawn).
export function recall(state) { state.phase = 'ready'; state.t = 0; }
// 0..1: how far the weapon is from being ready again (1 = ready), for a HUD bar.
export function readiness(state, def) {
  if (state.phase === 'ready') return 1;
  if (state.phase === 'away') { const total = def.throwable?.recall; return Number.isFinite(total) && total > 0 ? Math.min(1, Math.max(0, 1 - state.t / total)) : 0; }
  const left = state.phase === 'windup' ? state.t + def.recovery : state.t;
  return Math.min(1, Math.max(0, 1 - left / swingInterval(def)));
}

// Who a swing from `pose` ({ x, z, ax, az }: position and unit facing) hits: the
// nearest target whose body (circle of `radius`) comes within `reach`, inside the
// cone of half-angle `arc` (a target pressed against you, within its own radius,
// counts from any angle in front of your shoulders), with no box of `boxes` in
// between. Returns { target, distance, sweet } or null. Targets are { x, z }.
export function swingHit(pose, targets, def, { boxes = [], radius = .55 } = {}) {
  const length = Math.hypot(pose.ax, pose.az) || 1, fx = pose.ax / length, fz = pose.az / length;
  let best = null;
  for (const target of targets) {
    const dx = target.x - pose.x, dz = target.z - pose.z, distance = Math.hypot(dx, dz);
    if (distance - radius > def.reach) continue;
    const cos = distance > 1e-6 ? (dx * fx + dz * fz) / distance : 1;
    // The cone widens for a body that close: its edge, not its centre, has to be inside.
    const slack = distance > radius ? Math.asin(Math.min(1, radius / distance)) : Math.PI / 2;
    if (Math.acos(Math.max(-1, Math.min(1, cos))) > def.arc + slack) continue;
    if (boxes.some(o => segmentBox(pose.x, pose.z, dx, dz, o) !== null)) continue;
    if (!best || distance < best.distance) best = { target, distance };
  }
  if (!best) return null;
  const sweet = !!def.sweetSpot && best.distance >= def.sweetSpot.from * def.reach;
  return { ...best, sweet, damage: def.damage + (sweet ? def.sweetSpot.bonus || 0 : 0) };
}

// Throws the weapon from `pose` ({ x, y, z, ax, az, pitch }: the hand and the look):
// it leaves the hand and comes back later (see the header). Its elevation is the
// pitch plus `lift`, so a level look still throws a little upward. Returns the
// projectile { x, y, z, vx, vy, vz, life, radius, damage, gravity }, or null when
// the weapon cannot be thrown now (not throwable, mid-swing or already away).
export function throwStart(state, def, pose) {
  const spec = def.throwable; if (!spec || state.phase !== 'ready') return null;
  state.phase = 'away'; state.t = spec.returns === 'pickup' ? Infinity : spec.recall; state.throws++;
  return { ...throwVelocity(spec, pose), x: pose.x, y: pose.y ?? 1.45, z: pose.z, life: spec.life, radius: spec.radius, damage: spec.damage, gravity: spec.gravity };
}
export function throwVelocity(spec, { ax = 0, az = -1, pitch = 0 }) {
  const length = Math.hypot(ax, az) || 1, elevation = pitch + spec.lift, flat = Math.cos(elevation) * spec.speed;
  return { vx: ax / length * flat, vy: Math.sin(elevation) * spec.speed, vz: az / length * flat };
}
// One step of a thrown weapon: swept against cover, round targets and the ground,
// then moved. Returns { victim, hit } where hit is 'target' | 'cover' | 'ground'
// when it stopped this step (it stays where it stopped), or null while it flies.
// `life` runs down; at 0 it stops with hit 'ground'.
export function stepThrown(flying, dt, { boxes = [], targets = [], radius = .55, height = 1.9 } = {}) {
  const r = sweepArc(flying, dt, { boxes, targets, radius: radius + flying.radius, height, gravity: flying.gravity });
  flying.life -= dt;
  // Stopped this step: it rests on the swept chord, exactly where it touched.
  if (r.t <= 1) { flying.x += r.dx * r.t; flying.y = Math.max(0, flying.y + r.dy * r.t); flying.z += r.dz * r.t; flying.life = 0; return { victim: r.victim, hit: r.hit }; }
  stepArc(flying, dt, flying.gravity);
  if (flying.life <= 0) return { victim: null, hit: 'ground' };
  return { victim: null, hit: null };
}
// The look pitch (radians, within [down, up]) whose throw passes `distance` metres
// ahead closest to `aimHeight` over the ground, on open ground: how a bot throws.
export function aimThrow(def, distance, { hand = 1.45, aimHeight = 1, down = -.7, up = .55 } = {}) {
  const spec = def.throwable; if (!spec) return null;
  let best = null;
  for (let pitch = down; pitch <= up + 1e-9; pitch += .025) {
    const { vx, vz, vy } = throwVelocity(spec, { ax: 1, az: 0, pitch }), flat = Math.hypot(vx, vz);
    const t = distance / flat; if (t > spec.life) continue;
    const y = hand + vy * t - spec.gravity * t * t / 2; if (y < 0) continue;
    const miss = Math.abs(y - aimHeight);
    if (!best || miss < best.miss) best = { pitch, miss, time: t };
  }
  return best && best.miss < .6 ? best : null;
}
