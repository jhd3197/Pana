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
export const TONES = { trim: '#2a2c3a', boot: '#3a3140', metal: '#aab2be', hose: '#20222c', dial: '#7bffb0' };
export const SHADE = .68;

// The dome, in the head's units (the head's pivot is its centre). Open at the
// bottom, where the rim sits on the collar.
export const DOME = { center: [0, .1, .18], radius: 1.28, openAt: -.85 };
export const domeOpening = () => Math.sqrt(DOME.radius ** 2 - (DOME.openAt - DOME.center[1]) ** 2);

const ball = (at, size, tone = 'main') => ({ shape: 'ball', at, size, tone });
const ring = (at, radius, tube, tone = 'trim', squash = 1) => ({ shape: 'ring', at, radius, tube, tone, squash });
const box = (at, size, tone = 'trim') => ({ shape: 'box', at, size, tone });
const can = (at, radius, height, tone = 'metal', axis = 'y') => ({ shape: 'can', at, radius, height, tone, axis });
const hose = points => ({ shape: 'tube', points, radius: .045, tone: 'hose' });

// Each list becomes one merged mesh on that bone of the sculpt.
export const SUIT_PARTS = {
  torso: [
    ball([0, .70, 0], [.80, .30, .60]),                // hips
    ring([0, .88, 0], .74, .05, 'trim', .75),          // belt
    ball([0, 1.08, 0], [.90, .34, .68]),               // belly
    ball([0, 1.40, 0], [.86, .34, .66], 'shade'),      // chest
    ball([0, 1.62, .10], [.88, .24, .80]),             // shoulders, under the collar
    ball([0, 1.78, .155], [.72, .08, .72], 'trim'),    // seals the collar under the head
    ring([0, 1.74, .155], .74, .09, 'shade'),          // collar
    box([0, 1.22, .68], [.62, .40, .22]),              // chest pack
    can([-.16, 1.27, .80], .06, .03, 'dial', 'z'),
    box([.14, 1.17, .795], [.20, .08, .02], 'metal'),
    hose([[.22, 1.40, .76], [.40, 1.56, .86], [.52, 1.72, .76], [.50, 1.80, .60]]),
    hose([[-.22, 1.40, .76], [-.40, 1.56, .86], [-.52, 1.72, .76], [-.50, 1.80, .60]]),
    can([.19, 1.22, -.74], .17, .72),                  // air tanks on the back
    can([-.19, 1.22, -.74], .17, .72),
  ],
  arm: [
    ball([0, -.04, .02], [.33, .27, .33]),
    ball([0, -.33, .02], [.29, .20, .30], 'shade'),
    ball([0, -.58, .02], [.27, .18, .28]),
    ring([0, -.74, .02], .21, .05),                    // cuff
    ball([0, -.88, .03], [.25, .19, .27]),             // glove
  ],
  leg: [
    ball([0, .02, 0], [.38, .25, .40]),
    ball([0, -.22, .01], [.35, .17, .37], 'shade'),
    ring([0, -.33, .02], .29, .05),                    // boot cuff
    ball([0, -.46, .12], [.37, .18, .44], 'boot'),
  ],
  helmet: [
    ring([0, DOME.openAt, DOME.center[2]], domeOpening(), .085),
    box([0, 1.02, 1.0], [.26, .17, .14]),              // lamp housing
  ],
  lens: [can([0, 1.02, 1.08], .085, .03, 'dial', 'z')],
};
