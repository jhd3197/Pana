// The pato real, the black and white yard duck with a red face. It paddles on a pond tile and walks on land.
// Feet at y = 0, bill towards +Z, about .75 long before the Studio's scale.
import * as THREE from 'three';
import { rng } from '/engine/models/core/primitives.js';
import { softSculpt, smooth, oval } from '/engine/models/core/soft-sculpt.js';

const NECK = [0, .33, .16];
const BODY = [
  { at: [0, .25, -.02], size: [.15, .135, .25] }, { at: [0, .29, .14], size: [.12, .12, .14] },
  { at: [0, .3, -.27], size: [.08, .06, .13], tilt: -.45, k: .05 },     // the tail tips up
];
const HEAD = [{ at: [0, .4, .19], size: [.07, .13, .075], tilt: .2 }, { at: [0, .53, .22], size: [.078, .08, .09], k: .05 }];
const COATS = { real: [0xf3efe2, 0x25282b], blanco: [0xf6f2e6, 0xf6f2e6], pardo: [0x8a6a48, 0x3b4a3a] };
const templates = new Map();
function template(name) {
  if (templates.has(name)) return templates.get(name);
  const [base, patch] = COATS[name].map(c => new THREE.Color(c)), out = new THREE.Color(), shade = new THREE.Color(0xcfc8b4);
  const back = (x, y, z) => smooth(.2, .7, Math.sin(z * 9 + .8) * .6 + smooth(.26, .36, y) + Math.cos(x * 14) * .3 - .2);
  const body = (x, y, z, n) => out.copy(base).lerp(shade, smooth(.22, .1, y) * .5).lerp(patch, back(x, y, z) * .92);
  const head = (x, y, z) => out.copy(base).lerp(patch, name === 'pardo' ? .85 : smooth(.52, .6, y) * smooth(.2, .14, z) * .9);
  const made = { body: softSculpt(BODY, { resolution: 24, paint: body, blend: .05 }), head: softSculpt(HEAD, { resolution: 20, paint: head, blend: .05, floor: false }) };
  made.head.translate(-NECK[0], -NECK[1], -NECK[2]);
  templates.set(name, made); return made;
}
const feather = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85 });
const bill = new THREE.MeshStandardMaterial({ color: 0xe0863a, roughness: .7 }), red = new THREE.MeshStandardMaterial({ color: 0xc23b2e, roughness: .8 });
const dark = new THREE.MeshStandardMaterial({ color: 0x1d1714, roughness: .45 });

export function pato({ seed = 7, coat = 'real' } = {}) {
  if (!COATS[coat]) throw new RangeError(`Unknown duck coat: ${coat}`);
  const random = rng(seed), g = new THREE.Group(), shape = new THREE.Group(), made = template(coat);
  const trunk = new THREE.Mesh(made.body.clone(), feather); trunk.castShadow = true; shape.add(trunk);
  const skull = new THREE.Group(); skull.position.set(...NECK);
  const face = new THREE.Mesh(made.head.clone(), feather); face.castShadow = true; skull.add(face);
  const at = (x, y, z) => [x - NECK[0], y - NECK[1], z - NECK[2]];
  const beak = oval(skull, bill, at(0, .515, .335), [.045, .02, .075], 8); beak.rotation.x = .12;
  if (coat === 'real') oval(skull, red, at(0, .545, .285), [.058, .04, .045], 8);    // the caruncle
  for (const s of [-1, 1]) {
    oval(skull, dark, at(s * .062, .56, .255), [.014, .016, .016], 6);
    const foot = oval(shape, bill, [s * .06, .012, .03], [.04, .012, .06], 6); foot.castShadow = false;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .13, 5), bill); leg.position.set(s * .06, .07, 0); shape.add(leg);
  }
  shape.add(skull); shape.scale.x = .96 + random() * .1; g.add(shape);
  const phase = random() * 6.28;
  g.name = 'Pato real'; g.userData = { assetId: 'pato', species: 'duck', coat, previewBounds: [[-.2, 0, -.42], [.2, .65, .42]],
    // afloat: the Studio sinks it to its waterline and lets it drift a little.
    tick(t = 0, afloat = false) {
      const time = t + phase, dab = smooth(.7, .95, (Math.sin(time * .47) + 1) / 2);
      skull.rotation.x = dab * (afloat ? 1.1 : .9) + Math.sin(time * 7) * .05 * dab;
      skull.rotation.y = Math.sin(time * .9) * .4 * (1 - dab);
      shape.position.y = afloat ? -.13 + Math.sin(time * 1.6) * .012 : 0;
      shape.rotation.z = afloat ? Math.sin(time * 1.1) * .04 : 0;
      shape.rotation.y = afloat ? Math.sin(time * .23) * .5 : 0;
    } };
  g.userData.tick(0);
  return g;
}
