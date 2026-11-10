// The chigüire of the llanos, sculpted to read as one from the farm's camera: a brick of a head with the eyes
// and the little ears set high and far back, a blunt square muzzle, a rump taller than the shoulders, no tail,
// and short slim legs that leave daylight under the belly. Feet at y = 0, snout towards +Z, about 2 long.
import * as THREE from 'three';
import { rng } from '/engine/models/core/primitives.js';
import { softSculpt, smooth, oval } from '/engine/models/core/soft-sculpt.js';

const NECK = [0, .7, .5];
const body = young => [
  { at: [0, .66, -.46], size: [.345, .37, .44] },                 // rump, the highest point
  { at: [0, .61, -.06], size: [.36, .36, .5] },                   // barrel
  { at: [0, .6, .3], size: [.31, .32, .34] },                     // shoulders, a little lower
  { at: [0, .5, -.08], size: [.3, .24, .5] },                     // the belly hangs, but clear of the ground
  { at: [0, .7, .5], size: [.24, .26, .25] },                     // short thick neck
  ...[-1, 1].flatMap(s => [
    { at: [s * .24, .5, -.46], size: [.15, .24, .23], k: .05 },   // thigh
    { at: [s * .25, young ? .2 : .24, -.5], size: [.085, .25, .1], k: .04 },    // hind shank
    { at: [s * .25, .045, -.42], size: [.085, .05, .15], k: .03 },             // long hind foot
    { at: [s * .2, young ? .22 : .27, .32], size: [.075, .28, .085], k: .04 }, // straight foreleg
    { at: [s * .2, .045, .38], size: [.078, .048, .12], k: .03 },              // forefoot
  ]),
];
const head = [
  { at: [0, .845, .73], size: [.2, .185, .26], p: 2.6 },           // skull: flat on top
  { at: [0, .8, .99], size: [.15, .158, .22], p: 3.6, k: .05 },    // the muzzle is a block
  { at: [0, .7, .8], size: [.165, .115, .23], k: .06 },            // jaw and cheeks
  ...[-1, 1].map(s => ({ at: [s * .11, .74, .74], size: [.1, .12, .14], k: .06 })),
];
const COAT = { back: 0x6f4d33, side: 0x9c7148, belly: 0xc4a57a, nose: 0x3d2f27, foot: 0x3a2d25, jaw: 0xc2a071 };
const YOUNG = { back: 0x8b6238, side: 0xb98a52, belly: 0xd6b987, nose: 0x493830, foot: 0x45362c, jaw: 0xd0b283 };

const templates = new Map();
function template(young) {
  if (templates.has(young)) return templates.get(young);
  const tones = Object.fromEntries(Object.entries(young ? YOUNG : COAT).map(([k, v]) => [k, new THREE.Color(v)])), out = new THREE.Color();
  // Coarse fur: streaks along the body, darker along the spine, sandy underneath.
  const fur = (x, y, z) => .5 + .5 * Math.sin(z * 31 + Math.sin(y * 17 + x * 9) * 2.2) * Math.sin(x * 23 + z * 7);
  const paintBody = (x, y, z, n) => {
    out.copy(tones.side).lerp(tones.back, smooth(.62, .98, y) * (.55 + .45 * n.y));
    out.lerp(tones.belly, smooth(.5, .26, y) * .85);
    out.multiplyScalar(.9 + fur(x, y, z) * .16);
    return out.lerp(tones.foot, smooth(.2, .06, y));
  };
  const paintHead = (x, y, z, n) => {
    out.copy(tones.side).lerp(tones.back, smooth(.84, 1.02, y) * .8);
    out.lerp(tones.jaw, smooth(.76, .64, y) * .8);
    out.multiplyScalar(.92 + fur(x, y, z) * .12);
    // The bare dark nose wraps the front of the block and a little of its top.
    return out.lerp(tones.nose, smooth(1.1, 1.17, z) * smooth(.7, .78, y) * .95);
  };
  const made = { body: softSculpt(body(young), { resolution: young ? 24 : 32, paint: paintBody }), head: softSculpt(head, { resolution: young ? 20 : 26, paint: paintHead, floor: false }) };
  made.head.translate(-NECK[0], -NECK[1], -NECK[2]);
  templates.set(young, made); return made;
}
const coat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .92 });
const dark = new THREE.MeshStandardMaterial({ color: 0x1d1714, roughness: .45 }), shine = new THREE.MeshStandardMaterial({ color: 0xfff1d8, roughness: .3 });
const earOut = new THREE.MeshStandardMaterial({ color: 0x6f4a2e, roughness: .95 }), earIn = new THREE.MeshStandardMaterial({ color: 0x3c2a22, roughness: .95 });

export function chiguire({ seed = 7, young = false } = {}) {
  const random = rng(seed), g = new THREE.Group(), shape = new THREE.Group(), made = template(young);
  const trunk = new THREE.Mesh(made.body.clone(), coat); trunk.castShadow = true; trunk.receiveShadow = true; shape.add(trunk);
  const skull = new THREE.Group(); skull.position.set(...NECK);
  const face = new THREE.Mesh(made.head.clone(), coat); face.castShadow = true; skull.add(face);
  const at = (x, y, z) => [x - NECK[0], y - NECK[1], z - NECK[2]], ears = [], eyes = [];
  for (const s of [-1, 1]) {
    const eye = oval(skull, dark, at(s * .158, .925, .83), [.03, .034, .034], 8); eyes.push(eye);
    oval(eye, shine, [s * .35, .4, .5], [.26, .26, .26], 6);
    oval(skull, dark, at(s * .058, .865, 1.196), [.026, .02, .016], 6);       // nostril
    const ear = new THREE.Group(); ear.position.set(...at(s * .135, 1.005, .575)); ear.rotation.set(-.25, s * .5, s * .35);
    oval(ear, earOut, [0, .045, 0], [.062, .07, .03], 8); oval(ear, earIn, [0, .045, .014], [.04, .048, .02], 6);
    skull.add(ear); ears.push(ear);
  }
  shape.add(skull);
  skull.scale.setScalar(young ? 1.22 : 1.08);
  if (young) shape.scale.setScalar(.5);
  shape.scale.x *= .97 + random() * .08;
  g.add(shape);
  const phase = random() * 6.28, rest = ears.map(e => e.rotation.z);
  g.name = young ? 'Cría de chigüire' : 'Chigüire';
  g.userData = { assetId: 'chiguire', species: 'capybara', young, parts: { shape, skull, trunk, neck: NECK }, previewBounds: [[-.45, 0, -.95], [.45, 1.1, 1.25]],
    tick(t = 0) {
      const time = t + phase, graze = smooth(.55, .9, (Math.sin(time * .31) + 1) / 2);
      trunk.scale.y = 1 + Math.sin(time * 1.9) * .012;                                  // breathing
      skull.rotation.x = graze * .42 + Math.sin(time * 4.1) * .03 * graze + Math.sin(time * .8) * .02;
      skull.rotation.y = Math.sin(time * .43) * .32 * (1 - graze);
      ears.forEach((ear, i) => { const flick = Math.max(0, Math.sin(time * 1.7 + i * 2.1) - .86) * 5; ear.rotation.z = rest[i] + (i ? -1 : 1) * flick * .5; });
      const blink = 1 - .9 * Math.exp(-(((Math.sin(time * .61) - .995) / .018) ** 2));
      eyes.forEach(eye => { eye.scale.y = .034 * blink; });
    } };
  g.userData.tick(0);
  return g;
}
// A mother with her young close by, the way they move through the llano.
export function chiguireFamily({ seed = 7, young = 3 } = {}) {
  const g = new THREE.Group(), random = rng(seed), members = [];
  const mother = chiguire({ seed }); mother.position.set(-.75, 0, -.5); mother.rotation.y = .3; g.add(mother); members.push(mother);
  for (let i = 0; i < young; i++) {
    const cub = chiguire({ seed: seed + 3 + i * 5, young: true }), a = .4 + i * 1.15;
    cub.position.set(.7 + Math.cos(a) * .8, 0, .5 + Math.sin(a) * .85); cub.rotation.y = random() * 2 - .4; g.add(cub); members.push(cub);
  }
  g.name = 'Chigüires'; g.userData.tick = t => members.forEach(m => m.userData.tick(t));
  return g;
}
