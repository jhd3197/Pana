import * as THREE from 'three';
import { rng } from '../../random.js';

const mats = new Map();
function M(color, extra = {}) {
  const key = color + JSON.stringify(extra);
  if (!mats.has(key)) {
    mats.set(key, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.65, ...extra }));
  }
  return mats.get(key);
}

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

const box = (w, h, d, mat, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);

function tube(a, b, r, mat) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const m = mesh(new THREE.CylinderGeometry(r, r, va.distanceTo(vb), 8), mat);
  m.position.copy(va).add(vb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  return m;
}

// decals sit flush on what they're stuck to without flickering
const DECAL = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 };

function canvasMat(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, transparent: true, ...DECAL });
}

// A tiling texture painted on a canvas: draw(ctx, w, h). srgb for colour maps
// (false for data such as bump maps); owned collects it for the caller's dispose.
function canvasTexture(w, h, draw, { srgb = true, owned = null } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  owned?.push(t);
  return t;
}

// Deterministic rng so scenery looks the same on every load (engine/random.js).


export { M, mesh, box, tube, canvasMat, canvasTexture, rng };
