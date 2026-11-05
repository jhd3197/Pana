// El Silbón and the nooks it cannot reach. Metres, +Y up, front at +Z, origin on
// the floor. The boss is one merged, vertex-coloured mesh per moving part (eight
// draws and no lights) with userData.animate(t, pose); the nook bakes with the
// floor's statics. The silhouette has to read in the dark from across a room:
// very tall, a wide hat, arms past the knees and a sack over one shoulder.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function paint(geometry, color) {
  const c = new THREE.Color(color), n = geometry.attributes.position.count, colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry.index ? geometry.toNonIndexed() : geometry;
}
const scratch = new THREE.Object3D();
// Collects shapes in one part's space, then merges them.
function parts() {
  const list = [];
  const add = (geometry, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    scratch.position.set(x, y, z); scratch.rotation.set(rx, ry, rz); scratch.scale.set(sx, sy, sz); scratch.updateMatrix();
    list.push(paint(geometry.applyMatrix4(scratch.matrix), color));
  };
  return { add, build: () => { const merged = mergeGeometries(list, false); list.forEach(g => g.dispose()); return merged; } };
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (top, bottom, h, s = 8) => new THREE.CylinderGeometry(top, bottom, h, s);
const ball = (r, w = 9, h = 7) => new THREE.SphereGeometry(r, w, h);

const COAT = 0x262028, COAT_D = 0x17131b, SKIN = 0x8d8676, HAT = 0x1d1812, SACK = 0x5a4632, BONE = 0xcabfa4;

export function silbon({ seed = 1 } = {}) {
  const root = new THREE.Group(); root.name = 'El Silbón'; // i18n-ignore: scene graph name
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x15101a, emissiveIntensity: .6 });
  const eyes = new THREE.MeshBasicMaterial({ color: 0xffe6a0 });
  const geometries = [];
  const pivot = (parent, x, y, z, make) => {
    const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
    const p = parts(); make(p); const geometry = p.build(); geometries.push(geometry);
    const m = new THREE.Mesh(geometry, material); m.castShadow = true; g.add(m); g.userData.mesh = m; return g;
  };
  const LEG = 1.55, TORSO = 1.1;
  const hips = new THREE.Group(); hips.position.y = LEG; root.add(hips);
  const legs = [-1, 1].map(s => pivot(hips, s * .17, 0, 0, p => {
    p.add(cyl(.085, .1, LEG - .05), COAT_D, 0, -(LEG - .05) / 2);
    p.add(box(.2, .1, .46), HAT, 0, -LEG + .05, .1);
  }));
  const torso = pivot(hips, 0, 0, 0, p => {
    p.add(cyl(.27, .2, TORSO, 9), COAT, 0, TORSO / 2);
    // The coat's torn hem swings under the hips.
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; p.add(box(.14, .7 + (i % 3) * .14, .03), COAT_D, Math.sin(a) * .24, -.3, Math.cos(a) * .24, 0, a); }
  });
  const neck = new THREE.Group(); neck.position.y = TORSO; torso.add(neck);
  const head = pivot(neck, 0, 0, 0, p => {
    p.add(cyl(.05, .06, .2), SKIN, 0, .08);
    p.add(ball(.15), SKIN, 0, .3, .03, 0, 0, 0, .86, 1.15, .95);
    p.add(box(.1, .05, .08), COAT_D, 0, .2, .13);               // the mouth pursed to whistle
    p.add(cyl(.42, .46, .03, 14), HAT, 0, .45);                 // a very wide brim
    p.add(cyl(.15, .19, .24, 10), HAT, 0, .58);
  });
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(.024, 6, 5), eyes); e.position.set(s * .055, .33, .15); head.add(e); geometries.push(e.geometry); }
  const arms = [-1, 1].map(s => pivot(neck, s * .3, -.1, 0, p => {
    p.add(cyl(.05, .065, .85, 6), COAT, 0, -.42);
    p.add(cyl(.04, .05, .85, 6), COAT, 0, -1.2);
    p.add(ball(.075, 6, 5), SKIN, 0, -1.66);
    for (const f of [-1, 0, 1]) p.add(cyl(.012, .02, .26, 4), BONE, f * .04, -1.82, .01, f * .08);
  }));
  // The sack of bones slung over its back.
  const sack = pivot(neck, -.14, -.25, -.28, p => {
    p.add(ball(.3, 10, 8), SACK, 0, -.2, 0, 0, 0, 0, 1, 1.3, .9);
    p.add(cyl(.03, .06, .22, 6), SACK, 0, .22);
    p.add(cyl(.016, .016, .34, 4), BONE, .16, .02, .05, 0, 0, .9);
    p.add(ball(.05, 6, 5), BONE, .28, .12, .06);
  });
  root.userData = {
    assetId: 'el-silbon', previewBounds: [[-.8, 0, -.7], [.8, 3.4, .7]],
    // pose: { walk, windup, peek, sniff, stun, fall }, walk at 0…1.
    animate(t, { walk = 0, windup = 0, peek = 0, sniff = 0, stun = 0, fall = 0 } = {}) {
      const stride = t * 4.6 + seed, swing = Math.sin(stride) * .5 * walk;
      legs[0].rotation.x = swing; legs[1].rotation.x = -swing;
      hips.position.y = LEG + Math.abs(Math.cos(stride)) * .05 * walk;
      // Stooped; further still when it bends to a nook's opening.
      const stoop = .16 + peek * .52 + sniff * .34 + stun * .3;
      torso.rotation.x = stoop + Math.sin(stride * 2) * .02 * walk; torso.rotation.z = Math.sin(stride) * .05 * walk;
      head.rotation.x = -stoop * .55 + (sniff ? Math.sin(t * 9) * .1 : 0); head.rotation.y = sniff ? Math.sin(t * 2.4 + seed) * .6 : Math.sin(t * .7 + seed) * .12;
      for (const [i, arm] of arms.entries()) {
        const side = i ? 1 : -1;
        arm.rotation.x = -swing * .7 * side + .08 - (windup ? 1.5 + windup * .9 : 0) - peek * (i ? 1.25 : .4) - stun * .3;
        arm.rotation.z = side * (.1 + stun * .4 + fall * 1.2);
      }
      sack.rotation.x = Math.sin(stride * 2) * .06 * walk;
      // Falling, it reaches for the rim with everything it has.
      if (fall) { arms[0].rotation.x = arms[1].rotation.x = -2.8; legs[0].rotation.x = .5; legs[1].rotation.x = -.3; torso.rotation.x = -.25; }
    },
    dispose() { geometries.forEach(g => g.dispose()); material.dispose(); eyes.dispose(); },
  };
  root.userData.animate(0);
  return root;
}

// Shared, so a floor's nooks bake into the same batches.
let nookShared = null;
const nookMaterials = () => nookShared ??= { stoneMat: new THREE.MeshLambertMaterial({ vertexColors: true }), chalkMat: new THREE.MeshBasicMaterial({ vertexColors: true }) };
// A narrow gap between two slabs against a wall. Front faces +Z, `width` the
// gap, `depth` from the wall (at z = -depth) to the opening (z = 0). The chalk
// handprint on the lintel marks it from across a room; no text anywhere. It must
// read as a way in: a worn sill runs from the room's floor through the opening,
// and at the back a candle on a ledge warms the stone, lit from the model's own
// unlit colours (no light of its own). userData.flames goes to candleFlames.
export function hideNook({ gap = 1.25, slab = .5, depth = 1.5, height = 2.3, stone = 0x5e564c, dark = 0x3a342e, chalk = 0xd8c9a0, sill = 0x8a8070 } = {}) {
  const group = new THREE.Group(); group.name = 'Hueco'; // i18n-ignore: scene graph name
  const { stoneMat, chalkMat } = nookMaterials();
  const p = parts(), w = gap + slab * 2;
  for (const s of [-1, 1]) {
    const x = s * (gap + slab) / 2;
    p.add(box(slab, height, depth), s < 0 ? stone : dark, x, height / 2, -depth / 2);
    // Rough courses so a slab reads as stacked rock, not a clean box.
    for (let i = 0; i < 4; i++) p.add(box(slab + .06, .04, depth + .04), dark, x, .45 + i * .5, -depth / 2);
    p.add(box(slab + .14, .2, depth * .6), stone, x + s * .03, .1, -depth * .3 + .03);
  }
  // The lintel, and a roof so it reads as an inside.
  p.add(box(w + .1, .34, depth + .05), stone, 0, height + .17, -depth / 2);
  p.add(box(gap, .03, depth), 0x0b090c, 0, height - .015, -depth / 2);
  // The way in: a sill across the threshold and flags worn down the middle.
  p.add(box(gap + .04, .03, .3), sill, 0, .015, .03);
  for (let i = 0; i < 3; i++) p.add(box(gap - .04, .02, .36), i % 2 ? dark : stone, 0, .01, -.34 - i * .4);
  const body = new THREE.Mesh(p.build(), stoneMat); body.castShadow = true; body.receiveShadow = true; group.add(body);
  // The back wall in courses, warmest around the ledge, and the ledge with its candle.
  const warm = parts(), back = -depth + .16, ledge = 1, cold = new THREE.Color(0x1c130e), hot = new THREE.Color(0xa8622a);
  warm.add(box(gap, height, .04), 0x1a100a, 0, height / 2, back);
  for (let row = 0; row < 6; row++) {
    const y = .2 + row * .38, heat = Math.max(0, 1 - Math.abs(y - (ledge + .22)) / 1.05), seams = row % 2 ? [-.625, -.2, .2, .625] : [-.625, -.3, .3, .625];
    for (let c = 0; c < 3; c++) { const x = (seams[c] + seams[c + 1]) / 2; warm.add(box(seams[c + 1] - seams[c] - .018, .362, .03), cold.clone().lerp(hot, heat * heat * (1 - Math.abs(x) / 1.1)).getHex(), x, y, back + .03); }
  }
  warm.add(box(.5, .05, .2), 0x8a5a30, 0, ledge - .025, back + .13);
  warm.add(box(.42, .1, .14), 0x2a1c14, 0, ledge - .1, back + .1);
  warm.add(box(.05, .15, .05), 0xe8d8b0, 0, ledge + .075, back + .14);
  group.add(new THREE.Mesh(warm.build(), chalkMat));
  // The mark: an open hand, in chalk.
  const hand = parts();
  hand.add(box(.15, .15, .01), chalk, 0, 0, 0);
  for (let i = 0; i < 4; i++) hand.add(box(.03, .1 + (i === 1 || i === 2 ? .025 : 0), .01), chalk, -.054 + i * .036, .13, 0);
  hand.add(box(.03, .09, .01), chalk, .095, .03, 0, 0, 0, -.6);
  const mark = new THREE.Mesh(hand.build(), chalkMat); mark.position.set(0, height + .17, .035); group.add(mark);
  group.userData = {
    assetId: 'hide-nook', previewBounds: [[-w / 2, 0, -depth], [w / 2, height + .4, .1]],
    flames: [new THREE.Vector3(0, 1.17, -depth + .3)],
    dispose() { group.traverse(o => o.geometry?.dispose()); },
  };
  return group;
}
