// The map of milestone one: a riverbank in the Llanos, west to east:
// a sandy beach into the river, our plateau with a boulder, a caño crossed by
// a thin rock arch, El Tepuyito (a rock tower with an overhanging cap on a
// mound in the middle, a cave dug into the mound from each side, the two
// parted by a thin wall that one shot opens), a second caño under an
// overhanging lip,
// the rivals' plateau with its boulder, a rock cliff undercut by the river and
// a sandbar island off it. The tower blocks flat shots and is too steep to
// climb, so a team lobs over it or digs through; the caves are cover. Pure and seeded: the same ground on every
// load, in Node tests and for the bot.
import { createMask, fillHeights, carve, fill } from '../../../engine/play/terrain-mask.js';
import { fbm2, smoothstep, lerp, clamp } from '../../../engine/random.js';

export const LLANOS = Object.freeze({ id: 'llanos', name: 'Orilla del llano', seed: 2026, width: 80, height: 40, cell: .1, water: 4.2 }); // i18n-ignore: a place name

// Where the capis of each team start, mirrored across the tower.
export const SPAWNS = Object.freeze([[13, 19, 25], [55, 61, 67]]);

// The landmarks, in world units (x along the map).
export const FEATURES = Object.freeze({
  tower: { x: 40, half: 3.2, top: 22.6 },   // El Tepuyito: steep sides, flat top
  mound: { half: 3.4, foot: 5.2, height: 5 }, // the mound under the tower, just climbable
  caves: { reach: 6, wall: .8, radius: 1.15 }, // from the mound's flank to .8 short of the middle
  canos: [30.5, 49.5],                    // the two caños (dips)
  boulders: [16, 64],                     // a rock knob on each plateau
  arch: { from: 27.6, to: 33.6, y: 12.2 },  // the rock arch over the west caño
  lip: { x: 52.4, y: 12.4 },              // the overhang over the east caño
  beach: 12.5,                            // the west beach climbs to the plateau here
  cliff: 72.6,                            // the east cliff's face
  island: { x: 76.4, half: 2, top: 1.15 }, // the sandbar, above the water line
});
const gauss = (x, at, width) => Math.exp(-(((x - at) / width) ** 2));

// The ground's height before the tower: rolling savanna, boulders, caños.
function plateau(x, { seed } = LLANOS) {
  const roll = fbm2(x * .06 + seed * .013, seed * .071, { octaves: 4 });
  let h = 13.2 + (roll - .5) * 4;
  for (const b of FEATURES.boulders) h += 1.7 * gauss(x, b, 1.5);
  for (const c of FEATURES.canos) h -= 5.6 * gauss(x, c, 2.3);
  return h;
}

// Ground height at x (the top of the heightfield; the arch, the overhangs and
// the caves are added by buildMap).
export function llanosHeight(x, map = LLANOS) {
  const { width, water } = map, { tower, mound, cliff, island, beach } = FEATURES;
  let h = Math.max(plateau(x, map), water + 2.2);
  // The mound: never steeper than a capi climbs.
  const rise = clamp((mound.half + mound.foot - Math.abs(x - tower.x)) / mound.foot, 0, 1);
  h += mound.height * (.6 * rise + .4 * smoothstep(rise));
  // El Tepuyito: a flat top with near-vertical shoulders 1.1 wide.
  const shoulder = clamp((tower.half + 1.1 - Math.abs(x - tower.x)) / 1.1, 0, 1);
  h = Math.max(h, lerp(h, tower.top + (fbm2(x * .7, 3) - .5) * .8, smoothstep(shoulder)));
  // West: a long, soft beach down into the river (never steeper than a capi climbs).
  const t = clamp((x - 1) / (beach - 1), 0, 1);
  h = lerp(water - 2.5, h, .75 * t + .25 * smoothstep(t));
  // East: the cliff drops straight into the river, then the sandbar.
  const east = clamp((cliff + .6 - x) / .6, 0, 1);
  h = lerp(water - 2.6, h, east);
  const bar = 1 - ((x - island.x) / island.half) ** 2;
  if (bar > 0) h = Math.max(h, water - 2.6 + (2.6 + island.top) * Math.sqrt(bar));
  return Math.min(h, map.height - 4);
}

// The playable ground for `map`: heights, then the arch, the tower's cap,
// the overhang, the caves and the river's notch under the cliff. `hollow`
// marks the cells the caves and the notch took out (for the scene's back wall).
export function buildMap(map = LLANOS) {
  const mask = createMask(map), { tower, caves, arch, lip, cliff } = FEATURES;
  fillHeights(mask, x => llanosHeight(x, map));
  // The rock arch: a thin span over the west caño, thickest at its ends.
  for (let x = arch.from; x <= arch.to; x += .2) {
    const t = (x - arch.from) / (arch.to - arch.from), sag = Math.sin(t * Math.PI) * .7;
    fill(mask, x, arch.y - sag, .55 + .5 * Math.abs(t - .5) ** 1.5 * 4);
  }
  // El Tepuyito's cap juts out over both sides; under the lips the rock is cut back.
  for (const side of [-1, 1]) {
    fill(mask, tower.x + side * (tower.half + 1.3), tower.top - .55, .95);
    fill(mask, tower.x + side * (tower.half + .7), tower.top - .3, .9);
    carve(mask, tower.x + side * (tower.half + 1.9), tower.top - 2.6, 1.15);
  }
  // The east caño's overhanging lip.
  fill(mask, lip.x - .9, lip.y, .8); fill(mask, lip.x - 1.8, lip.y + .2, .55);
  carve(mask, lip.x - .6, lip.y - 1.9, 1.05);
  // The caves and the river's notch are hollows: the scene gives them a back wall.
  const before = mask.solid.slice();
  // A cave into the mound from each side, its floor on the plateau's ground,
  // ending in a thin wall under the tower.
  for (const side of [-1, 1]) for (let d = caves.reach; d >= caves.wall + caves.radius; d -= .25) {
    const x = tower.x + side * d; carve(mask, x, plateau(x, map) + caves.radius - .25, caves.radius);
  }
  // The river has eaten a notch under the cliff, leaving its top as an overhang.
  carve(mask, cliff + .4, map.water + 2.3, 1.9);
  mask.hollow = before.map((v, i) => v & (1 - mask.solid[i]));
  fill(mask, cliff + .5, llanosHeight(cliff - .4, map) - .6, .75);
  return mask;
}

// What the map's earth is made of, for the painter: 0..1 rock at (x, y).
// The tower, the cliff and the boulders are rock; deep down there are rock
// strata everywhere.
export function rockAt(x, y) {
  const { tower, cliff, boulders, arch } = FEATURES;
  let k = 0;
  if (Math.abs(x - tower.x) < tower.half + 2.4 && y > 11.5) k = Math.max(k, .85);
  if (x > cliff - 3) k = Math.max(k, clamp((x - cliff + 3) / 2, 0, 1) * .9);
  for (const b of boulders) k = Math.max(k, clamp(1.3 - Math.hypot(x - b, (y - 13.6) * 1.4) / 1.6, 0, 1));
  if (x > arch.from - .6 && x < arch.to + .6 && Math.abs(y - arch.y) < 1.3) k = Math.max(k, .75);
  // Two wavy strata deep in the bank.
  const wave = Math.sin(x * .21) * .5 + Math.sin(x * .07 + 1) * .9;
  if (Math.abs(y - 7.6 - wave) < .45 || Math.abs(y - 2.9 - wave * .6) < .6) k = Math.max(k, .7);
  return k;
}

// Where the ground was at the start: grass grows only near it, so a crater's
// floor and the caves' floors are bare earth.
export function grassAt(x, y) { return y > llanosHeight(x) - .9 || Math.abs(x - FEATURES.arch.from - 3) < 3.4 && y > FEATURES.arch.y; }
