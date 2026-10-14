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

// The torso is an ellipsoid; this puts a flat detail right on its surface.
const TORSO = { c: new THREE.Vector3(0, 0.7, 0), r: new THREE.Vector3(0.56, 0.5, 0.48) };
function onTorso(mesh, dx, dy, dz) {
  const d = new THREE.Vector3(dx, dy, dz).normalize();
  const p = d.clone().multiply(TORSO.r).multiplyScalar(0.985).add(TORSO.c);
  const n = new THREE.Vector3(d.x / TORSO.r.x, d.y / TORSO.r.y, d.z / TORSO.r.z).normalize();
  mesh.position.copy(p).addScaledVector(n, 0.01);
  mesh.lookAt(mesh.position.clone().add(n));
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
      const crown = part(new THREE.SphereGeometry(r, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, r * 0.38, -r * 0.04);
      crown.scale.set(1.03, 0.8, 1.05);
      head.add(crown);
      const brim = part(new THREE.BoxGeometry(r * 1.05, r * 0.08, r * 0.85), dark, 0, r * 0.44, dir * r * 1.12);
      brim.rotation.x = dir * 0.1;
      head.add(brim);
      break;
    }
    case 'pesca':
      head.add(part(new THREE.CylinderGeometry(r * 0.8, r * 0.95, r * 0.55, 9), m, 0, r * 0.8, 0));
      head.add(part(new THREE.CylinderGeometry(r * 1.38, r * 1.45, r * 0.08, 12), dark, 0, r * 0.52, 0));
      break;
    case 'lana': {
      const crown = part(new THREE.SphereGeometry(r, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, r * 0.32, 0);
      crown.scale.set(1.04, 0.95, 1.04);
      head.add(crown);
      const cuff = part(new THREE.TorusGeometry(r * 0.96, r * 0.12, 5, 14), dark, 0, r * 0.36, 0);
      cuff.rotation.x = Math.PI / 2;
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
      head.add(part(new THREE.CylinderGeometry(r * 0.62, r * 0.8, r * 0.62, 10), m, 0, r * 0.98, 0));
      head.add(part(new THREE.CylinderGeometry(r * 0.82, r * 0.82, r * 0.13, 10), M('#2b2d42'), 0, r * 0.72, 0));
      head.add(part(new THREE.CylinderGeometry(r * 1.7, r * 1.7, r * 0.08, 14), m, 0, r * 0.64, 0));
      break;
    default:
  }
}

// ---------- glasses: blocky shades with a red glint ----------
function addGlasses(head, r, style) {
  if (style === 'none') return;
  const y = r * 0.27, z = r * 0.84;   // sits on the face, over the eyes
  const frame = style === 'fiesta' ? M('#f15bb5', { roughness: 0.4 }) : M('#111114', { roughness: 0.3 });
  const lens = M('#0d0d10', { roughness: 0.1, metalness: 0.5 });
  for (const s of [1, -1]) {
    head.add(part(new THREE.BoxGeometry(r * 0.52, r * 0.32, r * 0.1), frame, s * r * 0.31, y, z));
    head.add(part(new THREE.BoxGeometry(r * 0.4, r * 0.2, r * 0.04), lens, s * r * 0.31, y, z + r * 0.05));
    head.add(part(new THREE.BoxGeometry(r * 0.06, r * 0.08, r * 0.6), frame, s * r * 0.6, y, z - r * 0.32));   // temples
  }
  head.add(part(new THREE.BoxGeometry(r * 0.2, r * 0.08, r * 0.08), frame, 0, y + r * 0.06, z));
}

// ---------- the capybara ----------
export function buildCharacter(input, { head: r = 0.58 } = {}) {
  const a = normalizeAvatar(input);
  const fur = M(a.fur);
  const paw = M(PAW);
  const dressed = a.outfit !== 'nada';
  const cloth = dressed ? M(a.outfitColor) : fur;
  const trim = M('#f3e9d7');
  const group = new THREE.Group();

  // body: one pear shape, widest at the bottom: the torso (outfit color)
  // sinks into wide fur hips; chunky thighs and dark feet up front
  const torso = part(blob(0.5, 2), cloth, TORSO.c.x, TORSO.c.y, TORSO.c.z);
  torso.scale.set(1.12, 1.0, 0.96);
  group.add(torso);
  const hips = part(blob(0.5, 2), fur, 0, 0.3, 0.0);
  hips.scale.set(1.18, 0.64, 1.05);
  group.add(hips);
  for (const s of [1, -1]) {
    const thigh = part(blob(0.21, 2), fur, s * 0.27, 0.2, 0.2);
    thigh.scale.set(1, 0.9, 1.15);
    group.add(thigh);
    const foot = part(blob(0.15, 0), paw, s * 0.28, 0.07, 0.4);
    foot.scale.set(1.1, 0.8, 1.2);
    group.add(foot);
  }

  // outfit details, flush on the torso
  if (a.outfit === 'deportivo') {
    group.add(onTorso(part(new THREE.PlaneGeometry(0.04, 0.5), trim), 0, 0.05, 1));   // zipper
  } else if (a.outfit === 'hoodie') {
    group.add(onTorso(part(new THREE.PlaneGeometry(0.36, 0.16), M(shade(a.outfitColor, 0.82))), 0, -0.35, 1));   // pocket
    for (const s of [1, -1]) group.add(onTorso(part(new THREE.PlaneGeometry(0.03, 0.18), trim), s * 0.12, 0.55, 1));
    const hood = part(new THREE.TorusGeometry(0.28, 0.1, 5, 10), cloth, 0, 1.0, -0.14);
    hood.rotation.x = Math.PI / 2 + 0.45;
    group.add(hood);
  } else if (a.outfit === 'hawaiana') {
    const flower = M('#ffc629', { side: THREE.DoubleSide });
    for (const [x, y] of [[0.5, 0.2], [-0.55, 0.45], [0.35, 0.7], [-0.3, -0.2], [0.95, 0.1], [-0.95, 0.25], [0.1, -0.45]]) {
      group.add(onTorso(part(new THREE.CircleGeometry(0.075, 5), flower), x, y, 1));
    }
    group.add(onTorso(part(new THREE.CircleGeometry(0.13, 3), trim), 0, 0.75, 1));   // undershirt V
  }
  if (a.extra === 'cadena') {
    group.add(onTorso(part(new THREE.CircleGeometry(0.075, 8), GOLD()), 0, 0.25, 1));
    for (let i = -3; i <= 3; i++) {
      if (i === 0) continue;
      group.add(onTorso(part(new THREE.CircleGeometry(0.025, 5), GOLD()), i * 0.13, 0.62 - Math.abs(i) * 0.03, 1));
    }
  }

  // arms: short rounded limbs that grow out of the body's sides (the pivot
  // sits inside the torso, so there's no visible joint) and rest forward on
  // the belly, ending in a big dark paw
  const arms = [];
  for (const s of [1, -1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(s * 0.38, 0.82, 0.08);
    shoulder.rotation.set(-0.55, 0, s * 0.32);
    const limb = part(new THREE.CapsuleGeometry(0.135, 0.2, 2, 7), cloth, 0, -0.2, 0);
    shoulder.add(limb);
    if (a.outfit === 'deportivo') shoulder.add(part(new THREE.BoxGeometry(0.02, 0.26, 0.06), trim, s * 0.13, -0.2, 0));
    const hand = part(blob(0.15, 1), paw, 0, -0.42, 0.02);
    hand.scale.set(1.05, 0.95, 1.1);
    shoulder.add(hand);
    group.add(shoulder);
    arms.push(shoulder);
  }

  // head: rounded block, wide snout with a darker muzzle, little ears
  const neck = new THREE.Group();
  neck.position.y = 0.92;
  group.add(neck);
  const head = new THREE.Group();
  head.position.y = r * 0.52;   // the big head sinks into the shoulders
  neck.add(head);
  const skull = part(blob(r, 2), fur);
  skull.scale.set(0.96, 1.0, 1.0);
  head.add(skull);
  // capybara snout: a big rounded block, its flat front a darker muzzle
  // patch with the nose on top
  const snout = part(blob(r * 0.55, 2), fur, 0, -r * 0.14, r * 0.62);
  snout.scale.set(1.1, 1.05, 1.12);
  head.add(snout);
  const muzzle = part(blob(r * 0.4, 2), M(shade(a.fur, 0.66)), 0, -r * 0.12, r * 1.05);
  muzzle.scale.set(1.2, 1.0, 0.42);
  head.add(muzzle);
  const nose = part(blob(r * 0.17, 1), M('#3b2416', { roughness: 0.5 }), 0, r * 0.04, r * 1.19);
  nose.scale.set(1.5, 0.62, 0.5);
  head.add(nose);
  for (const s of [1, -1]) {
    const ear = part(blob(r * 0.16, 0), M(shade(a.fur, 0.78)), s * r * 0.52, r * 0.8, -r * 0.12);
    ear.scale.set(1, 1.1, 0.6);
    head.add(ear);
  }

  // eyes: black beads, happy arcs or big cartoon eyes
  const eyes = [];
  const arcEyes = a.face === 'feliz';
  for (const s of [1, -1]) {
    const eye = new THREE.Group();
    eye.position.set(s * r * 0.4, r * 0.26, r * 0.78);
    if (arcEyes) {
      eye.add(part(new THREE.TorusGeometry(r * 0.1, r * 0.03, 4, 8, Math.PI), M('#16100c')));
    } else if (a.face === 'ojazos') {
      const white = part(new THREE.SphereGeometry(r * 0.2, 10, 8), M('#ffffff', { roughness: 0.3 }));
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

  // mouth: depends on the face; an open "O" when yelling
  const mouthAt = new THREE.Vector3(0, -r * 0.28, r * 1.2);
  const rest = new THREE.Group();
  rest.position.copy(mouthAt);
  head.add(rest);
  if (a.face === 'cool') {
    const line = part(new THREE.BoxGeometry(r * 0.26, r * 0.04, r * 0.04), M('#2a1810'), r * 0.04, 0, 0);
    line.rotation.z = 0.18;
    rest.add(line);
  } else {
    const smile = part(new THREE.TorusGeometry(r * 0.13, r * 0.03, 4, 8, Math.PI), M('#2a1810'));
    smile.rotation.z = Math.PI;
    rest.add(smile);
    if (a.face === 'lengua') {
      const tongue = part(new THREE.BoxGeometry(r * 0.18, r * 0.06, r * 0.26), M('#ff6f8a'), 0, -r * 0.1, r * 0.1);
      tongue.rotation.x = 0.7;
      rest.add(tongue);
    }
  }
  const open = new THREE.Group();
  open.position.copy(mouthAt);
  const hole = part(new THREE.SphereGeometry(r * 0.16, 8, 6), M('#3a0f12'));
  hole.scale.z = 0.4;
  open.add(hole);
  open.visible = false;
  head.add(open);

  addHat(head, r, a.hat, a.hatColor);
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
  return {
    group, neck, head, arms, avatar: a,
    armL: arms[0], armR: arms[1],
    update(dt, s = {}) {
      nextBlink -= dt;
      let lid = 1;
      if (nextBlink < 0) {
        lid = 0.1;
        if (nextBlink < -0.12) nextBlink = 2 + Math.random() * 3.5;
      }
      for (const e of eyes) {
        e.scale.y = arcEyes ? 1 : (s.dizzy ? 0.4 : lid);
        e.position.x = Math.sign(e.position.x) * r * 0.4 + (s.look || 0) * r * 0.03;
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
