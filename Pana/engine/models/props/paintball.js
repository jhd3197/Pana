import * as THREE from 'three';
import { rng } from '../../random.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { bake } from '/engine/models/core/static-batch.js';
import { disposeModel } from './game-table.js';

// Held origin at the grip; barrel points +Z. A sporting paint marker, not a firearm.
export function createPaintMarker({ color = '#f28b42' } = {}) {
  const root = new THREE.Group(), paint = new THREE.MeshStandardMaterial({ color, roughness: .4 });
  const dark = new THREE.MeshStandardMaterial({ color: '#344847', roughness: .55 }), steel = new THREE.MeshStandardMaterial({ color: '#a9bfc0', metalness: .6, roughness: .3 });
  function add(geometry, material, x, y, z, turn = false) { const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); if (turn) mesh.rotation.x = Math.PI / 2; mesh.castShadow = true; root.add(mesh); return mesh; }
  add(new RoundedBoxGeometry(.19, .21, .52, 2, .04), paint, 0, .15, .16);
  add(new RoundedBoxGeometry(.15, .3, .17, 2, .035), dark, 0, -.08, .02).rotation.x = -.2;
  add(new THREE.CylinderGeometry(.055, .07, .65, 16), steel, 0, .17, .67, true);
  add(new THREE.CylinderGeometry(.078, .078, .07, 16), paint, 0, .17, 1.02, true);
  add(new THREE.CylinderGeometry(.045, .045, .075, 16), dark, 0, .17, 1.025, true);
  add(new THREE.CylinderGeometry(.07, .07, .17, 12), steel, 0, .32, .13);
  add(new THREE.SphereGeometry(.21, 16, 12), paint, 0, .5, .12).scale.set(1, .8, 1.45);
  add(new THREE.CylinderGeometry(.13, .13, .43, 16), dark, 0, -.12, -.25, true);
  const result = bake(root); const geometry = new Set(); root.traverse(o => { if (o.geometry) geometry.add(o.geometry); }); geometry.forEach(g => g.dispose());
  result.name = 'Marcadora de pintura'; let disposed = false;
  result.userData.dispose = () => { if (!disposed) { disposed = true; disposeModel(result); } }; return result;
}

// The paint-battle look: glossy splats with drips and droplets. A white blob
// on a transparent canvas, tinted by each material's colour.
export function splatTexture(seed, pattern = 'splat') {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const g = canvas.getContext('2d'), r = rng(seed); g.fillStyle = g.strokeStyle = '#fff'; g.lineCap = 'round';
  g.beginPath(); g.arc(128, 128, 58, 0, Math.PI * 2); g.fill();
  for (let i = 0; i < 11; i++) {
    const a = r() * Math.PI * 2, d = 46 + r() * 44, size = 12 + r() * 24, x = 128 + Math.cos(a) * d, y = 128 + Math.sin(a) * d;
    g.lineWidth = size * 1.3; g.beginPath(); g.moveTo(128, 128); g.lineTo(x, y); g.stroke();
    g.beginPath(); g.arc(x, y, size, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 10; i++) { const a = r() * Math.PI * 2, d = 100 + r() * 24; g.beginPath(); g.arc(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 3 + r() * 6, 0, Math.PI * 2); g.fill(); }
  if(pattern === 'stripe' || pattern === 'dots') { g.clearRect(0,0,256,256); for(let i=0;i<5;i++) { if(pattern==='stripe') {g.fillRect(32,40+i*36,192,18);} else {for(let j=0;j<5;j++){g.beginPath();g.arc(40+i*42,40+j*42,12,0,Math.PI*2);g.fill();}} } }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}
// Warm stone paving for the court, like the plaza's slabs.
export function pavingTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const g = canvas.getContext('2d'), r = rng(51), stones = ['#ecd09f', '#e6c690', '#f0d6a8', '#e2bf8b', '#eccb97'];
  g.fillStyle = '#c99f6e'; g.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 8; y++) for (let x = -1; x < 8; x++) {
    const ox = (y % 2) * 32; g.fillStyle = stones[Math.floor(r() * stones.length)];
    g.beginPath(); g.roundRect(x * 64 + ox + 3, y * 64 + 3, 58, 58, 7); g.fill();
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(4.6, 4.6); texture.anisotropy = 4; return texture;
}

// A team's pop-up canopy: four poles and a square peaked roof in the team colour.
// Ground origin; the poles stand at ±size/2.
export function teamCanopy({ color = '#f28b42', size = 5.2, height = 2.9 } = {}) {
  const root = new THREE.Group(), cloth = new THREE.MeshStandardMaterial({ color, roughness: .75, side: THREE.DoubleSide }), pole = new THREE.MeshStandardMaterial({ color: '#d8d8d8', metalness: .4, roughness: .4 });
  const add = (geometry, material, x, y, z) => { const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; root.add(mesh); return mesh; };
  const half = size / 2;
  for (const x of [-half, half]) for (const z of [-half, half]) add(new THREE.CylinderGeometry(.045, .05, height, 8), pole, x, height / 2, z);
  add(new THREE.ConeGeometry(half * Math.SQRT2, 1.3, 4, 1, true), cloth, 0, height + .65, 0).rotation.y = Math.PI / 4;
  // A short valance hangs round the edge.
  for (const [x, z, turn] of [[0, -half, 0], [0, half, 0], [-half, 0, 1], [half, 0, 1]]) add(new THREE.BoxGeometry(size, .28, .03), cloth, x, height - .1, z).rotation.y = turn * Math.PI / 2;
  const result = bake(root); const geometry = new Set(); root.traverse(o => { if (o.geometry) geometry.add(o.geometry); }); geometry.forEach(g => g.dispose());
  result.name = 'Toldo de equipo'; return result;
}

// A run of stacked sandbags, fitted to a w × h × d box (long side along X). Ground origin.
export function sandbagWall({ w = 6, h = .7, d = .8, seed = 1 } = {}) {
  const root = new THREE.Group(), r = rng(seed), rows = Math.max(1, Math.round(h / .23)), per = Math.max(1, Math.round(w / .62));
  const tones = ['#b8a070', '#a99063', '#c2ab7c'].map(color => new THREE.MeshStandardMaterial({ color, roughness: .95 }));
  const bag = new RoundedBoxGeometry(1, 1, 1, 2, .3);
  for (let row = 0; row < rows; row++) for (let i = 0; i < per - (row % 2); i++) {
    const mesh = new THREE.Mesh(bag, tones[Math.floor(r() * 3)]), length = w / per;
    mesh.scale.set(length * 1.02, h / rows * 1.05, d * (.9 + r() * .1));
    mesh.position.set(-w / 2 + length * (i + .5 + (row % 2) / 2), h / rows * (row + .5), (r() - .5) * .06); mesh.rotation.y = (r() - .5) * .08;
    mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
  }
  const result = bake(root); bag.dispose();
  result.name = 'Sacos de arena'; return result;
}
