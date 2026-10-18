import * as THREE from 'three';
import { rng } from '../core/primitives.js';

// Owned resources, ground origin, metres, long axis Z. No gameplay state here.
export function criollasCourt({ width = 11, length = 24 } = {}) {
  const group = new THREE.Group(); group.name = 'Cancha de bolas criollas';
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const c = canvas.getContext('2d'), r = rng(82);
  c.fillStyle = '#cf9567'; c.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 18000; i++) {
    c.fillStyle = i % 2 ? `rgba(91,51,26,${.04 + r() * .13})` : `rgba(255,227,179,${.1 + r() * .2})`;
    c.fillRect(r() * 512, r() * 512, 1 + r() * 2, 1 + r() * 2);
  }
  for (let i = 0; i < 45; i++) { c.strokeStyle = 'rgba(115,69,36,.10)'; c.beginPath(); c.ellipse(r() * 512, r() * 512, 15 + r() * 55, 2 + r() * 8, r(), 0, Math.PI); c.stroke(); }
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(3, 6); tex.anisotropy = 4;
  const dirt = new THREE.MeshStandardMaterial({ map: tex, roughness: 1 });
  const border = new THREE.MeshStandardMaterial({ color: '#ad5d42', roughness: .95 });
  const chalk = new THREE.MeshStandardMaterial({ color: '#fff0cb', roughness: 1 });
  const wood = new THREE.MeshStandardMaterial({ color: '#684b37', roughness: .9 });
  function box(w, h, d, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true; group.add(m); return m;
  }
  box(width + 1.1, .24, length + 1.1, border, 0, -.16, 0);
  box(width, .1, length, dirt, 0, -.05, 0);
  for (const side of [-1, 1]) {
    box(.045, .013, length, chalk, side * (width / 2 - .02), .009, 0);
    box(width, .013, .045, chalk, 0, .009, side * (length / 2 - .02));
    box(.25, .35, length + .9, border, side * (width / 2 + .45), .06, 0);
    // Benches remain outside the playable court and camera sight line.
    for (const z of [-5, 3]) {
      box(1.1, .16, 3.6, wood, side * (width / 2 + 2.2), .7, z);
      box(.14, 1.15, 3.6, wood, side * (width / 2 + 2.65), 1.15, z);
      for (const dz of [-1.25, 1.25]) box(.65, .7, .15, wood, side * (width / 2 + 2.2), .35, z + dz);
    }
  }
  box(2, .016, .05, chalk, 0, .012, 10.6);
  for (const x of [-1, 1]) box(.05, .016, .7, chalk, x, .012, 10.95);
  group.userData.previewBounds = [[-9, -.3, -13], [9, 2, 13]];
  let disposed = false;
  group.userData.dispose = () => { if (disposed) return; disposed = true; group.traverse(o => o.geometry?.dispose()); [dirt, border, chalk, wood].forEach(m => m.dispose()); tex.dispose(); };
  return group;
}

export function criollaBall({ color = '#ed5949', radius = .25, stripe = false } = {}) {
  const group = new THREE.Group(); group.name = 'Bola criolla';
  const material = new THREE.MeshStandardMaterial({ color, roughness: .31, metalness: .08 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 16), material);
  ball.castShadow = ball.receiveShadow = true; group.add(ball);
  const trim = new THREE.MeshStandardMaterial({ color: '#fff0cb', roughness: .65 });
  // A second stripe distinguishes teammates without replacing team colors.
  for (const y of stripe ? [-.075, .075] : [0]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(Math.sqrt(radius ** 2 - y ** 2) + .001, .008, 5, 48), trim);
    ring.rotation.x = Math.PI / 2; ring.position.y = y; group.add(ring);
  }
  let disposed = false;
  group.userData.dispose = () => { if (disposed) return; disposed = true; group.traverse(o => o.geometry?.dispose()); material.dispose(); trim.dispose(); };
  return group;
}
