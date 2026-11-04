// What a pana wears into the dark, as plain data: the per-seat colours, the
// avatar with everything that would poke through the dome taken off, and the
// suit's parts in the sculpt's own units. Renderer-free so tests can read it;
// explorer-suit.js turns it into meshes. Looks only: nothing here reaches the
// rules, and a suited pana walks exactly like any other.

// One colour per seat: name tag, map dot, paint and suit all match.
export const SEAT_COLORS = ['#ffc83d', '#3fd6e0', '#ff7a6b', '#7bdc5a', '#b98bff', '#ff8fc8', '#4a9dff', '#ffa94d'];
export const seatColor = seat => SEAT_COLORS[(seat || 0) % SEAT_COLORS.length];

// Passed to buildCharacter as `head`: the dome has to hold the whole head, ears
// included, so the head sits a little smaller than the bare pana's 0.58.
export const SUIT_HEAD = .5;

// Keeps fur, face and glasses, the pana's identity. Hats, necklaces, backpacks
// and garment choices would clip through the suit, so they are never built.
export function suitedAvatar(avatar) {
  const worn = { ...(avatar || {}), hat: 'none', outfit: 'franela', extra: 'none' };
  if (worn.wardrobe) worn.wardrobe = { ...worn.wardrobe, hat: 'none', top: 'shirt', print: 'none', neck: 'none', back: 'none', wrist: false };
  return worn;
}

// `main` and `shade` come from the seat colour; the rest are the same on everyone.
export const TONES = { trim: '#2a2c3a', boot: '#3a3140', metal: '#d6dde6', hose: '#20222c', dial: '#7bffb0' };
export const SHADE = .6;

// The dome, in the head's units (the head's pivot is its centre). Open at the
// bottom, where the rim sits on the collar: well under the widest point, so it
// reads as a round bowl on a slim neck ring.
export const DOME = { center: [0, .1, .18], radius: 1.28, openAt: -1.02 };
export const domeOpening = () => Math.sqrt(DOME.radius ** 2 - (DOME.openAt - DOME.center[1]) ** 2);

// How the glass is painted, facing the viewer (explorer-suit.js): a clear middle
// so the face shows, an edge that brightens as the glass turns away, and a
// curved streak with a small glint opposite. Alpha values.
export const GLASS = { tint: '#a9dcff', edgeTint: '#d8f1ff', clear: .1, edge: .85, edgePower: 2.4, streak: .95, glint: .8 };

const ball = (at, size, tone = 'main') => ({ shape: 'ball', at, size, tone });
const ring = (at, radius, tube, tone = 'trim', squash = 1) => ({ shape: 'ring', at, radius, tube, tone, squash });
const box = (at, size, tone = 'trim') => ({ shape: 'box', at, size, tone });
const can = (at, radius, height, tone = 'metal', axis = 'y') => ({ shape: 'can', at, radius, height, tone, axis });
const hose = points => ({ shape: 'tube', points, radius: .032, tone: 'hose' });
// One smooth turned surface instead of stacked balls: [radius, y] from the
// bottom up, z flattened by `squash`.
const turned = (at, profile, tone = 'main', squash = 1) => ({ shape: 'turned', at, profile, tone, squash });

// A flatter body than a round one, so a suit fits a chest and not a barrel.
export const BODY_SQUASH = .78;
const COLLAR_Y = 1.635, COLLAR_Z = .155;

// Each list becomes one merged mesh on that bone of the sculpt.
export const SUIT_PARTS = {
  torso: [
    turned([0, 0, .03], [[0, .46], [.48, .5], [.635, .64], [.625, .84], [.585, .98]], 'shade', BODY_SQUASH),   // hips
    turned([0, 0, .03], [[.585, .98], [.59, 1.12], [.625, 1.32], [.6, 1.48], [.44, 1.6], [0, 1.66]], 'main', BODY_SQUASH),   // chest
    ring([0, .97, .03], .592, .036, 'trim', BODY_SQUASH),   // belt
    box([0, .97, .50], [.15, .10, .035], 'metal'),          // buckle
    turned([0, 0, COLLAR_Z], [[.40, 1.42], [.48, 1.54], [.54, COLLAR_Y]], 'shade'),     // neck ring, up to the helmet
    ball([0, COLLAR_Y + .02, COLLAR_Z], [.5, .17, .5], 'trim'),   // seals the collar under the head
    box([0, 1.26, .56], [.40, .25, .12]),                   // chest pack
    can([-.10, 1.28, .625], .05, .02, 'dial', 'z'),
    box([.09, 1.24, .625], [.14, .05, .015], 'metal'),
    hose([[.17, 1.36, .58], [.30, 1.46, .60], [.40, 1.56, .54], [.44, 1.62, .42]]),
    can([0, 1.27, -.56], .13, .52),                         // small air tank on the back
    can([0, 1.56, -.56], .05, .07, 'trim'),
    ring([0, 1.27, -.56], .135, .02),
  ],
  arm: [
    turned([0, 0, .01], [[0, -.8], [.12, -.76], [.125, -.56], [.145, -.32], [.165, -.22], [.10, -.13], [0, -.1]]),
    ring([0, -.70, .01], .13, .032),                        // cuff
    ball([0, -.84, .02], [.165, .145, .175]),               // glove
  ],
  leg: [
    turned([0, 0, 0], [[0, -.42], [.16, -.36], [.17, -.2], [.19, 0], [.17, .1], [0, .14]], 'shade'),
    ring([0, -.31, .01], .178, .032),                       // boot cuff
    ball([0, -.48, .07], [.235, .155, .32], 'boot'),
  ],
  helmet: [
    ring([0, DOME.openAt, DOME.center[2]], domeOpening() + .02, .09, 'metal'),
    box([0, 1.02, 1.0], [.26, .17, .14]),                   // lamp housing
  ],
  lens: [can([0, 1.02, 1.08], .085, .03, 'dial', 'z')],
};
