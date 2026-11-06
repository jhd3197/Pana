// La Estatua: a carved mourner from the buried library (Reliquia). A tall,
// slightly elongated scholar in stone robes on a low plinth, about 2.1 m,
// pale weathered marble far lighter than the dark stacks around it, so the
// headlamp finds a person-shaped silhouette at once. The face is bare:
// brow ridge, a chipped nose, cheekbones, hollow dark eye sockets with
// stains weeping down from them and a mouth a little open. Only a thin torn
// veil hangs from the crown to the shoulders, behind the face. Two separate
// arms end in long-fingered hands; moss creeps up the hem and the plinth;
// dark cracks run through the robe. Nothing glows. Metres, +Y up, facing +Z.
//
// It is stone: it never animates. userData.setPose(i) puts it in one of
// statue-pose.js's poses at once (weeping, reading, reaching, close,
// strike); userData.animate(t, { pose }) only does that when the pose
// changes, so a frozen statue costs nothing per frame. Each pivot is one
// tinted bake (the head three: stone, hollows, veil): about 16 draws, the
// open book one more while it shows; no lights. Source geometry and
// materials are shared and never disposed; the baked meshes are each
// statue's own.
import * as THREE from 'three';
import { bake } from '/engine/models/core/static-batch.js';
import { rng } from '/engine/random.js';
import { statuePose } from './statue-pose.js';

// Warm bone-grey marble, a few shades of it, dust, stains, moss and cracks.
// Every stone part shares roughness and a faint cold emissive so the tinted
// bake keeps a pivot to one draw; the hollows have none, the veil is two-sided.
export const STATUE_PALETTE = {
  marble: 0xa3a197, marble2: 0x9b998f, marble3: 0x939590, dust: 0xaba89d, grime: 0x7c7a71, stain: 0x5f5c55, crack: 0x2e2c28,
  moss: 0x4a5a44, moss2: 0x56644c, plinth: 0x86847c, hollow: 0x0d0c0b, veil: 0x96918a, leather: 0x6c675e,
};
const RIM = 0x10141a;
const MATS = {};
const mat = name => MATS[name] ||= Object.assign(new THREE.MeshStandardMaterial({
  color: STATUE_PALETTE[name], roughness: .82, metalness: 0,
  emissive: name === 'hollow' ? 0x000000 : RIM, emissiveIntensity: 1,
  side: name === 'veil' ? THREE.DoubleSide : THREE.FrontSide,
}), { userData: { reliquiaOwned: true, shared: true } });
const GEOS = new Map();
const geo = (key, make) => { if (!GEOS.has(key)) GEOS.set(key, make()); return GEOS.get(key); };
const cyl = (rt, rb, h, seg = 12) => geo(`c${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1));
const ball = (r, w = 14, h = 10) => geo(`s${r},${w},${h}`, () => new THREE.SphereGeometry(r, w, h));
const cap = (r, arc) => geo(`k${r},${arc}`, () => new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, arc));
const pill = (r, len) => geo(`p${r},${len}`, () => new THREE.CapsuleGeometry(r, len, 4, 10));
const slab = (w, h, d) => geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
// The torn veil: an open cone behind the face, folded and ragged at the hem.
const veilCloth = () => geo('veil', () => {
  const g = new THREE.CylinderGeometry(.1, .22, .4, 22, 5, true, 1.15, Math.PI * 2 - 2.05), p = g.attributes.position;
  const R = rng(9137);
  const rag = Array.from({ length: 23 }, () => R());
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), u = (y + .2) / .4, a = Math.atan2(x, z), col = i % 23;
    const fold = 1 + .09 * Math.sin(a * 6) * (1 - u);   // folds open toward the hem
    const tear = u < .01 ? .01 + rag[col] * .06 * (col % 4 ? 1 : 1.8) : u < .25 ? rag[col] * .015 : 0;
    p.setXYZ(i, x * fold, y + tear, z * fold);
  }
  g.computeVertexNormals(); return g;
});

function put(parent, geometry, name, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geometry, mat(name));
  m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
// A unit-height cylinder stretched from point a to point b (folds, cracks).
function between(parent, rt, rb, name, a, b, seg = 6) {
  _a.set(...a); _b.set(...b); const len = _a.distanceTo(_b);
  const m = put(parent, cyl(rt, rb, 1, seg), name, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, 1, len, 1);
  m.quaternion.setFromUnitVectors(UP, _b.sub(_a).normalize()); return m;
}
const pivot = (parent, x = 0, y = 0, z = 0, order = 'XYZ') => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.order = order; parent.add(g); return g; };
const PLINTH = .12, WAIST = PLINTH + .98;

export function libraryStatue({ seed = 1, pose = 0 } = {}) {
  const R = rng((seed * 4099 + 71) >>> 0);
  const group = new THREE.Group(); group.name = 'La Estatua';

  // The plinth and the bare feet, which never move.
  const foot = pivot(group);
  put(foot, cyl(.35, .39, PLINTH - .03, 8), 'plinth', 0, (PLINTH - .03) / 2, 0);
  put(foot, cyl(.33, .35, .03, 8), 'marble3', 0, PLINTH - .015, 0);
  for (let i = 0; i < 5; i++) { const a = R() * Math.PI * 2; put(foot, ball(.06, 8, 6), i % 2 ? 'moss' : 'moss2', Math.sin(a) * .36, .02 + R() * .05, Math.cos(a) * .36, 1.4, .5, 1.4); }
  for (let i = 0; i < 3; i++) { const a = R() * Math.PI * 2; between(foot, .004, .004, 'crack', [Math.sin(a) * .385, .01, Math.cos(a) * .385], [Math.sin(a + .1) * .375, .08, Math.cos(a + .1) * .375], 4); }
  for (const s of [-1, 1]) {
    put(foot, ball(.045, 10, 8), 'marble', s * .085, PLINTH + .03, .2, 1, .55, 1.9);
    for (let t = 0; t < 4; t++) put(foot, ball(.012, 6, 4), 'marble2', s * (.06 + t * .016), PLINTH + .025, .275 - t * .006);
  }

  // The robe from the waist down: a long skirt with deep folds to the hem,
  // moss and grime climbing it from the floor.
  const base = pivot(group, 0, WAIST, 0);
  const H = WAIST - PLINTH - .01;
  put(base, cyl(.165, .3, H, 18), 'marble', 0, -H / 2, 0, 1, 1, .78);
  put(base, cyl(.3, .32, .05, 18), 'marble2', 0, -H + .02, 0, 1, 1, .8);
  // Grime darkens the hem; the folds are broad ribs sunk into the skirt.
  put(base, cyl(.268, .307, .22, 18), 'grime', 0, -H + .11, 0, 1, 1, .79);
  for (let i = 0; i < 9; i++) {
    const a = -2.6 + i * .65 + (R() - .5) * .15;
    between(base, .03, .065, i % 3 ? 'marble' : 'marble2', [Math.sin(a) * .14, -.02, Math.cos(a) * .11], [Math.sin(a) * .275, -H + .03, Math.cos(a) * .225], 8);
  }
  for (let i = 0; i < 12; i++) { const a = (R() - .5) * 4.4; put(base, ball(.04, 8, 6), i % 3 ? 'moss' : 'moss2', Math.sin(a) * .3, -H + .04 + R() * .1, Math.cos(a) * .245, 1.6, .45 + R() * .4, .45); }
  put(base, geo('cord', () => new THREE.TorusGeometry(.165, .014, 6, 20)), 'marble2', 0, -.03, 0, 1, .78, 1).rotation.x = Math.PI / 2;

  // Torso, a mantle over the shoulders, the neck.
  const spine = pivot(base, 0, 0, 0, 'YXZ');
  put(spine, cyl(.19, .155, .5, 16), 'marble', 0, .25, 0, 1, 1, .62);
  put(spine, ball(.2, 18, 12), 'marble', 0, .47, 0, 1, .55, .62);
  for (const s of [-1, 1]) put(spine, ball(.066), 'marble', s * .185, .53, 0, 1, .8, .9);
  for (let i = 0; i < 3; i++) { const x = -.07 + i * .07; between(spine, .018, .03, 'marble2', [x * .3, .44, .085], [x, .06, .075], 6); }
  put(spine, cyl(.045, .055, .16, 10), 'marble', 0, .66, .005);
  for (let i = 0; i < 3; i++) { const x = (R() - .5) * .2, y = .15 + R() * .3; between(spine, .004, .004, 'crack', [x, y, .13], [x + (R() - .5) * .08, y + .1, .125], 4); }
  // The open book (reading pose only), held at the chest.
  const book = pivot(spine, 0, .37, .42); book.rotation.x = -1.15;
  for (const s of [-1, 1]) { const leaf = put(book, slab(.14, .2, .014), 'leather', s * .066, 0, 0); leaf.rotation.y = -s * .28; const pages = put(book, slab(.126, .185, .022), 'dust', s * .062, 0, .014); pages.rotation.y = -s * .26; }

  // The head: skull, brow, chipped nose, cheekbones, hollow eyes weeping
  // stains, the mouth a dark gap, and the torn veil hanging behind.
  const head = pivot(spine, 0, .72, .01, 'YXZ');
  put(head, ball(.104, 16, 12), 'marble', 0, .135, -.005, .86, 1.1, 1);
  put(head, ball(.08, 14, 10), 'marble', 0, .085, .03, .82, 1.02, .92);
  put(head, cyl(.042, .046, .1, 10), 'marble', 0, -.01, -.01);
  put(head, pill(.017, .066), 'marble2', 0, .158, .086, 1, 1, .75).rotation.z = Math.PI / 2;
  for (const s of [-1, 1]) {
    put(head, ball(.022, 10, 8), 'hollow', s * .033, .133, .084, 1.15, .8, .55);
    put(head, ball(.022, 8, 6), 'marble', s * .048, .108, .078, 1.25, .75, .8);           // cheekbone
    put(head, slab(.007, .075, .005), 'stain', s * .034, .08, .099).rotation.z = s * .05;   // weeping streak
    put(head, ball(.018, 8, 6), 'marble2', s * .085, .12, 0, .5, 1.1, .8);                 // ear
  }
  put(head, ball(.017, 8, 8), 'marble', 0, .112, .1, .7, 1.7, 1).rotation.x = .3;          // nose
  put(head, ball(.008, 6, 4), 'stain', .004, .09, .113);                                    // the chipped tip
  put(head, ball(.024, 10, 8), 'hollow', 0, .057, .082, 1.2, .55, .5);                     // inside the mouth
  put(head, cap(.115, Math.PI * .42), 'veil', 0, .14, -.012, .88, 1.08, 1).rotation.x = -.42;
  put(head, veilCloth(), 'veil', 0, .02, -.012, .95, 1, .95);
  const jaw = pivot(head, 0, .08, -.01);
  put(jaw, ball(.062, 12, 8), 'marble', 0, -.028, .04, .8, .62, 1);
  put(jaw, ball(.022, 8, 6), 'marble2', 0, -.042, .088, 1.1, .8, .8);                      // chin

  // Two arms in wide sleeves, bare forearms, long hands. One finger is
  // chipped short on the right.
  const arms = [-1, 1].map(side => {
    const shoulder = pivot(spine, side * .2, .55, 0, 'XZY');
    put(shoulder, cyl(.052, .058, .32, 10), 'marble', 0, -.16, 0);
    put(shoulder, ball(.054, 10, 8), 'marble2', 0, -.32, 0);
    const elbow = pivot(shoulder, 0, -.32, 0);
    put(elbow, cyl(.056, .088, .15, 12), 'marble2', 0, -.06, 0);   // the bell of the sleeve
    put(elbow, ball(.088, 12, 6), 'marble2', 0, -.135, 0, 1, .18, 1);
    put(elbow, cyl(.043, .033, .29, 8), 'marble', 0, -.145, 0);
    const hand = pivot(elbow, 0, -.29, 0);
    put(hand, ball(.048, 10, 8), 'marble', 0, -.045, 0, .88, 1.1, .4);
    put(hand, pill(.01, .045), 'marble', -side * .036, -.035, .012).rotation.z = side * .7;   // thumb
    const fingers = pivot(hand, 0, -.088, 0);
    for (let f = 0; f < 4; f++) {
      const short = side > 0 && f === 0, len = (f === 0 || f === 3 ? .066 : .082) * (short ? .55 : 1), spread = (f - 1.5) * .16;
      const g = put(fingers, pill(.0085, len), f % 2 ? 'marble' : 'marble2', (f - 1.5) * .016 + Math.sin(spread) * len * .5, -Math.cos(spread) * (len / 2 + .008), 0);
      g.rotation.z = spread;
    }
    return { side, shoulder, elbow, hand, fingers };
  });

  const tinted = [];
  for (const p of [foot, base, spine, book, head, jaw, ...arms.flatMap(a => [a.shoulder, a.elbow, a.hand, a.fingers])]) {
    const rigid = new THREE.Group();
    for (const child of [...p.children]) if (child.isMesh) rigid.add(child);
    if (rigid.children.length) { const baked = bake(rigid, { tint: true }); tinted.push(...baked.userData.tinted); p.add(baked); }
  }

  const out = {};
  let current = -1;
  const setPose = i => {
    const p = statuePose(i, { seed }, out); current = i;
    base.rotation.x = p.baseRx;
    spine.rotation.set(p.spineRx, p.spineRy, p.spineRz);
    head.rotation.set(p.headRx, p.headRy, p.headRz);
    jaw.rotation.x = p.jaw;
    book.visible = p.book > .5;
    for (const a of arms) {
      const k = a.side < 0 ? 'l' : 'r';
      a.shoulder.rotation.set(-p[`${k}Fwd`], a.side * p[`${k}Twist`], a.side * p[`${k}Out`]);
      a.elbow.rotation.x = -p[`${k}Elbow`]; a.hand.rotation.x = -p[`${k}Wrist`]; a.fingers.rotation.x = -p[`${k}Curl`];
    }
  };
  // setShade(k) scales the albedo (1 = as carved): the view dims it a little
  // when the headlamp is right on it so pale marble never clips to white.
  let shade = 1;
  const setShade = k => { if (Math.abs(k - shade) < .004) return; shade = k; for (const m of tinted) m.color.setScalar(k); };
  group.userData.seed = seed; group.userData.setPose = setPose; group.userData.setShade = setShade;
  group.userData.animate = (t, opts = {}) => { const i = Number.isInteger(opts.pose) ? opts.pose : 0; if (i !== current) setPose(i); };
  group.userData.tick = () => {};
  setPose(pose);
  return group;
}
