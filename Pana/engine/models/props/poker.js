import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { disposeModel } from './game-table.js';
import { bake } from '/engine/models/core/static-batch.js';

import { CARD_SUITS } from '/engine/models/core/playing-card-art.js';
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .72, ...extra });
function part(group, geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); return mesh;
}
function own(group) { let disposed = false; group.userData.dispose = () => { if (!disposed) { disposed = true; disposeModel(group); } }; return group; }
export function createPokerTable() {
  const group = new THREE.Group(); group.name = 'Mesa de póquer';
  const wood = mat('#815036'), leather = mat('#46362e'), brass = mat('#d4ae63', { metalness: .65, roughness: .38 });
  for (const [r, h, y, m] of [[5, .25, 1.2, wood], [5.03, .16, 1.4, leather], [4.58, .04, 1.47, mat('#246f58', { roughness: 1 })]]) {
    const top = part(group, new THREE.CylinderGeometry(r, r, h, 80), m, 0, y, 0); top.scale.z = .66;
  }
  const trim = part(group, new THREE.TorusGeometry(4.64, .026, 8, 96), brass, 0, 1.5, 0); trim.rotation.x = Math.PI / 2; trim.scale.y = .66;
  for (const x of [-3.2, 3.2]) for (const z of [-1.6, 1.6]) {
    part(group, new THREE.CylinderGeometry(.16, .25, 1.1, 12), wood, x, .6, z);
    part(group, new THREE.CylinderGeometry(.27, .27, .12, 16), brass, x, .06, z);
  }
  for (let i = 0; i < 6; i++) {
    const angle = i * Math.PI / 3, x = Math.sin(angle) * 4.8, z = Math.cos(angle) * 3.13;
    const cup = part(group, new THREE.TorusGeometry(.15, .025, 8, 24), brass, x, 1.49, z); cup.rotation.x = Math.PI / 2;
    part(group, new THREE.CylinderGeometry(.13, .13, .012, 20), leather, x, 1.48, z);
  }
  return own(group);
}

export function createPokerCard({ card = 12 } = {}) {
  const group = new THREE.Group(); group.name = 'Carta de póquer';
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 384;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff5dd'; ctx.fillRect(0, 0, 256, 384);
  if (card === null) {
    ctx.fillStyle = '#236455'; ctx.fillRect(12, 12, 232, 360); ctx.strokeStyle = '#d4ba72'; ctx.lineWidth = 2;
    for (let i = -384; i < 640; i += 20) { ctx.beginPath(); ctx.moveTo(i, 12); ctx.lineTo(i + 360, 372); ctx.stroke(); }
    ctx.fillStyle = '#e8cf90'; ctx.textAlign = 'center'; ctx.font = 'bold 38px sans-serif'; ctx.fillText('PANA', 128, 200);
  } else {
    const suit = Math.floor(card / 13), rank = card % 13 + 2, face = ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A' })[rank] || String(rank);
    ctx.fillStyle = suit === 1 || suit === 2 ? '#b93547' : '#1c2531';
    const pip = new Path2D(CARD_SUITS[suit]);
    for (const flip of [false, true]) {
      ctx.save(); if (flip) { ctx.translate(256, 384); ctx.rotate(Math.PI); }
      ctx.font = 'bold 49px sans-serif'; ctx.fillText(face, 16, 54); ctx.translate(19, 65); ctx.scale(1.5, 1.5); ctx.fill(pip); ctx.restore();
    }
    ctx.save(); ctx.translate(65, 125); ctx.scale(5.2, 5.2); ctx.fill(pip); ctx.restore();
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  part(group, new RoundedBoxGeometry(.64, .025, .96, 2, .012), mat('#f2e3c8'), 0, .0125, 0);
  const face = part(group, new THREE.PlaneGeometry(.615, .935), new THREE.MeshBasicMaterial({ map: texture }), 0, .026, 0); face.rotation.x = -Math.PI / 2;
  group.userData.card = card; return own(group);
}

export function createPokerChips({ count = 6, color = '#c15a61' } = {}) {
  const group = new THREE.Group(); group.name = 'Fichas de póquer';
  const paint = mat(color), stripe = mat('#fff0cf');
  const disc = new THREE.CylinderGeometry(.17, .17, .045, 24), mark = new THREE.BoxGeometry(.045, .046, .07);
  for (let i = 0; i < Math.max(1, Math.min(20, count)); i++) {
    part(group, disc, paint, 0, .025 + i * .05, 0);
    for (let n = 0; n < 6; n++) { const angle = n * Math.PI / 3, m = part(group, mark, stripe, Math.sin(angle) * .144, .025 + i * .05, Math.cos(angle) * .144); m.rotation.y = angle; }
  }
  const result = bake(group); result.name = group.name; disc.dispose(); mark.dispose(); return own(result);
}
