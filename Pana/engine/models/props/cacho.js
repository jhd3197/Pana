import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// The cacho: a leather dice cup, its die and a coin, for ¿Quién empieza?
// (engine/play/quien-empieza.js). Unit sizes: the cup is 1 tall standing on
// its base at the origin, the die is .38 across; scale the group per table.
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .78, ...extra });
function part(parent, geometry, material, y = 0) {
  const mesh = new THREE.Mesh(geometry, material); mesh.position.y = y;
  mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
}

// A worn leather cup with a dark band and cream stitches at the mouth.
export function createCacho({ color = '#7b3f20', band = '#3a1d10' } = {}) {
  const group = new THREE.Group(); group.name = 'Cacho';
  const leather = mat(color), dark = mat(band, { roughness: .9 }), stitch = mat('#f1dfb8', { roughness: .6 });
  const wall = [];
  for (let i = 0; i <= 10; i++) { const k = i / 10; wall.push(new THREE.Vector2(.34 + k * .08 + Math.sin(k * Math.PI) * .015, k)); }
  const inner = wall.map(v => new THREE.Vector2(v.x - .035, v.y)).reverse();
  part(group, new THREE.LatheGeometry([new THREE.Vector2(0, 0), ...wall, ...inner, new THREE.Vector2(0, .04)], 28), leather);
  part(group, new THREE.TorusGeometry(.405, .03, 8, 28), dark, .92).rotation.x = Math.PI / 2;
  part(group, new THREE.TorusGeometry(.35, .025, 8, 28), dark, .08).rotation.x = Math.PI / 2;
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * Math.PI * 2, s = part(group, new THREE.BoxGeometry(.045, .012, .012), stitch, .82);
    s.position.x = Math.cos(a) * .418; s.position.z = Math.sin(a) * .418; s.rotation.y = -a + Math.PI / 2;
  }
  return group;
}

function pips(value, ink = '#2b1d16') {
  const c = document.createElement('canvas'); c.width = c.height = 128; const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff6e2'; ctx.fillRect(0, 0, 128, 128); ctx.fillStyle = value === 1 ? '#d7263d' : ink;
  const points = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
    5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
  for (const [x, y] of points[value]) { ctx.beginPath(); ctx.arc(64 + x * 31, 64 + y * 31, value === 1 ? 15 : 11, 0, Math.PI * 2); ctx.fill(); }
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}
// Euler angles that turn each value to face up (+Y).
export const DIE_FACE_UP = { 1: [0, 0, 0], 2: [-Math.PI / 2, 0, 0], 3: [0, 0, Math.PI / 2], 4: [0, 0, -Math.PI / 2], 5: [Math.PI / 2, 0, 0], 6: [Math.PI, 0, 0] };
// Centred on its middle; faces +x −x +y −y +z −z are 3 4 1 6 2 5.
export function createCachoDie({ size = .38 } = {}) {
  const group = new THREE.Group(); group.name = 'Dado del cacho';
  const geometry = new RoundedBoxGeometry(size, size, size, 3, size * .14);
  part(group, geometry, [3, 4, 1, 6, 2, 5].map(v => new THREE.MeshStandardMaterial({ map: pips(v), roughness: .42 })));
  return group;
}

function coinFace(label, sun) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const ctx = c.getContext('2d');
  ctx.fillStyle = '#e8b64a'; ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = '#a8761f'; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(128, 128, 112, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#8a5c14';
  if (sun) {
    ctx.beginPath(); ctx.arc(128, 112, 40, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ctx.fillRect(128 + Math.cos(a) * 52 - 5, 112 + Math.sin(a) * 52 - 5, 10, 10); }
  } else {
    ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 22 : 50; ctx.lineTo(128 + Math.cos(a) * r, 108 + Math.sin(a) * r); } ctx.fill();
  }
  ctx.font = '900 40px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(label, 128, 200);
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}
// A gold coin lying flat: cara faces +Y, sello faces −Y. Radius .5.
export function createMoneda() {
  const group = new THREE.Group(); group.name = 'Moneda';
  const rim = mat('#c9952f', { metalness: .7, roughness: .35 });
  const face = label => new THREE.MeshStandardMaterial({ map: coinFace(label, label === 'CARA'), metalness: .45, roughness: .4 });
  part(group, new THREE.CylinderGeometry(.5, .5, .07, 40), [rim, face('CARA'), face('SELLO')]);
  return group;
}
