// La Estatua's poses as plain numbers (no Three.js, Node-tested); the model
// (library-statue.js) copies them onto its pivots. It is stone: it never
// animates. Between one stride and the next it simply is in another pose,
// and nobody saw it change. Each statue's seed bends every pose a little,
// so two never stand quite alike.
//
//   0  weeping: both hands over a bowed face (how it stands in a room)
//   1  reading: one hand on the face, the other low with a book's weight
//   2  reaching: head lifting toward you, both arms out
//   3  close: a lunge, fingers hooked
//   4  strike: arms raised over the head
//
// statuePose(index, { seed, t, frozen }, out) fills and returns `out` (time
// and `frozen` change nothing: stone holds; they are accepted so a caller can
// pass its usual frame options). A bad index falls back to 0.
import { rng } from '../../random.js';

export const STATUE_POSES = [
  { spineRx: .22, spineRz: 0, headRx: .6, headRy: 0, headRz: .08, lArmRx: -.62, lArmRz: -.38, lElbow: -2.25, rArmRx: -.62, rArmRz: .38, rElbow: -2.25, lHandRx: -.35, rHandRx: -.35, sheetRx: .05 },
  { spineRx: .2, spineRz: .06, headRx: .5, headRy: -.2, headRz: .18, lArmRx: -.6, lArmRz: -.36, lElbow: -2.2, rArmRx: -.12, rArmRz: -.08, rElbow: -.35, lHandRx: -.35, rHandRx: .3, sheetRx: .02 },
  { spineRx: .14, spineRz: -.04, headRx: -.12, headRy: .1, headRz: .22, lArmRx: -1.3, lArmRz: -.06, lElbow: -.22, rArmRx: -1.18, rArmRz: .1, rElbow: -.3, lHandRx: -.15, rHandRx: -.1, sheetRx: .1 },
  { spineRx: .38, spineRz: .08, headRx: -.25, headRy: -.08, headRz: -.15, lArmRx: -1.62, lArmRz: -.12, lElbow: -.5, rArmRx: -1.1, rArmRz: .16, rElbow: -.7, lHandRx: -.65, rHandRx: -.6, sheetRx: .18 },
  { spineRx: -.12, spineRz: 0, headRx: -.32, headRy: 0, headRz: .1, lArmRx: -2.75, lArmRz: .2, lElbow: -.55, rArmRx: -2.7, rArmRz: -.2, rElbow: -.6, lHandRx: -.5, rHandRx: -.5, sheetRx: -.08 },
];
const KEYS = Object.keys(STATUE_POSES[0]);
const bends = new Map();

// Per-seed offsets, cached: a few hundredths of a radian on every joint.
function bendFor(seed) {
  let b = bends.get(seed); if (b) return b;
  const R = rng(Math.imul((seed | 0) + 7, 2246822519) >>> 0); b = {};
  for (const k of KEYS) b[k] = (R() - .5) * .14;
  if (bends.size > 64) bends.clear();
  bends.set(seed, b); return b;
}

export function statuePose(index, { seed = 1 } = {}, out = {}) {
  const pose = STATUE_POSES[Number.isInteger(index) && STATUE_POSES[index] ? index : 0], b = bendFor(seed | 0);
  for (const k of KEYS) out[k] = pose[k] + b[k];
  return out;
}
