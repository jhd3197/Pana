// The gaunt mummy: mummy({ gaunt: true }) in reliquia.js. Too tall (about
// 2.8 m, stooped, a head over the classic mummy), too thin, arms that hang to the knees, narrow shoulders
// on a long neck and a small head tilted to one side. The wraps are old and
// dark (grey-brown, soot, mildew, stains), torn over dry ribs, with rags and
// loose bandages hanging off it. The face is a hollow with two small cold
// eyes, the only thing on it that glows. Metres, +Y up, facing +Z.
//
// Each pivot is baked to one draw (bake with tint), the eyes to one more:
// about 18 draws a mummy, no lights. Source geometry is shared by every
// mummy and never disposed; the baked meshes are each mummy's own.
// userData.animate(t, moving, winding, { frozen, look, lit, scares }) poses
// it from gaunt-pose.js; userData.seed varies the rhythm per mummy.
import * as THREE from 'three';
import { bake } from '/engine/models/core/static-batch.js';
import { rng } from '/engine/random.js';
import { createGauntPose } from './gaunt-pose.js';

const PALETTE = { wrap: 0x5d564b, rag: 0x48433b, soot: 0x2a2723, mildew: 0x4a5045, stain: 0x3b2e25, bone: 0x7a7264, dry: 0x4f4538, hollow: 0x060607 };
const MATS = {};
const mat = name => MATS[name] ||= Object.assign(new THREE.MeshStandardMaterial({ color: PALETTE[name], roughness: .95, metalness: 0 }), { userData: { reliquiaOwned: true, shared: true } });
const GEOS = new Map();
const geo = (key, make) => { if (!GEOS.has(key)) GEOS.set(key, make()); return GEOS.get(key); };
const cyl = (rt, rb, h, seg = 7) => geo(`c${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
const ball = (r, w = 8, h = 6) => geo(`s${r},${w},${h}`, () => new THREE.SphereGeometry(r, w, h));
const slab = (w, h, d) => geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const band = (r, tube, arc = Math.PI * 2) => geo(`t${r},${tube},${arc.toFixed(3)}`, () => new THREE.TorusGeometry(r, tube, 4, 12, arc));

function put(parent, geometry, name, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, typeof name === 'string' ? mat(name) : name);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
const HIP = 1.05, SCALE = 1.2;
const pivot = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

export function gauntMummy({ seed = 1 } = {}) {
  const R = rng((seed * 7919 + 13) >>> 0), cloth = () => ['wrap', 'wrap', 'rag', 'soot', 'mildew', 'stain'][Math.floor(R() * 6)];
  // Wraps around a limb or body: a few rings at uneven tilts, some torn short.
  const wraps = (parent, r, y0, y1, n, flat = 1) => {
    for (let i = 0; i < n; i++) {
      const torn = R() < .25, ring = put(parent, band(r, r * .22, torn ? Math.PI * 1.3 : Math.PI * 2), cloth(), 0, y0 + (y1 - y0) * (i + R() * .4) / n, 0);
      ring.rotation.set(Math.PI / 2 + (R() - .5) * .45, 0, R() * Math.PI * 2); ring.scale.set(1, flat, 1);
    }
  };
  const strip = (parent, w, h, x, y, z, ry = 0, rz = 0) => { const s = put(parent, slab(w, h, .008), cloth(), x, y - h / 2, z); s.rotation.set(0, ry, rz); s.castShadow = false; return s; };

  const group = new THREE.Group(); group.name = 'Momia del templo';
  // Built at 2.35 m, shown at 2.8 m, over the classic mummy's 2.7 m: it should
  // loom over a pana. Callers may still scale the group itself.
  const body = pivot(group); body.scale.setScalar(SCALE);
  const hips = pivot(body, 0, HIP, 0);
  put(hips, cyl(.12, .1, .2), 'wrap').scale.z = .72;
  wraps(hips, .12, -.08, .08, 2, .72);
  const tatters = pivot(hips, 0, -.06, 0);
  for (let i = 0; i < 7; i++) { const a = -1.2 + i * .4 + (R() - .5) * .2, len = .3 + R() * .35; strip(tatters, .05 + R() * .04, len, Math.sin(a) * .12, 0, Math.cos(a) * .09, a, (R() - .5) * .2); }
  for (let i = 0; i < 3; i++) { const a = Math.PI - .5 + i * .5; strip(tatters, .06, .25 + R() * .3, Math.sin(a) * .12, 0, Math.cos(a) * .09, a); }

  // Legs: stiff and bone-thin, knees showing through.
  const legs = [-1, 1].map(side => {
    const leg = pivot(hips, side * .085, -.03, 0);
    put(leg, cyl(.06, .045, .52), 'wrap', 0, -.27, 0);
    put(leg, ball(.05), 'dry', 0, -.53, .01);
    put(leg, cyl(.045, .033, .45), 'rag', 0, -.77, -.01);
    put(leg, slab(.075, .05, .2), 'soot', 0, -.99, .045);
    wraps(leg, .055, -.5, -.05, 3); wraps(leg, .043, -.95, -.58, 3);
    if (R() < .7) strip(leg, .03, .3, side * .04, -.6, 0, 0, side * .15);
    return leg;
  });

  // Torso: a narrow waist, a long flat chest torn open over the ribs.
  const spine = pivot(hips, 0, .08, 0);
  put(spine, cyl(.09, .11, .26), 'rag', 0, .12, 0).scale.z = .7;
  put(spine, cyl(.165, .1, .52), 'wrap', 0, .5, 0).scale.z = .62;
  put(spine, slab(.17, .26, .03), 'hollow', 0, .43, .07);
  for (let i = 0; i < 5; i++) { const rib = put(spine, band(.115 - i * .006, .011, Math.PI), 'bone', 0, .32 + i * .055, .005); rib.rotation.set(Math.PI / 2 + .25, 0, 0); rib.scale.set(1, .82, 1); }
  for (let i = 0; i < 4; i++) { const r = put(spine, band(.16 - i * .01, .02, Math.PI * (1.1 + R() * .5)), cloth(), 0, .58 + i * .045 + R() * .02, 0); r.rotation.set(Math.PI / 2 + (R() - .5) * .3, 0, Math.PI + (R() - .5) * .6); r.scale.set(1, .62, 1); }
  wraps(spine, .1, .02, .24, 3, .7);
  put(spine, slab(.36, .06, .12), 'wrap', 0, .74, 0);
  for (const s of [-1, 1]) put(spine, ball(.05), 'rag', s * .18, .72, 0);
  const trail = pivot(spine, 0, .68, -.09);
  strip(trail, .07, 1.05, .03, 0, 0, 0, .04); strip(trail, .05, .7, -.05, 0, .01, 0, -.06);

  // Neck too long, head too small.
  const neck = pivot(spine, 0, .76, .02);
  put(neck, cyl(.038, .05, .3, 6), 'dry', 0, .15, 0);
  wraps(neck, .045, .03, .25, 3);
  const head = pivot(neck, 0, .3, 0);
  put(head, ball(.12, 10, 8), 'wrap', 0, .1, 0).scale.set(.82, 1.15, .95);
  put(head, ball(.085), 'hollow', 0, .07, .075).scale.set(1, 1.25, .55);
  put(head, slab(.16, .03, .05), 'soot', 0, .135, .088);
  wraps(head, .1, .02, .2, 3, .95);
  strip(head, .035, .42, .07, .04, .02, .3, .12);
  const jaw = pivot(head, 0, .02, .02);
  put(jaw, slab(.1, .03, .085), 'bone', 0, -.03, .04);
  put(jaw, slab(.11, .025, .07), 'rag', 0, -.055, .03);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0e1218, emissive: 0xc8dcff, emissiveIntensity: 1.6, roughness: .4 });
  eyeMat.userData.reliquiaOwned = true;
  const eyes = new THREE.Group();
  for (const s of [-1, 1]) { const e = new THREE.Mesh(ball(.014, 6, 4), eyeMat); e.position.set(s * .033, .1, .108); eyes.add(e); }

  // Arms: narrow shoulders, upper arm, forearm, a long hand of dry fingers.
  const arms = [-1, 1].map(side => {
    const shoulder = pivot(spine, side * .19, .7, 0);
    put(shoulder, cyl(.04, .032, .5), 'wrap', 0, -.25, 0);
    wraps(shoulder, .038, -.45, -.04, 3);
    const elbow = pivot(shoulder, 0, -.5, 0);
    put(elbow, ball(.035), 'dry');
    put(elbow, cyl(.032, .025, .47), 'rag', 0, -.235, 0);
    wraps(elbow, .03, -.42, -.05, 3);
    strip(elbow, .03, .32 + R() * .2, 0, -.22, -.025, 0, side * .1);
    const hand = pivot(elbow, 0, -.47, 0);
    put(hand, slab(.055, .1, .025), 'dry', 0, -.05, 0);
    for (let f = 0; f < 4; f++) { const finger = put(hand, cyl(.008, .005, .16, 4), f === 3 ? 'bone' : 'dry', (f - 1.5) * .015, -.18, .006); finger.rotation.z = (f - 1.5) * .06; }
    return { shoulder, elbow, hand };
  });

  // One draw per pivot (tinted bake), one for the eyes.
  const tinted = [];
  for (const p of [hips, tatters, spine, trail, neck, head, jaw, ...legs, ...arms.flatMap(a => [a.shoulder, a.elbow, a.hand])]) {
    const rigid = new THREE.Group();
    for (const child of [...p.children]) if (child.isMesh) rigid.add(child);
    if (!rigid.children.length) continue;
    const baked = bake(rigid, { tint: true }); tinted.push(...baked.userData.tinted); p.add(baked);
  }
  const bakedEyes = bake(eyes); bakedEyes.traverse(o => { if (o.isMesh) o.castShadow = false; }); head.add(bakedEyes);

  const motion = createGauntPose({ seed }), base = eyeMat.emissiveIntensity;
  let shade = 1;
  group.userData.gaunt = true; group.userData.seed = seed; group.userData.pose = motion.pose;
  const fallback = {};
  group.userData.animate = (t, moving = true, winding = false, opts = fallback) => {
    opts.moving = moving; opts.winding = winding;
    const p = motion.update(t, opts);
    hips.position.y = HIP + p.hipsY; hips.rotation.set(p.hipsRx, 0, p.hipsRz);
    spine.rotation.set(p.spineRx, 0, p.spineRz); neck.rotation.x = p.neckRx;
    head.rotation.set(p.headRx, p.headRy, p.headRz); jaw.rotation.x = p.jawRx;
    arms[0].shoulder.rotation.set(p.lArmRx, 0, -p.lArmRz); arms[0].elbow.rotation.x = p.lElbow; arms[0].hand.rotation.set(p.lHandRx, 0, p.lHandRz);
    arms[1].shoulder.rotation.set(p.rArmRx, 0, -p.rArmRz); arms[1].elbow.rotation.x = p.rElbow; arms[1].hand.rotation.set(p.rHandRx, 0, p.rHandRz);
    legs[0].rotation.x = p.lLegRx; legs[1].rotation.x = p.rLegRx;
    tatters.rotation.set(p.tatterRx, 0, p.tatterRz); trail.rotation.x = p.trailRx;
    eyeMat.emissiveIntensity = base * p.eye;
    if (Math.abs(p.shade - shade) > .01) { shade = p.shade; for (const m of tinted) m.color.setScalar(shade); }
  };
  group.userData.tick = t => group.userData.animate(t, false, false);
  group.userData.animate(0, false, false);
  return group;
}
