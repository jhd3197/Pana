// El Lector: the buried library's blind librarian (Reliquia). A gaunt, hunched
// figure about 2.3 m tall in a long tattered robe of cold grey-blue wool, a
// stole hanging off the neck, a chain at the waist with a key and an old book
// on it. The head is bald and pale, cocked to one side; the eyes are bound
// with a strip of linen sewn shut with black thread: nothing glows. Long
// sleeves end in pale hands with long fingers. Metres, +Y up, facing +Z.
//
// Each pivot is one tinted bake (bake({ tint: true }); every material is
// double-sided, so one batch a pivot): about 13 draws, no
// lights, no emissive. Source geometry and materials are shared by every
// Lector and never disposed; the baked meshes are each one's own.
// userData.animate(t, moving, winding, { mode, look, scares }) poses it from
// reader-pose.js.
import * as THREE from 'three';
import { bake } from '/engine/models/core/static-batch.js';
import { rng } from '/engine/random.js';
import { createReaderPose } from './reader-pose.js';

// Dark desaturated wool and linen, cold pale skin, iron: the gaunt mummy's palette, colder.
const PALETTE = { robe: 0x2b2f36, robe2: 0x23262c, worn: 0x363940, lining: 0x1a1b1f, skin: 0x777873, dry: 0x5c5d59, linen: 0x77746b, stain: 0x4d4a43, thread: 0x111012, iron: 0x3a3d42, leather: 0x35282a, page: 0x8a8578 };
const MATS = {};
const mat = name => MATS[name] ||= Object.assign(new THREE.MeshStandardMaterial({ color: PALETTE[name], roughness: .95, metalness: 0, side: THREE.DoubleSide }), { userData: { reliquiaOwned: true, shared: true } });
const GEOS = new Map();
const geo = (key, make) => { if (!GEOS.has(key)) GEOS.set(key, make()); return GEOS.get(key); };
const cyl = (rt, rb, h, seg = 8, open = false) => geo(`c${rt},${rb},${h},${seg},${open}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open));
const ball = (r, w = 10, h = 8) => geo(`s${r},${w},${h}`, () => new THREE.SphereGeometry(r, w, h));
const slab = (w, h, d) => geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const ring = (r, tube, arc = Math.PI * 2, seg = 12) => geo(`t${r},${tube},${arc.toFixed(3)},${seg}`, () => new THREE.TorusGeometry(r, tube, 4, seg, arc));

function put(parent, geometry, name, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, mat(name));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
const pivot = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
const HIP = 1.0, SCALE = 1.2;

export function blindLibrarian({ seed = 1 } = {}) {
  const R = rng((seed * 6151 + 29) >>> 0), wool = () => ['robe', 'robe', 'robe2', 'worn'][Math.floor(R() * 4)];
  const strip = (parent, w, h, x, y, z, ry = 0, rz = 0, name = wool()) => { const s = put(parent, slab(w, h, .01), name, x, y - h / 2, z); s.rotation.set(0, ry, rz); s.castShadow = false; return s; };

  const group = new THREE.Group(); group.name = 'El Lector';
  const body = pivot(group); body.scale.setScalar(SCALE);
  const hips = pivot(body, 0, HIP, 0);
  // The robe falls from the hips nearly to the floor, its hem in tatters.
  const robe = pivot(hips, 0, 0, 0);
  put(robe, cyl(.16, .34, .92, 10, true), 'robe', 0, -.46, 0).scale.z = .82;
  put(robe, cyl(.155, .33, .9, 10, true), 'lining', 0, -.47, 0).scale.z = .8;
  // A ragged hem: a few long torn tongues, dark with dirt.
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + (R() - .5) * .3, len = .06 + R() * .1; strip(robe, .11 + R() * .06, len, Math.sin(a) * .325, -.86, Math.cos(a) * .265, a, (R() - .5) * .2, R() < .5 ? 'robe2' : 'lining'); }
  put(robe, ring(.17, .022), 'iron', 0, .02, 0).rotation.x = Math.PI / 2;   // the belt
  // On the belt: a chain with an old key and a book on it.
  const chain = pivot(hips, .14, .0, .1);
  for (let i = 0; i < 6; i++) { const link = put(chain, ring(.018, .005, Math.PI * 2, 6), 'iron', 0, -.03 - i * .032, 0); link.rotation.y = i % 2 ? Math.PI / 2 : 0; }
  put(chain, slab(.012, .08, .006), 'iron', 0, -.25, 0); put(chain, ring(.02, .006, Math.PI * 2, 6), 'iron', 0, -.2, 0);
  put(chain, slab(.03, .012, .006), 'iron', .012, -.28, 0);
  const book = put(chain, slab(.16, .22, .05), 'leather', -.05, -.42, .02); book.rotation.z = .25;
  put(chain, slab(.15, .2, .035), 'page', -.048, -.42, .022).rotation.z = .25;
  // Feet: bare, long and grey, just out from under the hem.
  const feet = [-1, 1].map(side => { const foot = pivot(hips, side * .09, -.93, .04); put(foot, slab(.07, .04, .2), 'dry', 0, -.04, .06); return foot; });

  // Torso: narrow, bent, the wool worn thin over the shoulder blades.
  const spine = pivot(hips, 0, .02, 0);
  put(spine, cyl(.15, .17, .6, 9), 'robe', 0, .3, 0).scale.z = .7;
  put(spine, slab(.2, .3, .02), 'worn', 0, .38, -.11);
  put(spine, ring(.12, .04), 'robe2', 0, .6, 0).rotation.x = Math.PI / 2;   // the cowl, fallen back
  // A stole hangs off the neck, frayed at the ends.
  for (const s of [-1, 1]) strip(spine, .07, .62, s * .06, .62, .1, 0, s * .05, 'worn');
  for (const s of [-1, 1]) put(spine, ball(.06, 8, 6), 'robe2', s * .17, .58, 0);

  const neck = pivot(spine, 0, .62, .02);
  put(neck, cyl(.035, .045, .2, 6), 'dry', 0, .1, 0);
  const head = pivot(neck, 0, .2, 0);
  put(head, ball(.125), 'skin', 0, .11, 0).scale.set(.82, 1.18, .95);
  put(head, slab(.12, .04, .04), 'dry', 0, .02, .07);   // cheekbones, hollow under
  put(head, slab(.022, .05, .03), 'skin', 0, .08, .1);   // the nose
  put(head, slab(.05, .006, .01), 'thread', 0, .025, .1);   // a thin mouth
  for (const s of [-1, 1]) put(head, slab(.015, .04, .03), 'dry', s * .093, .1, -.005);   // ears
  // The eyes bound shut: a strip of linen round the head, sewn with black thread.
  const band = put(head, ring(.108, .026, Math.PI * 2, 16), 'linen', 0, .13, .005); band.rotation.x = Math.PI / 2; band.scale.set(.95, 1, .7);
  put(head, slab(.035, .1, .006), 'linen', -.06, .07, -.075).rotation.z = .2;   // the knot's tail
  for (const s of [-1, 1]) {
    put(head, slab(.045, .026, .02), 'stain', s * .037, .13, .1);
    for (let k = 0; k < 3; k++) put(head, slab(.004, .042, .004), 'thread', s * (.022 + k * .013), .13, .112);
  }

  // Arms: wide sleeves, then pale hands with five long fingers on a knuckle pivot.
  const arms = [-1, 1].map(side => {
    const shoulder = pivot(spine, side * .18, .56, 0);
    put(shoulder, cyl(.045, .06, .46), 'robe', 0, -.23, 0);
    const elbow = pivot(shoulder, 0, -.46, 0);
    put(elbow, cyl(.06, .1, .4, 8, true), 'robe2', 0, -.2, 0);
    put(elbow, cyl(.022, .02, .36, 5), 'skin', 0, -.2, 0);
    strip(elbow, .06, .16 + R() * .1, side * .05, -.38, 0, 0, side * .1);
    const hand = pivot(elbow, 0, -.42, 0);
    put(hand, slab(.06, .09, .022), 'skin', 0, -.045, 0);
    const fingers = pivot(hand, 0, -.09, 0);
    for (let f = 0; f < 5; f++) {
      const thumb = f === 4, len = thumb ? .1 : .19 - Math.abs(f - 1.5) * .015;
      const finger = put(fingers, cyl(.0075, .0045, len, 4), f === 2 ? 'dry' : 'skin', thumb ? side * -.035 : (f - 1.5) * .014, -len / 2, thumb ? .02 : .004);
      finger.rotation.z = thumb ? side * -.5 : (f - 1.5) * .05;
    }
    return { shoulder, elbow, hand, fingers };
  });

  // One draw per pivot.
  for (const p of [hips, robe, chain, ...feet, spine, neck, head, ...arms.flatMap(a => [a.shoulder, a.elbow, a.hand, a.fingers])]) {
    const rigid = new THREE.Group();
    for (const child of [...p.children]) if (child.isMesh) rigid.add(child);
    if (!rigid.children.length) continue;
    p.add(bake(rigid, { tint: true }));
  }

  const motion = createReaderPose({ seed });
  group.userData.seed = seed; group.userData.pose = motion.pose;
  const fallback = {};
  group.userData.animate = (t, moving = false, winding = false, opts = fallback) => {
    opts.moving = moving; opts.winding = winding;
    const p = motion.update(t, opts);
    hips.position.y = HIP + p.hipsY; hips.rotation.z = p.hipsRz;
    robe.rotation.set(p.robeRx, 0, p.robeRz); chain.rotation.x = p.chainRx;
    spine.rotation.set(p.spineRx, 0, p.spineRz); neck.rotation.x = p.neckRx;
    head.rotation.set(p.headRx, p.headRy, p.headRz);
    arms[0].shoulder.rotation.set(p.lArmRx, 0, -p.lArmRz); arms[0].elbow.rotation.x = p.lElbow; arms[0].hand.rotation.x = p.lHandRx; arms[0].fingers.rotation.x = -p.lCurl;
    arms[1].shoulder.rotation.set(p.rArmRx, 0, -p.rArmRz); arms[1].elbow.rotation.x = p.rElbow; arms[1].hand.rotation.x = p.rHandRx; arms[1].fingers.rotation.x = -p.rCurl;
    feet[0].rotation.x = p.lFootRx; feet[1].rotation.x = p.rFootRx;
  };
  group.userData.tick = t => group.userData.animate(t, false, false);
  group.userData.animate(0, false, false);
  return group;
}
