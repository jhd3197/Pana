// La Estatua: a draped stone scholar from the buried library (Reliquia). A
// hooded figure in heavy stone robes, about 2.1 m, cold grey and worn smooth,
// with fine cracks and a pale dusty sheet thrown over one shoulder. The face
// under the hood is blank stone with two shallow hollows: nothing glows. It
// stands in a room like any other statue, hands over its bowed face.
// Metres, +Y up, facing +Z.
//
// It is stone: it never animates. userData.setPose(i) puts it in one of
// statue-pose.js's poses at once (weeping, reading, reaching, close,
// strike); userData.animate(t, { pose }) only does that when the pose
// changes, so a frozen statue costs nothing per frame. Each pivot is one
// tinted bake: about 13 draws, no lights. Source geometry and materials are
// shared and never disposed; the baked meshes are each statue's own.
import * as THREE from 'three';
import { bake } from '/engine/models/core/static-batch.js';
import { rng } from '/engine/random.js';
import { statuePose } from './statue-pose.js';

const PALETTE = { stone: 0x42464c, stone2: 0x3b3f44, dark: 0x2d3034, dust: 0x4c5055, crack: 0x202226, hollow: 0x111214, sheet: 0x77746d, sheet2: 0x6a6761 };
const MATS = {};
const mat = name => MATS[name] ||= Object.assign(new THREE.MeshStandardMaterial({ color: PALETTE[name], roughness: 1, metalness: 0, side: name.startsWith('sheet') ? THREE.DoubleSide : THREE.FrontSide }), { userData: { reliquiaOwned: true, shared: true } });
const GEOS = new Map();
const geo = (key, make) => { if (!GEOS.has(key)) GEOS.set(key, make()); return GEOS.get(key); };
const cyl = (rt, rb, h, seg = 10, open = false) => geo(`c${rt},${rb},${h},${seg},${open}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open));
const ball = (r, w = 10, h = 8, arc = Math.PI) => geo(`s${r},${w},${h},${arc.toFixed(3)}`, () => new THREE.SphereGeometry(r, w, h, 0, Math.PI * 2, 0, arc));
// A curved piece of cloth or a fold: part of an open cylinder.
const drape = (r0, r1, h, from, arc) => geo(`d${r0},${r1},${h},${from},${arc}`, () => new THREE.CylinderGeometry(r0, r1, h, 10, 1, true, from, arc));
const slab = (w, h, d) => geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));

function put(parent, geometry, name, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, mat(name));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
const pivot = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
const WAIST = 1.0;

export function libraryStatue({ seed = 1, pose = 0 } = {}) {
  const R = rng((seed * 4099 + 71) >>> 0), stone = () => ['stone', 'stone', 'stone2', 'dust'][Math.floor(R() * 4)];
  const crack = (parent, x, y, z, len, rz) => { const c = put(parent, slab(.006, len, .006), 'crack', x, y, z); c.rotation.z = rz; c.castShadow = false; return c; };

  const group = new THREE.Group(); group.name = 'La Estatua';
  // Robes from the waist down: heavy folds to the floor (folds are thin ribs).
  const base = pivot(group, 0, WAIST, 0);
  put(base, cyl(.21, .31, 1, 14), 'stone', 0, -.5, 0).scale.z = .8;
  // Four deep folds down the front and sides.
  for (const a of [-1.1, -.35, .4, 1.15]) { const f = put(base, cyl(.035, .07, .9, 6), stone(), Math.sin(a) * .25, -.53, Math.cos(a) * .2); f.rotation.z = -Math.sin(a) * .09; }
  put(base, cyl(.31, .34, .06, 14), 'dark', 0, -.97, 0).scale.z = .82;   // the hem on the floor
  for (let i = 0; i < 3; i++) crack(base, (R() - .5) * .4, -.3 - R() * .5, .27, .12 + R() * .2, (R() - .5) * .8);
  // The dust sheet thrown over it falls down one side to below the knee.
  put(base, drape(.25, .33, .72, .2, 1.9), 'sheet2', 0, -.36, 0).scale.z = .85;

  // Torso and the hood.
  const spine = pivot(base, 0, 0, 0);
  put(spine, cyl(.17, .2, .62, 10), 'stone', 0, .31, 0).scale.z = .72;
  put(spine, cyl(.2, .17, .12, 10), 'stone2', 0, .6, 0).scale.z = .74;
  for (let i = 0; i < 2; i++) crack(spine, (R() - .5) * .2, .2 + R() * .3, .13, .1 + R() * .12, (R() - .5));
  put(spine, drape(.2, .22, .52, .3, 2.2), 'sheet', 0, .38, 0).scale.z = .78;
  put(spine, ball(.21, 10, 6, Math.PI * .5), 'sheet', .05, .56, 0).scale.set(.9, .45, .78);   // over the shoulder
  // Hood: a half sphere over the head, open at the front.
  const head = pivot(spine, 0, .7, .02);
  const hood = put(head, ball(.16, 12, 8, Math.PI * .62), 'stone2', 0, .1, -.015); hood.scale.set(.95, 1.15, 1.05); hood.rotation.x = -.35;
  put(head, cyl(.15, .2, .14, 10, true), 'stone2', 0, -.02, -.02).scale.z = .9;
  put(head, ball(.1, 10, 8), 'dark', 0, .07, .02).scale.set(.85, 1.1, .8);   // the face, in shadow
  for (const s of [-1, 1]) put(head, ball(.018, 6, 4), 'hollow', s * .032, .1, .095);

  const arms = [-1, 1].map(side => {
    const shoulder = pivot(spine, side * .2, .58, 0);
    put(shoulder, cyl(.06, .075, .44, 8), 'stone', 0, -.22, 0);
    const elbow = pivot(shoulder, 0, -.44, 0);
    put(elbow, cyl(.075, .11, .36, 8), 'stone2', 0, -.18, 0);   // the wide sleeve
    const hand = pivot(elbow, 0, -.36, 0);
    put(hand, slab(.06, .1, .028), 'stone', 0, -.04, 0);
    for (let f = 0; f < 4; f++) { const g = put(hand, cyl(.008, .006, .12, 4), 'stone', (f - 1.5) * .015, -.15, .004); g.rotation.z = (f - 1.5) * .05; }
    put(hand, cyl(.008, .007, .07, 4), 'stone', side * -.035, -.07, .012).rotation.z = side * -.6;
    return { shoulder, elbow, hand };
  });

  for (const p of [base, spine, head, ...arms.flatMap(a => [a.shoulder, a.elbow, a.hand])]) {
    const rigid = new THREE.Group();
    for (const child of [...p.children]) if (child.isMesh) rigid.add(child);
    if (rigid.children.length) p.add(bake(rigid, { tint: true }));
  }

  const out = {};
  let current = -1;
  const setPose = i => {
    const p = statuePose(i, { seed }, out); current = i;
    spine.rotation.set(p.spineRx, 0, p.spineRz);
    head.rotation.set(p.headRx, p.headRy, p.headRz);
    arms[0].shoulder.rotation.set(p.lArmRx, 0, -p.lArmRz); arms[0].elbow.rotation.x = p.lElbow; arms[0].hand.rotation.x = p.lHandRx;
    arms[1].shoulder.rotation.set(p.rArmRx, 0, -p.rArmRz); arms[1].elbow.rotation.x = p.rElbow; arms[1].hand.rotation.x = p.rHandRx;
  };
  group.userData.seed = seed; group.userData.setPose = setPose;
  group.userData.animate = (t, opts = {}) => { const i = Number.isInteger(opts.pose) ? opts.pose : 0; if (i !== current) setPose(i); };
  group.userData.tick = () => {};
  setPose(pose);
  return group;
}
