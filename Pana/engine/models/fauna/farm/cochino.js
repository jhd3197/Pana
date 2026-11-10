// The backyard pig: long barrel, drooping ears over the eyes, a flat disc of a snout and a curl of a tail.
// Feet at y = 0, snout towards +Z, about 1.9 long.
import * as THREE from 'three';
import { rng } from '/engine/models/core/primitives.js';
import { softSculpt, smooth, oval } from '/engine/models/core/soft-sculpt.js';

const NECK = [0, .56, .5];
const BODY = [
  { at: [0, .6, -.38], size: [.34, .34, .42] }, { at: [0, .58, .02], size: [.35, .34, .5] }, { at: [0, .57, .36], size: [.31, .31, .3] },
  { at: [0, .46, -.02], size: [.3, .22, .5] },
  ...[-1, 1].flatMap(s => [
    { at: [s * .21, .25, -.44], size: [.09, .27, .11], k: .04 }, { at: [s * .2, .25, .34], size: [.085, .27, .1], k: .04 },
    { at: [s * .21, .04, -.42], size: [.075, .045, .09], k: .02 }, { at: [s * .2, .04, .37], size: [.075, .045, .09], k: .02 },
  ]),
];
const HEAD = [
  { at: [0, .6, .68], size: [.23, .22, .25] }, { at: [0, .53, .9], size: [.14, .13, .18], k: .06 },
  { at: [0, .52, 1.05], size: [.115, .1, .07], p: 3.2, k: .03 },
];
const COATS = { rosado: [0xdea592, 0xc98672, 0x4a3a35], criollo: [0x57443d, 0x3d302c, 0xdca794], manchado: [0xe0aa97, 0xc98b78, 0x3f322e], baquiro: [0x5d5750, 0x403c38, 0x8d867b] };
const templates = new Map();
function template(name) {
  if (templates.has(name)) return templates.get(name);
  const [base, shade, patch] = COATS[name].map(c => new THREE.Color(c)), hoof = new THREE.Color(0x3a2e29), out = new THREE.Color();
  const spots = (x, y, z) => name === 'rosado' ? 0 : name === 'baquiro' ? smooth(.18, .02, Math.abs(z - .42)) * smooth(.3, .5, y) : smooth(.55, .9, Math.sin(z * 4.3 + 1.2) + Math.cos(y * 6 + x * 3.5) + .4 * Math.sin(z * 11 - y * 7));
  const paint = snout => (x, y, z, n) => {
    out.copy(base).lerp(shade, smooth(.5, .2, y) * .7 + (1 - n.y) * .12).lerp(patch, spots(x, y, z) * (name === 'criollo' ? .55 : .9));
    if (snout) out.lerp(shade, smooth(1.02, 1.1, z) * .7);
    return out.lerp(hoof, smooth(.12, .05, y));
  };
  const made = { body: softSculpt(BODY, { resolution: 30, paint: paint(false) }), head: softSculpt(HEAD, { resolution: 24, paint: paint(true), floor: false }), ear: shade.getHex(), base: base.getHex() };
  made.head.translate(-NECK[0], -NECK[1], -NECK[2]);
  templates.set(name, made); return made;
}
const skin = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8 });
const dark = new THREE.MeshStandardMaterial({ color: 0x1d1714, roughness: .45 });
const flat = new Map(), tone = color => { if (!flat.has(color)) flat.set(color, new THREE.MeshStandardMaterial({ color, roughness: .85, side: THREE.DoubleSide })); return flat.get(color); };

export function cochino({ seed = 7, coat = 'rosado' } = {}) {
  if (!COATS[coat]) throw new RangeError(`Unknown pig coat: ${coat}`);
  const random = rng(seed), g = new THREE.Group(), shape = new THREE.Group(), made = template(coat);
  const trunk = new THREE.Mesh(made.body.clone(), skin); trunk.castShadow = true; trunk.receiveShadow = true; shape.add(trunk);
  const skull = new THREE.Group(); skull.position.set(...NECK);
  const face = new THREE.Mesh(made.head.clone(), skin); face.castShadow = true; skull.add(face);
  const at = (x, y, z) => [x - NECK[0], y - NECK[1], z - NECK[2]], ears = [];
  for (const s of [-1, 1]) {
    oval(skull, dark, at(s * .15, .7, .84), [.026, .028, .026], 8);
    oval(skull, dark, at(s * .045, .525, 1.118), [.02, .028, .012], 6);
    // A floppy triangle that folds forward over the eye.
    const ear = new THREE.Group(); ear.position.set(...at(s * .16, .79, .66));
    const blade = new THREE.Mesh(new THREE.ConeGeometry(.11, .24, 4), tone(made.ear)); blade.scale.z = .3; blade.position.y = -.1; blade.rotation.x = Math.PI; blade.castShadow = true; ear.add(blade);
    ear.rotation.set(-1.25, s * .25, s * .35); skull.add(ear); ears.push(ear);
  }
  shape.add(skull);
  const tail = new THREE.Mesh(new THREE.TorusGeometry(.07, .022, 6, 14, Math.PI * 1.7), tone(made.base)); tail.position.set(0, .74, -.8); tail.rotation.y = Math.PI / 2; tail.castShadow = true; shape.add(tail);
  shape.scale.x = .97 + random() * .08; g.add(shape);
  const phase = random() * 6.28;
  g.name = 'Cochino'; g.userData = { assetId: 'cochino', species: 'pig', coat, parts: { shape, skull, trunk, neck: NECK }, previewBounds: [[-.45, 0, -.95], [.45, 1, 1.2]],
    tick(t = 0) {
      const time = t + phase, root = smooth(.4, .85, (Math.sin(time * .37) + 1) / 2);
      trunk.scale.y = 1 + Math.sin(time * 2.2) * .012;
      skull.rotation.x = root * .5 + Math.sin(time * 6) * .05 * root;     // rooting in the dirt
      skull.rotation.y = Math.sin(time * .5) * .25 * (1 - root);
      ears.forEach((ear, i) => { ear.rotation.x = -1.25 + Math.sin(time * 6 + i) * .06 * root; });
      tail.rotation.x = Math.sin(time * 5) * .25;
    } };
  g.userData.tick(0);
  return g;
}
