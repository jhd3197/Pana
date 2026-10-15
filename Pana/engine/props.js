// Scenery and props shared by every game: stylized, built in
// code (no asset files). Scenery sits on y = 0 and faces +Z; carried mangoes
// keep their centered origin. Anything with userData.tick(t, dt) wants animating.

import * as THREE from 'three';
import { leafBlade, taperedStem } from './botanical-shapes.js';

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

// The Pana flag: brand purple field, a yellow stripe and a capybara face.
function panaFlag() {
  return canvasMat(192, 128, (g) => {
    g.fillStyle = '#1a1336'; g.fillRect(0, 0, 192, 128);
    g.fillStyle = '#ffc629'; g.fillRect(0, 98, 192, 14);
    g.fillStyle = '#2ad1b2'; g.fillRect(0, 112, 192, 16);
    g.fillStyle = '#cf7d22';
    g.beginPath(); g.ellipse(46, 50, 28, 32, 0, 0, Math.PI * 2); g.fill();
    for (const x of [26, 66]) { g.beginPath(); g.ellipse(x, 22, 7, 8, 0, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#8b5e3c'; g.beginPath(); g.ellipse(46, 66, 18, 13, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#16161a';
    for (const x of [35, 57]) { g.beginPath(); g.arc(x, 46, 3.6, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#ffc629'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '44px "Luckiest Guy", system-ui, sans-serif'; g.fillText('PANA', 132, 54, 104);
  });
}

// ---------- mango (Derrape's item, Bululú's everything) ----------
const mangoBodies = new Map();
function mangoBody(gold) {
  if (!mangoBodies.has(gold)) {
    const geo = new THREE.SphereGeometry(1, 28, 20), pos = geo.attributes.position, colors = [];
    const yellow = new THREE.Color(gold ? 0xffcc47 : 0xffbd32);
    const blush = new THREE.Color(gold ? 0xe69a19 : 0xe94e28);
    const green = new THREE.Color(gold ? 0xffdf75 : 0xc9b640);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const fullness = 1 + y * 0.14 - y * y * 0.08;
      // One continuous, asymmetric fruit with a full shoulder and curved lower tip.
      pos.setXYZ(i, x * 0.46 * fullness + 0.13 * (1 - y * y) - y * 0.09,
        y * 0.55 - x * 0.025, z * 0.42 * (1 + y * 0.07));
      const red = THREE.MathUtils.smoothstep(x * 0.55 + z * 0.72 + y * 0.28, -0.1, 0.85);
      const color = yellow.clone().lerp(blush, red * (gold ? 0.35 : 0.88));
      color.lerp(green, THREE.MathUtils.smoothstep(y, 0.65, 1) * 0.55);
      colors.push(color.r, color.g, color.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geo.computeVertexNormals();
    mangoBodies.set(gold, geo);
  }
  // Callers dispose their own geometry; templates are never mounted in a scene.
  return mangoBodies.get(gold).clone();
}

function makeMango({ gold = false } = {}) {
  const g = new THREE.Group();
  const skin = M(0xffffff, { vertexColors: true, flatShading: false,
    roughness: gold ? 0.32 : 0.46, metalness: gold ? 0.72 : 0,
    emissive: gold ? 0xb66c09 : 0, emissiveIntensity: gold ? 0.08 : 0 });
  const wood = M(gold ? 0x98702c : 0x6b472a, { flatShading: false, roughness: 0.85 });
  const green = M(0xffffff, { vertexColors: true, side: THREE.DoubleSide, flatShading: false, roughness: 0.72 });
  const body = mesh(mangoBody(gold), skin); body.name = 'mango-body';
  g.add(body, mesh(taperedStem([[-0.09, 0.53, 0], [-0.12, 0.65, -0.02], [-0.06, 0.74, -0.035]], 0.038, 0.027, 6, 7), wood));
  const leaf = mesh(leafBlade(0.64, 0.16, 0.13, gold ? 0x859d39 : 0x559936), green, -0.1, 0.65, -0.015);
  leaf.rotation.set(0.2, -0.3, 0.15); g.add(leaf);
  const vein = mesh(taperedStem([[0, 0.006, 0], [0.3, 0.115, 0], [0.62, -0.067, 0]], 0.009, 0.002, 6, 4), M(0xb0bd59, { flatShading: false }));
  leaf.add(vein);
  // Keep the historic centered origin and root scale used by held/thrown fruit.
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

// Flag pole with the Venezuelan (default) or Pana flag waving.
function flagPole({ h = 9, flag: design = 'venezuela' } = {}) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.12, 0.16, h, 8), M(0x8a8a92, { metalness: 0.4, roughness: 0.5 }), 0, h / 2, 0));
  const flag = new THREE.Group();
  flag.position.set(0, h - 0.8, 0);
  const fabric = design === 'pana' ? panaFlag() : venezuelaFlag();
  fabric.side = THREE.DoubleSide;
  const f = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.7, 20, 10), fabric);
  const rest = f.geometry.attributes.position.array.slice();
  f.position.x = 1.35;
  flag.add(f);
  g.add(flag);
  const cord = M(0xd4c9ab, { roughness: 1 });
  g.add(tube([0.18, 1.1, 0], [0.18, h - 0.03, 0], 0.012, cord));
  g.add(tube([0.18, 1.1, 0], [0.23, 1.35, 0], 0.022, cord));
  g.add(mesh(new THREE.SphereGeometry(0.18, 12, 8), M(0xc4ad75, { metalness: 0.55, roughness: 0.4 }), 0, h, 0));
  g.userData.tick = (t) => {
    const pos = f.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = rest[i * 3], y = rest[i * 3 + 1], u = (x + 1.3) / 2.6;
      pos.setXYZ(i, x - 0.07 * u * u, y - 0.13 * u * u + Math.sin(t * 2.4 + x * 2 + y) * 0.025 * u,
        (Math.sin(t * 3.2 - u * 6.3 + y * 0.65) * 0.17 + Math.sin(t * 5 - u * 11) * 0.045) * u);
    }
    pos.needsUpdate = true;
    f.geometry.computeVertexNormals();
  };
  g.userData.tick(0);
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
  venezuelaFlag, panaFlag, makeMango,
  woodSign, watchtower, flagPole, rock,
};
