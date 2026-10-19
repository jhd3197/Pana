import * as THREE from 'three';
import { palm } from '../models/vegetation/palm.js';
import { parkBench, streetFoodKiosk } from '../models/props/pueblo.js';
import { streetLamp } from '../models/props/plaza.js';
import { bake } from '../models/core/static-batch.js';
import { disposeModel } from '../models/props/game-table.js';
import { rng } from '../random.js';
import { PALETTE, BUNTING } from './look.js';

// Estadio Pana for a court game: the court sits on the concourse in front of
// the main grandstand, beside the straight where Derrape's race passes
// (ambient-life karts use the lane at x = 22.3). Court axis Z, camera from +Z.
// Everything stays outside arenas.js's COURT_CLEAR.
export function createEstadioEnvironment() {
  const group = new THREE.Group(), statics = new THREE.Group(), materials = new Map(), random = rng(404);
  group.name = 'Estadio Pana'; group.userData.mapId = 'estadio'; group.userData.mode = 'court';
  const mat = (color, extra = {}) => { const key = color + JSON.stringify(extra); if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: .8, ...extra })); return materials.get(key); };
  const box = (w, h, d, color, x, y, z, extra) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, extra)); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; statics.add(m); return m; };
  const place = (o, x, z, angle = 0, scale = 1) => { o.position.set(x, 0, z); o.rotation.y = angle; o.scale.setScalar(scale); statics.add(o); return o; };
  // Grass, the paved concourse and the race straight with red and white kerbs.
  box(220, .3, 220, '#7fbf55', 0, -.3, 0);
  box(34, .1, 44, '#ead2a6', -1, -.1, -2);
  box(8, .1, 160, '#4b4d57', 22.3, -.09, 0);
  for (let z = -78; z < 78; z += 2) for (const x of [18.1, 26.5]) box(.5, .12, 2, (Math.round(z / 2) % 2) ? '#ffffff' : PALETTE.rojo, x, -.02, z + 1);
  for (let z = -76; z < 76; z += 8) box(.18, .02, 3, '#f4f1ea', 22.3, -.03, z);
  box(.4, .9, 120, '#d9d2bf', 17.5, .45, 0);
  // The main grandstand: concrete tiers, a coloured seat stripe on each, and a crowd.
  const tiers = 7, left = -30, right = 16, width = right - left, mid = (left + right) / 2;
  for (let i = 0; i < tiers; i++) {
    box(width, .7, 1.7, '#ddd5c2', mid, .35 + i * .7, -24.8 - i * 1.7);
    for (let s = 0; s < 6; s++) box(width / 6 - .1, .28, .55, BUNTING[(s + i) % BUNTING.length], left + (s + .5) * width / 6, .84 + i * .7, -24.35 - i * 1.7);
  }
  box(width, tiers * .7, 1, '#cfc6b1', mid, tiers * .35, -24.8 - tiers * 1.7);
  box(width + 2, .35, 14, PALETTE.turquesa, mid, 9, -30.5);
  for (const x of [left + 1, mid, right - 1]) box(.5, 9, .5, '#e9e4d6', x, 4.5, -36.5);
  // The stadium's name across the roof front.
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 128;
  const g = canvas.getContext('2d'); g.fillStyle = PALETTE.rojo; g.fillRect(0, 0, 1024, 128);
  g.fillStyle = '#fff6dc'; g.font = '88px "Luckiest Guy", sans-serif'; g.textAlign = 'center'; g.fillText('ESTADIO PANA', 512, 100, 980);
  const signTexture = new THREE.CanvasTexture(canvas); signTexture.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(22, 2.75), new THREE.MeshStandardMaterial({ map: signTexture, roughness: .7 }));
  sign.position.set(mid, 10.6, -23.4); statics.add(sign);
  box(23, 3.2, .3, PALETTE.madera, mid, 10.6, -23.6);
  // Light towers at the four corners of the concourse.
  for (const [x, z] of [[-30, -22], [16, -22], [-30, 22], [16, 22]]) {
    box(.7, 18, .7, '#e9e4d6', x, 9, z);
    box(4.2, 2.4, .5, '#f4f1ea', x, 18.5, z + (z < 0 ? .4 : -.4), { emissive: '#fff4cc', emissiveIntensity: .6 });
  }
  // The west concourse: palms, a food kiosk, benches and lamps for the fans.
  for (const [i, z] of [-18, -4, 10, 22].entries()) place(palm({ h: 7 + i % 3, seed: 40 + i }), -16, z);
  place(streetFoodKiosk(), -13.5, 4, Math.PI / 2);
  for (const z of [-9, 15]) place(parkBench(), -12.6, z, Math.PI / 2);
  for (const z of [-14, 0, 16]) place(streetLamp(), -11.2, z);
  for (const [i, x] of [-26, -10, 6].entries()) place(palm({ h: 8, seed: 60 + i }), x, 27);
  const batch = bake(statics), originals = new Set(); statics.traverse(o => { if (o.geometry) originals.add(o.geometry); }); originals.forEach(geo => geo.dispose());
  group.add(batch);
  // Canonical factories cache materials: own clones before this map is freed.
  const owned = new Map(), own = m => { if (!owned.has(m)) owned.set(m, m.clone()); return owned.get(m); };
  batch.traverse(o => { if (o.material) o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material); });
  // A cheering crowd: one instanced mesh of round fans in team colours.
  const fans = [], crowd = new THREE.InstancedMesh(new THREE.CapsuleGeometry(.28, .35, 4, 8), new THREE.MeshStandardMaterial({ roughness: .7 }), 140);
  const colors = [PALETTE.rojo, PALETTE.amarillo, PALETTE.azul, PALETTE.verde, PALETTE.coral, PALETTE.turquesa, '#c68a4e'];
  const color = new THREE.Color(), matrix = new THREE.Matrix4();
  for (let i = 0; i < 140; i++) {
    const tier = Math.floor(random() * tiers);
    fans.push({ x: left + 1 + random() * (width - 2), y: 1.25 + tier * .7, z: -24.9 - tier * 1.7, phase: random() * 6 });
    crowd.setColorAt(i, color.set(colors[Math.floor(random() * colors.length)]));
  }
  crowd.castShadow = true; group.add(crowd);
  function update(t) {
    for (let i = 0; i < fans.length; i++) {
      const f = fans[i], hop = Math.max(0, Math.sin(t * 3 + f.phase)) ** 6 * .35;
      crowd.setMatrixAt(i, matrix.makeTranslation(f.x, f.y + hop, f.z));
    }
    crowd.instanceMatrix.needsUpdate = true;
  }
  update(0);
  let disposed = false;
  return { id: 'estadio', group, update,
    dispose() { if (disposed) return; disposed = true; signTexture.dispose(); crowd.geometry.dispose(); crowd.material.dispose(); crowd.dispose(); disposeModel(group); materials.forEach(m => m.dispose()); } };
}
