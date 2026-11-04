// The boxing glove's measurements and how it sits on the arm, with no Three.js
// so the tests can check them. Glove units (×GLOVE_SIZE in the world): origin at
// the wrist, knuckles toward −Y, thumb side +Z, the palm toward −side on X.
export const WRIST = .13, FIST_TOP = .03, FIST_LENGTH = .39, FIST_WIDTH = .168, FIST_DEPTH = .18;
const CURL = .075, DROOP = .03;
const smooth = (x, a, b) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

// One point of the padded fist: u around the hand, v from the wrist to the
// knuckles. Fuller than a ball, pinched into the wrist, with a soft crease
// behind the knuckle pad, the back of the hand padded more than the palm, and
// the whole fist curling toward the palm like a closed hand.
export function fistPoint(u, v, side = 1) {
  const angle = u * Math.PI * 2, h = Math.cos(v * Math.PI);
  const reach = (1 - h) / 2, round = Math.sin(v * Math.PI) ** .66;
  const neck = .66 + .34 * smooth(reach, .06, .36);
  const crease = 1 - .07 * Math.exp(-(((reach - .68) / .05) ** 2));
  const across = -Math.cos(angle), depth = Math.sin(angle);
  const back = 1 + .13 * Math.max(0, across * side) * smooth(v, .15, .5);
  return [
    across * FIST_WIDTH * round * neck * crease * back - side * CURL * reach * reach,
    FIST_TOP - reach * FIST_LENGTH,
    depth * FIST_DEPTH * round * neck * crease - DROOP * reach * reach,
  ];
}

// The thumb's centre line: it starts by the wrist on the +Z side, leaning to the
// palm, and lies along the fist with its tip toward the knuckles.
export const thumbLine = (side = 1) => ({
  from: [-side * .05, -.095, .135],
  to: [-side * .08, -.195, .165],
  radius: .06,
});

// How far the hand turns on the arm's axis: 0 is the arm's own lie, thumb
// forward when hanging (thumb up in guard), palm in. Positive turns the palm
// down: a straight punch lands that way, knuckles first. An upper turns it up.
const REST = { idle: .45, wind: .2, grab: .9, hug: .6, throw: .3, taunt: .3 };
const BLOCK = { alta: .3, cruz: .55, concha: .05 };
export function handRoll(act, { style, striking = false, extension = 0 } = {}) {
  if (act === 'jab' || act === 'trompon') {
    if (!striking) return .35;
    return style === 'upper' ? .45 - 1.05 * extension : .45 + 1.1 * extension;
  }
  if (act === 'block') return BLOCK[style] ?? .3;
  return REST[act] ?? 0;
}

// A rigid frame for the glove out of the arm's world matrix (column-major, as
// Matrix4.elements): the arm is stretched and the body squashes, so its axes are
// neither unit nor square. Y stays on the arm, the others are squared to it. A
// glove on these axes can't shear, whatever the pose.
export function rigidFrame(e) {
  const unit = (v) => { const l = Math.hypot(...v) || 1; return v.map(n => n / l); };
  const y = unit([e[4], e[5], e[6]]);
  const lean = e[8] * y[0] + e[9] * y[1] + e[10] * y[2];
  const z = unit([e[8] - lean * y[0], e[9] - lean * y[1], e[10] - lean * y[2]]);
  return { x: [y[1] * z[2] - y[2] * z[1], y[2] * z[0] - y[0] * z[2], y[0] * z[1] - y[1] * z[0]], y, z };
}
