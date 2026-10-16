// Reusable Venezuelan food and market-kitchen objects. All models face +Z.
import * as THREE from 'three';
import { M, mesh, box, tube, canvasMat } from '/engine/models/core/primitives.js';
const cream = M('#fff1cd'), wood = M('#bc743d'), darkWood = M('#74452b'), steel = M('#b4bac0', { metalness: 0.45, roughness: 0.4 }), iron = M('#30313a');
const disk = (r, h, color, x = 0, y = 0, z = 0) => mesh(new THREE.CylinderGeometry(r, r, h, 24), M(color), x, y, z);

export function corn() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CapsuleGeometry(0.18, 0.6, 3, 9), M('#f7c52e'), 0, 0.42, 0));
  for (let j = 0; j < 6; j++) for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2;
    g.add(mesh(new THREE.SphereGeometry(0.058, 5, 4), M(j % 2 ? '#ffe17b' : '#f6b936'), Math.cos(a) * 0.18, 0.12 + j * 0.12, Math.sin(a) * 0.18));
  }
  for (const s of [-1, 1]) { const leaf = mesh(new THREE.ConeGeometry(0.17, 0.9, 4), M('#629c32'), s * 0.17, 0.35, 0); leaf.rotation.z = s * -0.3; leaf.scale.z = 0.3; g.add(leaf); }
  return g;
}
export function cheese() {
  const g = new THREE.Group(); g.add(box(0.7, 0.32, 0.5, M('#ffe18a'), 0, 0.16, 0));
  for (const [x, z] of [[-0.2, 0.12], [0.1, -0.1], [0.2, 0.15]]) g.add(disk(0.055, 0.006, '#dbaa46', x, 0.324, z));
  return g;
}
function plate() { const g = new THREE.Group(); g.add(disk(0.82, 0.09, '#e8e6df', 0, 0.05)); g.add(disk(0.71, 0.04, '#fffaf0', 0, 0.11)); return g; }
function toasted(g, radius = 0.58, y = 0.4) {
  for (let i = 0; i < 9; i++) { const a = i * 2.4, r = radius * Math.sqrt((i + 1) / 12); const spot = disk(0.055 + i % 3 * 0.02, 0.008, '#a76422', Math.cos(a) * r, y, Math.sin(a) * r); spot.scale.z = 0.6; g.add(spot); }
}
export function food(id = 'arepa', { stage = 'cooked', plated = true } = {}) {
  const g = new THREE.Group(); if (plated) g.add(plate());
  const y = plated ? 0.14 : 0.02;
  if (stage === 'raw') {
    const basket = box(1.25, 0.25, 0.8, wood, 0, y + 0.12, 0); g.add(basket);
    if (id === 'cachapa') { const c = corn(); c.rotation.z = 1.1; c.position.set(0.1, y + 0.35, 0); g.add(c); }
    else for (const x of [-0.3, 0.15]) { const dough = mesh(new THREE.SphereGeometry(0.25, 12, 8), cream, x, y + 0.35, 0); dough.scale.y = 0.55; g.add(dough); }
    const q = id === 'empanada' ? mesh(new THREE.IcosahedronGeometry(0.24, 1), M('#a84c37')) : cheese(); q.scale.setScalar(0.65); q.position.set(0.35, y + 0.3, 0.12); g.add(q); return g;
  }
  const raw = stage === 'prepared', burnt = stage === 'burnt', gold = burnt ? '#4d3026' : raw ? '#f5dda2' : '#f3b849';
  if (id === 'arepa') {
    g.add(disk(0.62, 0.15, gold, 0, y + 0.08));
    if (!raw) {
      const lettuce = disk(0.64, 0.05, burnt ? '#47362a' : '#629b35', 0, y + 0.19); lettuce.scale.z = 0.92; g.add(lettuce);
      g.add(disk(0.57, 0.09, burnt ? '#47362a' : '#ac4432', 0, y + 0.24));
      g.add(box(0.95, 0.04, 0.9, cream, 0, y + 0.3, 0));
    }
    g.add(disk(0.62, 0.16, gold, 0, y + 0.37)); if (!raw && !burnt) toasted(g, 0.57, y + 0.455);
  } else if (id === 'cachapa') {
    g.add(disk(0.7, 0.12, gold, 0, y + 0.06));
    g.add(box(1, 0.08, 0.65, cream, 0, y + 0.15, 0.1));
    const top = mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.13, 24, 1, false, -Math.PI / 2, Math.PI), M(gold), 0, y + 0.24, 0); g.add(top);
    if (!raw && !burnt) toasted(g, 0.5, y + 0.31);
  } else if (id === 'tequenos') {
    for (let i = 0; i < 3; i++) {
      const roll = new THREE.Group(); roll.add(mesh(new THREE.CapsuleGeometry(0.16, 0.7, 3, 10), M(gold)));
      for (let j = 0; j < 4; j++) { const band = mesh(new THREE.TorusGeometry(0.162, 0.018, 4, 12), M(burnt ? '#35251d' : '#ce8c30'), 0, -0.27 + j * 0.18, 0); band.rotation.x = Math.PI / 2 - 0.15; roll.add(band); }
      roll.rotation.set(Math.PI / 2, 0, -0.3); roll.position.set((i - 1) * 0.37, y + 0.2 + (i === 1 ? 0.12 : 0), 0); g.add(roll);
    }
  } else {
    for (const [x, z, turn] of [[-0.24, 0.05, -0.35], [0.27, -0.1, 0.2]]) {
      const e = new THREE.Group();
      e.add(mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.12, 24, 1, false, -Math.PI / 2, Math.PI), M(gold), 0, 0.07, 0));
      const puff = mesh(new THREE.SphereGeometry(0.55, 20, 10, 0, Math.PI, 0, Math.PI / 2), M(gold), 0, 0.1, 0); puff.scale.y = 0.55; e.add(puff);
      for (let i = 0; i < 12; i++) { const a = -Math.PI / 2 + i / 11 * Math.PI; e.add(mesh(new THREE.SphereGeometry(0.065, 6, 4), M(gold), Math.sin(a) * 0.52, 0.15, Math.cos(a) * 0.52)); }
      e.position.set(x, y, z); e.rotation.y = turn; g.add(e);
    }
  }
  return g;
}
export function kitchenSign(text, width = 2.5, color = '#286c66') {
  return mesh(new THREE.PlaneGeometry(width, width * 0.25), canvasMat(512, 128, ctx => {
    ctx.fillStyle = color; ctx.fillRect(0, 0, 512, 128); ctx.strokeStyle = '#fff0c9'; ctx.lineWidth = 5; ctx.strokeRect(9, 9, 494, 110);
    ctx.font = '900 48px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff0c9'; ctx.fillText(text, 256, 65, 475);
  }));
}
export function kitchenStation(def) {
  const g = new THREE.Group(), top = 1.35;
  if (def.type === 'trash') {
    g.add(mesh(new THREE.CylinderGeometry(0.65, 0.5, 1.25, 10), M('#62817d'), 0, 0.63));
    g.add(disk(0.68, 0.13, '#344e52', 0, 1.3)); const lid = disk(0.23, 0.07, '#132e32', 0, 1.38); g.add(lid); return g;
  }
  g.add(box(def.w, 1.12, def.d, def.type === 'stove' ? steel : wood, 0, 0.62, 0));
  g.add(box(def.w + 0.16, 0.18, def.d + 0.15, def.type === 'stove' ? iron : M('#dfac69'), 0, top, 0));
  for (const x of [-def.w / 2 + 0.16, def.w / 2 - 0.16]) {
    g.add(box(0.18, 0.4, def.d, darkWood, x, 0.2, 0));
    if (def.type !== 'stove') g.add(box(0.08, 0.85, 0.03, darkWood, x, 0.7, def.d / 2 + 0.01));
  }
  if (def.type === 'supply') {
    g.add(box(def.w - 0.25, 0.15, def.d - 0.25, darkWood, 0, 1.5, 0));
    for (const z of [-0.83, 0.83]) g.add(box(def.w - 0.1, 0.36, 0.08, wood, 0, 1.7, z));
    for (const x of [-1.18, 1.18]) g.add(box(0.1, 0.36, 1.6, wood, x, 1.7, 0));
    for (let i = 0; i < 5; i++) {
      const o = def.recipe === 'cachapa' ? corn() : def.recipe === 'empanada' ? mesh(new THREE.IcosahedronGeometry(0.3, 1), M('#a9523d')) : mesh(new THREE.SphereGeometry(0.31, 10, 7), cream);
      o.position.set(-0.7 + i % 3 * 0.65, def.recipe === 'cachapa' ? 1.63 : 1.85, -0.35 + Math.floor(i / 3) * 0.65); if (def.recipe === 'cachapa') o.rotation.z = 0.6; else o.scale.y = 0.65; g.add(o);
    }
    const q = cheese(); q.position.set(0.7, 1.78, 0.4); g.add(q);
    const sign = kitchenSign(def.label.toUpperCase(), 2.2); sign.position.set(0, 0.86, def.d / 2 + 0.02); g.add(sign);
  } else if (def.type === 'prep') {
    g.add(box(1.85, 0.08, 1.4, M('#f4d39a'), 0, 1.48, 0));
    const knife = new THREE.Group(); knife.add(box(0.12, 0.06, 0.55, steel, 0, 0, -0.15)); knife.add(box(0.13, 0.1, 0.35, darkWood, 0, 0, 0.3)); knife.position.set(1.1, 1.55, 0); knife.rotation.y = 0.3; g.add(knife);
    const towel = box(0.55, 0.04, 1.3, M('#62a5b2'), -1, 1.48, 0.4); g.add(towel);
    const edge = box(0.55, 0.5, 0.04, M('#62a5b2'), -1, 1.22, 1.08); g.add(edge);
  } else if (def.type === 'stove') {
    g.add(box(def.w - 0.55, 0.61, 0.06, iron, 0, 0.64, def.d / 2 + 0.02));
    g.add(box(def.w - 0.8, 0.08, 0.11, steel, 0, 0.96, def.d / 2 + 0.1));
    for (const x of [-0.8, 0, 0.8]) { const dial = disk(0.11, 0.07, '#d84e39'); dial.rotation.x = Math.PI / 2; dial.position.set(x, 1.15, def.d / 2 + 0.08); g.add(dial); }
    for (const x of [-0.65, 0.65]) for (const z of [-0.5, 0.5]) {
      g.add(disk(0.32, 0.08, '#171c27', x, 1.5, z)); g.add(box(0.8, 0.04, 0.06, steel, x, 1.55, z)); g.add(box(0.06, 0.04, 0.8, steel, x, 1.55, z));
    }
    g.add(disk(0.85, 0.1, '#141e25', 0, 1.65)); g.add(box(0.25, 0.12, 0.75, iron, 0, 1.68, 1.05));
  } else if (def.type === 'serve') {
    const sign = kitchenSign('¡BUEN PROVECHO!', 4.6, '#a84632'); sign.position.set(0, 0.77, def.d / 2 + 0.02); g.add(sign);
    for (const x of [-2.1, 2.1]) { g.add(disk(0.24, 0.06, '#343441', x, 1.5, 0)); g.add(mesh(new THREE.SphereGeometry(0.2, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), steel, x, 1.53, 0)); }
    for (let i = 0; i < 5; i++) { const p = plate(); p.scale.setScalar(0.65); p.position.set(-1.2, 1.48 + i * 0.06, 0); g.add(p); }
    const meal = food('arepa'); meal.position.set(1.05, 1.5, 0); g.add(meal);
  } else {
    const sign = kitchenSign('PARA TU PANA', 2.4); sign.position.set(0, 0.8, def.d / 2 + 0.03); g.add(sign);
  }
  return g;
}
export function sink() {
  const g = new THREE.Group(); g.add(box(3, 1.2, 1.9, steel, 0, 0.6, 0));
  g.add(box(2.6, 0.06, 1.5, M('#52767e'), 0, 1.22, 0));
  for (const x of [-1.4, 1.4]) g.add(box(0.2, 0.17, 1.8, steel, x, 1.3, 0));
  for (const z of [-0.85, 0.85]) g.add(box(3, 0.17, 0.2, steel, 0, 1.3, z));
  g.add(tube([0, 1.3, -0.7], [0, 2.3, -0.7], 0.075, steel)); g.add(tube([0, 2.3, -0.7], [0, 2.3, 0], 0.075, steel));
  return g;
}
