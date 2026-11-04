// Loading the carrito, renderer-free: what fits (real objects at their true
// size on a height map of the hopper), whether you aimed into it, what makes a
// piece bounce out, and how a pushed load wobbles. Nothing here touches anyone's
// speed: heavier pieces are shorter throws, longer to place and bouncier.
import { ITEMS } from './items.js';
import { clamp } from '../../../engine/random.js';

// The open hopper, metres from the cart's origin (`mineCart({ hollow: true })`
// in engine/models/props/mine.js is built to these numbers).
export const HOPPER = { width: 1, length: 1.5, floor: .6, rim: 1.02, heap: .75 };
const CELL = .25, COLS = Math.round(HOPPER.width / CELL), ROWS = Math.round(HOPPER.length / CELL);
const RIM_LEVEL = HOPPER.rim - HOPPER.floor;
// Each piece's real footprint, width × length × height, from its model's bounds;
// `lay` pieces rest on their backs. Heights are as they stack (they nest a little).
export const BULK = {
  coins: [.5, .45, .2], emerald: [.4, .4, .3], pearl: [.4, .45, .25], cup: [.36, .36, .3], oldBook: [.3, .25, .08],
  mask: [.6, .6, .25, true], idol: [.36, .5, .3, true], echoMask: [.56, .5, .26, true], sandals: [.4, .34, .22], sunCrown: [.4, .4, .36], laughingIdol: [.4, .56, .34, true],
  miche: [.2, .48, .2, true], compass: [.32, .34, .2], luckyCoin: [.28, .34, .12, true], jaguarHeart: [.3, .34, .2, true],
};
const bulkOf = kind => BULK[kind] || [.5, .5, .3];
// How heavy it feels, 0…1.
export const HEFT = { coins: .2, emerald: .15, pearl: .15, cup: .25, oldBook: .1, mask: .55, idol: .6, echoMask: .5, sandals: .2, sunCrown: .45, laughingIdol: .6, miche: .35, compass: .3, luckyCoin: .1, jaguarHeart: .5 };
export const heftOf = kind => ITEMS[kind]?.size === 'big' ? 1 : HEFT[kind] ?? .4;

// Where every piece rests: each goes to the lowest place its footprint fits, far
// end first (the side a pana at the handle can see into), so the same contents
// always pack the same on every client.
export function packCart(contents) {
  const heights = new Float32Array(COLS * ROWS), slots = [];
  let top = 0;
  for (const piece of contents) {
    const [w, d, h, lay] = bulkOf(piece.kind), cw = Math.min(COLS, Math.ceil(w / CELL - 1e-6)), cd = Math.min(ROWS, Math.ceil(d / CELL - 1e-6));
    let bestY = Infinity, bestI = 0, bestJ = 0;
    for (let j = ROWS - cd; j >= 0; j--) for (let i = 0; i + cw <= COLS; i++) {
      let y = 0;
      for (let b = j; b < j + cd; b++) for (let a = i; a < i + cw; a++) y = Math.max(y, heights[b * COLS + a]);
      if (y < bestY - 1e-6) { bestY = y; bestI = i; bestJ = j; }
    }
    for (let b = bestJ; b < bestJ + cd; b++) for (let a = bestI; a < bestI + cw; a++) heights[b * COLS + a] = bestY + h;
    top = Math.max(top, bestY + h);
    slots.push({ x: (bestI + cw / 2) * CELL - HOPPER.width / 2, y: bestY, z: (bestJ + cd / 2) * CELL - HOPPER.length / 2, h, lay: !!lay });
  }
  return { slots, top };
}
// Does one more piece of this kind fit under the heap line? A big treasure sits
// on the load and fills the cart.
export const fitsIn = (cart, kind) => !cart.big && packCart([...cart.contents, { kind }]).top <= HOPPER.heap + 1e-6;
// How full, 0…1 (1 at the heap line); a big treasure is a full cart.
export const fillOf = cart => cart.big ? 1 : clamp(packCart(cart.contents).top / HOPPER.heap);
// The pieces standing above the rim, which a big treasure climbing in pushes out.
export function overRim(cart) {
  const list = [...cart.contents], out = [];
  while (list.length && packCart(list).top > RIM_LEVEL + 1e-6) out.unshift(list.pop());
  return out;
}

// Where the crosshair lands on the hopper's opening: in it, on the rim, or off it.
export function aimInto(p, cart) {
  const pitch = p.pitch || 0, cp = Math.cos(pitch), ly = Math.sin(pitch), eye = (p.y || 0) + 1.45;
  if (ly >= -.02) return 'out';
  const t = (HOPPER.rim - eye) / ly, x = p.x + Math.sin(p.h) * cp * t - cart.x, z = p.z + Math.cos(p.h) * cp * t - cart.z;
  const across = Math.abs(x * Math.cos(cart.h) - z * Math.sin(cart.h)), along = Math.abs(x * Math.sin(cart.h) + z * Math.cos(cart.h));
  const edge = Math.max(across - HOPPER.width / 2, along - HOPPER.length / 2);
  return edge <= .1 ? 'in' : edge <= .35 ? 'rim' : 'out';
}
// Is a flying piece over the opening?
export function overHopper(item, cart, pad = .08) {
  const x = item.x - cart.x, z = item.z - cart.z;
  return Math.abs(x * Math.cos(cart.h) - z * Math.sin(cart.h)) <= HOPPER.width / 2 + pad && Math.abs(x * Math.sin(cart.h) + z * Math.cos(cart.h)) <= HOPPER.length / 2 + pad;
}
// How likely a piece is to bounce out, 0…1. A careful drop into a calm cart with
// room never does; the rim, a heaped load, a cart on the move, a hard throw and a
// heavy piece all add up.
export function bounceChance({ heft = .3, aim = 'in', fill = 0, speed = 0, wobble = 0, impact = 0 } = {}) {
  const weight = .5 + heft;
  return clamp((aim === 'rim' ? .25 + .5 * heft : 0) + Math.max(0, fill - .66) * weight + Math.min(1, speed / 4) * .35 * weight + wobble * .3 + Math.max(0, impact - 6) * .07 * weight, 0, .95);
}
// Seconds of holding E to set a piece in: a handful is a tip of the hand, a mask
// takes a moment, the heavier the longer.
export const placeTime = held => held.pile ? 0 : .25 + .5 * heftOf(held.kind);
// A big treasure settling into the cart.
export const climbTime = kind => .5 + .4 * (ITEMS[kind]?.need || 2);
// Heavier flies shorter (m/s a thrown piece leaves with).
export const throwPower = (kind, power) => power * (1 - .45 * heftOf(kind));
// The load's wobble, 0…1, as it rolls: a hard start, stop or turn (`jerk`, the
// change of velocity in m/s) and a bump into a wall feed it, only a heavy heap
// really feels it, and it settles by itself. At 1 a piece falls off the top.
export function stepWobble(wobble = 0, { jerk = 0, bump = false, fill = 0, big = false, dt = .05 } = {}) {
  const load = clamp((fill - .45) / .55) * (big ? 1.3 : 1);
  return clamp(wobble + (Math.max(0, jerk - 1.5) * .11 + (bump ? .4 : 0)) * load - dt * .55);
}
