// What a pana wears into the dark, as plain data: the per-seat colours, the
// avatar with everything that would poke through the helmet taken off, and the
// diving suit's parts in the sculpt's own units. Renderer-free so tests can
// read it; explorer-suit.js turns it into meshes. Looks only: nothing here
// reaches the rules, and a suited pana walks exactly like any other.
import { locKey } from '../../../engine/i18n.js';

// One colour per seat: name tag, map dot, paint and suit all match.
export const SEAT_COLORS = ['#f0392f', '#17b9d6', '#ffd93a', '#55c93a', '#a56bff', '#ff7fbe', '#3d78f5', '#ff7a2a'];
export const seatColor = seat => SEAT_COLORS[(seat || 0) % SEAT_COLORS.length];

// Passed to buildCharacter as `head`: the helmet has to hold the whole head,
// ears included, so the head sits a little smaller than the bare pana's 0.58.
export const SUIT_HEAD = .5;

// Keeps fur, face and glasses, the pana's identity. Hats, necklaces, backpacks
// and garment choices would clip through the suit, so they are never built.
export function suitedAvatar(avatar) {
  const worn = { ...(avatar || {}), hat: 'none', outfit: 'franela', extra: 'none' };
  if (worn.wardrobe) worn.wardrobe = { ...worn.wardrobe, hat: 'none', top: 'shirt', print: 'none', neck: 'none', back: 'none', wrist: false };
  return worn;
}

// `main` and `shade` come from the seat colour; the rest are the same on everyone.
export const TONES = { brass: '#c98f2c', brassDark: '#8e5f20', rivet: '#e8bd5e', boot: '#6e4424', hose: '#3a2c20', hollow: '#120c08', port: '#2b4a55', cream: '#f2e3bd', patch: '#7a5734', stitch: '#e9d7a8', night: '#1d2230', braid: '#f4c542' };
export const SHADE = .72;
// Your own headlamp bleaches a full-strength colour to white at a few metres, and
// past its beam the cave is nearly black, so the cloth is painted a little darker
// and everything glows faintly in its own colour.
export const CLOTH = .74;
export const SELF_GLOW = { cloth: .13, brass: .09 };

// The helmet, in the head's units (the head's pivot is its centre): a brass ball
// with a round hole in front, `port` radians from the forward axis, closed by a
// glass cap so the face shows. It sinks into the collar, so no neck is seen.
export const HELMET = { center: [0, .1, .18], radius: 1.32, port: .76 };
const [HX, HY, HZ] = HELMET.center, R = HELMET.radius;
export const portRadius = () => R * Math.sin(HELMET.port);
const PORT_Z = HZ + R * Math.cos(HELMET.port);

// How the glass is painted, facing the viewer (explorer-suit.js): a clear middle
// so the face shows, an edge that brightens as the glass turns away, and a
// curved streak with a small glint opposite. Alpha values.
export const GLASS = { tint: '#bfe6ff', edgeTint: '#fff0c8', clear: .08, edge: .7, edgePower: 2.4, streak: .75, glint: .85 };

// Where the headlamp shines from, in the head's units.
export const LAMP = { at: [0, 1.66, .78], glow: .9, beam: .15, beamLength: 6, beamRadius: 1.25, tilt: .14 };

const ball = (at, size, tone = 'main') => ({ shape: 'ball', at, size, tone });
const rivet = (at, r = .05, tone = 'rivet') => ({ shape: 'rivet', at, radius: r, tone });
const ring = (at, radius, tube, tone = 'brass', squash = 1, facing = 'y') => ({ shape: 'ring', at, radius, tube, tone, squash, facing });
const can = (at, radius, height, tone = 'brass', axis = 'y') => ({ shape: 'can', at, radius, height, tone, axis });
const box = (at, size, tone = 'brass') => ({ shape: 'box', at, size, tone });
const hose = points => ({ shape: 'tube', points, radius: .04, tone: 'hose' });
// One smooth turned surface: [radius, y] from the bottom up, z flattened by `squash`.
const turned = (at, profile, tone = 'main', squash = 1) => ({ shape: 'turned', at, profile, tone, squash });
const around = (n, fn) => Array.from({ length: n }, (_, i) => fn((i + .5) / n * Math.PI * 2));

// Round but not a perfect ball, so the arms still have somewhere to hang.
export const BODY_SQUASH = .94;
const WAIST = 1.0, COLLAR = 1.6;

// A point on the helmet's skin, from the forward axis: `tilt` away from it, `spin` around it.
const onHelmet = (tilt, spin, lift = 0) => {
  const r = R + lift, s = Math.sin(tilt) * r;
  return [HX + Math.cos(spin) * s, HY + Math.sin(spin) * s, HZ + Math.cos(tilt) * r];
};
const sidePort = side => {
  const x = HX + side * R * .98, y = HY + .12;
  return [
    { shape: 'ring', at: [x, y, HZ], radius: .3, tube: .065, tone: 'brass', squash: 1, facing: 'x' },
    { shape: 'can', at: [x - side * .03, y, HZ], radius: .26, height: .04, tone: 'port', axis: 'x' },
    ...around(4, a => rivet([x + side * .015, y + Math.sin(a) * .3, HZ + Math.cos(a) * .3], .04)),
  ];
};

// Each list becomes one merged mesh on that bone of the sculpt.
export const SUIT_PARTS = {
  torso: [
    turned([0, 0, .02], [[0, .34], [.46, .38], [.72, .56], [.8, .82], [.8, WAIST]], 'shade', BODY_SQUASH),
    turned([0, 0, .02], [[.8, WAIST], [.8, 1.2], [.72, 1.42], [.54, COLLAR], [0, 1.72]], 'main', BODY_SQUASH),
    ring([0, WAIST, .02], .8, .05, 'brass', BODY_SQUASH),   // belt
    box([0, WAIST, .8], [.2, .15, .05], 'brassDark'),           // buckle
    turned([0, 0, .02], [[.66, 1.42], [.68, 1.47], [.54, 1.62], [.42, 1.72]], 'brass', BODY_SQUASH),   // the breastplate the helmet bolts onto
    ...around(8, a => rivet([Math.sin(a) * .63, 1.5, .02 + Math.cos(a) * .63 * BODY_SQUASH], .045)),
    can([0, 1.12, -.92], .2, .56, 'brass'),                 // small tank on the back
    ball([0, 1.4, -.92], [.2, .12, .2], 'brass'),
    ball([0, .84, -.92], [.2, .12, .2], 'brassDark'),
    ring([0, 1.26, -.92], .205, .025, 'brassDark'),
    ring([0, .98, -.92], .205, .025, 'brassDark'),
    hose([[0, 1.5, -.92], [0, 1.74, -.82], [.05, 1.86, -.68]]),
  ],
  arm: [
    turned([0, 0, 0], [[0, -.56], [.19, -.5], [.215, -.3], [.2, -.12], [.13, -.02], [0, .02]]),
    ring([0, -.47, 0], .19, .04),                           // cuff
    ball([0, -.6, .02], [.21, .19, .22], 'shade'),          // mitten
  ],
  leg: [
    turned([0, 0, 0], [[0, -.42], [.25, -.38], [.28, -.2], [.28, 0], [.22, .14], [0, .2]], 'shade'),
    ring([0, -.3, 0], .265, .04),                           // boot cuff
    ball([0, -.44, .08], [.31, .19, .4], 'boot'),
  ],
  helmet: [
    { shape: 'shell', radius: R, from: HELMET.port, tone: 'brass', widthSegments: 18, heightSegments: 9 },
    { shape: 'shell', radius: R - .03, from: HELMET.port, tone: 'hollow', widthSegments: 12, heightSegments: 5, inward: true },
    { shape: 'ring', at: [HX, HY, PORT_Z], radius: portRadius(), tube: .12, tone: 'brass', squash: 1, facing: 'z' },
    ...around(10, a => rivet([HX + Math.cos(a) * portRadius(), HY + Math.sin(a) * portRadius(), PORT_Z + .1], .05)),
    ...sidePort(1), ...sidePort(-1),
    ...around(10, a => rivet(onHelmet(2.32, a, .005), .05)),    // the seam behind the head
    ring([HX, HY - R * .92, HZ], R * .42, .1, 'brassDark'),     // the collar
    box([0, HY + R + .03, .28], [.3, .14, .46], 'brassDark'),   // lamp bracket
    can([0, 1.66, .48], .21, .58, 'brass', 'z'),                // lamp housing
    ring([0, 1.66, .76], .21, .045, 'rivet', 1, 'z'),
  ],
  lens: [can([0, 1.66, .78], .17, .03, 'rivet', 'z')],
};

// What a diver's rank has earned (the unlock ids in progress.js), added to the suit
// above. Each table runs low to high and the highest one owned is what is worn. The
// cloth stays the seat's colour, so a look never hides who is who.
const band = (y, tone, tube = .035, radius = .8) => ring([0, y, .02], radius, tube, tone, BODY_SQUASH);
const patch = (x, y, z, w, h) => [
  ball([x, y, z], [w, h, .06], 'patch'),
  ...around(6, a => rivet([x + Math.cos(a) * w * .9, y + Math.sin(a) * h * .9, z + .05], .022, 'stitch')),
];
// A ring on your first-person arm, `y` up the forearm from the wrist (the shared hand
// rig's units), just proud of its cloth. At rest only the first few hundredths of the
// sleeve are on screen, so these sit either side of the cuff: below 0 is the glove's
// wrist, past .04 the start of the sleeve. Anything further up is never seen.
const sleeveBand = (y, height, tone) => can([0, y, 0], (.043 + .021 * Math.max(0, y)) * 1.14, height, tone);
const shoulders = around(2, a => ball([Math.sin(a) * .66, 1.38, .02], [.24, .08, .24], 'brass'));
const FRANJA = {
  torso: [band(1.18, 'cream'), band(.82, 'cream')],
  arm: [ring([0, -.22, 0], .215, .026, 'cream')],
  leg: [ring([0, -.08, 0], .285, .028, 'cream')],
  sleeve: [sleeveBand(-.032, .016, 'cream'), sleeveBand(.052, .018, 'cream')],
};
const REMIENDO = {
  torso: [...FRANJA.torso, ...patch(.36, .66, .63, .2, .17), ...patch(-.42, 1.26, .62, .17, .13)],
  arm: [...FRANJA.arm, ball([0, -.36, .19], [.1, .09, .035], 'patch')],
  leg: [...FRANJA.leg, ball([0, -.2, .27], [.14, .1, .04], 'patch')],
  sleeve: [sleeveBand(-.032, .016, 'cream'), sleeveBand(.058, .03, 'patch')],
};
const CAPATAZ = {
  torso: [band(1.18, 'night', .06), band(1.27, 'braid', .02, .77), band(1.09, 'braid', .02), ...shoulders, can([0, 1.2, .8], .13, .05, 'brass', 'z')],
  arm: [ring([0, -.2, 0], .212, .024, 'braid'), ring([0, -.3, 0], .218, .024, 'braid')],
  leg: [ring([0, -.08, 0], .285, .03, 'night')],
  sleeve: [sleeveBand(-.032, .016, 'night'), sleeveBand(.048, .01, 'braid'), sleeveBand(.066, .01, 'braid')],
};
const LEYENDA = {
  torso: [...CAPATAZ.torso, band(.82, 'braid', .045), ...around(5, a => ball([Math.sin(a) * .1, 1.2 + Math.cos(a) * .1, .84], [.045, .045, .03], 'braid'))],
  arm: [...CAPATAZ.arm, ring([0, -.12, 0], .205, .024, 'braid')],
  leg: [ring([0, -.08, 0], .285, .03, 'braid'), ring([0, -.2, 0], .29, .022, 'braid')],
  sleeve: [sleeveBand(-.032, .016, 'braid'), sleeveBand(-.05, .01, 'braid'), sleeveBand(.05, .014, 'braid'), sleeveBand(.07, .014, 'braid'), sleeveBand(.09, .014, 'braid')],
};
export const TRAJES = { franja: FRANJA, remiendo: REMIENDO, capataz: CAPATAZ, leyenda: LEYENDA };
// A helmet's metal is the whole suit's, so your cuffs show it in first person.
export const CASCOS = {
  cobre: { brass: '#c66a3c', brassDark: '#86401f', rivet: '#eb9a6b' },
  plata: { brass: '#c4ccd4', brassDark: '#7d8791', rivet: '#eef3f7' },
  oro: { brass: '#f5c518', brassDark: '#b78a0e', rivet: '#fff0a0' },
};
// `mix`: how far the headlamp turns this colour, so a biome's own lamp still shows.
export const FAROLES = { ambar: { lamp: '#ffb35a', mix: .65 } };

export const PLAIN = Object.freeze({ traje: null, casco: null, farol: null });
export const lookKey = look => `${look.traje || ''}|${look.casco || ''}|${look.farol || ''}`;
// isUnlocked: progress.isUnlocked, or anything else that answers for an unlock id.
export function lookFor(isUnlocked) {
  const highest = (table, kind) => Object.keys(table).filter(id => isUnlocked(`${kind}:${id}`)).pop() ?? null;
  return { traje: highest(TRAJES, 'traje'), casco: highest(CASCOS, 'casco'), farol: highest(FAROLES, 'farol') };
}

// The camp's wardrobe (ropero.js): every look of each kind, plain first, with the
// unlock id that earns it. Plain is always yours.
const option = (kind, id, name) => ({ id, name, unlock: id ? `${kind}:${id}` : null });
export const ROPERO = {
  traje: [option('traje', null, locKey('Sin recorte')), option('traje', 'franja', locKey('Franja')), option('traje', 'remiendo', locKey('Remiendo')), option('traje', 'capataz', locKey('Capataz')), option('traje', 'leyenda', locKey('Leyenda'))],
  casco: [option('casco', null, locKey('Latón')), option('casco', 'cobre', locKey('Cobre')), option('casco', 'plata', locKey('Plata')), option('casco', 'oro', locKey('Oro'))],
  farol: [option('farol', null, locKey('Blanco')), option('farol', 'ambar', locKey('Ámbar'))],
};
export const ROPERO_KINDS = [['traje', locKey('Traje')], ['casco', locKey('Casco')], ['farol', locKey('Farol')]];
// What this pana chose to wear: `picks` is { kind: id | null } (null = plain). A kind
// with no pick, or a pick that is unknown or not (or no longer) earned, wears the
// highest earned, so nobody's look changes until they choose.
export function chosenLook(isUnlocked, picks) {
  const best = lookFor(isUnlocked), saved = picks && typeof picks === 'object' && !Array.isArray(picks) ? picks : {};
  const pick = kind => {
    if (!Object.hasOwn(saved, kind)) return best[kind];
    const found = ROPERO[kind].find(o => o.id === saved[kind]);
    return found && (!found.unlock || isUnlocked(found.unlock)) ? found.id : best[kind];
  };
  return { traje: pick('traje'), casco: pick('casco'), farol: pick('farol') };
}
export const suitTones = (look = PLAIN) => ({ ...TONES, ...CASCOS[look.casco] });
export function suitParts(look = PLAIN) {
  const added = TRAJES[look.traje] || {};
  return Object.fromEntries(Object.entries(SUIT_PARTS).map(([bone, list]) => [bone, [...list, ...(added[bone] || [])]]));
}
export const sleeveBands = (look = PLAIN) => TRAJES[look.traje]?.sleeve || [];
