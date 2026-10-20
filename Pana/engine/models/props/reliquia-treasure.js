// Reliquia's loot, enchanted artifacts and expedition tools. Metres, +Y up,
// resting on y = 0, front at +Z. Every model is baked to one mesh per
// material (static-batch) because a floor holds dozens of them at once, and
// the materials are shared between copies: never recolour one in place.
// Gold and gems carry a little emission so they read in a dark ruin.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { bake } from '/engine/models/core/static-batch.js';
import { rng } from '/engine/models/core/primitives.js';

const cache = new Map();
function paint(color, extra = {}) {
  const key = `${color}:${JSON.stringify(extra)}`;
  if (!cache.has(key)) cache.set(key, new THREE.MeshStandardMaterial({ color, roughness: .55, ...extra }));
  return cache.get(key);
}
const GOLD = () => paint(0xffc23d, { metalness: .55, roughness: .28, emissive: 0x5a3400, emissiveIntensity: .45 });
const DARK_GOLD = () => paint(0xd9902a, { metalness: .5, roughness: .35, emissive: 0x3a2000, emissiveIntensity: .35 });
const EMERALD = () => paint(0x2fe08a, { roughness: .15, metalness: .1, emissive: 0x0f7a42, emissiveIntensity: .8 });
const JADE = () => paint(0x4fe3c1, { roughness: .3, emissive: 0x168a6c, emissiveIntensity: .6 });
const RUBY = () => paint(0xff3d5a, { roughness: .2, emissive: 0x8a0a22, emissiveIntensity: .7 });
const WOOD = () => paint(0x9a5f34, { roughness: .8 });
const DARK = () => paint(0x2a1d16, { roughness: .9 });
const STONE = () => paint(0x9c9480, { roughness: .95, flatShading: true });
const CREAM = () => paint(0xfff1d6, { roughness: .6 });

function part(parent, geometry, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
const sphere = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
const cyl = (top, bottom, h, s = 16) => new THREE.CylinderGeometry(top, bottom, h, s);
const rounded = (w, h, d) => new RoundedBoxGeometry(w, h, d, 3, Math.min(w, h, d) * .22);

// Bake the parts into one mesh per material and keep the source geometry tidy.
function finish(root, name, bounds, extra = {}) {
  const group = bake(root); root.traverse(o => o.geometry?.dispose());
  group.name = name; group.userData = { previewBounds: bounds, ...extra };
  group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.userData.dispose = () => group.traverse(o => o.geometry?.dispose());
  return group;
}

// ---------- Small loot: goes in the bag ----------
export function coinPile({ count = 9, seed = 3 } = {}) {
  const g = new THREE.Group(), r = rng(seed), coin = cyl(.085, .085, .022, 18);
  for (let i = 0; i < count; i++) {
    const stack = i % 3, h = Math.floor(i / 3);
    const x = [-.1, .09, 0][stack] + (r() - .5) * .02, z = [0, .04, -.11][stack] + (r() - .5) * .02;
    part(g, coin.clone(), i % 4 ? GOLD() : DARK_GOLD(), x, .011 + h * .024, z, (r() - .5) * .08, r() * 3, (r() - .5) * .08);
  }
  part(g, coin.clone(), GOLD(), .17, .05, -.06, 1.25, 0, .3);
  return finish(g, 'Monedas de oro', [[-.25, 0, -.25], [.25, .2, .2]]);
}
export function emerald({ size = .17 } = {}) {
  const g = new THREE.Group(), body = cyl(size * .55, size * .55, size * 1.1, 6);
  part(g, body, EMERALD(), 0, size * .95, 0, 0, Math.PI / 6);
  part(g, new THREE.ConeGeometry(size * .55, size * .5, 6), EMERALD(), 0, size * 1.75, 0, 0, Math.PI / 6);
  part(g, new THREE.ConeGeometry(size * .55, size * .4, 6), EMERALD(), 0, size * .2, 0, Math.PI, Math.PI / 6);
  return finish(g, 'Esmeralda', [[-.2, 0, -.2], [.2, size * 2.1, .2]]);
}
export function pearl() {
  const g = new THREE.Group(), shell = paint(0xffb3a7, { roughness: .45 }), pearly = paint(0xfffaf2, { roughness: .12, metalness: .2, emissive: 0x6a5f55, emissiveIntensity: .35 });
  const lower = part(g, sphere(.16, 16, 8), shell, 0, .05, 0); lower.scale.set(1, .32, .9);
  const upper = part(g, sphere(.16, 16, 8), shell, 0, .14, -.1, -1.0); upper.scale.set(1, .25, .9);
  for (let i = -2; i <= 2; i++) part(g, cyl(.008, .008, .3, 5), paint(0xe88a7e), i * .055, .1, -.13, -1.0 - .3, 0, i * .12);
  part(g, sphere(.07, 16, 12), pearly, 0, .12, .02);
  return finish(g, 'Perla de Cubagua', [[-.2, 0, -.25], [.2, .3, .2]]);
}
export function goldCup() {
  const g = new THREE.Group(), profile = [[0, 0], [.11, 0], [.12, .02], [.04, .05], [.03, .14], [.05, .17], [.12, .2], [.14, .33], [.13, .34], [.11, .22], [0, .21]].map(([x, y]) => new THREE.Vector2(x, y));
  part(g, new THREE.LatheGeometry(profile, 20), GOLD());
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; part(g, sphere(.022, 8, 6), i ? EMERALD() : RUBY(), Math.sin(a) * .128, .27, Math.cos(a) * .128); }
  return finish(g, 'Copa de oro', [[-.18, 0, -.18], [.18, .36, .18]]);
}
// A hammered gold face: the plan's gold mask. Holes are dark inlays.
export function goldMask({ inlay = 'jade' } = {}) {
  const g = new THREE.Group();
  const face = part(g, new THREE.SphereGeometry(.2, 20, 14, -Math.PI / 2, Math.PI), GOLD(), 0, .26, 0); face.scale.set(1, 1.2, .55);
  for (const s of [-1, 1]) {
    const eye = part(g, sphere(.045, 12, 8), DARK(), s * .075, .3, .1); eye.scale.set(1.3, .6, .4);
    part(g, sphere(.022, 8, 6), inlay === 'jade' ? JADE() : RUBY(), s * .075, .3, .118);
    part(g, new THREE.TorusGeometry(.04, .012, 6, 14), DARK_GOLD(), s * .2, .22, 0, 0, Math.PI / 2);
  }
  part(g, new THREE.ConeGeometry(.03, .09, 4), DARK_GOLD(), 0, .245, .11, .3);
  const mouth = part(g, sphere(.05, 12, 6), DARK(), 0, .16, .095); mouth.scale.set(1.4, .35, .4);
  for (let i = 0; i < 7; i++) { const a = -1.2 + i * .4; part(g, new THREE.ConeGeometry(.03, .1, 4), DARK_GOLD(), Math.sin(a) * .22, .26 + Math.cos(a) * .27, -.02, 0, 0, -a); }
  return finish(g, 'Máscara de oro', [[-.3, 0, -.15], [.3, .6, .2]]);
}
// A squat seated figure: big head, little arms on the belly.
export function carvedIdol({ stone = 0x5fbf8f } = {}) {
  const g = new THREE.Group(), body = paint(stone, { roughness: .6, emissive: 0x0d3a26, emissiveIntensity: .4 });
  part(g, rounded(.26, .06, .22), DARK_GOLD(), 0, .03, 0);
  const torso = part(g, sphere(.13, 14, 10), body, 0, .16, 0); torso.scale.set(1, 1.05, .85);
  const head = part(g, sphere(.12, 14, 10), body, 0, .34, .01); head.scale.set(1.15, 1, .95);
  for (const s of [-1, 1]) {
    part(g, sphere(.03, 8, 6), GOLD(), s * .05, .36, .1);
    part(g, cyl(.03, .035, .15, 8), body, s * .085, .17, .07, 1.2, 0, s * .4);
    part(g, sphere(.045, 8, 6), body, s * .07, .05, .08);
  }
  part(g, new THREE.BoxGeometry(.22, .04, .14), GOLD(), 0, .45, 0);
  return finish(g, 'Ídolo tallado', [[-.18, 0, -.15], [.18, .5, .16]]);
}

// ---------- Big treasures: two to four panas, or very slow alone ----------
export function sunDisk() {
  const g = new THREE.Group();
  for (const x of [-.55, .55]) part(g, new THREE.BoxGeometry(.12, .12, 1.1), WOOD(), x, .06, 0);
  part(g, new THREE.BoxGeometry(1.3, .1, .3), WOOD(), 0, .16, 0);
  part(g, cyl(.82, .82, .12, 32), GOLD(), 0, 1.05, 0, Math.PI / 2);
  part(g, cyl(.6, .6, .14, 32), DARK_GOLD(), 0, 1.05, .01, Math.PI / 2);
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; part(g, new THREE.ConeGeometry(.08, .26, 4), GOLD(), Math.sin(a) * .93, 1.05 + Math.cos(a) * .93, 0, 0, 0, -a); }
  for (const s of [-1, 1]) { part(g, sphere(.07, 10, 8), JADE(), s * .2, 1.15, .09); }
  const smile = part(g, new THREE.TorusGeometry(.2, .03, 6, 16, Math.PI), DARK(), 0, 1.02, .08, 0, 0, Math.PI); smile.scale.y = .8;
  part(g, sphere(.08, 10, 8), RUBY(), 0, 1.05, .09);
  return finish(g, 'Disco del sol', [[-1.1, 0, -.6], [1.1, 2.2, .6]]);
}
export function emeraldChest() {
  const g = new THREE.Group(), r = rng(9);
  part(g, rounded(1.1, .6, .72), WOOD(), 0, .32, 0);
  for (const x of [-.45, 0, .45]) part(g, new THREE.BoxGeometry(.08, .64, .76), GOLD(), x, .32, 0);
  const lid = part(g, new THREE.CylinderGeometry(.36, .36, 1.1, 14, 1, false, 0, Math.PI), WOOD(), 0, .62, -.34, -.6, 0, Math.PI / 2);
  lid.rotation.order = 'YXZ';
  for (let i = 0; i < 14; i++) part(g, new THREE.OctahedronGeometry(.07 + r() * .04), EMERALD(), (r() - .5) * .8, .64 + r() * .1, (r() - .5) * .4, r(), r(), r());
  part(g, new THREE.BoxGeometry(.16, .18, .06), GOLD(), 0, .48, .38);
  return finish(g, 'Cofre de esmeraldas', [[-.7, 0, -.7], [.7, 1.1, .5]]);
}
export function ceremonialDrum() {
  const g = new THREE.Group(), hide = paint(0xffe2b0, { roughness: .7 }), red = paint(0xe0452e, { roughness: .6 }), teal = paint(0x2fb5a8, { roughness: .6 });
  part(g, cyl(.5, .42, .95, 24), red, 0, .55, 0);
  for (const y of [.12, .98]) part(g, new THREE.TorusGeometry(.48, .04, 6, 24), GOLD(), 0, y, 0, Math.PI / 2);
  part(g, cyl(.49, .49, .04, 24), hide, 0, 1.03, 0);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; part(g, new THREE.BoxGeometry(.12, .5, .04), i % 2 ? teal : GOLD(), Math.sin(a) * .47, .55, Math.cos(a) * .47, 0, a, 0); }
  for (const s of [-1, 1]) part(g, cyl(.04, .04, .7, 8), WOOD(), s * .6, .45, 0, 0, 0, s * .25);
  return finish(g, 'Tambor ceremonial', [[-.75, 0, -.55], [.75, 1.1, .55]]);
}
export function cursedMirror() {
  const g = new THREE.Group(), glass = paint(0xb48cff, { metalness: .9, roughness: .05, emissive: 0x3a1a7a, emissiveIntensity: .7 });
  for (const s of [-1, 1]) part(g, new THREE.BoxGeometry(.12, .12, .8), WOOD(), s * .45, .06, 0);
  const frame = part(g, new THREE.TorusGeometry(.62, .09, 10, 32), GOLD(), 0, 1.15, 0); frame.scale.y = 1.4;
  const face = part(g, cyl(.6, .6, .05, 32), glass, 0, 1.15, 0, Math.PI / 2); face.scale.z = 1.4;
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; part(g, sphere(.06, 8, 6), i % 2 ? RUBY() : JADE(), Math.sin(a) * .66, 1.15 + Math.cos(a) * .9, .06); }
  part(g, new THREE.ConeGeometry(.16, .3, 5), GOLD(), 0, 2.25, 0);
  part(g, new THREE.BoxGeometry(.18, .35, .18), GOLD(), 0, .2, 0);
  return finish(g, 'Espejo maldito', [[-.85, 0, -.5], [.85, 2.45, .5]]);
}
export function cacaoAltar() {
  const g = new THREE.Group(), r = rng(12), pod = paint(0xe0782a, { roughness: .5 }), podDark = paint(0x9a4a1e, { roughness: .6 });
  part(g, rounded(2.0, .5, 1.2), STONE(), 0, .25, 0);
  part(g, rounded(1.8, .3, 1.0), paint(0xbdb196, { roughness: .9, flatShading: true }), 0, .65, 0);
  for (let i = 0; i < 10; i++) { const p = part(g, sphere(.12, 10, 8), i % 3 ? pod : podDark, (r() - .5) * 1.4, .9, (r() - .5) * .6, 0, r() * 3, .4); p.scale.set(.75, 1.4, .75); }
  for (const x of [-.65, 0, .65]) { part(g, new THREE.SphereGeometry(.22, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), GOLD(), x, 1.05, .2, Math.PI); part(g, cyl(.05, .07, .1, 8), GOLD(), x, .85, .2); }
  for (const s of [-1, 1]) part(g, new THREE.BoxGeometry(.08, .45, 1.24), GOLD(), s * .98, .25, 0);
  return finish(g, 'Altar de cacao y oro', [[-1.1, 0, -.7], [1.1, 1.3, .7]]);
}

// ---------- Enchanted artifacts: one hand, a power with a catch ----------
// Each carries an aura colour the game reuses for its glow and HUD chip.
export const ARTIFACT_AURA = { echoMask: 0x5fd6ff, sandals: 0xffd23f, sunCrown: 0xffb02e, laughingIdol: 0xff6f9c, miche: 0xc58aff, compass: 0x7dffb0, luckyCoin: 0xffe066, jaguarHeart: 0xff4a3d };
function aura(g, color, y = .2) { part(g, new THREE.OctahedronGeometry(.035), paint(color, { emissive: color, emissiveIntensity: 1.6 }), 0, y, 0); }
export function echoMask() {
  const g = new THREE.Group(), blue = paint(0x3fb8e8, { roughness: .35, emissive: 0x0d4a6a, emissiveIntensity: .7 });
  const face = part(g, new THREE.SphereGeometry(.17, 18, 12, -Math.PI / 2, Math.PI), blue, 0, .22, 0); face.scale.set(1, 1.15, .5);
  for (const s of [-1, 1]) {
    part(g, new THREE.TorusGeometry(.06, .018, 6, 16, Math.PI * 1.6), GOLD(), s * .2, .24, 0, 0, s * Math.PI / 2);
    const eye = part(g, sphere(.035, 10, 6), paint(0xffffff, { emissive: 0x9ff2ff, emissiveIntensity: 1.4 }), s * .065, .25, .085); eye.scale.set(1.2, .7, .4);
  }
  const o = part(g, new THREE.TorusGeometry(.035, .012, 6, 14), DARK(), 0, .14, .085); o.scale.y = 1.4;
  aura(g, ARTIFACT_AURA.echoMask, .46);
  return finish(g, 'Máscara de los ecos', [[-.28, 0, -.12], [.28, .5, .14]], { aura: ARTIFACT_AURA.echoMask });
}
export function messengerSandals() {
  const g = new THREE.Group(), sole = paint(0xc98f55, { roughness: .9 }), strap = paint(0xff5e8a, { roughness: .6 }), wing = paint(0xffffff, { emissive: 0xfff2a0, emissiveIntensity: .8 });
  for (const s of [-1, 1]) {
    const x = s * .09;
    const base = part(g, rounded(.1, .03, .26), sole, x, .015, 0); base.rotation.y = s * .08;
    for (const z of [-.04, .06]) part(g, new THREE.TorusGeometry(.045, .012, 6, 12, Math.PI), strap, x, .03, z);
    for (let i = 0; i < 3; i++) part(g, new THREE.BoxGeometry(.008, .03, .09 - i * .02), wing, x + s * .055, .06 + i * .02, -.08 - i * .01, 0, 0, s * (.5 + i * .25));
  }
  aura(g, ARTIFACT_AURA.sandals, .18);
  return finish(g, 'Alpargatas del mensajero', [[-.2, 0, -.18], [.2, .22, .16]], { aura: ARTIFACT_AURA.sandals });
}
export function sunCrown() {
  const g = new THREE.Group();
  part(g, new THREE.TorusGeometry(.14, .03, 8, 24), GOLD(), 0, .05, 0, Math.PI / 2);
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; part(g, new THREE.ConeGeometry(.03, .14 + (i % 2) * .05, 4), GOLD(), Math.sin(a) * .14, .14 + (i % 2) * .025, Math.cos(a) * .14); }
  part(g, new THREE.OctahedronGeometry(.045), paint(0xffb02e, { emissive: 0xff8a00, emissiveIntensity: 1.6 }), 0, .12, .15);
  aura(g, ARTIFACT_AURA.sunCrown, .32);
  return finish(g, 'Corona del sol', [[-.2, 0, -.2], [.2, .36, .2]], { aura: ARTIFACT_AURA.sunCrown });
}
export function laughingIdol() {
  const g = new THREE.Group(), mouth = paint(0xd62a4a, { emissive: 0x6a0418, emissiveIntensity: .7 });
  part(g, rounded(.2, .05, .18), DARK_GOLD(), 0, .025, 0);
  const body = part(g, sphere(.12, 14, 10), GOLD(), 0, .15, 0); body.scale.set(1.1, 1, .9);
  const head = part(g, sphere(.13, 16, 12), GOLD(), 0, .33, 0); head.scale.set(1.15, 1, 1);
  const grin = part(g, new THREE.SphereGeometry(.08, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mouth, 0, .3, .1); grin.scale.set(1.3, .9, .5);
  for (const s of [-1, 1]) { const eye = part(g, new THREE.TorusGeometry(.025, .01, 6, 10, Math.PI), DARK(), s * .05, .38, .12); eye.rotation.z = 0; part(g, cyl(.025, .03, .12, 8), GOLD(), s * .13, .2, .04, .3, 0, s * -1); }
  aura(g, ARTIFACT_AURA.laughingIdol, .52);
  return finish(g, 'Ídolo que se ríe', [[-.2, 0, -.16], [.2, .56, .18]], { aura: ARTIFACT_AURA.laughingIdol });
}
export function micheBottle() {
  const g = new THREE.Group(), glass = paint(0x8a4fc9, { roughness: .1, metalness: .2, emissive: 0x3a1366, emissiveIntensity: .7 }), cork = paint(0xb88a52, { roughness: .9 }), label = paint(0xfff1d6, { roughness: .8 });
  part(g, cyl(.07, .075, .2, 16), glass, 0, .1, 0);
  part(g, cyl(.03, .07, .07, 16), glass, 0, .235, 0);
  part(g, cyl(.028, .028, .09, 12), glass, 0, .3, 0);
  part(g, cyl(.024, .028, .05, 10), cork, 0, .36, 0);
  part(g, cyl(.0755, .0755, .08, 16, 1, true), label, 0, .1, 0);
  part(g, new THREE.TorusGeometry(.076, .006, 4, 16), RUBY(), 0, .07, 0, Math.PI / 2);
  aura(g, ARTIFACT_AURA.miche, .45);
  return finish(g, 'Botella de miche', [[-.1, 0, -.1], [.1, .48, .1]], { aura: ARTIFACT_AURA.miche });
}
export function crookedCompass() {
  const g = new THREE.Group(), brass = paint(0xc9a050, { metalness: .6, roughness: .3, emissive: 0x2a1a00, emissiveIntensity: .3 }), dial = paint(0xfff6e0, { roughness: .5 });
  part(g, cyl(.13, .13, .05, 24), brass, 0, .025, 0);
  part(g, cyl(.11, .11, .052, 24), dial, 0, .03, 0);
  part(g, new THREE.TorusGeometry(.025, .008, 6, 12), brass, 0, .03, -.15, Math.PI / 2);
  const needle = new THREE.Group(); needle.position.set(0, .06, 0); g.add(needle);
  part(needle, new THREE.ConeGeometry(.018, .12, 4), RUBY(), .02, 0, .05, Math.PI / 2, 0, -.3);
  part(needle, new THREE.ConeGeometry(.018, .08, 4), DARK(), -.01, 0, -.04, -Math.PI / 2, 0, .5);
  aura(g, ARTIFACT_AURA.compass, .16);
  return finish(g, 'Brújula torcida', [[-.16, 0, -.18], [.16, .2, .16]], { aura: ARTIFACT_AURA.compass });
}
export function luckyCoin() {
  const g = new THREE.Group(), ribbon = paint(0xe83a3a, { roughness: .7 });
  const coin = part(g, new THREE.TorusGeometry(.085, .045, 10, 24), GOLD(), 0, .14, 0); coin.scale.z = .45;
  part(g, cyl(.09, .09, .02, 20), DARK_GOLD(), 0, .14, 0, Math.PI / 2);
  for (const s of [-1, 1]) part(g, new THREE.BoxGeometry(.03, .14, .008), ribbon, s * .03, .03, 0, 0, 0, s * .4);
  aura(g, ARTIFACT_AURA.luckyCoin, .3);
  return finish(g, 'Moneda de la suerte', [[-.14, 0, -.06], [.14, .34, .06]], { aura: ARTIFACT_AURA.luckyCoin });
}
export function jaguarHeart() {
  const g = new THREE.Group(), heart = paint(0xff5a2e, { roughness: .2, emissive: 0xc0200a, emissiveIntensity: 1 });
  for (const s of [-1, 1]) part(g, sphere(.075, 14, 10), heart, s * .05, .17, 0);
  const tip = part(g, new THREE.ConeGeometry(.11, .16, 14), heart, 0, .09, 0, Math.PI); tip.scale.z = .75;
  for (let i = 0; i < 5; i++) { const a = i * 1.3; part(g, sphere(.016, 6, 4), DARK(), Math.sin(a) * .07, .14 + Math.cos(a) * .04, .06); }
  aura(g, ARTIFACT_AURA.jaguarHeart, .3);
  return finish(g, 'Corazón de jaguar', [[-.15, 0, -.1], [.15, .34, .1]], { aura: ARTIFACT_AURA.jaguarHeart });
}

// ---------- Tools and room fittings ----------
export function machete() {
  const g = new THREE.Group(), steel = paint(0xd8dde0, { metalness: .7, roughness: .25 }), grip = paint(0x5a3a22, { roughness: .8 });
  const blade = new THREE.Shape(); blade.moveTo(0, 0); blade.lineTo(.6, .015); blade.quadraticCurveTo(.7, .05, .62, .1); blade.lineTo(0, .07); blade.closePath();
  part(g, new THREE.ExtrudeGeometry(blade, { depth: .008, bevelEnabled: false }), steel, .02, -.035, -.004);
  part(g, new THREE.BoxGeometry(.2, .05, .04), grip, -.09, 0, 0);
  part(g, new THREE.BoxGeometry(.03, .09, .05), DARK_GOLD(), .01, 0, 0);
  return finish(g, 'Machete', [[-.2, -.1, -.05], [.7, .12, .05]]);
}
export function botiquin() {
  const g = new THREE.Group(), white = paint(0xfafafa, { roughness: .5 }), red = paint(0xe8343a, { roughness: .5 });
  part(g, rounded(.34, .22, .16), white, 0, .11, 0);
  part(g, new THREE.BoxGeometry(.13, .04, .01), red, 0, .12, .082);
  part(g, new THREE.BoxGeometry(.04, .13, .01), red, 0, .12, .082);
  part(g, new THREE.TorusGeometry(.05, .012, 6, 12, Math.PI), DARK(), 0, .22, 0);
  return finish(g, 'Botiquín', [[-.2, 0, -.1], [.2, .3, .1]]);
}
// Chest with a hinged lid on userData.lid (rotate x negative to open).
export function treasureChest({ seed = 5 } = {}) {
  const g = new THREE.Group(), r = rng(seed), wood = paint(0x8a4e2a, { roughness: .8 });
  part(g, rounded(.9, .5, .6), wood, 0, .25, 0);
  for (const x of [-.36, .36]) part(g, new THREE.BoxGeometry(.06, .52, .62), GOLD(), x, .25, 0);
  const body = finish(g, 'Cofre del templo', [[-.55, 0, -.45], [.55, .9, .45]]);
  const lidRoot = new THREE.Group(); lidRoot.position.set(0, .5, -.3);
  const lidParts = new THREE.Group();
  part(lidParts, new THREE.CylinderGeometry(.3, .3, .9, 14, 1, false, 0, Math.PI), wood, 0, 0, .3, 0, 0, Math.PI / 2).rotation.set(0, 0, Math.PI / 2);
  for (const x of [-.36, .36]) part(lidParts, new THREE.CylinderGeometry(.31, .31, .06, 14, 1, false, 0, Math.PI), GOLD(), x, 0, .3, 0, 0, Math.PI / 2).rotation.set(0, 0, Math.PI / 2);
  part(lidParts, new THREE.BoxGeometry(.12, .14, .04), GOLD(), 0, -.02, .61);
  const lid = bake(lidParts); lidParts.traverse(o => o.geometry?.dispose()); lidRoot.add(lid); body.add(lidRoot);
  for (let i = 0; i < 3 + r() * 3; i++) part(body, new THREE.OctahedronGeometry(.05), i % 2 ? EMERALD() : GOLD(), (r() - .5) * .6, .48, (r() - .5) * .3, r(), r(), r());
  body.userData.lid = lidRoot;
  return body;
}
// Pressure plate: the game swaps userData.glyph's material when it is armed.
export function trapPlate() {
  const g = new THREE.Group();
  part(g, rounded(1.7, .08, 1.7), paint(0xb8a47c, { roughness: .9, flatShading: true }), 0, .04, 0);
  const glyph = new THREE.Mesh(new THREE.RingGeometry(.35, .5, 4), paint(0x6a5a3a, { roughness: .9 }));
  glyph.rotation.set(-Math.PI / 2, 0, Math.PI / 4); glyph.position.y = .085; g.add(glyph);
  g.name = 'Losa trampa'; g.userData = { glyph, previewBounds: [[-.9, 0, -.9], [.9, .2, .9]] };
  return g;
}
// A serpent head that juts from a wall and spits darts: its mouth faces +Z.
export function dartHead() {
  const g = new THREE.Group(), stone = paint(0x7f8a6a, { roughness: .9, flatShading: true });
  part(g, rounded(.5, .5, .35), stone, 0, 0, 0);
  const snout = part(g, rounded(.36, .26, .3), stone, 0, -.04, .28);
  snout.scale.z = 1.1;
  for (const s of [-1, 1]) part(g, sphere(.05, 8, 6), RUBY(), s * .14, .12, .2);
  part(g, cyl(.06, .06, .05, 10), DARK(), 0, -.06, .44, Math.PI / 2);
  return finish(g, 'Boca de dardos', [[-.3, -.3, -.2], [.3, .3, .5]]);
}
// Stone seal over a stairwell: a slab with a jade sun the game can light.
export function stairSeal({ width = 3.4, height = 3.6 } = {}) {
  const g = new THREE.Group(), slab = paint(0x6f7a66, { roughness: .95, flatShading: true });
  part(g, new THREE.BoxGeometry(width, height, .45), slab, 0, height / 2, 0);
  part(g, new THREE.TorusGeometry(.7, .09, 8, 28), GOLD(), 0, height * .55, .24);
  part(g, cyl(.45, .45, .06, 24), JADE(), 0, height * .55, .24, Math.PI / 2);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; part(g, new THREE.BoxGeometry(.12, .3, .05), GOLD(), Math.sin(a) * .95, height * .55 + Math.cos(a) * .95, .24, 0, 0, -a); }
  for (const s of [-1, 1]) part(g, new THREE.BoxGeometry(.18, height, .5), DARK_GOLD(), s * (width / 2 - .09), height / 2, .02);
  return finish(g, 'Sello de la escalera', [[-width / 2, 0, -.3], [width / 2, height, .35]]);
}

// ---------- Ways in and out ----------
// A timber A-frame over a hole with a pulley and a rope that drops `depth`
// metres into the dark: the way down to the next floor. Origin at the hole's
// centre on the floor; the frame spans x.
export function rappelRig({ depth = 6, width = 3.6 } = {}) {
  const g = new THREE.Group(), wood = WOOD(), rope = paint(0xd9b47a, { roughness: .9 }), iron = paint(0x4a4a52, { metalness: .5, roughness: .45 });
  for (const s of [-1, 1]) {
    part(g, cyl(.11, .13, 3.4, 8), wood, s * width / 2, 1.6, -.5, -.18, 0, 0);
    part(g, cyl(.11, .13, 3.4, 8), wood, s * width / 2, 1.6, .5, .18, 0, 0);
  }
  part(g, cyl(.1, .1, width + .3, 8), wood, 0, 3.2, 0, 0, 0, Math.PI / 2);
  part(g, new THREE.TorusGeometry(.2, .06, 8, 16), iron, 0, 2.95, 0, 0, Math.PI / 2, 0);
  part(g, cyl(.035, .035, depth + 3, 6), rope, .2, 3 - (depth + 3) / 2, 0);
  for (let i = 0; i < 6; i++) part(g, sphere(.06, 6, 4), rope, .2, 2.4 - i * 1.1, 0);
  part(g, new THREE.TorusGeometry(.4, .07, 6, 14), rope, -.9, .08, .9, Math.PI / 2);
  return finish(g, 'Rapel de la bajada', [[-width / 2 - .3, -depth, -1], [width / 2 + .3, 3.4, 1]]);
}
// A knotted rope hanging from a hole in the ceiling, daylight spilling down:
// the climb back up. Origin on the floor under the hole.
export function climbRope({ height = 6 } = {}) {
  const g = new THREE.Group(), rope = paint(0xd9b47a, { roughness: .9 });
  part(g, cyl(.04, .04, height, 6), rope, 0, height / 2, 0);
  for (let y = .6; y < height; y += .55) part(g, sphere(.075, 6, 4), rope, 0, y, 0);
  part(g, new THREE.TorusGeometry(.32, .06, 6, 14), rope, .35, .07, .2, Math.PI / 2);
  const beam = new THREE.Mesh(cyl(.6, .9, height, 18, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff1c8, transparent: true, opacity: .14, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  beam.position.y = height / 2;
  const out = finish(g, 'Cuerda de subida', [[-1, 0, -1], [1, height, 1]]);
  out.add(beam); return out;
}
// The montacargas: a timber cage on a plank deck, open at the front (+Z),
// one green lever on its right (-X) that sends it up or down, and a bell. `headframe` adds the tall tower used on the surface.
export function liftCage({ headframe = false } = {}) {
  const g = new THREE.Group(), wood = WOOD(), plank = paint(0xb07a48, { roughness: .85 }), iron = paint(0x3a3a42, { metalness: .5, roughness: .4 }), bell = paint(0xffc23d, { metalness: .6, roughness: .3 });
  const green = paint(0x3fe07a, { emissive: 0x1a9a48, emissiveIntensity: .9 });
  part(g, new THREE.BoxGeometry(3.2, .18, 3.2), plank, 0, .09, 0);
  const top = headframe ? 9 : 4.2;
  for (const sx of [-1.5, 1.5]) for (const sz of [-1.5, 1.5]) part(g, new THREE.BoxGeometry(.24, top, .24), wood, sx, top / 2, sz);
  for (const y of [1.1, top - .3]) { part(g, new THREE.BoxGeometry(3.2, .14, .14), wood, 0, y, -1.5); for (const s of [-1.5, 1.5]) part(g, new THREE.BoxGeometry(.14, .14, 3.2), wood, s, y, 0); }
  part(g, new THREE.BoxGeometry(3.2, .14, .14), wood, 0, top - .3, 1.5);
  for (let i = -2; i <= 2; i++) part(g, cyl(.03, .03, 1, 6), iron, i * .55, .6, -1.5);
  for (const [x, knob] of [[-1.32, green]]) {
    part(g, new THREE.BoxGeometry(.14, .7, .14), wood, x, .4, 0);
    part(g, cyl(.03, .03, .45, 6), iron, x, .9, .1, .45);
    part(g, sphere(.09, 10, 8), knob, x, 1.1, .2);
  }
  part(g, new THREE.ConeGeometry(.22, .32, 12, 1, true), bell, 0, top - .65, -1.35);
  part(g, cyl(.05, .05, top + 20, 6), paint(0xd9b47a), 1.2, top / 2 + 10, -1.2);
  if (headframe) {
    for (const s of [-1, 1]) part(g, new THREE.BoxGeometry(.3, .3, 3.6), wood, s * 1.6, top + .2, 0);
    part(g, new THREE.TorusGeometry(.7, .12, 8, 20), iron, 0, top + .9, 0, 0, Math.PI / 2, 0);
  }
  return finish(g, 'Montacargas', [[-1.8, 0, -1.8], [1.8, top + 1.7, 1.8]]);
}

// The shaft the montacargas rides: four walls of rock held by timber cribbing
// with a warm lamp every few metres, `below` metres down and `above` up.
// Origin at the stop's floor; faces inward, open at the front (+Z) between
// the floor and the ceiling.
export function liftShaft({ below = 16, above = 16 } = {}) {
  const g = new THREE.Group(), rock = paint(0x5a4636, { roughness: 1, flatShading: true }), wood = WOOD(), lamp = paint(0xffd08a, { emissive: 0xffa040, emissiveIntensity: 1.6 });
  const h = below + above, mid = (above - below) / 2;
  for (const [x, z, w, d] of [[2, 0, .3, 4.3], [-2, 0, .3, 4.3], [0, -2, 4.3, .3]]) part(g, new THREE.BoxGeometry(w, h, d), rock, x, mid, z);
  // The front (+Z) stays open from the floor to the ceiling: the way in.
  part(g, new THREE.BoxGeometry(4.3, below - .3, .3), rock, 0, -(below + .3) / 2, 2);
  part(g, new THREE.BoxGeometry(4.3, above - 4.7, .3), rock, 0, 4.7 + (above - 4.7) / 2, 2);
  for (let y = -below + 1; y < above; y += 2.4) {
    if (y > -.6 && y < 5) continue;
    for (const s of [-1, 1]) { part(g, new THREE.BoxGeometry(.22, .22, 3.9), wood, s * 1.78, y, 0); part(g, new THREE.BoxGeometry(3.9, .22, .22), wood, 0, y, s * 1.78); }
    if (Math.round(y) % 2 === 0) part(g, sphere(.12, 8, 6), lamp, 1.7, y + .4, 1.7);
  }
  return finish(g, 'Pozo del montacargas', [[-2.2, -below, -2.2], [2.2, above, 2.2]]);
}

// The cargo lift: a low iron-edged pad under a timber gantry with a pulley
// and cables, and a big yellow button on a post `button` (±1) metres·1.7 to
// one side. The carrito alone rides it up to the camp.
export function cargoLift({ button = 1, height = 4.3 } = {}) {
  const g = new THREE.Group(), wood = WOOD(), iron = paint(0x3a3a42, { metalness: .5, roughness: .4 }), plank = paint(0xc98f55, { roughness: .85 }), yellow = paint(0xffc23d, { emissive: 0xa06a00, emissiveIntensity: .7 }), stripe = paint(0x1e1a14);
  part(g, new THREE.BoxGeometry(2.6, .14, 2.6), plank, 0, .07, 0);
  for (const [w, d, x, z] of [[2.7, .12, 0, 1.3], [2.7, .12, 0, -1.3], [.12, 2.7, 1.3, 0], [.12, 2.7, -1.3, 0]]) part(g, new THREE.BoxGeometry(w, .16, d), iron, x, .1, z);
  for (let i = -2; i <= 2; i++) part(g, new THREE.BoxGeometry(.24, .02, 2.5), i % 2 ? yellow : stripe, i * .5, .15, 0);
  for (const sx of [-1.3, 1.3]) part(g, new THREE.BoxGeometry(.22, height, .22), wood, sx, height / 2, -1.3);
  part(g, new THREE.BoxGeometry(2.9, .24, .24), wood, 0, height, -1.3);
  part(g, new THREE.TorusGeometry(.35, .08, 8, 18), iron, 0, height - .1, -1.15);
  for (const sx of [-.9, .9]) part(g, cyl(.025, .025, height + 6, 5), iron, sx, (height + 6) / 2, 0);
  part(g, new THREE.BoxGeometry(.18, 1, .18), wood, button * 1.7, .5, 0);
  part(g, cyl(.16, .16, .12, 16), yellow, button * 1.7, 1.06, 0);
  part(g, cyl(.2, .2, .06, 16), iron, button * 1.7, .99, 0);
  return finish(g, 'Montacargas de carga', [[-1.9, 0, -1.5], [1.9, height + .4, 1.5]]);
}
