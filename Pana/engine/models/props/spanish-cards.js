// Spanish deck (baraja española): card faces drawn on a canvas, the 3D card
// and a score chip. Used by Caída and Bululú's ¡Caída! minigame.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { disposeModel } from '/engine/models/props/game-table.js';

export const SUIT_COLORS = { oros: '#b8872b', copas: '#b33c32', espadas: '#31666c', bastos: '#4d7139' };
const cache = new Map();

function suit(ctx, type, x, y, size) {
  ctx.save(); ctx.translate(x, y); ctx.scale(size / 80, size / 80);
  ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeStyle = '#483e32'; ctx.fillStyle = SUIT_COLORS[type];
  if (type === 'oros') {
    ctx.beginPath(); ctx.arc(0, 0, 29, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#f5df9a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 21, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#f5df9a'; ctx.beginPath(); for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8 - Math.PI / 2, r = i % 2 ? 8 : 17; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill();
  } else if (type === 'copas') {
    ctx.fillStyle = '#b8872b'; ctx.fillRect(-4, 3, 8, 26); ctx.beginPath(); ctx.ellipse(0, 29, 21, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = SUIT_COLORS[type]; ctx.beginPath(); ctx.moveTo(-27, -27); ctx.lineTo(27, -27); ctx.quadraticCurveTo(26, 10, 0, 12); ctx.quadraticCurveTo(-26, 10, -27, -27); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d9b969'; ctx.fillRect(-28, -31, 56, 8); ctx.fillRect(-19, -18, 38, 4);
  } else if (type === 'espadas') {
    ctx.rotate(.24); ctx.fillStyle = '#9fb6b4'; ctx.beginPath(); ctx.moveTo(0, -38); ctx.lineTo(10, -20); ctx.lineTo(6, 18); ctx.lineTo(-6, 18); ctx.lineTo(-10, -20); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#e2f0e6'; ctx.beginPath(); ctx.moveTo(0, -27); ctx.lineTo(0, 14); ctx.stroke();
    ctx.fillStyle = '#b8872b'; ctx.fillRect(-22, 13, 44, 7); ctx.fillRect(-5, 20, 10, 15); ctx.beginPath(); ctx.arc(0, 36, 7, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.rotate(-.28); ctx.beginPath(); ctx.moveTo(-6, 34); ctx.bezierCurveTo(-4, 4, -23, -19, -13, -33); ctx.quadraticCurveTo(0, -44, 15, -30); ctx.bezierCurveTo(21, -9, 8, 6, 7, 34); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#d6cc8b'; ctx.beginPath(); ctx.moveTo(0, 25); ctx.lineTo(2, -24); ctx.stroke();
    for (const [a, b] of [[-13, -15], [12, -4], [-8, 8]]) { ctx.fillStyle = '#6c8a46'; ctx.beginPath(); ctx.ellipse(a, b, 9, 5, a < 0 ? -.7 : .7, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
}

function court(ctx, card) {
  const color = SUIT_COLORS[card.suit];
  ctx.save(); ctx.translate(160, 217);
  // Original geometric court illustrations: tunic, sash, face and headwear.
  ctx.fillStyle = color; ctx.strokeStyle = '#483e32'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-28, -33); ctx.lineTo(-65, 60); ctx.lineTo(63, 60); ctx.lineTo(28, -33); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#d9b969'; ctx.beginPath(); ctx.moveTo(-27, -25); ctx.lineTo(-11, -34); ctx.lineTo(48, 58); ctx.lineTo(22, 58); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#dfb080'; ctx.beginPath(); ctx.roundRect(-22, -83, 44, 53, 16); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#483e32'; ctx.fillRect(-12, -62, 4, 4); ctx.fillRect(8, -62, 4, 4); ctx.beginPath(); ctx.moveTo(-5, -47); ctx.lineTo(7, -47); ctx.stroke();
  if (card.rank === 12) {
    ctx.fillStyle = '#bd8e32'; ctx.beginPath(); ctx.moveTo(-27, -80); ctx.lineTo(-33, -112); ctx.lineTo(-12, -98); ctx.lineTo(0, -119); ctx.lineTo(12, -98); ctx.lineTo(33, -112); ctx.lineTo(27, -80); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f5df9a'; ctx.fillRect(-25, -88, 50, 8);
  } else {
    ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(0, -82, 34, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.roundRect(-19, -109, 38, 27, [14, 14, 0, 0]); ctx.fill();
    ctx.strokeStyle = '#b8872b'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(12, -106); ctx.quadraticCurveTo(36, -144, 40, -111); ctx.stroke();
  }
  if (card.rank === 11) {
    ctx.fillStyle = '#e8dbc4'; ctx.strokeStyle = '#483e32'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-57, 98); ctx.lineTo(-65, 28); ctx.lineTo(-91, 6); ctx.lineTo(-90, -26); ctx.lineTo(-80, -12); ctx.lineTo(-59, -11); ctx.bezierCurveTo(-23, 0, -32, 51, -18, 98); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#483e32'; ctx.beginPath(); ctx.arc(-78, 0, 3, 0, 7); ctx.fill(); ctx.strokeStyle = color; ctx.beginPath(); ctx.moveTo(-90, 14); ctx.lineTo(-64, 14); ctx.lineTo(-40, 38); ctx.stroke();
  }
  suit(ctx, card.suit, 60, -27, 55);
  ctx.fillStyle = '#483e32'; ctx.font = 'bold 18px Georgia'; ctx.textAlign = 'center'; ctx.fillText({ 10: 'SOTA', 11: 'CABALLO', 12: 'REY' }[card.rank], 0, 104);
  ctx.restore();
}

export function cardCanvas(card = null) {
  const id = card?.id || 'back'; if (cache.has(id)) return cache.get(id);
  const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 480;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fbf2df'; ctx.beginPath(); ctx.roundRect(0, 0, 320, 480, 18); ctx.fill();
  if (!card) {
    ctx.fillStyle = '#224e48'; ctx.beginPath(); ctx.roundRect(12, 12, 296, 456, 12); ctx.fill();
    ctx.strokeStyle = '#c4b079'; ctx.lineWidth = 1;
    ctx.save(); ctx.beginPath(); ctx.rect(24, 24, 272, 432); ctx.clip();
    for (let x = -480; x < 800; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 480, 480); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, 480); ctx.lineTo(x + 480, 0); ctx.stroke(); } ctx.restore();
    ctx.fillStyle = '#224e48'; ctx.beginPath(); ctx.ellipse(160, 240, 91, 119, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#dfc693'; ctx.lineWidth = 3; ctx.stroke();
    suit(ctx, 'oros', 160, 218, 90); ctx.fillStyle = '#f5e6c6'; ctx.textAlign = 'center'; ctx.font = 'bold 27px Georgia'; ctx.fillText('PANA', 160, 288);
  } else {
    const color = SUIT_COLORS[card.suit]; ctx.strokeStyle = '#d0b993'; ctx.lineWidth = 2; ctx.strokeRect(16, 16, 288, 448);
    for (let corner = 0; corner < 2; corner++) {
      ctx.save(); if (corner) { ctx.translate(320, 480); ctx.rotate(Math.PI); }
      ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.font = 'bold 43px Georgia'; ctx.fillText(String(card.rank), 43, 61); suit(ctx, card.suit, 43, 91, 34); ctx.restore();
    }
    if (card.rank >= 10) court(ctx, card);
    else if (card.rank === 1) { suit(ctx, card.suit, 160, 226, 154); }
    else {
      const positions = { 2: [[160, 150], [160, 320]], 3: [[160, 135], [160, 235], [160, 335]], 4: [[104, 153], [216, 153], [104, 317], [216, 317]], 5: [[104, 140], [216, 140], [160, 235], [104, 330], [216, 330]], 6: [[104, 135], [216, 135], [104, 235], [216, 235], [104, 335], [216, 335]], 7: [[104, 122], [216, 122], [104, 223], [216, 223], [104, 324], [216, 324], [160, 373]] };
      positions[card.rank].forEach(([x, y]) => suit(ctx, card.suit, x, y, card.rank === 7 ? 60 : 76));
    }
    ctx.fillStyle = color; ctx.font = '17px Georgia'; ctx.textAlign = 'center'; ctx.fillText(card.suit.toUpperCase(), 160, 427);
  }
  cache.set(id, canvas); return canvas;
}

// Card face is +Y, long edge Z; each instance owns its textures and geometry.
export function createSpanishCard({ rank = 1, suit = 'oros' } = {}) {
  const group = new THREE.Group(); group.name = `${rank} de ${suit}`;
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: '#eadac0', roughness: .55 });
  const body = new THREE.Mesh(new RoundedBoxGeometry(.64, .024, .96, 2, .012), bodyMaterial); body.castShadow = body.receiveShadow = true; group.add(body);
  const faces = [];
  for (const [index, canvas] of [cardCanvas({ rank, suit, id: `${suit}-${rank}` }), cardCanvas()].entries()) {
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(.635, .953), new THREE.MeshStandardMaterial({ map: texture, roughness: .7, transparent: true, alphaTest: .1 }));
    face.rotation.x = -Math.PI / 2; face.position.y = .013 + index * .001; group.add(face); faces.push(face);
  }
  group.userData.faceUp = show => { faces[0].visible = show; faces[1].visible = !show; };
  group.userData.highlight = on => { bodyMaterial.color.set(on ? '#e9bc55' : '#eadac0'); bodyMaterial.emissive.set(on ? '#97632a' : '#000000'); bodyMaterial.emissiveIntensity = .4; };
  group.userData.faceUp(true); group.userData.dispose = () => disposeModel(group); return group;
}

export function createScoreToken({ color = '#d5ac58' } = {}) {
  const group = new THREE.Group(); group.name = 'Ficha de puntos de Caída';
  const material = new THREE.MeshStandardMaterial({ color, metalness: .35, roughness: .45 });
  const chip = new THREE.Mesh(new THREE.CylinderGeometry(.085, .085, .035, 24), material); chip.position.y = .0175; chip.castShadow = true; group.add(chip);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.06, .004, 5, 24), new THREE.MeshStandardMaterial({ color: '#f3dfb3', metalness: .5 })); ring.rotation.x = Math.PI / 2; ring.position.y = .036; group.add(ring);
  group.userData.dispose = () => disposeModel(group); return group;
}
