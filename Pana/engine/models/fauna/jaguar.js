// Jaguar (Panthera onca): a stocky cat about 1.8 m nose to rump plus a 0.7 m
// tail, 0.68 m at the shoulder. +Z forward, paws on y = 0. Rosettes come from
// one owned canvas texture; a vertex-colour gradient pales the belly, throat
// and muzzle. Every rigid segment is one merged mesh (about 30 draw calls).
//   pose 'prowl'  head low, shoulder blades rolling; tick(t) walks in place at
//                 userData.pace strides per second (userData.stride metres
//                 each), so the consumer moves it at stride · pace m/s
//   pose 'sit'    upright on its haunches, tail curled round the paws; tick(t)
//                 breathes, looks about and flicks the tail tip
// melanistic: true gives the black jaguar of the deep selva.
// jaguarForm and sitPose are shared with the stone carvings in
// props/jaguar-stone.js.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from '/engine/models/core/primitives.js';

const at = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => new THREE.Matrix4().compose(
  new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

// Colour each vertex by its unit-geometry normal (belly paler than back), then place it.
function painted(geometry, matrix, colour) {
  const p = geometry.attributes.position, n = geometry.attributes.normal, colors = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { colour(c, n.getX(i), n.getY(i), n.getZ(i), p.getY(i)); colors.set([c.r, c.g, c.b], i * 3); }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry.applyMatrix4(matrix);
}
const ellipsoid = (w = 18, h = 12) => new THREE.SphereGeometry(1, w, h);
const limb = (top, bottom, length) => new THREE.CylinderGeometry(top, bottom, length, 12, 2).translate(0, -length / 2, 0);

// Seamless rosettes: broken rings of dark blotches round a slightly deeper
// centre, plus loose spots. Drawn white-based so vertex colour tints it.
function rosetteTexture(seed) {
  const random = rng(seed), size = 256, canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const x = canvas.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, size, size);
  const blot = (px, py, r, colour) => {
    x.fillStyle = colour;
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) { x.beginPath(); x.ellipse(px + ox, py + oy, r, r * (.7 + random() * .4), random() * 3, 0, Math.PI * 2); x.fill(); }
  };
  const grid = 4, pitch = size / grid;
  for (let row = 0; row < grid; row++) for (let col = 0; col < grid; col++) {
    const cx = (col + (row % 2) * .5 + (random() - .5) * .3) * pitch, cy = (row + (random() - .5) * .3) * pitch, ring = 20 + random() * 7;
    blot(cx, cy, ring * .95, 'rgba(170,98,30,.45)');
    const pieces = 5 + Math.floor(random() * 2), turn = random() * 6;
    for (let i = 0; i < pieces; i++) {
      const a = turn + i / pieces * Math.PI * 2 + (random() - .5) * .35;
      blot(cx + Math.cos(a) * ring, cy + Math.sin(a) * ring, 6 + random() * 3, '#1e150e');
    }
    if (random() < .6) blot(cx + (random() - .5) * 8, cy + (random() - .5) * 8, 3.5, '#2a1d12');
    blot((col + .2) * pitch + random() * 20, (row + .62) * pitch, 3 + random() * 2.5, '#231910');
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = 4;
  return texture;
}

// Shared skeleton: returns the posed group plus its moving parts. `skin`
// supplies { coat, limbs, head, dark, eye } materials and a
// colour(c, nx, ny, nz, y) painter applied to every merged part.
export function jaguarForm(skin, seed = 7) {
  const random = rng(seed), group = new THREE.Group(), geometries = [];
  const mesh = (parts, material) => {
    const merged = mergeGeometries(parts.map(([g, m, paint = skin.colour]) => painted(g, m, paint)));
    parts.forEach(([g]) => g.dispose()); geometries.push(merged);
    const m = new THREE.Mesh(merged, material); m.castShadow = true; m.receiveShadow = true; return m;
  };
  const body = new THREE.Group(); group.add(body);
  // Front half pivots at the hips so the cat can sit up.
  const front = new THREE.Group(); front.position.set(0, .62, -.42); body.add(front);
  body.add(Object.assign(mesh([
    [ellipsoid(), at(0, .64, -.44, 0, 0, 0, .23, .25, .3)],
    [ellipsoid(), at(0, .5, -.6, .5, 0, 0, .2, .2, .22)],
  ], skin.coat), { name: 'haunches' }));
  front.add(mesh([
    [ellipsoid(), at(0, .0, .4, -.04, 0, 0, .24, .27, .6)],
    [ellipsoid(), at(0, -.04, .82, 0, 0, 0, .23, .29, .3)],
  ], skin.coat));
  // Shoulder blades roll above the back as the front legs step.
  const blades = [-1, 1].map(s => { const b = mesh([[ellipsoid(10, 8), at(0, 0, 0, 0, 0, 0, .055, .045, .12)]], skin.coat); b.position.set(s * .09, .17, .8); front.add(b); return b; });
  // Neck and head.
  const neck = new THREE.Group(); neck.position.set(0, .06, 1.0); front.add(neck);
  neck.add(mesh([[ellipsoid(), at(0, .04, .1, -.5, 0, 0, .16, .17, .22)]], skin.coat));
  const head = new THREE.Group(); head.position.set(0, .1, .3); neck.add(head);
  const pale = (c, nx, ny, nz) => skin.colour(c, nx, Math.min(ny, -.4 + nz * .2), nz);
  head.add(mesh([
    [ellipsoid(), at(0, 0, 0, 0, 0, 0, .165, .14, .17)],
    [ellipsoid(), at(0, -.055, .13, .15, 0, 0, .1, .075, .1), pale],
    [ellipsoid(10, 8), at(0, -.1, .07, 0, 0, 0, .085, .045, .09), pale],
    ...[-1, 1].map(s => [ellipsoid(10, 8), at(s * .1, .02, .01, 0, 0, 0, .07, .09, .1)]),
  ], skin.head));
  head.add(mesh([[new THREE.ConeGeometry(.035, .04, 3), at(0, -.02, .23, Math.PI / 2 + .3, 0, Math.PI, 1, 1, .8)]], skin.dark));
  for (const s of [-1, 1]) {
    const ear = new THREE.Group(); ear.position.set(s * .11, .1, -.03); ear.rotation.z = s * -.35; head.add(ear);
    ear.add(mesh([[ellipsoid(10, 6), at(0, .03, 0, 0, 0, 0, .05, .05, .022)]], skin.head));
    ear.add(mesh([[ellipsoid(8, 6), at(0, .035, -.012, 0, 0, 0, .036, .036, .012)]], skin.dark));
    head.add(mesh([[ellipsoid(10, 8), at(s * .075, .035, .135, 0, 0, 0, .026, .022, .016)]], skin.eye));
    head.add(mesh([[ellipsoid(8, 6), at(s * .077, .036, .148, 0, 0, 0, .007, .016, .006)]], skin.dark));
  }
  // Legs: hip/shoulder pivot, a knee or wrist, and a paw that stays flat.
  const leg = (x, y, z, upper, lower, radius, parent) => {
    const hip = new THREE.Group(); hip.position.set(x, y, z); parent.add(hip);
    hip.add(mesh([[limb(radius * 1.25, radius, upper), at()], [ellipsoid(), at(0, -.02, 0, 0, 0, 0, radius * 1.45, radius * 1.9, radius * 1.6)]], skin.limbs));
    const knee = new THREE.Group(); knee.position.y = -upper; hip.add(knee);
    knee.add(mesh([[limb(radius * .95, radius * .8, lower), at()]], skin.limbs));
    const paw = mesh([[ellipsoid(12, 8), at(0, 0, .03, 0, 0, 0, radius * 1.15, radius * .65, radius * 1.5)]], skin.limbs);
    paw.position.y = -lower; knee.add(paw);
    const set = (h, k) => { hip.rotation.x = h; knee.rotation.x = k; paw.rotation.x = -(h + k + (parent === front ? front.rotation.x : 0)); };
    return { hip, knee, paw, set, upper, lower };
  };
  const legs = {
    lf: leg(-.12, -.06, .86, .27, .27, .072, front), rf: leg(.12, -.06, .86, .27, .27, .072, front),
    lh: leg(-.13, .63, -.44, .3, .32, .08, body), rh: leg(.13, .63, -.44, .3, .32, .08, body),
  };
  // Tail: nine segments from the rump, a dark-ringed tip.
  const tail = []; let link = new THREE.Group(); link.position.set(0, .68, -.72); body.add(link);
  for (let i = 0; i < 9; i++) {
    const r = .045 - i * .0025, piece = mesh([[limb(r, r * .92, .085), at(0, 0, 0, -Math.PI / 2)]], i > 6 ? skin.dark : skin.limbs);
    link.add(piece); tail.push(link);
    const next = new THREE.Group(); next.position.z = -.08; link.add(next); link = next;
  }
  const phase = random() * 6;
  return { group, body, front, head, neck, legs, tail, blades, phase, geometries };
}

function poseProwl(cat, t, pace) {
  const { body, front, neck, head, legs, tail, blades, phase } = cat, w = t * pace * Math.PI * 2;
  front.rotation.x = .04; neck.rotation.x = .5; head.rotation.x = -.3 + Math.sin(w * 2) * .03;
  // Lateral-sequence walk: left hind, left fore, right hind, right fore.
  const step = (l, base, offset, hipBase, kneeBase) => {
    const a = w + offset * Math.PI * 2;
    l.set(hipBase + Math.sin(a) * .38, kneeBase + Math.max(0, -Math.cos(a)) * (base === 'fore' ? .9 : .5));
  };
  step(legs.lh, 'hind', 0, -.32, .56); step(legs.lf, 'fore', .25, 0, 0);
  step(legs.rh, 'hind', .5, -.32, .56); step(legs.rf, 'fore', .75, 0, 0);
  blades[0].position.y = .17 + Math.max(0, Math.sin(w + Math.PI * .5)) * .035;
  blades[1].position.y = .17 + Math.max(0, Math.sin(w + Math.PI * 1.5)) * .035;
  body.position.y = Math.sin(w * 2) * .012;
  tail.forEach((link, i) => { link.rotation.x = i ? .1 + i * .02 : -.95; link.rotation.y = Math.sin(t * 1.3 + phase - i * .45) * .09; });
}

export function sitPose(cat, t = 0) {
  const { body, front, neck, head, legs, tail, phase } = cat;
  body.position.y = -.42; front.rotation.x = -.55; neck.rotation.x = .25;
  head.rotation.x = .3 + Math.sin(t * .4 + phase) * .04; head.rotation.y = Math.sin(t * .23 + phase) * .45;
  front.scale.y = 1 + Math.sin(t * 1.4 + phase) * .012;
  // Front legs hang straight down from the raised chest to the ground.
  for (const l of [legs.lf, legs.rf]) l.set(.55, 0);
  for (const l of [legs.lh, legs.rh]) l.set(-1.25, 2.6);
  // Down from the rump, level along the ground, then curling round the paws.
  tail.forEach((link, i) => {
    link.rotation.x = i === 0 ? -1.35 : i === 1 ? 1.25 : 0;
    link.rotation.y = i === 0 ? 0 : .5 + (i > 6 ? Math.sin(t * 2.1 + phase) * .25 : 0);
  });
}

export function jaguar({ pose = 'prowl', seed = 7, melanistic = false, pace = .9 } = {}) {
  const map = rosetteTexture(seed), limbMap = map.clone(), headMap = map.clone();
  map.repeat.set(2.2, 1.4); limbMap.repeat.set(.8, 1.2); headMap.repeat.set(1.2, .9);
  const gold = new THREE.Color(melanistic ? 0x2e2924 : 0xd99a45), cream = new THREE.Color(melanistic ? 0x3a332c : 0xf3e4c4);
  const colour = (c, nx, ny) => c.copy(gold).lerp(cream, THREE.MathUtils.smoothstep(-ny, .2, .8));
  const coat = m => new THREE.MeshStandardMaterial({ map: m, vertexColors: true, roughness: .86 });
  const skin = {
    coat: coat(map), limbs: coat(limbMap), head: coat(headMap), colour,
    dark: new THREE.MeshStandardMaterial({ color: 0x1f1813, roughness: .8 }),
    eye: new THREE.MeshStandardMaterial({ color: 0xd7a630, roughness: .3, emissive: 0x2a1c04 }),
  };
  const cat = jaguarForm(skin, seed), group = cat.group;
  group.name = melanistic ? 'Jaguar negro' : 'Jaguar';
  const stride = 1.15;
  group.userData = { ...group.userData, assetId: 'jaguar', species: 'jaguar', pose, stride, pace, footprintRadius: 1.4,
    tick(t) { if (pose === 'sit') sitPose(cat, t); else poseProwl(cat, t, group.userData.pace); },
    previewBounds: [[-.6, 0, -1.6], [.6, 1.2, 1.4]],
  };
  group.userData.tick(0);
  let disposed = false;
  group.userData.dispose = () => {
    if (disposed) return; disposed = true;
    cat.geometries.forEach(g => g.dispose()); [map, limbMap, headMap].forEach(t => t.dispose());
    Object.values(skin).forEach(m => m.dispose?.());
  };
  return group;
}
