import * as THREE from 'three';
import { M, mesh, box, canvasMat } from '/engine/models/core/primitives.js';
import { bake } from '/engine/models/core/static-batch.js';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { addWaterMotion } from '/engine/models/effects/water-details.js';
import { colonialHouse } from './colonial-house.js';
import { clamp } from '../../random.js';

function lettering(words, color = '#fff0ca', bg = '#387c82', w = 4, h = 1.1) {
  return mesh(new THREE.PlaneGeometry(w, h), canvasMat(768, 192, ctx => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 768, 192);
    ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.strokeRect(12, 12, 744, 168);
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 64px Nunito, sans-serif'; ctx.fillText(words, 384, 100, 710);
  }));
}

// Every street house is a colonial-house recipe (colonial-house.js), so the
// maker's windows, roofs and wall finishes reach every plaza and circuit
// that calls house(). Same 5.4 m deep shell and ground origin as before;
// the style picks the family and roof, the seed the finish and details.
const STYLES = ['tejas', 'balcon', 'tienda', 'terraza'];
const FINISHES = ['ladrillo-visto', 'ladrillo-pintado', 'cal', 'ladrillo-visto', 'ladrillo-pintado'];
export function house({ w = 7, h = 6, color = 0xe5b965, seed = 1, label = '', style, detail = 'game' } = {}) {
  style = STYLES.includes(style) ? style : STYLES[((seed % 4) + 4) % 4];
  const s = Math.abs(Math.floor(seed)) >>> 0, floors = h > 6 ? 2 : 1;
  const family = style === 'balcon' ? (floors === 2 ? 'casa-balcon' : 'casa-remate')
    : style === 'tienda' ? (floors === 1 ? 'casa-portal' : 'casa-esquina')
      : style === 'terraza' ? 'casa-remate' : 'casa-baja';
  const g = colonialHouse({
    seed: s, family, floors, width: clamp(w, 5.8, 12), depth: 5.4, floorHeight: clamp((h - 0.18) / floors, 3.6, 4.4),
    roof: style === 'tejas' ? 'tejas' : style === 'tienda' ? 'cuatro-aguas' : 'azotea',
    layout: style === 'tienda' ? 'amplia' : undefined, wallFinish: FINISHES[s % FINISHES.length], wallColor: color, detail,
  });
  if (label) {
    const spec = g.userData.houseSpec;
    const sign = lettering(label, '#ffedcb', style === 'tienda' ? '#345f5c' : '#80503c', Math.min(spec.width * 0.6, 4.6), 0.5);
    sign.position.set(0, spec.base + spec.floorHeight * 0.9, spec.depth / 2 + 0.08); g.add(sign);
  }
  const out = bake(g); out.name = `Casa · ${style}`;
  Object.assign(out.userData, g.userData, { houseStyle: style });
  return out;
}

export function church() {
  const g = house({ w: 8.5, h: 7.8, color: 0xf2c76e, seed: 3, style: 'tejas' });
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
  const sign = lettering('PLAZA PANA', '#fff1cb', '#b26644', 4.6, 0.85); sign.position.set(0, 3.78, 2.81); g.add(sign);
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
