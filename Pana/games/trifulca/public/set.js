// Trifulca's own set: the big cartoon boxing gloves and the open-face moto
// helmet worn as headgear, the little ring under a black truss tent, and the
// Ávila ridge behind it. Registered in Pana Studio (web/studio/catalog/
// trifulca.js). Metres, +Y up, fronts toward +Z, ground at y = 0. Each factory
// returns a group whose userData.dispose frees what it built.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { disposeModel } from '/engine/models/props/game-table.js';
import { fbm2, rng } from '/engine/random.js';

export const CORNER_COLORS = { red: '#e8443a', blue: '#2f6fe0', yellow: '#f2b631', green: '#2aa876' };
export const HELMET_COLORS = ['#ffffff', '#ffc629', '#2ad1b2', '#ff6fae', '#1f1f24', '#ff8a3d', '#9b5de5', '#6bbf59'];

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .5, ...extra });
function part(parent, geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
const owned = (group) => { group.userData.dispose = () => disposeModel(group); return group; };
function rope(parent, a, b, r, material) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const mesh = part(parent, new THREE.CylinderGeometry(r, r, va.distanceTo(vb), 8), material);
  mesh.position.copy(va).add(vb).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.sub(va).normalize());
  return mesh;
}

// ---------- Guantes de boxeo ----------
// One oversized glove, knuckles toward −Y and the cuff up (it hangs from a
// pana's hand), thumb toward +Z. About 0.42 m long; `cuff` paints the cuff.
export function boxingGlove({ color = CORNER_COLORS.red, cuff = '#ffffff', side = 1 } = {}) {
  const group = new THREE.Group(); group.name = 'Guante de boxeo';
  const leather = mat(color, { roughness: .32, metalness: .05 }), band = mat(cuff, { roughness: .45 });
  const fist = part(group, new THREE.SphereGeometry(.2, 20, 16), leather, 0, -.17, .02);
  fist.scale.set(1, 1.08, 1.12);
  const knuckle = part(group, new THREE.SphereGeometry(.15, 16, 12), leather, 0, -.29, .06); knuckle.scale.set(1.15, .8, 1);
  const thumb = part(group, new THREE.CapsuleGeometry(.07, .12, 6, 10), leather, side * .1, -.12, .17);
  thumb.rotation.set(.5, 0, side * -.4);
  part(group, new THREE.CylinderGeometry(.13, .15, .16, 16), band, 0, .02, 0);
  // Laces across the cuff.
  const lace = mat('#f4efe4', { roughness: .8 });
  for (let i = 0; i < 3; i++) part(group, new THREE.BoxGeometry(.012, .012, .1), lace, 0, -.03 + i * .04, .14).rotation.y = i % 2 ? .5 : -.5;
  group.userData.previewBounds = [[-.25, -.45, -.25], [.25, .15, .3]];
  return owned(group);
}

// ---------- Casco de moto abierto ----------
// An open-face moto helmet, a bit too big, sized for a pana's head (about
// 1.25 m wide in the game's toy scale). Origin at the head's centre, open face
// toward +Z, a stripe over the top and a chin strap.
export function motoHelmet({ color = '#ffc629', stripe = '#1f1f24', scale = 1 } = {}) {
  const group = new THREE.Group(); group.name = 'Casco de moto';
  const shell = mat(color, { roughness: .22, metalness: .1 }), dark = mat(stripe, { roughness: .3 });
  const r = .6 * scale, open = 1.05;
  const geo = new THREE.SphereGeometry(r, 32, 20, Math.PI / 2 + open, Math.PI * 2 - open * 2, 0, Math.PI * .66);
  const dome = part(group, geo, shell, 0, .1 * scale, -.04 * scale); dome.material.side = THREE.DoubleSide;
  const cap = part(group, new THREE.SphereGeometry(r * 1.002, 32, 10, 0, Math.PI * 2, 0, Math.PI * .26), shell, 0, .1 * scale, -.04 * scale);
  void cap;
  // The rim around the face opening and the stripe over the crown.
  const rim = part(group, new THREE.TorusGeometry(r * .78, .035 * scale, 8, 28, Math.PI * 1.2), dark, 0, -.02 * scale, .22 * scale);
  rim.rotation.set(0, 0, -Math.PI * .1);
  const band = part(group, new THREE.TorusGeometry(r * 1.01, .05 * scale, 6, 32, Math.PI * .9), dark, 0, .1 * scale, -.04 * scale);
  band.rotation.set(0, Math.PI / 2, Math.PI * .05);
  // Little visor peak and the strap under the chin.
  const peak = part(group, new RoundedBoxGeometry(.5 * scale, .04 * scale, .16 * scale, 2, .015 * scale), dark, 0, .36 * scale, .5 * scale);
  peak.rotation.x = .3;
  const strap = part(group, new THREE.TorusGeometry(.42 * scale, .018 * scale, 6, 20, Math.PI), mat('#2a2a2a'), 0, -.12 * scale, .12 * scale);
  strap.rotation.set(0, 0, Math.PI);
  group.userData.previewBounds = [[-.7 * scale, -.6 * scale, -.7 * scale], [.7 * scale, .75 * scale, .75 * scale]];
  return owned(group);
}

// ---------- Chancleta ----------
// A rubber flip-flop, 0.3 m long, sole on y = 0 and the toe toward +Z: the
// lightest thing to throw in a trifulca libre.
export function chancleta({ color = '#2ad1b2', strap = '#ffffff' } = {}) {
  const group = new THREE.Group(); group.name = 'Chancleta';
  const shape = new THREE.Shape();
  shape.moveTo(0, -.15); shape.bezierCurveTo(.07, -.15, .065, -.02, .055, .03); shape.bezierCurveTo(.05, .12, .06, .16, 0, .16);
  shape.bezierCurveTo(-.06, .16, -.05, .12, -.055, .03); shape.bezierCurveTo(-.065, -.02, -.07, -.15, 0, -.15);
  const sole = part(group, new THREE.ExtrudeGeometry(shape, { depth: .025, bevelEnabled: true, bevelSize: .006, bevelThickness: .006, bevelSegments: 2 }), mat(color, { roughness: .7 }));
  sole.rotation.x = -Math.PI / 2; sole.position.y = .006;
  const band = mat(strap, { roughness: .5 });
  for (const side of [-1, 1]) {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, .03, .11), new THREE.Vector3(side * .035, .06, .05), new THREE.Vector3(side * .055, .035, -.01)]);
    part(group, new THREE.TubeGeometry(curve, 10, .009, 6), band);
  }
  group.userData.previewBounds = [[-.1, 0, -.18], [.1, .1, .2]];
  return owned(group);
}

// ---------- Ring bajo toldo ----------
// A small boxing ring, canvas at 0.6 m, ropes inside ±2.9 m, under a black
// truss tent with blank coloured banners. The ropes are a separate child
// (`ropes`) so they can wobble; lights hang from the truss (`lamps`).
export const RING = { floor: .6, half: 2.9 };
export function tentRing({ seed = 1, tent = true } = {}) {
  const group = new THREE.Group(); group.name = 'Ring bajo toldo';
  const random = rng(seed), { floor, half } = RING;
  part(group, new THREE.BoxGeometry(half * 2 + .6, floor - .04, half * 2 + .6), mat('#2b2d42', { roughness: .8 }), 0, (floor - .04) / 2, 0);
  part(group, new THREE.BoxGeometry(half * 2 + .7, .1, half * 2 + .7), mat('#e9e2d0', { roughness: .95 }), 0, floor - .05, 0);
  // Painted canvas: a big ring of colour around a pale centre.
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#e8e3d3'; ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = '#d7cfb9'; ctx.lineWidth = 2; for (let i = 0; i < 512; i += 24) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke(); }
  ctx.strokeStyle = '#e8443a'; ctx.lineWidth = 26; ctx.beginPath(); ctx.arc(256, 256, 150, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffc629'; ctx.beginPath(); ctx.arc(256, 256, 54, 0, Math.PI * 2); ctx.fill();
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const top = part(group, new THREE.PlaneGeometry(half * 2 + .55, half * 2 + .55), new THREE.MeshStandardMaterial({ map: texture, roughness: .9 }), 0, floor + .001, 0);
  top.rotation.x = -Math.PI / 2;
  // Skirt panels in the corner colours.
  for (const [x, z, c] of [[0, half + .33, '#2f6fe0'], [0, -half - .33, '#e8443a']]) part(group, new THREE.BoxGeometry(half * 2 + .6, floor - .1, .02), mat(c), x, (floor - .1) / 2, z);
  // Corner posts with pads: red, blue and two neutral.
  const pads = { '-1,-1': '#e8443a', '1,1': '#2f6fe0', '-1,1': '#ffffff', '1,-1': '#ffffff' };
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    part(group, new THREE.CylinderGeometry(.07, .07, 1.55, 10), mat('#c9ccd6', { metalness: .7, roughness: .3 }), sx * half, floor + .78, sz * half);
    part(group, new RoundedBoxGeometry(.24, 1.05, .24, 2, .06), mat(pads[`${sx},${sz}`], { roughness: .4 }), sx * (half - .1), floor + .82, sz * (half - .1));
  }
  const ropes = new THREE.Group(); ropes.name = 'ropes'; group.add(ropes);
  const ropeMats = [mat('#e8443a', { roughness: .4 }), mat('#ffffff', { roughness: .4 }), mat('#2f6fe0', { roughness: .4 })];
  [.45, .85, 1.25].forEach((y, i) => {
    const corners = [[-half, half], [half, half], [half, -half], [-half, -half]];
    corners.forEach(([x0, z0], k) => {
      const [x1, z1] = corners[(k + 1) % 4];
      rope(ropes, [x0, floor + y, z0], [x1, floor + y, z1], .035, ropeMats[i]);
    });
  });
  // Steps up to the red corner.
  for (let i = 0; i < 3; i++) part(group, new THREE.BoxGeometry(1, .2, .35), mat('#4a4e69'), -half - .8 + i * .0, .1 + i * .2, -half + 1.2 - i * .35).visible = true;
  const lamps = new THREE.Group(); lamps.name = 'lamps'; group.add(lamps);
  if (tent) {
    const truss = mat('#1f1f24', { metalness: .5, roughness: .45 }), T = 4.4, H = 5.2;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      for (const dx of [-.12, .12]) for (const dz of [-.12, .12]) rope(group, [sx * T + dx, 0, sz * T + dz], [sx * T + dx, H, sz * T + dz], .03, truss);
      for (let y = .4; y < H; y += .55) rope(group, [sx * T - .12, y, sz * T - .12], [sx * T + .12, y + .5, sz * T + .12], .015, truss);
    }
    for (const [a, b] of [[[-T, H, -T], [T, H, -T]], [[-T, H, T], [T, H, T]], [[-T, H, -T], [-T, H, T]], [[T, H, -T], [T, H, T]]]) {
      rope(group, a, b, .05, truss); rope(group, [a[0], a[1] - .3, a[2]], [b[0], b[1] - .3, b[2]], .04, truss);
    }
    const roof = part(group, new THREE.ConeGeometry(T * 1.5, 2.2, 4, 1, true), mat('#26262c', { roughness: .85, side: THREE.DoubleSide }), 0, H + 1.05, 0);
    roof.rotation.y = Math.PI / 4;
    const colors = ['#ffc629', '#2ad1b2', '#ff6fae', '#ff8a3d', '#9b5de5', '#6bbf59'];
    for (let side = 0; side < 4; side++) for (let i = 0; i < 2; i++) {
      const banner = part(group, new THREE.BoxGeometry(2.6, .7, .04), mat(colors[(side * 2 + i + Math.floor(random() * 2)) % colors.length], { roughness: .7 }));
      const a = side * Math.PI / 2, along = (i ? 1.6 : -1.6);
      banner.position.set(Math.sin(a) * (T + .06) + Math.cos(a) * along, H - .75, Math.cos(a) * (T + .06) - Math.sin(a) * along);
      banner.rotation.y = a;
    }
    for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
      const lamp = part(lamps, new THREE.CylinderGeometry(.18, .26, .35, 12), mat('#2a2a2a', { metalness: .5 }), x, H - .25, z);
      part(lamp, new THREE.CircleGeometry(.2, 12), mat('#fff6d6', { emissive: '#fff1c2', emissiveIntensity: 1.4 }), 0, -.18, 0).rotation.x = Math.PI / 2;
    }
  }
  group.userData.previewBounds = [[-5, 0, -5], [5, 7, 5]];
  return owned(group);
}

// ---------- El Ávila ----------
// The green mountain wall behind Caracas: a long ridge `width` m wide, up to
// `height` m tall, its front foot along z = 0 and rising toward −Z.
export function avilaRidge({ width = 220, height = 46, depth = 60, seed = 7 } = {}) {
  const group = new THREE.Group(); group.name = 'El Ávila';
  const nx = 90, nt = 14, positions = [], colors = [], index = [];
  const low = new THREE.Color('#4f9a52'), high = new THREE.Color('#7fb86a'), rock = new THREE.Color('#8f9a7a');
  for (let j = 0; j <= nt; j++) for (let i = 0; i <= nx; i++) {
    const u = i / nx, t = j / nt, x = (u - .5) * width;
    const ridge = height * (.62 + .38 * fbm2(u * 6 + seed, seed * .3)) * (1 - Math.pow(Math.abs(u - .5) * 1.6, 3) * .5);
    const y = ridge * Math.sin(t * Math.PI / 2) + fbm2(u * 30, t * 4 + seed) * 3 * t;
    positions.push(x, y, -t * depth);
    const c = low.clone().lerp(high, t * .8).lerp(rock, Math.max(0, fbm2(u * 20, t * 6) - .55) * 1.5);
    colors.push(c.r, c.g, c.b);
  }
  for (let j = 0; j < nt; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
    index.push(a, c, b, b, c, d);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(index); geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
  mesh.receiveShadow = true; group.add(mesh);
  group.userData.previewBounds = [[-width / 2, 0, -depth], [width / 2, height, 0]];
  return owned(group);
}
