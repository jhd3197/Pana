import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { rng } from '../../random.js';

// Night paintball field: pallet stacks, inflatable bunkers, a tipped culvert
// tube, floodlight masts and glowing LED rope. Each model's origin sits on the
// ground at its centre, and `w`/`d`/`h` fill a collision box exactly.
const standard = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .8, ...extra });
const solid = (geometry, material, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m; };

// Wooden pallets stacked flat: deck slats over three runners, each layer nudged.
export function palletBunker({ w = 2.4, h = 1.6, d = 1.2, color = '#e9e2d0', seed = 1 } = {}) {
  const group = new THREE.Group(), r = rng(seed), wood = standard(color, { roughness: .95 }), shade = standard(new THREE.Color(color).multiplyScalar(.72), { roughness: .95 });
  group.name = 'Bunker de paletas';
  const layers = Math.max(1, Math.round(h / .16)), layer = h / layers, along = w >= d, long = along ? w : d, short = along ? d : w;
  for (let i = 0; i < layers; i++) {
    const y = i * layer, nudge = i ? (r() - .5) * .06 : 0, turn = i ? (r() - .5) * .03 : 0, pallet = new THREE.Group();
    for (const s of [-1, 0, 1]) pallet.add(solid(new THREE.BoxGeometry(long, layer * .55, .1), shade, 0, layer * .275, s * (short / 2 - .05)));
    const slats = Math.max(3, Math.round(long / .32));
    for (let k = 0; k < slats; k++) pallet.add(solid(new THREE.BoxGeometry(long / slats * .78, layer * .32, short), wood, -long / 2 + (k + .5) * long / slats, layer * .71, 0));
    pallet.position.set(along ? nudge : 0, y, along ? 0 : nudge); pallet.rotation.y = (along ? 0 : Math.PI / 2) + turn; group.add(pallet);
  }
  return group;
}

// Air-filled bunkers in soft rounded shapes, with a bright band around the middle.
export function inflatableBunker({ shape = 'can', w = 1.8, h = 2, d = 1.8, color = '#f4f1ea', band = '#ff4b4b' } = {}) {
  const group = new THREE.Group(), skin = standard(color, { roughness: .45 }), stripe = standard(band, { roughness: .45 });
  group.name = `Inflable ${shape}`;
  if (shape === 'dorito') {
    // A rounded triangular prism, point up, as wide as the box.
    const triangle = new THREE.Shape(); triangle.moveTo(-.5, 0); triangle.lineTo(.5, 0); triangle.lineTo(0, 1); triangle.closePath();
    const body = new THREE.ExtrudeGeometry(triangle, { depth: .76, bevelEnabled: true, bevelThickness: .12, bevelSize: .1, bevelSegments: 4, curveSegments: 4 });
    body.translate(0, .1, -.38); const mesh = solid(body, skin); mesh.scale.set(w * .8, h * .82, d); group.add(mesh);
    const strip = solid(new THREE.BoxGeometry(w * .62, h * .09, d * 1.01), stripe, 0, h * .38, 0); group.add(strip);
  } else if (shape === 'snake') {
    // A long, low tube lying on its side.
    const long = Math.max(w, d), short = Math.min(w, d), body = solid(new THREE.CapsuleGeometry(short / 2, long - short, 8, 16), skin, 0, h / 2, 0);
    body.rotation.z = Math.PI / 2; body.scale.set(h / short, 1, 1); if (d > w) body.rotation.y = Math.PI / 2; group.add(body);
    for (const s of [-1, 1]) { const ring = solid(new THREE.TorusGeometry(short * .5, .06, 8, 20), stripe, 0, h / 2, 0); ring.scale.set(1, h / short, 1); ring.rotation.y = d > w ? 0 : Math.PI / 2; ring.position[d > w ? 'z' : 'x'] = s * long * .25; group.add(ring); }
  } else if (shape === 'brick') {
    group.add(solid(new RoundedBoxGeometry(w, h, d, 4, Math.min(w, d, h) * .28), skin, 0, h / 2, 0));
    group.add(solid(new RoundedBoxGeometry(w * 1.01, h * .12, d * 1.01, 2, .05), stripe, 0, h * .62, 0));
  } else {
    // "Can": an upright drum with a puffy dome.
    const radius = Math.min(w, d) / 2;
    group.add(solid(new THREE.CylinderGeometry(radius * .94, radius, h - radius * .5, 24), skin, 0, (h - radius * .5) / 2, 0));
    const dome = solid(new THREE.SphereGeometry(radius * .94, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), skin, 0, h - radius * .5, 0); dome.scale.y = .53; group.add(dome);
    group.add(solid(new THREE.CylinderGeometry(radius * .97, radius * .97, h * .1, 24), stripe, 0, h * .55, 0));
  }
  return group;
}

// A big ribbed plastic culvert tipped on its side: crawl through or hide behind.
export function tubeBunker({ w = 1.6, h = 1.6, d = 3.6, color = '#3b8bff' } = {}) {
  const group = new THREE.Group(), plastic = standard(color, { roughness: .5, side: THREE.DoubleSide }), rib = standard(new THREE.Color(color).multiplyScalar(.75), { roughness: .5 });
  group.name = 'Tubo de plástico';
  const along = d >= w, long = along ? d : w, radius = Math.min(h, along ? w : d) / 2, inner = new THREE.Group();
  inner.add(solid(new THREE.CylinderGeometry(radius, radius, long, 28, 1, true), plastic));
  for (let k = 0; k <= 4; k++) { const ring = solid(new THREE.TorusGeometry(radius, .05, 8, 28), rib, 0, -long / 2 + k * long / 4, 0); ring.rotation.x = Math.PI / 2; inner.add(ring); }
  inner.rotation.x = Math.PI / 2; if (!along) inner.rotation.z = Math.PI / 2; inner.position.y = radius; group.add(inner);
  return group;
}

// Floodlight mast: a steel pole with two lamp heads. `userData.lamps` lists the
// lens positions (local) so a scene can hang its own lights there.
export function floodlightMast({ height = 7, color = '#ff3344' } = {}) {
  const group = new THREE.Group(), steel = standard('#3a3f4a', { metalness: .5, roughness: .45 }), lens = new THREE.MeshBasicMaterial({ color });
  group.name = 'Torre de reflectores';
  group.add(solid(new THREE.CylinderGeometry(.12, .18, height, 10), steel, 0, height / 2, 0));
  group.add(solid(new THREE.BoxGeometry(1.8, .12, .12), steel, 0, height - .1, 0));
  group.add(solid(new THREE.CylinderGeometry(.4, .5, .3, 12), steel, 0, .15, 0));
  group.userData.lamps = [];
  for (const s of [-1, 1]) {
    const head = new THREE.Group(); head.position.set(s * .7, height - .35, .1); head.rotation.x = .55;
    head.add(solid(new RoundedBoxGeometry(.62, .5, .3, 2, .06), steel));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(.5, .38), lens); face.position.z = .16; head.add(face);
    group.add(head); group.userData.lamps.push(new THREE.Vector3(s * .7, height - .35, .3));
  }
  return group;
}

// LED rope lying on the ground along a path of [x, z] points; unlit, so it glows.
export function ledRope({ points = [[-3, 0], [-1, .8], [1, -.8], [3, 0]], color = '#ff2a3a', radius = .045, closed = false } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, radius, z)), closed, 'centripetal');
  const length = curve.getLength(), mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(8, Math.round(length * 3)), radius, 6, closed), new THREE.MeshBasicMaterial({ color }));
  // Library factories return a Group (engine/models/README.md).
  const group = new THREE.Group(); group.name = 'Manguera LED'; group.add(mesh); return group;
}

// Soft round glow for additive halos around lamps, balls and splats.
export function glowTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d'), gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)'); gradient.addColorStop(.35, 'rgba(255,255,255,.45)'); gradient.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gradient; g.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}
