// Scenery and props shared by every game: low-poly, flat-shaded, built in
// code (no asset files). Each builder returns a THREE.Object3D that sits on
// y = 0 and faces +Z. Anything with userData.tick(t, dt) wants animating.

import * as THREE from 'three';

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

// Deterministic rng so scenery looks the same on every load.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function venezuelaFlag() {
  return canvasMat(192, 128, (g) => {
    g.fillStyle = '#ffcc00';
    g.fillRect(0, 0, 192, 43);
    g.fillStyle = '#00247d';
    g.fillRect(0, 43, 192, 42);
    g.fillStyle = '#cf142b';
    g.fillRect(0, 85, 192, 43);
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 8; i++) {
      const a = Math.PI * (0.18 + 0.64 * i / 7);
      g.beginPath();
      g.arc(96 - Math.cos(a) * 34, 78 - Math.sin(a) * 26, 3.4, 0, Math.PI * 2);
      g.fill();
    }
  });
}

// ---------- mango (Derrape's item, Bululú's everything) ----------
const mat = (color) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.7 });
const GOLD = new THREE.MeshStandardMaterial({ color: 0xffc629, emissive: 0xc77800, emissiveIntensity: 0.55, metalness: 0.5, roughness: 0.35, flatShading: true });

function makeMango({ gold = false } = {}) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), gold ? GOLD : mat(0xffae2b));
  body.scale.set(0.9, 0.85, 1.25);
  const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), gold ? GOLD : mat(0xe8452c));
  cheek.position.set(0.12, 0.14, 0.18);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.22, 5), mat(0x6b4226));
  stem.position.set(0, 0.42, -0.42);
  const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.6, 4), mat(0x3a9d3a));
  leaf.scale.set(1, 1, 0.35);
  leaf.position.set(0.18, 0.55, -0.5);
  leaf.rotation.z = -1.1;
  g.add(body, cheek, stem, leaf);
  for (const m of g.children) m.castShadow = true;
  g.scale.setScalar(1.5);
  return g;
}

// ---------- scenery ----------
// Big wooden billboard: one line, a name + subtitle, or several short lines.
function woodSign(lines, { w = 9, h = 4.4 } = {}) {
  const g = new THREE.Group();
  const wood = M(0x6b4226, { roughness: 0.9 });
  g.add(box(0.5, h + 1.6, 0.5, wood, -w / 2 + 0.6, (h + 1.6) / 2, 0));
  g.add(box(0.5, h + 1.6, 0.5, wood, w / 2 - 0.6, (h + 1.6) / 2, 0));
  const panel = canvasMat(512, 256, (ctx) => {
    ctx.fillStyle = '#7a4a2b';
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = '#4a2c17';
    ctx.lineWidth = 10;
    for (const y of [8, 90, 172, 248]) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const [top, bottom] = lines;
    ctx.font = '96px "Luckiest Guy", system-ui, sans-serif';
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#16161a';
    if (lines.length > 2) {
      const size = Math.min(72, 230 / lines.length);
      ctx.font = `${size}px "Luckiest Guy", system-ui, sans-serif`;
      ctx.lineWidth = size / 7;
      lines.forEach((line, i) => {
        const y = 128 + (i - (lines.length - 1) / 2) * size * 1.05;
        ctx.fillStyle = i === lines.length - 1 ? '#ffd23f' : '#fdf6e3';
        ctx.strokeText(line, 256, y);
        ctx.fillText(line, 256, y);
      });
    } else if (bottom) {
      ctx.fillStyle = '#fdf6e3';
      ctx.strokeText(top, 256, 82);
      ctx.fillText(top, 256, 82);
      ctx.fillStyle = '#ffd23f';
      ctx.strokeText(bottom, 256, 180);
      ctx.fillText(bottom, 256, 180);
    } else {
      ctx.fillStyle = '#ffd23f';
      ctx.strokeText(top, 256, 136);
      ctx.fillText(top, 256, 136);
    }
  });
  const board = mesh(new THREE.BoxGeometry(w, h, 0.3), panel, 0, h / 2 + 1.1, 0.1);
  g.add(board);
  return g;
}

function watchtower({ h = 6.5, roof = 'thatch' } = {}) {
  const g = new THREE.Group();
  const wood = M(0x8a5a33, { roughness: 0.9 });
  const dark = M(0x5c3a20, { roughness: 0.9 });
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    g.add(tube([sx * 1.5, 0, sz * 1.5], [sx * 1.05, h, sz * 1.05], 0.14, wood));
  }
  for (const y of [h * 0.35, h * 0.7]) {
    g.add(box(2.6 - y * 0.12, 0.12, 0.12, dark, 0, y, 1.35 - y * 0.1));
    g.add(box(2.6 - y * 0.12, 0.12, 0.12, dark, 0, y, -1.35 + y * 0.1));
    g.add(box(0.12, 0.12, 2.6 - y * 0.12, dark, 1.35 - y * 0.1, y, 0));
    g.add(box(0.12, 0.12, 2.6 - y * 0.12, dark, -1.35 + y * 0.1, y, 0));
  }
  g.add(box(3, 0.25, 3, wood, 0, h, 0));                      // platform
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    g.add(box(0.12, 1.1, 0.12, dark, sx * 1.35, h + 0.55, sz * 1.35));
  }
  g.add(box(2.9, 0.1, 0.1, dark, 0, h + 1.05, 1.35));
  g.add(box(2.9, 0.1, 0.1, dark, 0, h + 1.05, -1.35));
  g.add(box(0.1, 0.1, 2.9, dark, 1.35, h + 1.05, 0));
  g.add(box(0.1, 0.1, 2.9, dark, -1.35, h + 1.05, 0));
  if (roof === 'thatch') {
    const r = mesh(new THREE.ConeGeometry(2.6, 1.5, 4), M(0xc2a35c, { roughness: 1 }), 0, h + 2, 0);
    r.rotation.y = Math.PI / 4;
    g.add(r);
  } else {
    g.add(box(3.4, 0.14, 3.4, M(0xb5462f, { roughness: 0.6 }), 0, h + 1.9, 0));
  }
  return g;
}

// Wooden flag pole with the Venezuelan flag waving.
function flagPole({ h = 9 } = {}) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.12, 0.16, h, 8), M(0x8a8a92, { metalness: 0.4, roughness: 0.5 }), 0, h / 2, 0));
  const flag = new THREE.Group();
  flag.position.set(0, h - 0.8, 0);
  const f = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.7, 6, 1), venezuelaFlag());
  f.position.x = 1.35;
  flag.add(f);
  g.add(flag);
  g.userData.tick = (t) => {
    const pos = f.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      pos.setZ(i, Math.sin(t * 4 + x * 1.8) * 0.12 * (x + 1.3) / 2.6);
    }
    pos.needsUpdate = true;
  };
  return g;
}

// Rocky boulder: a displaced icosahedron.
function rock(r, color = 0x8d8d96, seed = 1) {
  const geo = new THREE.IcosahedronGeometry(r, 1);
  const rand = rng(seed);
  const pos = geo.attributes.position;
  const seen = new Map();
  for (let i = 0; i < pos.count; i++) {
    const key = [pos.getX(i), pos.getY(i), pos.getZ(i)].map((v) => v.toFixed(3)).join(',');
    if (!seen.has(key)) seen.set(key, 0.72 + rand() * 0.5);
    const k = seen.get(key);
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k * 0.75, pos.getZ(i) * k);
  }
  geo.computeVertexNormals();
  return mesh(geo, M(color, { roughness: 1 }));
}

export {
  M, mesh, box, tube, canvasMat, DECAL, rng,
  venezuelaFlag, makeMango,
  woodSign, watchtower, flagPole, rock,
};
