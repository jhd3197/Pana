// La Estatua's poses as plain numbers (no Three.js, Node-tested); the model
// (library-statue.js) copies them onto its pivots. It is stone: it never
// animates. Between one stride and the next it simply is in another pose,
// and nobody saw it change, so each pose reads as different body language
// from across a room: the head turns or lifts 30–70° and the torso leans.
// Each statue's seed bends every pose a little, so two never stand alike.
//
//   0  weeping: both hands over a bowed face (how it stands in a room)
//   1  reading: head bowed low over an open book held at the chest
//   2  reaching: one arm out toward you, fingers spread, head tilted
//   3  close: both arms reaching, head thrown up, mouth open
//   4  strike: a lunge, torso forward, arms out, fingers hooked
//
// Angles in radians. spine*/head* lean forward (+Rx), turn (+Ry, to its
// left) and tilt (+Rz); jaw opens the mouth; per arm (l*, r*): Fwd raises
// it forward, Out swings it away from the body (negative: across it), Twist
// turns it on its own axis, Elbow and Wrist bend forward, Curl hooks the
// fingers. book shows the open book (0 or 1).
//
// statuePose(index, { seed, t, frozen }, out) fills and returns `out` (time
// and `frozen` change nothing: stone holds; they are accepted so a caller can
// pass its usual frame options). A bad index falls back to 0.
import { rng } from '../../random.js';

const arm = (s, fwd, out, twist, elbow, wrist, curl) => ({ [`${s}Fwd`]: fwd, [`${s}Out`]: out, [`${s}Twist`]: twist, [`${s}Elbow`]: elbow, [`${s}Wrist`]: wrist, [`${s}Curl`]: curl });
const pose = (body, l, r) => ({ ...body, ...arm('l', ...l), ...arm('r', ...r) });

export const STATUE_POSE_NAMES = ['weeping', 'reading', 'reaching', 'close', 'strike'];
export const STATUE_POSES = [
  pose({ baseRx: 0, spineRx: .22, spineRy: 0, spineRz: .05, headRx: .6, headRy: .12, headRz: .14, jaw: .04, book: 0 },
    [1.1, -.25, -.85, 2.45, .3, .1], [1.1, -.25, -.85, 2.45, .3, .1]),
  pose({ baseRx: 0, spineRx: .26, spineRy: .08, spineRz: -.05, headRx: .8, headRy: -.5, headRz: -.18, jaw: .03, book: 1 },
    [.42, -.2, 0, 1.6, .05, .25], [.42, -.2, 0, 1.6, .05, .25]),
  pose({ baseRx: 0, spineRx: .06, spineRy: -.32, spineRz: .1, headRx: -.12, headRy: .68, headRz: .42, jaw: .14, book: 0 },
    [.1, .06, 0, .25, .1, .45], [1.45, .1, 3.14, .1, -.75, .12]),
  pose({ baseRx: .04, spineRx: .32, spineRy: .1, spineRz: -.04, headRx: -.55, headRy: -.32, headRz: -.12, jaw: .42, book: 0 },
    [1.45, .1, 3.14, .12, -.35, .35], [1.55, .08, 3.14, .08, -.3, .3]),
  pose({ baseRx: .12, spineRx: .62, spineRy: .16, spineRz: .06, headRx: -.62, headRy: .36, headRz: .22, jaw: .36, book: 0 },
    [2.05, .18, 3.14, .28, -.3, .85], [2.15, .15, 3.14, .2, -.35, .9]),
];
const KEYS = Object.keys(STATUE_POSES[0]);
const bends = new Map();

// Per-seed offsets, cached: a few hundredths of a radian on every joint
// (the book stays shown or hidden).
function bendFor(seed) {
  let b = bends.get(seed); if (b) return b;
  const R = rng(Math.imul((seed | 0) + 7, 2246822519) >>> 0); b = {};
  for (const k of KEYS) b[k] = k === 'book' ? 0 : (R() - .5) * .12;
  if (bends.size > 64) bends.clear();
  bends.set(seed, b); return b;
}

export function statuePose(index, { seed = 1 } = {}, out = {}) {
  const pose = STATUE_POSES[Number.isInteger(index) && STATUE_POSES[index] ? index : 0], b = bendFor(seed | 0);
  for (const k of KEYS) out[k] = pose[k] + b[k];
  return out;
}
