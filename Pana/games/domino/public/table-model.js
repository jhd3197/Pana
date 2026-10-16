import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PIPS } from './tiles.js';

function part(parent, geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .7, ...extra });
function rounded(parent, material, w, h, d, radius, x, y, z) {
  return part(parent, new RoundedBoxGeometry(w, h, d, 3, radius), material, x, y, z);
}
export function disposeModel(group) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  group.traverse(o => { if (o.geometry) geometries.add(o.geometry); for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) { materials.add(m); if (m.map) textures.add(m.map); } });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); group.removeFromParent();
}
function grain() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#a66536'; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 170; i++) {
    ctx.strokeStyle = i % 3 ? '#88512b30' : '#d7985b45'; ctx.lineWidth = i % 4 ? .5 : 1.5; ctx.beginPath();
    for (let x = 0; x <= 256; x += 8) { const y = i * 1.53 + Math.sin(x * .02 + i * 1.7) * 2; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = texture.wrapT = THREE.RepeatWrapping; return texture;
}

// Metres; ground origin. The square table leaves a clear 4.8 m playing surface.
export function createDominoTable() {
  const group = new THREE.Group(); group.name = 'Mesa de dominó · café y panas';
  const wood = mat('#ffffff', { map: grain() }), darkWood = mat('#68412d'), felt = mat('#225f50', { roughness: 1 }), brass = mat('#d4ae63', { metalness: .65, roughness: .38 });
  rounded(group, darkWood, 6.8, .27, 6.8, .24, 0, 1.16, 0);
  rounded(group, wood, 6.8, .17, 6.8, .23, 0, 1.31, 0);
  rounded(group, brass, 6.05, .035, 6.05, .16, 0, 1.409, 0);
  rounded(group, felt, 5.98, .04, 5.98, .15, 0, 1.43, 0);
  for (const x of [-2.55, 2.55]) for (const z of [-2.55, 2.55]) {
    rounded(group, darkWood, .24, 1.17, .24, .025, x, .585, z);
    part(group, new THREE.CylinderGeometry(.16, .18, .12, 12), brass, x, .06, z);
  }
  for (const sign of [-1, 1]) {
    rounded(group, darkWood, 5.3, .2, .13, .02, 0, .48, sign * 2.55);
    rounded(group, darkWood, .13, .2, 5.3, .02, sign * 2.55, .48, 0);
  }
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 512;
  const ctx = canvas.getContext('2d'); ctx.strokeStyle = '#bfcb9b'; ctx.fillStyle = '#c9d4b0'; ctx.globalAlpha = .28;
  ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(512, 256, 220, 164, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.textAlign = 'center'; ctx.font = 'bold 100px Georgia'; ctx.fillText('PANA', 512, 264); ctx.font = '24px sans-serif'; ctx.fillText('LA PARTIDA DEL SÁBADO', 512, 310);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const decal = part(group, new THREE.PlaneGeometry(2.7, 1.35), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }), 0, 1.454, 0); decal.rotation.x = -Math.PI / 2;
  // Coffee on the wooden corners, safely away from hands and the domino chain.
  const ceramic = mat('#f4e5bf'), coffee = mat('#49271a');
  for (const [x, z] of [[-3.12, -3.12], [3.12, 3.12]]) {
    part(group, new THREE.CylinderGeometry(.22, .2, .035, 24), ceramic, x, 1.42, z);
    part(group, new THREE.CylinderGeometry(.13, .1, .21, 24), ceramic, x, 1.54, z);
    part(group, new THREE.CylinderGeometry(.113, .113, .005, 24), coffee, x, 1.646, z);
    const handle = part(group, new THREE.TorusGeometry(.07, .022, 6, 16), ceramic, x + .135, 1.55, z); handle.rotation.y = Math.PI / 2;
  }
  group.userData.dispose = () => disposeModel(group); return group;
}

export function createDominoChair() {
  const group = new THREE.Group(); group.name = 'Silla de la partida'; const wood = mat('#9c6038'), stripe = mat('#d5ad68');
  rounded(group, wood, 1.45, .17, 1.35, .07, 0, .66, 0);
  for (const x of [-.55, .55]) for (const z of [-.49, .49]) rounded(group, wood, .12, .66, .12, .025, x, .33, z);
  for (const x of [-.57, .57]) rounded(group, wood, .12, 1.1, .12, .02, x, 1.2, -.52);
  for (const y of [1.22, 1.49, 1.73]) rounded(group, y === 1.49 ? stripe : wood, 1.26, .19, .12, .03, 0, y, -.52);
  group.userData.dispose = () => disposeModel(group); return group;
}

// Top face points +Y; long axis Z. a is the -Z half. Each piece owns its meshes.
export function createDominoTile({ a = 6, b = 6 } = {}) {
  const group = new THREE.Group(); group.name = `Ficha ${a}–${b}`;
  const ivory = mat('#fff3d5', { roughness: .32 }), back = mat('#213c35', { roughness: .42 }), black = mat('#243a31'), gold = mat('#b29a60', { metalness: .5 });
  const base = rounded(group, back, .28, .115, .56, .025, 0, .0575, 0);
  rounded(group, ivory, .276, .066, .556, .02, 0, .102, 0);
  const face = new THREE.Group(); group.add(face);
  rounded(face, gold, .225, .002, .005, .001, 0, .136, 0);
  part(face, new THREE.SphereGeometry(.009, 8, 6), gold, 0, .139, 0);
  const values = [a, b], total = PIPS[a].length + PIPS[b].length;
  if (total) {
    const dots = new THREE.InstancedMesh(new THREE.CylinderGeometry(.019, .016, .003, 12), black, total), matrix = new THREE.Matrix4(); let index = 0;
    values.forEach((value, half) => { for (const pip of PIPS[value]) { matrix.makeTranslation((pip % 3 - 1) * .066, .137, (half ? .14 : -.14) + (Math.floor(pip / 3) - 1) * .066); dots.setMatrixAt(index++, matrix); } });
    dots.instanceMatrix.needsUpdate = true; face.add(dots);
  }
  const cover = rounded(group, back, .279, .009, .559, .02, 0, .14, 0);
  const motif = part(cover, new THREE.TorusGeometry(.04, .004, 5, 16), gold, 0, .008, 0); motif.rotation.x = Math.PI / 2;
  cover.visible = false;
  group.userData.faceUp = show => { face.visible = show; cover.visible = !show; };
  group.userData.highlight = on => { ivory.emissive.set(on ? '#61451a' : '#000000'); ivory.emissiveIntensity = on ? .2 : 0; base.material.color.set(on ? '#ddb45e' : '#213c35'); };
  group.userData.dispose = () => disposeModel(group); return group;
}
