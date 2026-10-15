import * as THREE from 'three';
import { M, mesh, box, canvasMat } from '/engine/models/core/primitives.js';
import { bush } from '/engine/models/vegetation/bush.js';
import { bake } from '/engine/models/core/static-batch.js';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { addWaterMotion } from '/engine/models/effects/water-details.js';

function lettering(words, color = '#fff0ca', bg = '#387c82', w = 4, h = 1.1) {
  return mesh(new THREE.PlaneGeometry(w, h), canvasMat(768, 192, ctx => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 768, 192);
    ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.strokeRect(12, 12, 744, 168);
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 64px Nunito, sans-serif'; ctx.fillText(words, 384, 100, 710);
  }));
}

export function house({ w = 7, h = 6, color = 0xe5b965, seed = 1, label = '' } = {}) {
  const g = new THREE.Group(), wall = M(color), trim = M(0xffe8b7), dark = M(0x51463d), tile = M(0xc76540);
  g.add(box(w, h, 5.4, wall, 0, h / 2, 0));
  g.add(box(w + 0.12, 0.45, 5.5, M(0xd2976e), 0, 0.225, 0));
  g.add(box(w + 0.35, 0.22, 5.7, trim, 0, h - 0.15, 0));
  for (const side of [-1, 1]) {
    const roof = box(w + 0.85, 0.22, 3.35, tile, 0, h + 0.45, side * 1.55);
    roof.rotation.x = side * 0.25;
    g.add(roof);
    for (let x = -w / 2 - 0.1; x < w / 2 + 0.4; x += 0.46) {
      const row = mesh(new THREE.CylinderGeometry(0.18, 0.2, 3.38, 7, 1, true, 0, Math.PI), M((Math.round(x * 7) + seed) % 2 ? 0xd27b4c : 0xbc593a), x, h + 0.55, side * 1.55);
      row.rotation.x = Math.PI / 2 + side * 0.25;
      g.add(row);
    }
  }
  g.add(box(1.65, 2.8, 0.18, trim, 0, 1.4, 2.77));
  g.add(box(1.3, 2.55, 0.2, dark, 0, 1.28, 2.9));
  for (let x = -0.48; x < 0.6; x += 0.24) g.add(box(0.025, 2.4, 0.05, M(0x8c6644), x, 1.25, 3.02));
  for (const x of [-w * 0.31, w * 0.31]) {
    for (const y of (h > 6 ? [2.15, 5] : [2.5])) {
      g.add(box(1.35, 1.6, 0.14, trim, x, y, 2.77));
      g.add(box(1.02, 1.32, 0.18, dark, x, y, 2.88));
      for (const s of [-1, 1]) g.add(box(0.42, 1.45, 0.12, M(seed % 2 ? 0x477d80 : 0x985c40), x + s * 0.73, y, 2.92));
      g.add(box(1.55, 0.17, 0.5, trim, x, y - 0.82, 2.95));
      if (y > 3) {
        g.add(box(1.35, 0.38, 0.38, M(0xba624b), x, y - 0.62, 3.08));
        const flowers = bush({ seed, flowers: true }); flowers.scale.set(0.6, 0.5, 0.4); flowers.position.set(x, y - 0.45, 3.12); g.add(flowers);
      }
    }
  }
  if (label) { const sign = lettering(label, '#ffedb7', seed % 2 ? '#3b7474' : '#a04b36', w * 0.7, 0.85); sign.position.set(0, 3.9, 2.84); g.add(sign); }
  return g;
}

export function church() {
  const g = house({ w: 8.5, h: 7.8, color: 0xf2c76e, seed: 3 });
  const tower = new THREE.Group(); tower.position.set(2.3, 7.8, -0.5);
  tower.add(box(3.3, 4.3, 3.3, M(0xf3cd83), 0, 1.7, 0));
  tower.add(box(3.65, 0.25, 3.65, M(0xffe3ae), 0, 3.8, 0));
  tower.add(mesh(new THREE.ConeGeometry(2.55, 2.1, 4), M(0xc76b44), 0, 4.9, 0));
  tower.rotation.y = 0;
  tower.add(box(1.35, 2, 0.05, M(0x5c503d), 0, 2.15, 1.68));
  tower.add(mesh(new THREE.CylinderGeometry(0.4, 0.65, 0.8, 10), M(0xa18442, { metalness: 0.4 }), 0, 2.15, 1.7));
  tower.add(box(0.18, 1.6, 0.18, M(0x86543d), 0, 6.5, 0));
  tower.add(box(1, 0.18, 0.18, M(0x86543d), 0, 6.65, 0));
  g.add(tower);
  const sign = lettering('PLAZA PANA', '#fff1cb', '#b26644', 4.6, 0.85); sign.position.set(-0.5, 5.2, 2.81); g.add(sign);
  return g;
}

// The plaza's crowned-capybara fountain as a standalone landmark.
export function plazaFountain() {
  const f = fountain(), out = bake(f.group);
  f.capy.dispose(); f.group.traverse(o => o.geometry?.dispose());
  out.userData.tick = addWaterMotion(out, f.impacts, f.curves);
  return out;
}

export function fountain() {
  const g = new THREE.Group(), stone = M(0xe5caa0), rim = M(0xf6dfb8);
  g.add(mesh(new THREE.CylinderGeometry(3.1, 3.3, 0.3, 16), stone, 0, 0.15, 0));
  g.add(mesh(new THREE.CylinderGeometry(2.88, 3.02, 0.55, 16), rim, 0, 0.46, 0));
  const water = mesh(new THREE.CylinderGeometry(2.65, 2.65, 0.05, 32), M(0x47bec1, { metalness: 0.15, roughness: 0.25 }), 0, 0.76, 0); g.add(water);
  // Rounded coping and a glazed mosaic frieze around the existing footprint.
  const glaze = M(0x398f88, { roughness: 0.42 }), trim = M(0xf6dfb8, { flatShading: false, roughness: 0.8 });
  for (const [radius, y, thickness] of [[2.84, 0.74, 0.1], [1.48, 2.42, 0.07]]) {
    const ring = mesh(new THREE.TorusGeometry(radius, thickness, 6, 48), trim, 0, y, 0); ring.rotation.x = Math.PI / 2; g.add(ring);
  }
  for (let i = 0; i < 48; i++) {
    const a = i * Math.PI / 24, tile = box(0.18, 0.15, 0.045, i % 3 ? glaze : trim, Math.sin(a) * 2.94, 0.48, Math.cos(a) * 2.94);
    tile.rotation.y = a; g.add(tile);
  }
  g.add(mesh(new THREE.CylinderGeometry(0.8, 1.05, 1.8, 8), stone, 0, 1.35, 0));
  g.add(mesh(new THREE.CylinderGeometry(1.6, 1.3, 0.24, 12), rim, 0, 2.3, 0));
  g.add(mesh(new THREE.CylinderGeometry(1.42, 1.42, 0.03, 24), M(0x69d2d0), 0, 2.44, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.65, 0.8, 1.2, 8), stone, 0, 2.9, 0));
  const capy = buildCharacter({ fur: '#e8b97f', hat: 'corona', glasses: 'none', outfit: 'nada', face: 'feliz' });
  capy.group.position.y = 3.5; capy.group.scale.setScalar(1.15); g.add(capy.group);
  const streams = new THREE.Group(), curves = [], impacts = [];
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(Math.cos(a) * 1.35, 2.4, Math.sin(a) * 1.35), new THREE.Vector3(Math.cos(a) * 2.2, 2.2, Math.sin(a) * 2.2), new THREE.Vector3(Math.cos(a) * 2.35, 0.8, Math.sin(a) * 2.35));
    curves.push(curve); impacts.push([Math.cos(a) * 2.35, 0.8, Math.sin(a) * 2.35, 0.2]);
    streams.add(mesh(new THREE.TubeGeometry(curve, 10, 0.045, 4, false), M(0x91e5e1, { transparent: true, opacity: 0.75 })));
  }
  g.add(streams);
  return { group: g, streams, water, capy, curves, impacts };
}
