import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { disposeModel } from '/engine/models/props/game-table.js';
import { cardCanvas } from './cards.js';

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
