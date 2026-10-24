// Adapted from the supplied capy combat motion study. Pure pose sampling.
import { ATTACK_TIMING } from './attack-timing.js';
const clamp01 = x => Math.min(1, Math.max(0, x));
const E = {
  lin: x => x,
  in: x => x * x,
  in3: x => x * x * x,
  out: x => 1 - (1 - x) * (1 - x),
  out3: x => 1 - (1 - x) ** 3,
  snap: x => 1 - (1 - x) ** 5,
  io: x => x < .5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2,
  io3: x => x < .5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2,
  back: x => { const c = 1.7; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; },
};
const damp = (t, freq, decay) => t <= 0 ? 0 : Math.exp(-decay * t) * Math.sin(freq * t);

// Fighting stance: lead (left) hand high, rear (right) hand cocked at the chin,
// weight slightly forward, torso bladed. Arms are rotated in shoulder space,
// so rx = -PI/2 is straight forward and rz > 0 on the right arm aims inward.
const STANCE = {
  'body.y': 0, 'body.z': 0, 'body.pivot': 0, 'body.rx': .05, 'body.ry': -.2, 'body.rz': 0, squash: .03,
  'neck.rx': 0, 'neck.ry': 0, 'neck.rz': 0, 'head.rz': 0,
  'armL.rx': -1.5, 'armL.ry': 0, 'armL.rz': -.1, 'armL.z': .05, 'armL.s': 1,
  'armR.rx': -1.22, 'armR.ry': 0, 'armR.rz': .2, 'armR.z': 0, 'armR.s': 1,
  'legL.rx': -.14, 'legL.rz': .04, 'legR.rx': .16, 'legR.rz': -.04, 'legL.s': 1, 'legR.s': 1,
  eyes: .9, mouth: 0, ears: 0, spin: 0, puff: 0, laugh: 0, plant: 1, stab: 1,
};

// clip(duration, [time, ease, pose | null]) ; null = hold the stance on every
// channel this clip touches. Missing ends are filled with the stance.
function clip(dur, keys) {
  keys = keys.map((k, i) => [k, i]).sort((x, y) => x[0][0] - y[0][0] || x[1] - y[1]).map(x => x[0]);
  const names = new Set();
  keys.forEach(k => k[2] && Object.keys(k[2]).forEach(n => names.add(n)));
  const ch = {};
  for (const n of names) {
    const list = [];
    for (const [t, e, p] of keys) {
      if (p === null) list.push([t, STANCE[n], E[e]]);
      else if (n in p) list.push([t, p[n], E[e]]);
    }
    if (list[0][0] > 0) list.unshift([0, STANCE[n], E.lin]);
    if (list[list.length - 1][0] < dur) list.push([dur, STANCE[n], E.io]);
    ch[n] = list;
  }
  return { dur, ch };
}
function sample(c, t, P) {
  for (const n in c.ch) {
    const ks = c.ch[n];
    if (t <= ks[0][0]) { P[n] = ks[0][1]; continue; }
    let i = 1; while (i < ks.length - 1 && t > ks[i][0]) i++;
    const [t0, v0] = ks[i - 1], [t1, v1, e] = ks[i];
    P[n] = v0 + (v1 - v0) * e(clamp01((t - t0) / Math.max(1e-6, t1 - t0)));
  }
  return P;
}

const PUNCH = [ // rear cross to the chin
  [.16, 'io', { 'body.ry': -.62, 'body.rx': -.04, 'body.z': -.12, squash: .09, 'armR.rx': -.9, 'armR.rz': .12, 'armR.z': -.06,
    'armL.rx': -1.75, 'armL.rz': -.25, 'legL.rx': -.22, 'legR.rx': .22, eyes: .62, ears: -.25 }],
  [.22, 'out', { 'body.ry': -.68, squash: .11, 'armR.rx': -.84 }],
  [.29, 'snap', { 'body.ry': .52, 'body.rx': .22, 'body.z': .32, squash: -.06, 'armR.rx': -1.98, 'armR.rz': .2, 'armR.z': .16, 'armR.s': 1.16,
    'armL.rx': -1.15, 'armL.rz': -.45, 'legL.rx': -.42, 'legR.rx': .38, eyes: .55, mouth: .6, ears: .35 }],
  [.37, 'out', { 'body.ry': .58, 'armR.s': 1, 'armR.rx': -1.93, squash: -.02, mouth: .65 }],
  [.56, 'out3', { 'body.ry': .12, 'body.z': .3, 'body.rx': .08, 'armR.rx': -1.45, 'armR.rz': .22, 'armR.z': .02, squash: .05, mouth: .1, ears: -.1,
    'armL.rx': -1.45, 'armL.rz': -.15, 'legL.rx': -.25, 'legR.rx': .2 }],
  [.88, 'io3', null],
];

const UPPER = [ // crouch, explode up through the chin
  [.2, 'io', { squash: .22, 'body.rx': .08, 'body.ry': -.45, 'body.z': -.15, 'armR.rx': -.25, 'armR.rz': .25, 'armR.z': -.05, 'armL.rx': -1.7,
    'neck.rx': -.2, 'legL.rx': -.3, 'legR.rx': .3, eyes: .55, ears: -.35 }],
  [.27, 'out', { squash: .24, 'body.rx': .1, 'armR.rx': -.22 }],
  [.35, 'snap', { squash: -.1, 'body.y': 0, 'body.rx': .02, 'body.ry': .4, 'body.z': .72, 'armR.rx': -1.65, 'armR.rz': .42, 'armR.z': .18, 'armR.s': 1.2,
    'armL.rx': -1.0, 'armL.rz': -.5, 'neck.rx': -.25, 'legL.rx': -.1, 'legR.rx': .55, eyes: .5, mouth: .85, ears: .6 }],
  [.45, 'out', { 'body.y': .34, 'armR.rx': -2.75, 'armR.s': 1, 'body.ry': .46, squash: -.08, 'body.z': .8 }],
  [.62, 'in', { 'body.y': 0, squash: .14, 'armR.rx': -1.7, 'body.ry': .2, 'body.z': .45, 'body.rx': .1, 'neck.rx': 0, mouth: .15, ears: -.35 }],
  [.74, 'out', { squash: -.03, ears: .15 }],
  [1.25, 'io3', null],
];

const HOOK = [
  [.16, 'io', { 'body.ry': .45, 'armL.rx': -1.7, 'armL.rz': .95, 'armL.z': -.05, squash: .08, 'body.z': .1, eyes: .6, ears: -.3, 'armR.rx': -1.6 }],
  [.22, 'out', { 'body.ry': .52, 'armL.rz': 1.02 }],
  [.3, 'snap', { 'body.ry': -.75, 'body.rx': .12, 'body.z': .55, 'armL.rz': -.1, 'armL.rx': -1.85, 'armL.s': 1.12, 'armL.z': .12, squash: -.05, mouth: .6, ears: .4, eyes: .55 }],
  [.38, 'out', { 'body.ry': -.95, 'armL.rz': -.55, 'armL.s': 1 }],
  [.62, 'out3', { 'body.ry': -.35, 'body.z': .3, 'armL.rz': -.2, 'armL.rx': -1.5, mouth: 0 }],
  [1.0, 'io3', null],
];
function reactHead(ti, dur) {
  return [
    [ti - .03, 'lin', null],
    [ti, 'snap', { 'neck.rx': -.6, 'neck.rz': .2, 'head.rz': .12, 'body.rx': -.18, 'body.z': -.14, squash: .13, 'armL.rx': -.55, 'armL.rz': 1.05,
      'armR.rx': -.45, 'armR.rz': -1.0, eyes: .08, mouth: .9, 'legL.rx': .1, ears: .7 }],
    [ti + .15, 'out3', { 'neck.rx': -.42, 'body.rx': -.32, 'body.z': -.68, 'body.y': .05, squash: -.06, 'armL.rz': .75, 'armR.rz': -.8, 'armL.rx': -.95,
      'armR.rx': -.85, 'legL.rx': .5, 'legR.rx': -.12, eyes: .1 }],
    [ti + .32, 'io', { 'neck.rx': .14, 'neck.rz': .05, 'body.rx': .1, 'body.z': -.78, 'body.y': 0, squash: .07, 'legL.rx': .08, 'legR.rx': .1,
      eyes: .35, mouth: .3, 'armL.rx': -1.25, 'armR.rx': -1.0, 'armL.rz': .15, 'armR.rz': .05, ears: -.2 }],
    [ti + .46, 'io', { 'neck.rx': 0, 'neck.rz': 0, 'body.rx': .03, 'body.z': -.7, eyes: .95, mouth: 0, squash: .02 }],
    [dur - .16, 'io', { 'body.z': -.12, 'body.y': .06 }],
    [dur, 'in', null],
  ];
}

const KICK = [ // hop-in spinning side kick
  [.2, 'io', { 'body.ry': .55, 'body.rz': -.06, squash: .15, 'body.z': -.08, 'armL.rx': -.95, 'armR.rx': -.9, 'armL.rz': -.3, 'armR.rz': .35,
    'legL.rx': -.05, 'legL.rz': 0, eyes: .6, ears: -.3 }],
  [.3, 'out', { 'body.y': .26, squash: -.08, 'body.ry': -.5, 'body.rz': .12, 'body.z': .7, 'legL.rz': .7, 'legL.rx': 0, 'legR.rz': -.15,
    'armL.rz': .4, 'armR.rz': -.5, 'armL.rx': -.7, 'armR.rx': -.8, ears: .2 }],
  [.38, 'snap', { 'body.y': .2, squash: -.04, 'body.ry': -1.5, 'body.rz': .34, 'body.z': 1.36, 'legL.rz': 1.5, 'legL.s': 1.14, 'legR.rz': -.05,
    'armL.rz': 1.1, 'armL.rx': -.5, 'armR.rz': -1.15, 'armR.rx': -.6, eyes: .5, mouth: .7, ears: .5 }],
  [.48, 'out', { 'body.ry': -1.62, 'legL.rz': 1.38, 'legL.s': 1, 'body.y': .16, 'body.z': 1.25, mouth: .6 }],
  [.62, 'in', { 'body.y': 0, 'body.ry': -1.0, 'body.rz': .05, 'legL.rz': .18, squash: .16, 'armL.rz': .5, 'armR.rz': -.4, ears: -.4, mouth: .1, 'body.z': .75 }],
  [.74, 'out', { squash: -.03, 'body.ry': -.65, 'body.z': .5, ears: .2 }],
  [1.1, 'io3', null],
];

const TAU = Math.PI * 2;
const SWEEP = [
  [.18, 'io', { squash: .3, 'body.ry': .55, 'body.rz': -.05, 'armL.rx': -.9, 'armR.rx': -.9, eyes: .5, 'legL.rz': .2, 'body.z': .2, ears: -.4 }],
  [.3, 'in', { spin: -.6, 'legL.rz': .9, squash: .34, 'body.z': .7, 'body.rz': .18 }],
  [.4, 'lin', { spin: -2.12, 'legL.rz': 1.2, 'legL.s': 1.12, 'body.rz': .3, 'body.z': 1.3, squash: .34, mouth: .6, 'armL.rz': .8, 'armR.rz': -.9 }],
  [.56, 'out', { spin: -3.7, 'legL.rz': 1.25, 'legL.s': 1 }],
  [.8, 'io', { spin: -TAU, 'body.ry': -.2, 'legL.rz': .1, squash: .1, 'body.rz': 0, 'body.z': .9, mouth: 0, 'armL.rz': -.1, 'armR.rz': .2 }],
  [.801, 'lin', { spin: 0 }],
  [1.2, 'io', { 'body.z': .5 }],
  [1.6, 'io3', null],
];
const THROW = [
  [.18, 'io', { 'body.z': .3, 'armR.rx': -1.75, 'armR.rz': .15, 'armR.z': .12, 'armR.s': 1.1, 'body.ry': .3, eyes: .6, 'body.rx': .08 }],
  [.28, 'snap', { 'body.z': .4, 'armR.rx': -1.85, 'armR.s': 1.15, mouth: .3 }],
  [.42, 'in', { 'body.ry': -.9, 'body.rx': -.2, 'body.z': -.1, 'armR.rx': -2.6, 'armR.rz': -.4, 'armR.s': 1, squash: .1, mouth: .8, ears: .5, 'legL.rx': -.3, 'legR.rx': .35 }],
  [.6, 'out', { 'body.ry': -.4, 'body.rx': .1, 'body.z': 0, 'armR.rx': -1.4, squash: .05 }],
  [.78, 'in', { 'body.rx': .3, 'armR.rx': -.7, 'armR.rz': .1, squash: .18, mouth: 1 }],
  [.95, 'out', { 'body.rx': .05, squash: .02 }],
  [1.3, 'io', { 'body.ry': 0, 'body.z': .3, 'armR.rx': -.35, 'armR.rz': -2.2, 'armL.rx': -.35, 'armL.rz': 2.2, eyes: 1.12, mouth: .7, 'legL.rx': -.14, 'legR.rx': .16 }],
  [1.55, 'out', { 'body.y': .2, squash: -.05 }], [1.7, 'in', { 'body.y': 0, squash: .08 }],
  [2.4, 'io', { 'armR.rz': -2.0, 'armL.rz': 2.0, mouth: .3 }],
  [2.8, 'io3', null],
];
function reactThrow(tg, tl, dur) {
  const flat = { 'body.rx': 1.5 * Math.PI, 'body.pivot': 1.2, 'body.y': -.65, plant: 0, stab: .3, 'body.z': .2, 'legL.rx': -.2, 'legR.rx': -.1, 'armL.rz': 1.3, 'armR.rz': -1.3, 'armL.rx': -.4, 'armR.rx': -.4 };
  return [
    [tg - .04, 'lin', null],
    [tg, 'snap', { eyes: 1.2, mouth: .5, 'armL.rx': -1.75, 'armL.rz': -.1, 'armL.s': 1.15, 'body.z': .12, 'body.rx': .12, ears: .6 }],
    [tg + .14, 'in', { 'body.rx': .9, 'body.pivot': 1.2, 'body.y': .5, 'body.z': -.05, plant: 0, stab: .2, squash: -.08, 'legL.rx': -.6, 'legR.rx': -.3, 'armL.rx': -2.4, eyes: .1, mouth: 1 }],
    [tg + .3, 'out', { 'body.rx': 3.0, 'body.y': .9, 'body.z': 0, 'armL.s': 1, 'armL.rx': -1.0, 'armL.rz': 1.0, 'armR.rz': -1.2, 'legL.rx': .2, 'legR.rx': .4 }],
    [tl, 'in', { ...flat, squash: .22, eyes: .05, mouth: .8, ears: 1 }],
    [tl + .08, 'out', { 'body.y': -.5, squash: -.04 }],
    [tl + .17, 'in', { 'body.y': -.65, squash: .08 }],
    [dur - .5, 'io', { ...flat, eyes: .35, mouth: .2, 'legL.rx': -.45 }],
    [dur - .499, 'lin', { 'body.rx': -.5 * Math.PI }],
    [dur - .38, 'out', { 'body.rx': -1.75, 'legL.rx': -1.2, 'legR.rx': -1.2, squash: .1 }],
    [dur - .22, 'out', { 'body.rx': .06, 'body.y': .25, plant: 1, stab: 1, squash: -.08, 'legL.rx': -.14, 'legR.rx': .16, 'armL.rz': -.1, 'armR.rz': .2, 'armL.rx': -1.5, 'armR.rx': -1.22, eyes: .9, mouth: 0, 'body.z': .2 }],
    [dur - .1, 'in', { 'body.y': 0, squash: .1, 'body.rx': .04, 'body.pivot': 0, 'body.z': .1 }],
    [dur, 'io', null],
  ];
}

const LIE = { 'body.rx': -1.5, 'body.y': .5, plant: 0, stab: .3, squash: .06, 'legL.rx': -.25, 'legR.rx': -.12,
  'armL.rz': 1.3, 'armR.rz': -1.3, 'armL.rx': -.4, 'armR.rx': -.4 };
function downAndUp(tLand, z, dur) {
  return [
    [tLand, 'in', { ...LIE, 'body.z': z, squash: .18, eyes: .06, mouth: .6, ears: .8 }],
    [tLand + .08, 'out', { 'body.y': .66, squash: -.04, 'legL.rx': -.6, 'legR.rx': -.45 }],
    [tLand + .17, 'in', { 'body.y': .5, squash: .08, 'legL.rx': -.2, 'legR.rx': -.1 }],
    [tLand + .25, 'out', { 'body.y': .55 }],
    [tLand + .32, 'in', { 'body.y': .5, squash: .05, ears: -.3 }],
    [dur - .52, 'io', { ...LIE, 'body.z': z, eyes: .35, mouth: .2, 'legL.rx': -.45, 'legR.rx': -.05 }],
    [dur - .4, 'out', { 'body.rx': -1.72, 'legL.rx': -1.25, 'legR.rx': -1.25, squash: .1, 'armL.rz': .9, 'armR.rz': -.9 }], // tuck
    [dur - .24, 'out', { 'body.rx': .08, 'body.y': .32, plant: 1, stab: 1, squash: -.08, 'legL.rx': -.14, 'legR.rx': .16, 'armL.rz': -.1, 'armR.rz': .2,
      'armL.rx': -1.5, 'armR.rx': -1.22, eyes: .9, mouth: 0, ears: .4, 'body.z': z * .6 }], // kip-up
    [dur - .12, 'in', { 'body.y': 0, squash: .1, 'body.rx': .05, 'body.z': z * .35 }],
    [dur, 'io', null],
  ];
}
function reactSweep(ti, dur) {
  return [
    [ti - .03, 'lin', null],
    [ti, 'snap', { 'legL.rx': -.9, 'legR.rx': -.7, 'body.rx': -.3, 'body.y': .25, squash: -.06, eyes: .05, mouth: .9, ears: 1, 'armL.rz': 1.3, 'armR.rz': -1.3, plant: .5 }],
    [ti + .15, 'out', { 'body.y': .5, 'body.rx': -1.0, plant: .1, stab: .5, 'body.z': .1, 'legL.rx': -1.0, 'legR.rx': -.8 }],
    ...downAndUp(ti + .32, .35, dur),
  ];
}


const clips = {
  kick: { pose: clip(1.1, KICK), impact: .38 },
  sweep: { pose: clip(1.6, SWEEP), impact: .4 },
  toss: { pose: clip(1.25, [...THROW.filter(k => k[0] <= .95), [1.25, "io3", null]]), impact: .28 },
  recto: { pose: clip(.88, PUNCH), impact: .29, wind: .22 },
  gancho: { pose: clip(1, HOOK), impact: .3, wind: .22 },
  upper: { pose: clip(1.25, UPPER), impact: .35, wind: .27 },
};
const reaction = clip(.8, reactHead(.03, .8));
const tumbles = { toss: clip(1.4, reactThrow(.04, .5, 1.4)), sweep: clip(1.4, reactSweep(.04, 1.4)) };
export const COMBAT_STANCE = STANCE;
export function mirrorPose(pose) {
  const out = {};
  for (const [key, value] of Object.entries(pose)) {
    const mirrored = key.replace(/(arm|leg)(L|R)/, (_, limb, side) => limb + (side === 'L' ? 'R' : 'L'));
    out[mirrored] = /\.(ry|rz)$/.test(key) || key === 'spin' ? -value : value;
  }
  return out;
}
// Pin the authored impact pose to the host's contact window. Holding that
// pose during contact supplies hit-stop without pausing the simulation.
export function combatPose(act, at, { style = 'recto', hand = 1, windDuration = .43, tumbleKind = 'sweep', stun = .7 } = {}) {
  const p = { ...STANCE }, c = clips[act] || clips[style] || clips.recto;
  if (act === 'idle') return p;
  if (act === 'tumble') return sample(tumbles[tumbleKind] || tumbles.sweep, clamp01(at / stun) * 1.4, p);
  if (act === 'stun') return sample(reaction, .03 + .77 * clamp01(at / Math.max(.05, stun)), p);
  if (!['jab', 'wind', 'trompon', 'kick', 'sweep', 'toss'].includes(act)) return null;
  let t;
  if (act === 'wind') t = c.wind * clamp01(at / windDuration);
  else {
    const timing = ATTACK_TIMING[act];
    const start = act === 'trompon' ? c.wind : 0;
    t = at < timing.impact ? start + (c.impact - start) * clamp01(at / timing.impact)
      : at <= timing.release ? c.impact
      : c.impact + (c.pose.dur - c.impact) * clamp01((at - timing.release) / (timing.total - timing.release));
  }
  sample(c.pose, t, p);
  // The source hook is left-handed; the other source attacks use the right.
  return !clips[act] && hand !== (style === 'gancho' ? 0 : 1) ? mirrorPose(p) : p;
}
