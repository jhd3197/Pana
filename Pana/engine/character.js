// Low-poly capybara pana built from an avatar (see avatar.js).
// Origin is the feet/seat point; the character faces +Z.
//
//   const pana = buildCharacter(avatar);
//   scene.add(pana.group);
//   pana.update(dt, { open: false, dizzy: false, look: 0 });   // every frame
//
// Kept deliberately simple: the outfit is the color of the upper body itself
// (no separate cloth shells), and the few details sit flush on its surface.

import * as THREE from 'three';
import { normalizeAvatar } from './avatar.js';

const matCache = new Map();
function M(color, extra = {}) {
  const key = color + JSON.stringify(extra);
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, ...extra }));
  }
  return matCache.get(key);
}

function part(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

const blob = (r, detail = 1) => new THREE.IcosahedronGeometry(r, detail);
const shade = (hex, k) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();
const PAW = '#2a1c16';
const GOLD = () => M('#ffc629', { metalness: 0.5, roughness: 0.35, emissive: '#3a2a00' });

// Octagonal rings make broad readable facets instead of triangulated balls.
// Each profile is [height, half-width, half-depth, corner cut].
function profileGeometry(profile) {
  const vertices = [], rings = profile.map(([y, x, z, c]) => [
    [-x + c, y, -z], [x - c, y, -z], [x, y, -z + c], [x, y, z - c],
    [x - c, y, z], [-x + c, y, z], [-x, y, z - c], [-x, y, -z + c],
  ]);
  const triangle = (a, b, c) => vertices.push(...a, ...b, ...c);
  for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < 8; i++) {
    const n = (i + 1) % 8;
    triangle(rings[j][i], rings[j + 1][i], rings[j + 1][n]);
    triangle(rings[j][i], rings[j + 1][n], rings[j][n]);
  }
  for (let i = 1; i < 7; i++) {
    triangle(rings[0][0], rings[0][i], rings[0][i + 1]);
    triangle(rings.at(-1)[0], rings.at(-1)[i + 1], rings.at(-1)[i]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals(); return geometry;
}
function chunk(w, h, d, bevel = 0.08) {
  const b = Math.min(bevel, w / 4, h / 3, d / 4), x = w / 2, z = d / 2;
  return profileGeometry([
    [-h / 2, x - b * 0.6, z - b * 0.6, b * 0.4],
    [-h / 2 + b, x, z, b], [h / 2 - b, x, z, b],
    [h / 2, x - b * 0.6, z - b * 0.6, b * 0.4],
  ]);
}

// Outfit details follow the broad front plane of the pear-shaped torso.
const BODY_PROFILE = [
  [0.16, 0.34, 0.27, 0.15], [0.29, 0.51, 0.39, 0.23],
  [0.56, 0.56, 0.41, 0.26], [0.82, 0.5, 0.39, 0.21],
  [1.02, 0.38, 0.3, 0.15], [1.09, 0.3, 0.25, 0.12],
];
function torsoFront(x, y) {
  const found = BODY_PROFILE.findIndex(row => row[0] >= y);
  const i = found < 0 ? BODY_PROFILE.length - 1 : Math.max(1, found);
  const a = BODY_PROFILE[i - 1], b = BODY_PROFILE[i];
  const k = THREE.MathUtils.clamp((y - a[0]) / (b[0] - a[0]), 0, 1);
  const width = THREE.MathUtils.lerp(a[1], b[1], k), depth = THREE.MathUtils.lerp(a[2], b[2], k), corner = THREE.MathUtils.lerp(a[3], b[3], k);
  return depth - Math.max(0, Math.abs(x) - width + corner);
}
function onTorso(mesh, dx, dy) {
  const positions = mesh.geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = dx * 0.46 + positions.getX(i), y = 0.65 + dy * 0.42 + positions.getY(i);
    positions.setXYZ(i, x, y, torsoFront(x, y) + positions.getZ(i) + 0.018);
  }
  positions.needsUpdate = true; mesh.geometry.computeVertexNormals();
  return mesh;
}

function star(mat) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? 0.05 : 0.12;
    if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  return new THREE.Mesh(new THREE.ShapeGeometry(s), mat);
}

// ---------- hats ----------
function addHat(head, r, style, color) {
  const m = M(color);
  const dark = M(shade(color, 0.72));
  switch (style) {
    case 'gorra':
    case 'gorra-atras': {
      const dir = style === 'gorra-atras' ? -1 : 1;
      const crown = part(new THREE.SphereGeometry(r, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, r * 0.55, -r * 0.04);
      crown.scale.set(1.14, 0.65, 1.03);
      head.add(crown);
      const brim = part(chunk(r * 1.78, r * 0.1, r * 1.13, r * 0.15), m, 0, r * 0.58, dir * r * 1.01);
      brim.rotation.x = dir * -0.07;
      head.add(brim);
      head.add(part(chunk(r * 1.55, r * 0.035, r * 0.98, r * 0.12), dark, 0, r * 0.51, dir * r * 1.02));
      head.add(part(blob(r * 0.09, 0), m, 0, r * 1.2, -r * 0.04));
      break;
    }
    case 'pesca':
      head.add(part(new THREE.CylinderGeometry(r * 0.88, r * 1.13, r * 0.6, 10), m, 0, r * 0.82, 0));
      head.add(part(new THREE.CylinderGeometry(r * 1.38, r * 1.45, r * 0.08, 12), dark, 0, r * 0.52, 0));
      break;
    case 'lana': {
      const crown = part(new THREE.SphereGeometry(r, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, r * 0.32, 0);
      crown.scale.set(1.21, 0.95, 1.14); crown.position.y = r * 0.41;
      head.add(crown);
      const cuff = part(new THREE.CylinderGeometry(r * 1.14, r * 1.16, r * 0.2, 12), dark, 0, r * 0.36, 0);
      cuff.scale.z = 0.94;
      head.add(cuff);
      head.add(part(blob(r * 0.24, 0), M(shade(color, 1.15)), 0, r * 1.3, 0));   // pompom
      break;
    }
    case 'corona': {
      const gold = GOLD();
      head.add(part(new THREE.CylinderGeometry(r * 0.6, r * 0.64, r * 0.28, 10, 1, true), gold, 0, r * 1.0, 0));
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2;
        head.add(part(new THREE.ConeGeometry(r * 0.14, r * 0.34, 4), gold, Math.sin(ang) * r * 0.58, r * 1.3, Math.cos(ang) * r * 0.58));
      }
      break;
    }
    case 'llanero':
      head.add(part(new THREE.CylinderGeometry(r * 0.7, r * 1.0, r * 0.62, 10), m, 0, r * 0.98, 0));
      head.add(part(new THREE.CylinderGeometry(r * 0.96, r * 1.01, r * 0.13, 10), M('#2b2d42'), 0, r * 0.72, 0));
      head.add(part(new THREE.CylinderGeometry(r * 1.7, r * 1.7, r * 0.08, 14), m, 0, r * 0.64, 0));
      break;
    default:
  }
}

// ---------- glasses: blocky shades with a red glint ----------
function addGlasses(head, r, style) {
  if (style === 'none') return;
  const y = r * 0.22, z = r * 0.97;
  const frame = style === 'fiesta' ? M('#f15bb5', { roughness: 0.4 }) : M('#111114', { roughness: 0.3 });
  const lens = M('#0d0d10', { roughness: 0.1, metalness: 0.5 });
  for (const s of [1, -1]) {
    const framePart = part(chunk(r * 0.84, r * 0.42, r * 0.14, r * 0.045), frame, s * r * 0.49, y, z);
    framePart.rotation.z = -s * 0.06; head.add(framePart);
    head.add(part(chunk(r * 0.65, r * 0.26, r * 0.035, r * 0.025), lens, s * r * 0.49, y, z + r * 0.08));
    head.add(part(new THREE.BoxGeometry(r * 0.09, r * 0.14, r * 0.85), frame, s * r * 0.92, y, z - r * 0.35));
    const glint = part(new THREE.PlaneGeometry(r * 0.17, r * 0.065), M(style === 'fiesta' ? '#f38cce' : '#a93b25'), s * r * 0.35, y + r * 0.065, z + r * 0.105); glint.rotation.z = 0.2; head.add(glint);
  }
  head.add(part(new THREE.BoxGeometry(r * 0.24, r * 0.12, r * 0.13), frame, 0, y + r * 0.06, z));
}

// ---------- the capybara ----------
export function buildCharacter(input, { head: r = 0.58, seated = false, chef = false } = {}) {
  const a = normalizeAvatar(input);
  const fur = M(a.fur);
  const paw = M(PAW);
  const dressed = a.outfit !== 'nada';
  const cloth = dressed ? M(a.outfitColor) : fur;
  const trim = M('#f3e9d7');
  const group = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = seated ? 0 : 0.29;
  group.add(body);
  const legs = [];

  // One continuous pear silhouette. Clothing reaches the hips, so there is no
  // separate exposed belly ring dividing the character into stacked spheres.
  const torso = part(profileGeometry(BODY_PROFILE), cloth);
  body.add(torso);
  for (const s of [1, -1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.29, seated ? 0.3 : 0.5, 0);
    const thigh = part(chunk(0.3, seated ? 0.24 : 0.34, 0.32, 0.08), fur, 0, seated ? -0.16 : -0.13, seated ? 0.17 : 0);
    const foot = part(chunk(0.35, 0.23, 0.47, 0.065), paw, 0, seated ? -0.185 : -0.375, seated ? 0.34 : 0.1);
    leg.add(thigh, foot);
    for (const toe of [-1, 1]) leg.add(part(new THREE.BoxGeometry(0.012, 0.025, 0.07), M('#140e0b'), toe * 0.065, seated ? -0.13 : -0.32, seated ? 0.55 : 0.31));
    group.add(leg); legs.push(leg);
  }

  // outfit details, flush on the torso
  if (a.outfit === 'deportivo') {
    body.add(onTorso(part(new THREE.PlaneGeometry(0.04, 0.5, 1, 12), trim), 0, 0.05));   // zipper
  } else if (a.outfit === 'hoodie') {
    body.add(onTorso(part(new THREE.PlaneGeometry(0.36, 0.16, 2, 4), M(shade(a.outfitColor, 0.82))), 0, -0.35));   // pocket
    for (const s of [1, -1]) body.add(onTorso(part(new THREE.PlaneGeometry(0.03, 0.18), trim), s * 0.12, 0.55, 1));
    const hood = part(new THREE.TorusGeometry(0.28, 0.1, 5, 10), cloth, 0, 1.0, -0.14);
    hood.rotation.x = Math.PI / 2 + 0.45;
    body.add(hood);
  } else if (a.outfit === 'hawaiana') {
    const flower = M('#ffc629', { side: THREE.DoubleSide });
    for (const [x, y] of [[0.5, 0.2], [-0.55, 0.45], [0.35, 0.7], [-0.3, -0.2], [0.95, 0.1], [-0.95, 0.25], [0.1, -0.45]]) {
      body.add(onTorso(part(new THREE.CircleGeometry(0.075, 5), flower), x, y, 1));
    }
    body.add(onTorso(part(new THREE.CircleGeometry(0.13, 3), trim), 0, 0.75, 1));   // undershirt V
  }
  if (a.extra === 'cadena') {
    body.add(onTorso(part(new THREE.CircleGeometry(0.075, 8), GOLD()), 0, 0.25, 1));
    for (let i = -3; i <= 3; i++) {
      if (i === 0) continue;
      body.add(onTorso(part(new THREE.CircleGeometry(0.025, 5), GOLD()), i * 0.13, 0.62 - Math.abs(i) * 0.03, 1));
    }
  }

  // Short sleeves, visible forearms and solid mitten paws. Pivots remain inside
  // the shoulder so waving, carrying and existing game poses all share the rig.
  const arms = [];
  for (const s of [1, -1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(s * 0.44, 0.88, 0.02);
    shoulder.rotation.set(-0.3, 0, s * 0.22);
    const sleeve = part(chunk(0.31, 0.29, 0.32, 0.065), cloth, 0, -0.13, 0);
    const forearm = part(chunk(0.25, 0.24, 0.27, 0.06), fur, 0, -0.33, 0.015);
    shoulder.add(sleeve, forearm);
    if (a.outfit === 'deportivo') shoulder.add(part(new THREE.BoxGeometry(0.02, 0.19, 0.06), trim, s * 0.157, -0.15, 0));
    const hand = part(chunk(0.28, 0.25, 0.3, 0.065), paw, 0, -0.47, 0.04);
    shoulder.add(hand);
    body.add(shoulder);
    arms.push(shoulder);
  }

  // Broad cheeks and a forward, squared capybara muzzle. The nose is part of
  // that silhouette, rather than a circular bear-like patch stuck to the face.
  const neck = new THREE.Group();
  neck.position.y = 1.02;
  body.add(neck);
  const head = new THREE.Group();
  head.position.y = r * 0.45;
  neck.add(head);
  const skull = part(profileGeometry([
    [-0.85, 0.58, 0.57, 0.28], [-0.58, 0.87, 0.8, 0.44],
    [-0.05, 1.0, 0.88, 0.51], [0.4, 0.97, 0.83, 0.47],
    [0.72, 0.77, 0.65, 0.35], [0.9, 0.48, 0.46, 0.22],
  ].map(ring => ring.map(value => value * r))), fur);
  head.add(skull);
  // The muzzle grows forward out of the cheeks as one long wedge. A separate
  // raised nose disc reads as a pig; capybara nostrils sit flush near its end.
  const muzzleGeometry = profileGeometry([
    [0.45, 0.76, 0.52, 0.3], [0.92, 0.69, 0.5, 0.28],
    [1.48, 0.53, 0.4, 0.21], [1.57, 0.45, 0.33, 0.17],
  ].map(ring => ring.map(value => value * r)));
  muzzleGeometry.rotateX(Math.PI / 2);
  const snout = part(muzzleGeometry, M(shade(a.fur, 0.93)), 0, -r * 0.23, 0);
  head.add(snout);
  const earHeight = chef || a.hat === 'none' || a.hat === 'corona' ? 0.73 : 0.48;
  for (const s of [1, -1]) {
    const nostril = part(new THREE.SphereGeometry(r * 0.06, 7, 5), M('#654025'), s * r * 0.27, r * 0.205, r * 1.36);
    nostril.scale.set(0.6, 0.16, 1.2); nostril.rotation.y = -s * 0.3; head.add(nostril);
    const ear = part(new THREE.SphereGeometry(r * 0.22, 8, 6), fur, s * r * 0.84, r * earHeight, -r * 0.28);
    ear.scale.set(0.85, 1, 0.52);
    ear.rotation.z = -s * 0.15;
    head.add(ear);
    const inner = part(new THREE.SphereGeometry(r * 0.135, 8, 5), M(shade(a.fur, 0.63)), s * r * 0.84, r * (earHeight + 0.02), -r * 0.17);
    inner.scale.set(0.8, 1, 0.12); inner.rotation.z = -s * 0.15; head.add(inner);
  }

  // eyes: black beads, happy arcs or big cartoon eyes
  const eyes = [];
  const arcEyes = a.face === 'feliz';
  for (const s of [1, -1]) {
    const eye = new THREE.Group();
    eye.position.set(s * r * 0.64, r * 0.26, r * 0.8);
    eye.rotation.y = s * 0.25;
    if (arcEyes) {
      eye.add(part(new THREE.TorusGeometry(r * 0.1, r * 0.03, 4, 8, Math.PI), M('#16100c')));
    } else if (a.face === 'ojazos') {
      const white = part(new THREE.SphereGeometry(r * 0.19, 10, 8), M('#fff9e8', { roughness: 0.3 }));
      white.scale.z = 0.6;
      eye.add(white);
      eye.add(part(new THREE.SphereGeometry(r * 0.1, 8, 6), M('#16100c', { roughness: 0.2 }), r * 0.02, 0, r * 0.1));
    } else {
      eye.add(part(new THREE.SphereGeometry(r * 0.1, 8, 6), M('#16100c', { roughness: 0.2 })));
      eye.add(part(new THREE.SphereGeometry(r * 0.03, 4, 3), M('#ffffff'), r * 0.03, r * 0.035, r * 0.08));
    }
    head.add(eye);
    eyes.push(eye);
  }

  // Graphic smiles remain legible at game scale. Teeth/tongue are simple inset
  // shapes, and the open mouth stretches when celebrating or shouting.
  const mouthAt = new THREE.Vector3(0, -r * 0.31, r * 1.578);
  const rest = new THREE.Group();
  rest.position.copy(mouthAt);
  head.add(rest);
  const smileShape = new THREE.Shape();
  if (a.face === 'cool') {
    smileShape.moveTo(-r * 0.24, -r * 0.05); smileShape.quadraticCurveTo(0, -r * 0.16, r * 0.25, -r * 0.025);
    smileShape.quadraticCurveTo(r * 0.13, -r * 0.24, -r * 0.24, -r * 0.05);
  } else {
    smileShape.moveTo(-r * 0.3, r * 0.025); smileShape.quadraticCurveTo(0, -r * 0.1, r * 0.3, r * 0.05);
    smileShape.quadraticCurveTo(r * 0.23, -r * 0.25, 0, -r * 0.25); smileShape.quadraticCurveTo(-r * 0.23, -r * 0.24, -r * 0.3, r * 0.025);
  }
  rest.add(part(new THREE.ShapeGeometry(smileShape, 5), M('#2e1916')));
  if (a.face === 'cool') rest.rotation.z = -0.08;
  else for (const s of [-1, 1]) rest.add(part(chunk(r * 0.1, r * 0.07, r * 0.035, r * 0.015), trim, s * r * 0.07, -r * 0.055, r * 0.02));
  if (a.face === 'lengua') {
    const tongue = part(chunk(r * 0.24, r * 0.19, r * 0.12, r * 0.06), M('#ee7c83'), r * 0.05, -r * 0.22, r * 0.035); tongue.rotation.z = -0.15; rest.add(tongue);
  }
  const open = new THREE.Group();
  open.position.copy(mouthAt);
  const hole = part(new THREE.CircleGeometry(r * 0.26, 12), M('#30171a'), 0, -r * 0.07, r * 0.025);
  hole.scale.set(1.1, 1, 1); open.add(hole);
  open.add(part(chunk(r * 0.28, r * 0.13, r * 0.04, r * 0.04), M('#ed8183'), 0, -r * 0.22, r * 0.045));
  for (const s of [-1, 1]) open.add(part(chunk(r * 0.1, r * 0.09, r * 0.025, r * 0.015), trim, s * r * 0.07, r * 0.1, r * 0.045));
  open.visible = false;
  head.add(open);

  if (chef) {
    head.add(part(new THREE.CylinderGeometry(r * 0.77, r * 0.99, r * 0.4, 12), trim, 0, r * 0.88, 0));
    for (const [x, y, z] of [[-0.4, 1.18, 0], [0.4, 1.18, 0], [0, 1.32, -0.14], [0, 1.16, 0.32]]) {
      const puff = part(blob(r * 0.48, 2), M('#fff9e9'), x * r, y * r, z * r); puff.scale.y = 0.85; head.add(puff);
    }
    // Match the torso's facet boundaries so cloth triangles never cut through
    // a convex corner, even when the cook leans or carries a dish.
    const apronVertices = [], apronIndices = [];
    for (const y of [0.26, 0.29, 0.56, 0.82, 0.95]) {
      const width = THREE.MathUtils.lerp(0.38, 0.21, (y - 0.26) / 0.69);
      const edge = Math.min(width * 0.99, 1 - (torsoFront(0, y) - torsoFront(1, y)));
      for (const x of [-width, -edge, 0, edge, width]) apronVertices.push(x, y, torsoFront(x, y) + 0.018);
    }
    for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
      const i = row * 5 + col; apronIndices.push(i, i + 1, i + 6, i, i + 6, i + 5);
    }
    const apronGeometry = new THREE.BufferGeometry();
    apronGeometry.setAttribute('position', new THREE.Float32BufferAttribute(apronVertices, 3)); apronGeometry.setIndex(apronIndices);
    apronGeometry.computeVertexNormals(); body.add(part(apronGeometry, trim));
    body.add(part(chunk(0.26, 0.16, 0.025, 0.02), M(a.outfitColor), 0, 0.48, 0.46));
    for (const s of [-1, 1]) { const strap = part(new THREE.BoxGeometry(0.055, 0.25, 0.035), trim, s * 0.18, 0.98, 0.35); strap.rotation.x = -0.65; body.add(strap); }
  } else addHat(head, r, a.hat, a.hatColor);
  addGlasses(head, r, a.glasses);

  const stars = new THREE.Group();
  stars.position.y = r * 1.5;
  const starMat = M('#ffc629', { side: THREE.DoubleSide, emissive: '#6b5200' });
  for (let i = 0; i < 3; i++) {
    const st = star(starMat);
    const ang = (i / 3) * Math.PI * 2;
    st.position.set(Math.cos(ang) * r * 1.1, 0, Math.sin(ang) * r * 1.1);
    stars.add(st);
  }
  stars.visible = false;
  head.add(stars);

  // ---------- animation ----------
  let nextBlink = 1 + Math.random() * 3;
  let openK = 0;
  let gait = 0, stride = 0, age = 0;
  const carry = new THREE.Group(); carry.position.set(0, 0.76, 0.92); body.add(carry);
  return {
    group, body, neck, head, arms, legs, carry, avatar: a,
    armL: arms[0], armR: arms[1],
    update(dt, s = {}) {
      age += dt;
      if (!seated) {
        stride += ((s.walk ? Math.min(1.4, Number(s.walk)) : 0) - stride) * Math.min(1, dt * 12);
        gait += dt * (s.run ? 18 : 12);
        legs.forEach((leg, i) => { leg.rotation.x = Math.sin(gait + i * Math.PI) * 0.8 * stride; leg.rotation.z = (i ? -1 : 1) * stride * 0.08; });
        body.position.y = 0.29 + Math.abs(Math.sin(gait)) * 0.07 * stride;
        body.rotation.z = Math.sin(gait) * 0.085 * stride;
        body.rotation.x = s.run ? -0.1 * stride : 0;
        head.rotation.z = Math.sin(gait + 0.5) * 0.035 * stride;
        head.rotation.y = Math.sin(age * 0.9) * 0.035 * (1 - Math.min(1, stride)) + (s.look || 0) * 0.07;
        if ('walk' in s || 'carry' in s) arms.forEach((arm, i) => { arm.rotation.x = s.carry ? -1.35 : -0.25 + Math.sin(gait + i * Math.PI) * stride * 0.75; });
      }
      nextBlink -= dt;
      let lid = 1;
      if (nextBlink < 0) {
        lid = 0.1;
        if (nextBlink < -0.12) nextBlink = 2 + Math.random() * 3.5;
      }
      for (const e of eyes) {
        e.scale.y = arcEyes ? 1 : (s.dizzy ? 0.4 : lid);
        e.position.x = Math.sign(e.position.x) * r * 0.64 + (s.look || 0) * r * 0.03;
      }
      const yelling = s.open || a.face === 'wow';
      openK += ((yelling ? 1 : 0) - openK) * Math.min(1, dt * 14);
      open.visible = openK > 0.1;
      open.scale.set(1, Math.max(0.1, openK * 1.3), 1);
      rest.visible = !open.visible;
      stars.visible = !!s.dizzy;
      stars.rotation.y += dt * 6;
    },
  };
}
