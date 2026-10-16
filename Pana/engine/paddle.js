// The dugout-canoe stroke model, shared by Curiara and Bululú's river
// minigames. Pure: no THREE, no DOM, no clock of its own.
// Every stroke is a side (-1 left, +1 right) and a time in seconds; the gap to
// the previous stroke decides what it is worth. Alternating in rhythm is full
// power, the same side twice is a turn stroke, mashing is a weak chapoteo and a
// stroke in the sweet spot is a ¡Remazo!. Yaw > 0 turns the bow left: a stroke
// on the right pushes the bow away from that side, like a real dugout.
//
// State is a plain object so a race snapshot can carry it across host
// migration. createPaddler() wraps it for callers that prefer methods.
export const PADDLE = Object.freeze({
  impulse: 1.1,          // m/s added by a full stroke
  pull: .3,              // s over which a stroke delivers its impulse
  rhythm: [.25, .9],     // gaps that keep the rhythm
  sweet: [.35, .6],      // the paddle has just finished its pull
  remazo: 1.25, early: .85, steady: 1, start: .8,
  turnPower: .4, turnYaw: .5,
  steadyYaw: .05,        // the alternating wiggle; consecutive sides cancel it
  mashPower: .3, mashYaw: .12,
  pivot: 1.2,            // rad/s while back-paddling with a side held
  rudder: .55,           // rad/s from the back seat's rudder at cruising speed
  sync: .12, syncBonus: .15,
});
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function paddleState() {
  return { last: null, side: 0, quality: '', count: 0, streak: 0, power: 0, pulls: [], back: false, pivot: 0, rudder: 0, syncAt: null, synced: -1, syncs: 0 };
}

// What a stroke at `gap` seconds after the previous one, on `same` side, is worth.
export function grade(gap, same) {
  const P = PADDLE;
  if (gap < P.rhythm[0]) return { quality: 'chapoteo', power: P.mashPower * clamp(gap / P.rhythm[0], 0, 1), yaw: P.mashYaw };
  if (same) return { quality: 'giro', power: P.turnPower, yaw: P.turnYaw };
  if (gap > P.rhythm[1]) return { quality: 'arranque', power: P.start, yaw: P.steadyYaw };
  if (gap >= P.sweet[0] && gap <= P.sweet[1]) return { quality: 'remazo', power: P.remazo, yaw: P.steadyYaw };
  return { quality: gap < P.sweet[0] ? 'temprano' : 'bueno', power: gap < P.sweet[0] ? P.early : P.steady, yaw: P.steadyYaw };
}

export function stroke(state, side, t) {
  side = side < 0 ? -1 : 1;
  // While back-paddling the side keys pivot instead of stroking (see hold).
  if (state.back) return 'ciar';
  const gap = state.last == null ? Infinity : Math.max(0, t - state.last);
  const g = grade(gap, gap !== Infinity && side === state.side);
  let power = g.power;
  // The back seat called it: ¡Ahora!
  if (state.syncAt != null && Math.abs(t - state.syncAt) <= PADDLE.sync && g.quality !== 'chapoteo') {
    power *= 1 + PADDLE.syncBonus; state.synced = state.count + 1; state.syncs++; state.syncAt = null;
  }
  state.pulls.push([PADDLE.impulse * power, side * g.yaw, PADDLE.pull]);
  if (state.pulls.length > 8) state.pulls.shift();
  state.streak = g.quality === 'remazo' ? state.streak + 1 : g.quality === 'chapoteo' || g.quality === 'arranque' ? 0 : state.streak;
  Object.assign(state, { last: t, side, quality: g.quality, power, count: state.count + 1 });
  return g.quality;
}

// Solo: S held back-paddles; a side held with it pivots. Parejas: the back seat.
export function hold(state, back, pivot = 0) {
  state.back = !!back;
  state.pivot = back ? clamp(Math.sign(pivot) || 0, -1, 1) : 0;
}
export function rudder(state, dir) { state.rudder = clamp(Math.sign(dir) || 0, -1, 1); }

// The back seat taps the stroke key. Within PADDLE.sync of the front stroke
// (either order) that stroke gets the bonus once.
export function sync(state, t) {
  if (state.last != null && Math.abs(t - state.last) <= PADDLE.sync && state.synced !== state.count && state.quality !== 'chapoteo' && state.quality !== '') {
    state.pulls.push([PADDLE.impulse * state.power * PADDLE.syncBonus, 0, PADDLE.pull]);
    state.synced = state.count; state.syncs++; state.syncAt = null;
    return true;
  }
  state.syncAt = t;
  return false;
}

// Delivers the strokes being pulled. `thrust` is m/s to add this step, `yaw`
// rad/s of turn to add; `turn` is a steady rate (pivot), `rudder` -1..1 and
// `brake` says the paddles are dragging backwards.
export function step(state, dt) {
  let thrust = 0, yaw = 0;
  for (const pull of state.pulls) {
    const f = Math.min(dt, pull[2]) / PADDLE.pull;
    thrust += pull[0] * f; yaw += pull[1] * f; pull[2] -= dt;
  }
  state.pulls = state.pulls.filter(p => p[2] > 1e-6);
  return { thrust, yaw, turn: state.back ? -state.pivot * PADDLE.pivot : 0, rudder: state.rudder, brake: state.back, quality: state.quality };
}

// Seconds since the last stroke, as the HUD's stroke ring and the paddle
// animation read it. Infinity before the first stroke.
export const since = (state, t) => state.last == null ? Infinity : t - state.last;
export const inSweetSpot = (state, t) => { const g = since(state, t); return g >= PADDLE.sweet[0] && g <= PADDLE.sweet[1]; };

// Bululú-style input is `{x}`: a stroke is x reaching -1 or +1 from anywhere else.
export function axisStroke(previous, x) {
  if (x <= -1 && previous > -1) return -1;
  if (x >= 1 && previous < 1) return 1;
  return 0;
}

export function createPaddler(state = paddleState()) {
  return {
    state,
    stroke: (side, t) => stroke(state, side, t),
    hold: (back, pivot) => hold(state, back, pivot),
    rudder: dir => rudder(state, dir),
    sync: t => sync(state, t),
    step: dt => step(state, dt),
    since: t => since(state, t),
  };
}
