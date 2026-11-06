// What you hold in first person: the motion every first-person game shares, as
// numbers. Idle breathing, the walking bob, the sprint carry, the raise when you
// switch, air drift, the push-back from a wall and a swing played from a pose
// table. Pure (no Three.js, nothing allocated per frame), so Node tests run it.
// `viewmodel-rig.js` is the gloved hand and forearm it moves.
//
//   const motion = createHeldMotion(), pose = [0, 0, 0, 0, 0, 0], carry = {};
//   // every frame, for one hand:
//   motion.equip(item.id);                                   // a new item rises from below
//   motion.step(dt, { sprint, down });
//   const since = motion.swing(dt, { swings, windup, recovery });  // swings: a count that goes up
//   swingPose(since, windup, recovery, pose, table);         // table: MELEE_SWING or your own
//   motion.carry(carry, { bob, sway, air, push });           // sway 0..1, bob your stride's phase
//   applyHeld(rig.hand, pose, carry, { side: 1 });           // side -1 mirrors for a left hand
//   rig.update();
//
// A pose is [rotation x, rotation z, x, y, z, rotation y] in camera space, written
// for the right hand. A swing goes rest → cocked over the windup, snaps to through
// in `strike` seconds and eases back to rest over the recovery.

export const ease = t => t * t * (3 - 2 * t);

// A one-handed blow: carried leaning forward, cocked over the right shoulder,
// swung through to the left. The model stands on +Y from the grip.
export const MELEE_SWING = {
  rest: [-.45, -.35, .16, -.2, -.42, 0],
  cocked: [.55, -1.05, .25, -.1, -.38, 0],
  through: [-1.65, .55, -.04, -.26, -.48, 0],
  strike: .09,
};

// The same blow around another rest pose; `cocked` and `through` are offsets from it.
export function swingTable(rest, { cocked, through, strike = .09 }) {
  return { rest, cocked: rest.map((v, i) => v + (cocked[i] || 0)), through: rest.map((v, i) => v + (through[i] || 0)), strike };
}

const mix = (a, b, k, out) => { for (let i = 0; i < a.length; i++) out[i] = a[i] + (b[i] - a[i]) * k; return out; };

// The pose `since` seconds into a swing, into `out`; `since` below 0 is the rest.
export function swingPose(since, windup, recovery, out = [0, 0, 0, 0, 0, 0], table = MELEE_SWING) {
  const { rest, cocked, through, strike } = table;
  if (!(since >= 0)) return mix(rest, rest, 0, out);
  if (since < windup) return mix(rest, cocked, ease(since / windup), out);
  if (since < windup + strike) return mix(cocked, through, (since - windup) / strike, out);
  const back = Math.max(.05, recovery - strike);
  return mix(through, rest, ease(Math.min(1, (since - windup - strike) / back)), out);
}

// How a held thing moves with the body. bob*: reach of the stride; bobSprint*: how
// much a sprint widens it; idle*: the breathing; sprint: the lowered carry
// [x, y, z, rotation x, y, z]; rock: the sway of that carry; air: dip in a jump;
// swapY, swapRx: how far below a new item starts.
export const MELEE_CARRY = { bobX: .014, bobY: .012, bobSprintX: 0, bobSprintY: 0, idleX: 0, idleY: .004, idleRz: 0, sprint: [.04, -.08, 0, -.35, 0, -.25], rock: 0, air: .04, swapY: .3, swapRx: .9 };

export function createHeldMotion() {
  let last = null, lastSwings = null;
  const m = {
    t: 0, swap: 0, sprint: 0, since: -1,
    // Say what is held: a different key raises it from below (not the first one).
    equip(key, swings = null) {
      if (key === last) return false;
      m.swap = last ? 1 : 0; last = key; lastSwings = swings; m.since = -1;
      return true;
    },
    step(dt, { sprint = false, down = false } = {}) {
      m.t += dt; m.swap = Math.max(0, m.swap - dt * 3.2);
      m.sprint += ((sprint && !down ? 1 : 0) - m.sprint) * (1 - Math.exp(-dt * 9));
    },
    // A higher swing count starts a swing; it plays on its own clock, smooth between
    // snapshots. Returns the seconds into it, -1 when none is playing.
    swing(dt, { swings, windup, recovery }) {
      if (lastSwings !== null && swings > lastSwings) m.since = 0; else if (m.since >= 0) m.since += dt;
      lastSwings = swings;
      if (m.since > windup + recovery + .2) m.since = -1;
      return m.since;
    },
    // Writes this frame's offsets into `out` { x, y, z, rx, ry, rz }. calm scales the breathing.
    carry(out, { bob = 0, sway = 0, air = 0, push = 0, calm = 1 }, tune = MELEE_CARRY) {
      const { sprint, swap, t } = m, s = tune.sprint;
      out.x = Math.sin(bob) * tune.bobX * sway * (1 + sprint * tune.bobSprintX) + Math.sin(t * .8) * tune.idleX * calm + sprint * s[0];
      out.y = Math.abs(Math.cos(bob)) * tune.bobY * sway * (1 + sprint * tune.bobSprintY) + Math.sin(t * 1.4) * tune.idleY * calm + sprint * s[1] - swap * tune.swapY - air * tune.air;
      out.z = sprint * s[2] + push;
      out.rx = sprint * s[3] - swap * tune.swapRx + Math.sin(bob * 2) * tune.rock * sprint;
      out.ry = sprint * s[4];
      out.rz = sprint * s[5] + Math.sin(t * .8) * tune.idleRz * calm;
      return out;
    },
    reset() { m.swap = m.sprint = 0; m.since = -1; last = null; lastSwings = null; },
  };
  return m;
}

// Puts a pose and its carry on an object. side -1 mirrors the pose for a left hand;
// spread narrows how far from the middle it sits (a portrait screen).
export function applyHeld(object, pose, carry, { side = 1, spread = 1 } = {}) {
  object.position.set(pose[2] * spread * side + carry.x * side, pose[3] + carry.y, (pose[4] ?? -.42) + carry.z);
  object.rotation.set(pose[0] + carry.rx, ((pose[5] || 0) + carry.ry) * side, (pose[1] + carry.rz) * side);
  return object;
}
