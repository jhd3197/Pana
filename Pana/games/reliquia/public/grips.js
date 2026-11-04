// How your diver holds each item in first person: pure numbers, no Three.js. A row
// says the hand's shape, where it rests, how the model sits in it and which blow it
// plays. Poses are the engine's [rotation x, rotation z, x, y, z, rotation y]
// (engine/play/viewmodel.js), written for the right hand; the left mirrors them.
import { swingTable } from '../../../engine/play/viewmodel.js';
import { ITEMS } from './items.js';

// The blows, as offsets from a rest pose. windup + recovery stays near the rules'
// p.swing: the blow lands the moment you press, so the windup is only a flick.
const BLOWS = {
  chop: { cocked: [.75, -.55, .05, .1, .06], through: [-1.2, .8, -.2, -.1, -.1], strike: .07, windup: .06, recovery: .24 },
  punch: { cocked: [.3, 0, .01, -.02, .08], through: [-.45, .1, -.08, .07, -.17], strike: .06, windup: .04, recovery: .22 },
  shot: { cocked: [.08, 0, 0, 0, .01], through: [.28, 0, 0, .012, .05], strike: .03, windup: .01, recovery: .1 },
};

const grip = (shape, rest, blow, model = {}) => ({ shape, rest, blow: BLOWS[blow], table: swingTable(rest, BLOWS[blow]), scale: 1, at: [0, 0, 0], turn: [0, 0, 0], ...model });

const EMPTY = grip('open', [-.14, -.08, .25, -.3, -.5, 0], 'punch');
// Loot sits on an open palm, turned up.
const PALM = [-.2, .12, .19, -.2, -.45, 0];
const CUPPED = grip('cup', PALM, 'punch', { scale: .42, at: [0, .018, -.012] });
const ARTIFACT = grip('cup', PALM, 'punch', { scale: .5, at: [0, .018, -.012] });
const SMALL = grip('cup', PALM, 'punch', { scale: .3, at: [0, .018, -.012] });

const GRIPS = {
  // The models' own axes differ, so each row turns its model until the handle runs up the
  // fist. The blade leans out of the headlamp's cone, which would burn it white.
  machete: grip('fist', [-.6, -.12, .25, -.22, -.46, 0], 'chop', { scale: .52, at: [0, .05, 0], turn: [0, -.6, Math.PI / 2] }),
  // The lantern hangs from the fist by its ring, held up and a little out, by the hand light.
  farol: grip('fist', [-.04, -.04, .26, -.07, -.55, 0], 'punch', { scale: .24, at: [0, -.235, 0] }),
  bengala: grip('fist', [-.42, .14, .21, -.2, -.46, 0], 'punch', { scale: .9, at: [0, -.1, 0] }),
  cuerda: grip('fist', [-.1, -.04, .22, -.13, -.48, 0], 'punch', { scale: .5, at: [-.01, -.12, -.02], turn: [Math.PI / 2, 0, 0] }),
  botiquin: grip('fist', [-.1, -.06, .22, -.13, -.48, 0], 'punch', { scale: .42, at: [0, -.125, -.01] }),
  marcadora: grip('fist', [.02, 0, .2, -.22, -.46, 0], 'shot', { scale: .5, at: [0, .035, 0], turn: [0, Math.PI, 0] }),
  honda: grip('fist', [-.22, .1, .2, -.2, -.46, 0], 'shot', { scale: .85, at: [0, -.04, 0], turn: [0, Math.PI, 0] }),
};

// The row for what this hand holds: nothing, a tool, a pile of small loot or a piece in the palm.
export function gripFor(held) {
  if (!held) return EMPTY;
  return GRIPS[held.kind] || (held.pile || ITEMS[held.kind]?.size === 'small' ? SMALL : ITEMS[held.kind]?.artifact ? ARTIFACT : CUPPED);
}
export const GRIP_KINDS = Object.keys(GRIPS);
