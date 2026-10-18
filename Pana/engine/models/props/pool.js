import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { disposeModel } from './game-table.js';

export const POOL_SURFACE = 1.55;
const COLORS = ['#fff6e3', '#efc337', '#3775cc', '#d84c44', '#874ea2', '#eb8739', '#398e67', '#a43e4c', '#20242b'];
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .6, ...extra });
function part(group, geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); return mesh;
}
function box(group, material, w, h, d, x, y, z) { return part(group, new RoundedBoxGeometry(w, h, d, 2, .035), material, x, y, z); }
function pocketShape(w, d) {
  const shape = new THREE.Shape(); shape.moveTo(-w / 2, -d / 2); shape.lineTo(w / 2, -d / 2); shape.lineTo(w / 2, d / 2); shape.lineTo(-w / 2, d / 2); shape.closePath();
  for (const x of [-5, 0, 5]) for (const z of [-2.5, 2.5]) { const hole = new THREE.Path(); hole.absarc(x, z, .255, 0, Math.PI * 2, true); shape.holes.push(hole); }
  return shape;
}
function own(group) { let disposed = false; group.userData.dispose = () => { if (!disposed) { disposed = true; disposeModel(group); } }; return group; }

// Grounded, metres. The cloth is 10 × 5: rules coordinates map at 1 cm/unit.
export function createPoolTable() {
  const group = new THREE.Group(); group.name = 'Billar de la plaza';
  const wood = mat('#8b5e3c'), edge = mat('#d8884b'), felt = mat('#1f9e5e', { roughness: 1 }), cushion = mat('#187d4c'), brass = mat('#d6b578', { metalness: .65, roughness: .32 }), dark = mat('#171a16');
  // Cut the six pockets through every layer, so the cloth never sits on a
  // solid wooden slab and the recessed leather cups have genuine depth.
  for (const [w, d, h, y, material] of [[11.1, 6.1, .42, 1.02, wood], [11.2, 6.2, .15, 1.365, edge]]) {
    const plate = part(group, new THREE.ExtrudeGeometry(pocketShape(w, d), { depth: h, bevelEnabled: false, curveSegments: 24, steps: 1 }), material, 0, y, 0); plate.rotation.x = -Math.PI / 2;
  }
  const cloth = pocketShape(10.6, 5.6);
  for (const x of [-5, 0, 5]) for (const z of [-2.5, 2.5]) {
    const rim = part(group, new THREE.TorusGeometry(.275, .045, 8, 32), brass, x, POOL_SURFACE + .012, z); rim.rotation.x = Math.PI / 2;
    part(group, new THREE.CylinderGeometry(.25, .18, .23, 24), dark, x, 1.17, z);
  }
  const surface = part(group, new THREE.ShapeGeometry(cloth, 32), felt, 0, POOL_SURFACE, 0); surface.rotation.x = -Math.PI / 2;
  for (const z of [-2.65, 2.65]) for (const x of [-2.5, 2.5]) box(group, cushion, 4.5, .16, .3, x, 1.62, z);
  for (const x of [-5.15, 5.15]) box(group, cushion, .3, .16, 4.5, x, 1.62, 0);
  for (const x of [-5.47, 5.47]) box(group, wood, .24, .16, 5.9, x, 1.61, 0);
  for (const z of [-2.97, 2.97]) box(group, wood, 10.75, .16, .24, 0, 1.61, z);
  for (const x of [-4.3, 4.3]) for (const z of [-2.15, 2.15]) {
    part(group, new THREE.CylinderGeometry(.25, .35, 1.2, 12), wood, x, .65, z);
    part(group, new THREE.CylinderGeometry(.37, .37, .13, 16), brass, x, .065, z);
  }
  for (const x of [-3.75, -2.5, -1.25, 1.25, 2.5, 3.75]) for (const z of [-2.98, 2.98]) {
    const diamond = box(group, brass, .065, .015, .065, x, 1.7, z); diamond.rotation.y = Math.PI / 4;
  }
  box(group, wood, 8.8, .16, .18, 0, .4, 0);
  // Chalk rests on the rail, clear of the playable cloth.
  box(group, mat('#5da5be'), .17, .14, .17, 3.8, 1.76, 2.97);
  box(group, mat('#e4caa1'), .17, .035, .17, 3.8, 1.71, 2.97);
  return own(group);
}

export function createPoolBall({ number = 8 } = {}) {
  const group = new THREE.Group(); group.name = `Bola ${number}`;
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256;
  const ctx = canvas.getContext('2d'), color = COLORS[number > 8 ? number - 8 : number];
  ctx.fillStyle = number > 8 ? '#fff5df' : color; ctx.fillRect(0, 0, 512, 256);
  if (number > 8) { ctx.fillStyle = color; ctx.fillRect(0, 76, 512, 104); }
  if (number) for (const x of [128, 384]) {
    ctx.fillStyle = '#fff9e9'; ctx.beginPath(); ctx.arc(x, 128, 33, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#20242b'; ctx.font = 'bold 43px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(number, x, 130);
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const ball = part(group, new THREE.SphereGeometry(.11, 24, 16), mat('#ffffff', { map: texture, roughness: .22 }), 0, .11, 0);
  ball.rotation.z = Math.PI / 2; group.userData.ball = ball;
  return own(group);
}

// Tip at origin, shaft along -X, ready to aim with rotation.y = -angle.
export function createPoolCue() {
  const group = new THREE.Group(); group.name = 'Taco de billar';
  for (const [length, radius, color, x] of [[1.2, .023, '#e4bd7d', -.6], [.65, .04, '#74462f', -1.525], [.07, .025, '#5da5be', .005]]) {
    const shaft = part(group, new THREE.CylinderGeometry(radius * .75, radius, length, 12), mat(color), x); shaft.rotation.z = -Math.PI / 2;
  }
  return own(group);
}
