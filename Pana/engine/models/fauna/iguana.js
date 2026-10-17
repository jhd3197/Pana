// Iguana verde: about 1.2 m nose to tail-tip, +Z forward, origin on the ground
// (or branch) under the belly. One vertex-coloured material; every rigid part
// is merged into one mesh, so an iguana costs about a dozen draw calls.
//   userData.tick(t)    breathes, blinks and does the iguana head bob
//   userData.pose(name) 'sun' (flat, legs splayed), 'perch' (tail hanging), 'run'
//   userData.run(phase) diagonal leg gait and tail swing (call every frame)
//   userData.bonk(k)    0 → 1: flips onto its back, legs wiggling, dizzy stars, rights itself
// Options: color (base green), golden (the bonus one), seed, pose, and
// demo: 'run' | 'bonk' so a preview's tick loops that animation on its own.
// lite: true bakes the pose into two meshes (body, head) for map scenery;
// only tick() works then (breath and head bob, no blink).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from '/engine/models/core/primitives.js';
import { dizzyStars } from '/engine/models/effects/dizzy-stars.js';

const TAIL = [[0.17, 0.058], [0.16, 0.044], [0.15, 0.032], [0.13, 0.021], [0.12, 0.012]];
const LEGS = [[1, 0.1, 0.11], [-1, 0.1, 0.11], [1, 0.085, -0.12], [-1, 0.085, -0.12]];

// Colour every vertex of a geometry with fn(x, y, z) evaluated before placement.
function paint(geometry, fn, matrix) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  if (g !== geometry) geometry.dispose();
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
  const p = g.attributes.position, colors = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { c.set(fn(p.getX(i), p.getY(i), p.getZ(i))); colors.set([c.r, c.g, c.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  if (matrix) g.applyMatrix4(matrix);
  return g;
}
const at = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => new THREE.Matrix4().compose(
  new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
const solid = color => () => color;

export function iguana({ seed = 7, color = 0x5fae3c, golden = false, pose = 'sun', demo = null, lite = false } = {}) {
  const random = rng(seed), group = new THREE.Group(); group.name = golden ? 'Iguana dorada' : 'Iguana';
  group.userData.species = 'iguana';
  const base = new THREE.Color(golden ? 0xffc629 : color);
  const hsl = base.getHSL({});
  const shade = (dl, ds = 0, dh = 0) => new THREE.Color().setHSL(hsl.h + dh, Math.min(1, Math.max(0, hsl.s + ds)), Math.min(1, Math.max(0, hsl.l + dl))).getHex();
  const C = {
    skin: base.getHex(), band: golden ? 0xe0a21c : shade(-0.06, -0.3), ring: golden ? 0xb7750f : shade(-0.2, -0.25),
    belly: shade(0.12, -0.1), spine: golden ? 0xfff0a8 : shade(0.06, 0.05, -0.04), cheek: golden ? 0xfff4c4 : 0xd6dfb0,
    dewlap: shade(0.04, 0.05, 0.02), iris: 0xd9a52c, pupil: 0x141414, claw: 0x2b2b22,
  };
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: golden ? 0.35 : 0.85,
    metalness: golden ? 0.45 : 0, emissive: golden ? 0x6a4300 : 0x000000, emissiveIntensity: golden ? 0.35 : 0 });
  const part = (pieces, name) => {
    const m = new THREE.Mesh(mergeGeometries(pieces, false), material); m.name = name;
    m.castShadow = true; m.receiveShadow = true; pieces.forEach(g => g.dispose()); return m;
  };

  const root = new THREE.Group(); group.add(root);   // lifts and flips for bonk
  const body = new THREE.Group(); body.position.y = 0.075; root.add(body);
  // Torso, neck, belly and the crest of spines, banded grey-green across the back.
  const torsoColor = (x, y, z) => (y < -0.45 ? C.belly : Math.sin(z * 2.6 + 0.4) > 0.55 ? C.band : C.skin);
  const torso = [paint(new THREE.SphereGeometry(1, 12, 8), torsoColor, at(0, 0, -0.01, 0, 0, 0, 0.115, 0.075, 0.2)),
    paint(new THREE.SphereGeometry(1, 10, 7), torsoColor, at(0, 0.012, 0.15, 0, 0, 0, 0.07, 0.06, 0.085))];
  for (let i = 0; i < 10; i++) {
    const z = 0.2 - i * 0.036, h = 0.075 - Math.abs(i - 2) * 0.005;
    torso.push(paint(new THREE.ConeGeometry(0.011, h, 4), solid(C.spine), at(0, 0.075 + h * 0.35 - i * 0.002, z, -0.35, 0, 0)));
  }
  const torsoMesh = part(torso, 'Iguana torso'); body.add(torsoMesh);

  // Head on the neck joint: skull, snout, jaw, dewlap and the round cheek scale.
  const head = new THREE.Group(); head.position.set(0, 0.03, 0.19); head.scale.setScalar(1.12); body.add(head);
  const headColor = (x, y) => (y < -0.4 ? C.belly : C.skin);
  const headPieces = [
    paint(new THREE.SphereGeometry(1, 10, 7), headColor, at(0, 0, 0.035, 0, 0, 0, 0.052, 0.045, 0.065)),
    paint(new THREE.SphereGeometry(1, 9, 6), headColor, at(0, -0.004, 0.095, -0.1, 0, 0, 0.036, 0.03, 0.05)),
    paint(new THREE.SphereGeometry(1, 8, 5), solid(C.belly), at(0, -0.025, 0.07, 0.15, 0, 0, 0.034, 0.016, 0.06)),
    paint(new THREE.SphereGeometry(1, 8, 6), solid(C.dewlap), at(0, -0.06, 0.035, 0, 0, 0, 0.01, 0.045, 0.05)),
  ];
  for (const s of [-1, 1]) {
    headPieces.push(paint(new THREE.CylinderGeometry(0.017, 0.017, 0.006, 10), solid(C.cheek), at(s * 0.05, -0.016, 0.012, 0, 0, Math.PI / 2)));
    headPieces.push(paint(new THREE.SphereGeometry(0.004, 4, 3), solid(C.pupil), at(s * 0.015, 0.012, 0.142)));
  }
  for (let i = 0; i < 4; i++) headPieces.push(paint(new THREE.ConeGeometry(0.008, 0.045 - i * 0.006, 4), solid(C.spine), at(0, 0.055, 0.01 - i * 0.022, -0.35, 0, 0)));
  head.add(part(headPieces, 'Iguana head'));
  const eyes = new THREE.Group(); eyes.position.set(0, 0.016, 0.06); head.add(eyes);
  const eyePieces = [];
  for (const s of [-1, 1]) {
    eyePieces.push(paint(new THREE.SphereGeometry(0.014, 8, 6), solid(C.iris), at(s * 0.042, 0, 0)));
    eyePieces.push(paint(new THREE.SphereGeometry(0.007, 6, 4), solid(C.pupil), at(s * 0.052, 0, 0.002)));
  }
  eyes.add(part(eyePieces, 'Iguana eyes'));

  // Tail: a chain of laterally flattened segments with dark rings.
  const tail = new THREE.Group(); tail.position.set(0, 0.005, -0.17); body.add(tail);
  const links = [];
  let link = tail;
  TAIL.forEach(([len, r], i) => {
    const end = TAIL[i + 1]?.[1] ?? 0.003;
    const geo = new THREE.CylinderGeometry(end, r, len, 8, 3); geo.rotateX(-Math.PI / 2); geo.translate(0, 0, -len / 2);
    const pieces = [paint(geo, (x, y, z) => (-z / len > 0.62 ? C.ring : y < -r * 0.5 ? C.belly : C.skin), at(0, 0, 0, 0, 0, 0, 0.8, 1, 1))];
    if (i < 2) for (let k = 0; k < 3; k++) pieces.push(paint(new THREE.ConeGeometry(0.007, 0.03 - i * 0.008, 4), solid(C.spine), at(0, r * 0.95, -0.03 - k * 0.05, -0.3, 0, 0)));
    const m = part(pieces, `Iguana tail ${i + 1}`); link.add(m);
    const next = new THREE.Group(); next.position.z = -len; link.add(next);
    links.push(link); link = next;
  });

  // Legs: upper limb out to the side, forearm down, a foot with long toes.
  const legs = LEGS.map(([s, x, z], i) => {
    const front = i < 2, leg = new THREE.Group(); leg.position.set(s * x * 0.82, -0.02, z); body.add(leg);
    const pieces = [];
    const limb = (a, b, r1, r2) => {
      const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), len = va.distanceTo(vb);
      const geo = new THREE.CylinderGeometry(r2, r1, len, 6); geo.translate(0, len / 2, 0);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
      pieces.push(paint(geo, solid(C.skin), new THREE.Matrix4().compose(va, q, new THREE.Vector3(1, 1, 1))));
    };
    const knee = [s * 0.075, 0.005, front ? 0.01 : -0.015], foot = [s * 0.1, -0.05, front ? 0.03 : -0.02];
    limb([0, 0, 0], knee, front ? 0.022 : 0.028, 0.016); limb(knee, foot, 0.016, 0.011);
    pieces.push(paint(new THREE.SphereGeometry(1, 6, 4), solid(C.skin), at(foot[0], foot[1] - 0.004, foot[2] + 0.012, 0, 0, 0, 0.018, 0.008, 0.024)));
    for (let k = 0; k < 4; k++) {
      const a = (k - 1.5) * 0.35 + s * 0.2, len = 0.035 + (k === 2 ? 0.012 : 0);
      const toe = new THREE.ConeGeometry(0.004, len, 4); toe.rotateX(Math.PI / 2); toe.translate(0, 0, len / 2);
      pieces.push(paint(toe, solid(k === 3 ? C.claw : C.skin), at(foot[0], foot[1] - 0.006, foot[2] + 0.02, 0, a, 0)));
    }
    leg.add(part(pieces, `Iguana leg ${i + 1}`));
    return { leg, s, front };
  });

  const stars = dizzyStars({ radius: 0.11, size: 0.035 }); stars.position.set(0, 0.11, 0.06); stars.visible = false; head.add(stars);

  // ---- poses: a base posture the animations add to ----
  const POSES = {
    sun: { y: 0.08, head: -0.12, legs: [[0.12, -0.5], [0.12, 0.5], [0.12, 1.15], [0.12, -1.15]], tail: [0.02, 0.0, -0.02, 0.0, 0.0], curl: 0.12 },
    perch: { y: 0.08, head: -0.05, legs: [[0.75, -0.4], [0.75, 0.4], [0.85, 0.7], [0.85, -0.7]], tail: [-0.55, -0.5, -0.4, -0.3, -0.2], curl: 0 },
    run: { y: 0.118, head: -0.2, legs: [[0.6, -0.2], [0.6, 0.2], [0.6, 0.25], [0.6, -0.25]], tail: [-0.05, 0.02, 0.03, 0.02, 0.0], curl: 0 },
  };
  let current = POSES.sun, running = false, gait = 0, bonked = 0;
  const sway = random() * 6, bobPhase = random() * 10;
  function applyPose() {
    body.position.y = current.y;
    legs.forEach(({ leg, s }, i) => { leg.rotation.set(0, current.legs[i][1], -s * current.legs[i][0]); });
    links.forEach((l, i) => { l.rotation.set(current.tail[i], 0, 0); });
    head.rotation.set(current.head, 0, 0);
  }
  group.userData.pose = name => { current = POSES[name] || POSES.sun; running = false; applyPose(); };
  group.userData.run = phase => {
    running = true; gait = phase;
    legs.forEach(({ leg, s }, i) => {
      // diagonal pairs: front-right with hind-left
      const p = phase + ((i === 0 || i === 3) ? 0 : Math.PI), base = current.legs[i];
      leg.rotation.y = base[1] + s * Math.sin(p) * 0.6;
      leg.rotation.z = -s * (base[0] - Math.max(0, -Math.cos(p)) * 0.35);
    });
    links.forEach((l, i) => { l.rotation.y = Math.sin(phase - i * 0.7) * (0.22 + i * 0.04); });
    body.rotation.y = Math.sin(phase) * 0.1;
    head.rotation.y = -Math.sin(phase) * 0.12;
  };
  group.userData.tick = t => {
    torsoMesh.scale.set(1 + Math.sin(t * 1.6 + sway) * 0.025, 1 + Math.sin(t * 1.6 + sway) * 0.04, 1);
    // blink about every 3.7 s
    const blink = ((t + sway) % 3.7) < 0.14;
    eyes.scale.y = blink ? 0.15 : 1;
    // the bob: a burst of quick nods every few seconds
    const env = Math.pow(Math.max(0, Math.sin(t * 0.55 + bobPhase)), 10);
    head.rotation.x = current.head - Math.abs(Math.sin(t * 7)) * 0.35 * env;
    if (!running && !bonked) {
      links.forEach((l, i) => { l.rotation.y = Math.sin(t * 0.7 + sway + i * 0.6) * (0.03 + current.curl * i * 0.15); });
      body.rotation.y = 0; head.rotation.y = Math.sin(t * 0.4 + sway) * 0.15;
    }
  };
  group.userData.bonk = k => {
    k = THREE.MathUtils.clamp(k, 0, 1); bonked = k > 0 && k < 1 ? k : 0;
    // up and over in the first fifth, legs in the air, then back onto its feet
    const flip = k < 0.2 ? THREE.MathUtils.smoothstep(k, 0, 0.2) : k > 0.8 ? 1 - THREE.MathUtils.smoothstep(k, 0.8, 1) : 1;
    const hop = Math.sin(Math.min(1, k / 0.2) * Math.PI) * 0.12 + Math.sin(Math.max(0, (k - 0.8) / 0.2) * Math.PI) * 0.08;
    root.rotation.z = flip * Math.PI; root.position.y = hop + flip * (current.y + 0.11);
    stars.visible = k > 0.08 && k < 0.95;
    stars.userData.spin(k * 18);
    if (k > 0 && k < 1) legs.forEach(({ leg, s }, i) => {
      leg.rotation.z = -s * (current.legs[i][0] - 0.5 * flip) + Math.sin(k * 60 + i * 1.7) * 0.4 * flip * s;
      leg.rotation.y = current.legs[i][1] + Math.cos(k * 55 + i) * 0.3 * flip;
    });
    else applyPose();
  };
  if (demo) {
    const tick = group.userData.tick;
    group.userData.tick = t => {
      tick(t);
      if (demo === 'run') group.userData.run(t * 14);
      else group.userData.bonk(Math.min(1, (t % 3) / 2));
    };
  }
  group.userData.head = head; group.userData.tail = tail;
  group.userData.dispose = () => { group.traverse(o => o.geometry?.dispose()); material.dispose(); stars.userData.dispose(); };
  group.userData.pose(pose);
  return lite ? bakeLite(group, { root, body, head, stars, material, sway, bobPhase }) : group;
}

// Merge everything but the head into one mesh, in its current pose.
function bakeLite(group, { root, body, head, stars, material, sway, bobPhase }) {
  head.remove(stars); stars.userData.dispose();
  group.updateMatrixWorld(true);
  const inv = group.matrixWorld.clone().invert(), pieces = [], under = (o) => { for (let p = o; p; p = p.parent) if (p === head) return true; return false; };
  body.traverse((o) => { if (o.isMesh && !under(o)) pieces.push(o.geometry.clone().applyMatrix4(inv.clone().multiply(o.matrixWorld))); });
  group.attach(head);
  // the eyes join the head: one draw call fewer, no blink
  head.updateMatrixWorld(true);
  const headInv = head.matrixWorld.clone().invert(), faces = [];
  head.traverse((o) => { if (o.isMesh) faces.push(o.geometry.clone().applyMatrix4(headInv.clone().multiply(o.matrixWorld))); });
  head.traverse((o) => o.geometry?.dispose());
  head.clear();
  const face = new THREE.Mesh(mergeGeometries(faces, false), material); face.name = 'Iguana head';
  face.castShadow = face.receiveShadow = true; faces.forEach((g) => g.dispose());
  head.add(face);
  root.traverse((o) => o.geometry?.dispose());
  group.remove(root);
  const trunk = new THREE.Mesh(mergeGeometries(pieces, false), material); trunk.name = 'Iguana body';
  trunk.castShadow = trunk.receiveShadow = true; pieces.forEach((g) => g.dispose());
  group.add(trunk);
  const rest = head.rotation.x;
  group.userData = { species: 'iguana', lite: true,
    tick(t) {
      trunk.scale.y = 1 + Math.sin(t * 1.6 + sway) * 0.03;
      const env = Math.pow(Math.max(0, Math.sin(t * 0.55 + bobPhase)), 10);
      head.rotation.x = rest - Math.abs(Math.sin(t * 7)) * 0.35 * env;
      head.rotation.y = Math.sin(t * 0.4 + sway) * 0.15;
    },
    dispose() { group.traverse((o) => o.geometry?.dispose()); material.dispose(); },
  };
  return group;
}
