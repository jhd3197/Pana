// Pure quadruped locomotion: gait table, speed blending, foot trajectories,
// two-bone leg IK and body/head/mane/tail harmonics. No Three.js and no per-frame
// allocation, so a dozen animated animals stay cheap and node can test it.
//
// Units are metres, seconds and radians. Forward is +z, up is +y. Stride phase is
// in radians (2π per cycle), and touchdown offsets are fractions of a cycle.
// A positive x rotation pitches +z downward: nose-down for the body and neck,
// toe-down for a hoof. A segment's angle is measured from straight down toward
// -z, which is exactly what a bone's rotation.x adds to it.
//
// Legs are ordered LH, RH, LF, RF. With lead 1 the right lead is modelled: the
// left hind (trailing) lands first and the right fore (leading) lands last.

export const TAU = Math.PI * 2;
export const LH = 0, RH = 1, LF = 2, RF = 3;

// At full stride. Offsets are touchdown phases. Harmonics are [amplitude, peak
// phase] for once per cycle and twice per cycle.
// bob: peak in the airborne phase. pitch: positive peak with the fronts landing.
// nod: head dips (neck rotates down) as the fronts land.
// `fold` is the hoof's toe-down flexion mid-swing, `crouch` the lower carriage
// that gives a straight-legged sculpt the reach for its stride, `slide` the
// shoulder and pelvis swing with the leg.
export const GAITS = {
  walk: {
    speed: 1.6, offsets: [0, .5, .25, .75], duty: .65, reach: .36, lift: .13, fold: .8, heelOff: .32,
    crouch: .055, slide: .08, frontShift: -.01, hindShift: .07,
    bob1: 0, bob1At: 0, bob2: .012, bob2At: .1, pitch1: 0, pitch1At: 0, pitch2: .006, pitch2At: .25,
    neck: .08, head: -.05, nod1: 0, nod1At: 0, nod2: .07, nod2At: .25,
    lean: .02, stream: .04, flutter: .05, side: .05, tailStream: .04, tailSwing: .1, tailSway: .12, leanArm: .06,
  },
  trot: {
    speed: 3.8, offsets: [0, .5, .5, 1], duty: .45, reach: .44, lift: .2, fold: 1.05, heelOff: .42,
    crouch: .125, slide: .1, frontShift: -.09, hindShift: .05,
    bob1: 0, bob1At: 0, bob2: .03, bob2At: .475, pitch1: 0, pitch1At: 0, pitch2: .012, pitch2At: .25,
    neck: .05, head: -.04, nod1: 0, nod1At: 0, nod2: .035, nod2At: .5,
    lean: .08, stream: .16, flutter: .12, side: .09, tailStream: .34, tailSwing: .16, tailSway: .08, leanArm: .08,
  },
  canter: {
    speed: 6.2, offsets: [0, .3, .3, .6], duty: .33, reach: .53, lift: .3, fold: 1.2, heelOff: .48,
    crouch: .13, slide: .12, frontShift: -.13, hindShift: .05,
    bob1: .05, bob1At: .965, bob2: 0, bob2At: 0, pitch1: .055, pitch1At: .47, pitch2: 0, pitch2At: 0,
    neck: .15, head: -.08, nod1: .12, nod1At: .5, nod2: 0, nod2At: 0,
    lean: .17, stream: .3, flutter: .2, side: .12, tailStream: .62, tailSwing: .2, tailSway: .06, leanArm: .14,
  },
  gallop: {
    speed: 9.5, offsets: [0, .12, .35, .47], duty: .25, reach: .6, lift: .4, fold: 1.35, heelOff: .55,
    crouch: .14, slide: .14, frontShift: -.06, hindShift: .07,
    bob1: .055, bob1At: .86, bob2: 0, bob2At: 0, pitch1: .06, pitch1At: .45, pitch2: 0, pitch2At: 0,
    neck: .27, head: -.13, nod1: .13, nod1At: .46, nod2: 0, nod2At: 0,
    lean: .3, stream: .42, flutter: .24, side: .13, tailStream: .92, tailSwing: .22, tailSway: .05, leanArm: .18,
  },
};
const ORDER = [GAITS.walk, GAITS.trot, GAITS.canter, GAITS.gallop];
const KEYS = Object.keys(GAITS.walk).filter(key => key !== 'speed' && key !== 'offsets');
// Stride shrinks linearly below this speed, so the feet settle exactly on their
// rest marks and a slowing animal never slides.
const SETTLE_SPEED = .9;
const STOP_SPEED = .03;

const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const fract = v => v - Math.floor(v);
const harmonic = (angle, one, oneAt, two, twoAt) => one * Math.cos(angle - oneAt * TAU) + two * Math.cos(2 * (angle - twoAt * TAU));

export function newGait() {
  const out = { offsets: [0, 0, 0, 0], amount: 0, stride: 1 };
  for (const key of KEYS) out[key] = 0;
  return out;
}

// Fills `out` with the gait for a ground speed. strideScale and lead come from
// gaitVariation: lead -1 mirrors the left and right legs (a left lead).
export function blendGait(speed, out = newGait(), { strideScale = 1, lead = 1 } = {}) {
  const v = speed > 0 ? speed : 0;
  let a = ORDER[0], b = ORDER[0], t = 0;
  for (let i = 0; i < ORDER.length - 1; i++) {
    if (v >= ORDER[i].speed) { a = ORDER[i]; b = ORDER[i + 1]; t = smooth(a.speed, b.speed, v); }
  }
  for (let i = 0; i < KEYS.length; i++) out[KEYS[i]] = a[KEYS[i]] + (b[KEYS[i]] - a[KEYS[i]]) * t;
  const swap = lead < 0;
  out.offsets[LH] = lerpOffset(a, b, swap ? RH : LH, t);
  out.offsets[RH] = lerpOffset(a, b, swap ? LH : RH, t);
  out.offsets[LF] = lerpOffset(a, b, swap ? RF : LF, t);
  out.offsets[RF] = lerpOffset(a, b, swap ? LF : RF, t);
  // The sculpt's legs limit reach, so strideScale changes the rate a little as well.
  out.amount = clamp01(v / SETTLE_SPEED);
  out.reach *= strideScale * out.amount;
  out.stride = 2 * Math.max(out.reach, 1e-4) / out.duty;
  return out;
}
const lerpOffset = (a, b, leg, t) => a.offsets[leg] + (b.offsets[leg] - a.offsets[leg]) * t;

// Cycles per second that keep a stance foot still on the ground.
export function strideRate(speed, gait) {
  return speed > STOP_SPEED ? speed / gait.stride : 0;
}

// Per-animal lead, stride and starting phase, deterministic from an integer seed.
export function gaitVariation(seed = 0) {
  const mix = n => {
    let x = Math.imul((seed | 0) + n * 0x9e3779b1, 0x85ebca6b);
    x = Math.imul(x ^ x >>> 13, 0xc2b2ae35);
    return ((x ^ x >>> 16) >>> 0) / 4294967296;
  };
  return { lead: mix(1) < .5 ? 1 : -1, strideScale: .97 + mix(2) * .06, phase: mix(3) * TAU };
}

// Sagittal-plane skeleton from rest positions [y, z]. Bend +1 pushes the joint
// forward (a front knee), -1 backward (a hock).
export function createQuadrupedRig({ legs, neck, head, bit }) {
  return {
    neck, head, bit,
    legs: legs.map(({ hip, knee, fetlock, toe, bend }) => {
      const u = [knee[0] - hip[0], knee[1] - hip[1]], l = [fetlock[0] - knee[0], fetlock[1] - knee[1]];
      return {
        hip, knee, fetlock, toe, bend, front: bend > 0,
        upper: Math.hypot(u[0], u[1]), lower: Math.hypot(l[0], l[1]),
        upperRest: segmentAngle(u[0], u[1]), lowerRest: segmentAngle(l[0], l[1]),
        toeY: toe[0] - fetlock[0], toeZ: toe[1] - fetlock[1],
      };
    }),
  };
}
export const segmentAngle = (y, z) => Math.atan2(-z, -y);

// Two-bone IK by the law of cosines. Writes absolute segment angles and whether
// the target was in reach; an unreachable target gets the straightened leg.
export function solveTwoBone(l1, l2, dy, dz, bend, out) {
  const d = Math.hypot(dy, dz), min = Math.abs(l1 - l2) + 1e-4, max = l1 + l2 - 1e-4;
  const r = d < min ? min : d > max ? max : d, line = segmentAngle(dy, dz);
  const hip = Math.acos(Math.min(1, Math.max(-1, (l1 * l1 + r * r - l2 * l2) / (2 * l1 * r))));
  const knee = Math.acos(Math.min(1, Math.max(-1, (l2 * l2 + r * r - l1 * l1) / (2 * l2 * r))));
  out.upper = line - bend * hip;
  out.lower = line + bend * knee;
  out.reached = d >= min && d <= max;
  return out;
}

export function newPose(rig) {
  return {
    gait: newGait(), bob: 0, pitch: 0, neck: 0, head: 0, nod: 0, lean: 0, armNod: 0, amount: 0,
    bitY: rig.bit[0], bitZ: rig.bit[1],
    legs: rig.legs.map(() => ({ upper: 0, lower: 0, hoof: 0, slide: 0, toeY: 0, toeZ: 0, hoofPitch: 0, stance: true, reached: true })),
    mane: [{ x: 0, z: 0 }, { x: 0, z: 0 }, { x: 0, z: 0 }],
    tail: [{ x: 0, z: 0 }, { x: 0, z: 0 }, { x: 0, z: 0 }],
  };
}

// Where a leg's toe should be in the animal's frame, ignoring body motion, and the
// hoof's world pitch. Stance: planted, moving back at ground speed. Swing: an arc forward.
function footPath(rigLeg, leg, gait, cycle, offset) {
  const shift = (rigLeg.front ? gait.frontShift : gait.hindShift) * gait.amount;
  const centre = rigLeg.toe[1] + shift, reach = gait.reach;
  const u = fract(cycle - offset), duty = gait.duty;
  if (u < duty) {
    const s = u / duty;
    leg.stance = true;
    leg.toeY = 0;
    leg.toeZ = centre + reach * (1 - 2 * s);
    leg.hoofPitch = gait.heelOff * gait.amount * smooth(.68, 1, s);
    return centre;
  }
  const w = (u - duty) / (1 - duty), lift = gait.lift * (rigLeg.front ? 1 : .78) * gait.amount;
  leg.stance = false;
  leg.toeY = lift * Math.sin(Math.PI * Math.pow(w, .85));
  leg.toeZ = centre - reach + 2 * reach * smooth(.04, .96, w);
  const fold = gait.fold * gait.amount, heel = gait.heelOff * gait.amount;
  leg.hoofPitch = w < .42 ? heel + (fold - heel) * smooth(0, .42, w)
    : w < .88 ? fold + (-.28 * gait.amount - fold) * smooth(.42, .88, w)
      : -.28 * gait.amount * (1 - smooth(.88, 1, w));
  return centre;
}

// A full pose for a phase in radians, a ground speed, a jump height and the
// upward velocity of that jump. Pure: the same arguments give the same pose.
export function poseQuadruped(rig, phase, speed, jump, climb, pose, variation) {
  const gait = blendGait(speed, pose.gait, variation), a = gait.amount;
  const cycle = fract(phase / TAU), angle = cycle * TAU;
  const air = smooth(.015, .28, jump > 0 ? jump : 0), land = 1 - air;
  const rising = climb > 0 ? Math.min(1, climb / 4) : Math.max(-1, climb / 5);
  pose.amount = a;
  pose.bob = (harmonic(angle, gait.bob1, gait.bob1At, gait.bob2, gait.bob2At) * a - gait.crouch * a) * land;
  pose.pitch = harmonic(angle, gait.pitch1, gait.pitch1At, gait.pitch2, gait.pitch2At) * a * land - rising * .2 * air;
  pose.nod = harmonic(angle, gait.nod1, gait.nod1At, gait.nod2, gait.nod2At) * a * land;
  pose.neck = gait.neck * a + pose.nod - pose.pitch * .55 + air * (rising * -.16 + .12);
  pose.head = gait.head * a - pose.nod * .3 - pose.pitch * .3;
  pose.lean = gait.lean * a + air * .26 * (rising + .3);
  pose.armNod = gait.leanArm * a + pose.nod * .9;

  const c = Math.cos(pose.pitch), s = Math.sin(pose.pitch);
  for (let i = 0; i < rig.legs.length; i++) {
    const r = rig.legs[i], leg = pose.legs[i];
    const centre = footPath(r, leg, gait, cycle, gait.offsets[i]);
    let toeY = leg.toeY, toeZ = leg.toeZ, hoof = leg.hoofPitch;
    leg.slide = gait.slide * (r.front ? 1 : 1.5) * a * (toeZ - centre) / Math.max(gait.reach + .25, .25) * land;
    if (air > 0) {
      // Tucked fronts reach ahead, hinds trail behind and fold after the take-off.
      const tuckY = r.front ? .62 : .42, tuckZ = r.toe[1] + (r.front ? .3 : -.34), tuck = r.front ? 1.3 : .62;
      toeY += (tuckY - toeY) * air; toeZ += (tuckZ - toeZ) * air; hoof += (tuck - hoof) * air;
      leg.stance = false;
    }
    leg.toeY = toeY; leg.toeZ = toeZ; leg.hoofPitch = hoof;
    // Fetlock in the body frame: from the toe, back along the hoof's pitch, then
    // out of the bobbing, pitching body so a stance toe really stays on y=0.
    const hc = Math.cos(hoof), hs = Math.sin(hoof);
    const worldY = toeY - (r.toeY * hc - r.toeZ * hs) - pose.bob;
    const worldZ = toeZ - (r.toeY * hs + r.toeZ * hc);
    const bodyY = worldY * c + worldZ * s, bodyZ = -worldY * s + worldZ * c;
    solveTwoBone(r.upper, r.lower, bodyY - r.hip[0], bodyZ - (r.hip[1] + leg.slide), r.bend, leg);
    // Bone rotations relative to the rest pose. Same-axis rotations simply add.
    const upperAbsolute = leg.upper, lowerAbsolute = leg.lower;
    leg.upper = upperAbsolute - r.upperRest;
    leg.lower = lowerAbsolute - r.lowerRest - leg.upper;
    leg.hoof = hoof - pose.pitch - leg.upper - leg.lower;
  }

  // Delayed sines: each bone runs a little behind the last, so hair waves.
  const maneFlutter = gait.flutter * a * (1 - .4 * air), maneSide = gait.side * a;
  for (let i = 0; i < 3; i++) {
    const lag = angle - (i + 1) * .95;
    pose.mane[i].x = -gait.stream * a * (.22 + i * .2) + maneFlutter * Math.sin(lag + .8) * (.6 + i * .3);
    pose.mane[i].z = maneSide * Math.sin(lag + i * .6) * (.6 + i * .4);
    const tailLag = angle - (i + 1) * .8;
    pose.tail[i].x = gait.tailStream * a * (i === 0 ? 1 : .24) + gait.tailSwing * a * Math.sin(tailLag) * (.5 + i * .35) + air * (i === 0 ? .36 : .08);
    pose.tail[i].z = gait.tailSway * a * Math.sin(tailLag) * (.8 + i * .5);
  }

  // Where the reins meet the head, in the animal's frame.
  const nc = Math.cos(pose.neck), ns = Math.sin(pose.neck), tilt = pose.neck + pose.head;
  const bitY = rig.bit[0] - rig.head[0], bitZ = rig.bit[1] - rig.head[1], tc = Math.cos(tilt), ts = Math.sin(tilt);
  const relY = rig.head[0] - rig.neck[0], relZ = rig.head[1] - rig.neck[1];
  const animalY = rig.neck[0] + relY * nc - relZ * ns + bitY * tc - bitZ * ts;
  const animalZ = rig.neck[1] + relY * ns + relZ * nc + bitY * ts + bitZ * tc;
  pose.bitY = animalY * c - animalZ * s + pose.bob;
  pose.bitZ = animalY * s + animalZ * c;
  return pose;
}

// Forward kinematics, for tests and tools: toe and fetlock in the animal's frame.
export function legToe(rig, index, pose, out = {}) {
  const r = rig.legs[index], leg = pose.legs[index];
  const a1 = leg.upper + r.upperRest, a2 = leg.upper + leg.lower + r.lowerRest;
  const bodyY = r.hip[0] - r.upper * Math.cos(a1) - r.lower * Math.cos(a2);
  const bodyZ = r.hip[1] + leg.slide - r.upper * Math.sin(a1) - r.lower * Math.sin(a2);
  const c = Math.cos(pose.pitch), s = Math.sin(pose.pitch);
  out.fetlockY = bodyY * c - bodyZ * s + pose.bob;
  out.fetlockZ = bodyY * s + bodyZ * c;
  const hoofAngle = pose.pitch + leg.upper + leg.lower + leg.hoof, hc = Math.cos(hoofAngle), hs = Math.sin(hoofAngle);
  out.y = out.fetlockY + r.toeY * hc - r.toeZ * hs;
  out.z = out.fetlockZ + r.toeY * hs + r.toeZ * hc;
  // Knee (or hock), for checking which way the joint points.
  out.kneeZ = (r.hip[0] - r.upper * Math.cos(a1)) * s + (r.hip[1] + leg.slide - r.upper * Math.sin(a1)) * c;
  return out;
}
