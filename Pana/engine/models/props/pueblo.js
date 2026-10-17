// Pueblo 011–020. Ground at y=0, fronts +Z. Static details are material batches;
// the clock's hands remain separate and use deterministic absolute-time motion.
import * as THREE from 'three';
import { M, mesh, box, tube } from '/engine/models/core/primitives.js';
import { makeMango } from '/engine/models/props/mango.js';
import { bush } from '/engine/models/vegetation/bush.js';
import { colonialHouse as recipeHouse } from './colonial-house.js';
import { food } from '/engine/models/props/kitchen.js';
import { finish, rounded, sign, curve, archPanel, archFrame, tiledRoof, shutterWindow, palette as P } from '/engine/models/core/architecture-kit.js';

const coral = M(0xd87960, { roughness: 0.95 }), teal = M(0x3d8580, { roughness: 0.8 });
const clay = M(0xb86645, { roughness: 1 });

function door(g, x, y, z, w = 1.4, h = 2.7, paint = P.timber) {
  g.add(archFrame(w, h, 0.17, P.cream, x, y, z));
  g.add(archPanel(w, h, 0.08, paint, x, y, z));
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) g.add(rounded(w * 0.37, 0.51, 0.035, P.wood, x + side * w * 0.24, y + 0.35 + i * 0.64, z + 0.06));
    g.add(mesh(new THREE.SphereGeometry(0.045, 8, 6), P.brass, x + side * 0.09, y + 1.18, z + 0.12));
  }
  g.add(box(0.025, h - w / 2, 0.03, P.timber, x, y + (h - w / 2) / 2, z + 0.06));
  for (let i = -2; i <= 2; i++) {
    const a = i * Math.PI / 6;
    g.add(tube([x, y + h - w / 2, z + 0.055], [x + Math.sin(a) * w * 0.44, y + h - w / 2 + Math.cos(a) * w * 0.44, z + 0.055], 0.018, P.brass));
  }
}

function flowerPot(g, x, y, z, seed) {
  g.add(mesh(new THREE.CylinderGeometry(0.32, 0.23, 0.5, 12), clay, x, y + 0.25, z));
  g.add(mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.09, 12), clay, x, y + 0.47, z));
  const plant = bush({ seed, flowers: true }); plant.scale.setScalar(0.38); plant.position.set(x, y + 0.48, z); g.add(plant);
}

function awning(g, w, y, z, colors = [0x3d8580, 0xf0dfb9]) {
  const mats = colors.map(c => M(c, { side: THREE.DoubleSide, roughness: 0.9 })), n = Math.ceil(w / 0.42), width = w / n;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (i + 0.5) * width;
    const roof = box(width + 0.003, 0.05, 1.14, mats[i % 2], x, y, z + 0.46); roof.rotation.x = 0.2; g.add(roof);
    const shape = new THREE.Shape(); shape.moveTo(-width / 2, 0.08); shape.lineTo(width / 2, 0.08); shape.lineTo(width / 2, -0.12); shape.quadraticCurveTo(0, -0.33, -width / 2, -0.12); shape.closePath();
    g.add(mesh(new THREE.ShapeGeometry(shape, 7), mats[i % 2], x, y - 0.15, z + 1.02));
  }
  for (const s of [-1, 1]) g.add(tube([s * (w / 2 - 0.08), y - 0.7, z], [s * (w / 2 - 0.08), y - 0.1, z + 1], 0.025, P.iron));
}

// 011 · A single-storey colonial home with a tiled roof and grilled shutters.
export function colonialHouse(options = {}) {
  if (options.spec || options.family) return recipeHouse(options);
  return legacyColonialHouse(options);
}

function legacyColonialHouse({ seed = 11, color = 0x529b9d } = {}) {
  const g = new THREE.Group(), wall = M(color, { roughness: 0.95 });
  g.add(rounded(6.4, 4.2, 5.1, wall, 0, 2.2, 0, 0.08));
  g.add(rounded(6.65, 0.28, 5.35, P.cream, 0, 0.14, 0));
  for (const y of [0.5, 4.17]) g.add(box(6.58, 0.16, 5.25, P.cream, 0, y, 0));
  tiledRoof(g, { w: 6.4, d: 5.1, y: 4.28, rise: 1.2, wall, seed });
  door(g, 0, 0.28, 2.61);
  for (const x of [-2.05, 2.05]) shutterWindow(g, x, 2.23, 2.57, { color: 0x803f36 });
  const rear = new THREE.Group(); rear.rotation.y = Math.PI;
  for (const x of [-1.5, 1.5]) shutterWindow(rear, x, 2.3, 2.57, { w: 0.8, color: 0x803f36 }); g.add(rear);
  for (const s of [-1, 1]) flowerPot(g, s * 1.06, 0.28, 2.94, seed + s);
  const number = sign('11', 0.32, 0.32, { border: false }); number.position.set(1.0, 2.72, 2.66); g.add(number);
  g.add(rounded(3.5, 0.14, 1.15, P.cream, 0, 0.07, 2.78));
  g.add(rounded(3.15, 0.14, 0.85, P.cream, 0, 0.21, 2.78));
  return finish(g, 'colonialHouse');
}

// 012 · A corner shop reads from both street-facing sides.
export function cornerBodega({ seed = 12 } = {}) {
  const g = new THREE.Group(), plaster = M(0xe1b95f, { roughness: 0.95 });
  g.add(rounded(6, 4.1, 4.7, plaster, 0, 2.16, 0));
  g.add(rounded(6.25, 0.26, 4.95, P.cream, 0, 0.13, 0));
  g.add(rounded(6.25, 0.26, 0.95, P.cream, 0, 0.13, 2.8));
  for (const y of [0.6, 3.5, 4.22]) g.add(box(6.16, 0.16, 4.86, P.cream, 0, y, 0));
  g.add(box(6.1, 0.09, 4.8, clay, 0, 4.34, 0));
  const shopfront = (width, z) => {
    const front = new THREE.Group();
    front.add(box(width, 1.85, 0.08, P.dark, 0, 1.98, z));
    for (const y of [1.13, 1.74, 2.36]) {
      front.add(box(width, 0.065, 0.3, P.wood, 0, y, z + 0.12));
      for (let i = 0; i < 9; i++) {
        const color = [0xb9503c, 0xd7b34f, 0x608466][(i + Math.round(y * 10)) % 3];
        front.add(rounded(0.18, 0.3, 0.16, M(color), -width * 0.42 + i * width * 0.105, y + 0.18, z + 0.12));
      }
    }
    for (const x of [-width / 2, 0, width / 2]) front.add(box(0.06, 1.9, 0.06, teal, x, 2.0, z + 0.3));
    awning(front, width + 0.25, 3.2, z); return front;
  };
  const front = shopfront(3.25, 2.4); front.position.x = -1.1; g.add(front);
  door(g, 1.93, 0.26, 2.42, 1.1, 2.68, teal);
  const side = shopfront(3.6, 3.04); side.rotation.y = -Math.PI / 2; g.add(side);
  const title = sign(['BODEGA EL PANA', 'de todo un poquito'], 4.8, 0.62); title.position.set(0, 3.84, 2.45); g.add(title);
  const sideTitle = sign('ABIERTO', 2.2, 0.5); sideTitle.rotation.y = -Math.PI / 2; sideTitle.position.set(-3.07, 3.82, 0); g.add(sideTitle);
  for (let j = 0; j < 2; j++) {
    g.add(box(0.76, 0.44, 0.55, P.wood, -2.25 + j * 0.84, 0.48, 2.98));
    for (let i = 0; i < 3; i++) {
      const mango = makeMango(); mango.scale.setScalar(0.15); mango.position.set(-2.5 + j * 0.84 + i * 0.22, 0.77, 2.98); mango.rotation.z = 0.7; g.add(mango);
    }
  }
  flowerPot(g, 2.65, 0.26, 2.96, seed);
  return finish(g, 'cornerBodega');
}

// 013 · A whitewashed chapel with an open bell stage, rose window and steps.
export function colonialChurch() {
  const g = new THREE.Group(), plaster = M(0xeee6ce, { roughness: 1 }), blue = M(0x688d9b, { roughness: 0.8 });
  g.add(rounded(6, 4.8, 6.7, plaster, 0, 2.7, 0));
  for (let i = 0; i < 3; i++) g.add(rounded(6.5 - i * 0.18, 0.2, 7.7 - i * 0.3, P.stone, 0, 0.1 + i * 0.2, 0.1));
  tiledRoof(g, { w: 6, d: 6.7, y: 5.02, rise: 1.4, wall: plaster, seed: 13 });
  door(g, 0.45, 0.6, 3.43, 1.55, 2.9, teal);
  for (const x of [-2.65, 2.65]) g.add(box(0.24, 4.4, 0.24, P.cream, x, 2.8, 3.44));
  const rose = mesh(new THREE.CircleGeometry(0.5, 24), blue, 0.45, 4.35, 3.39); g.add(rose);
  g.add(mesh(new THREE.TorusGeometry(0.53, 0.075, 6, 24), P.cream, 0.45, 4.35, 3.43));
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.add(tube([0.45, 4.35, 3.45], [0.45 + Math.cos(a) * 0.48, 4.35 + Math.sin(a) * 0.48, 3.45], 0.018, P.cream)); }
  // Offset tower, with real air around the bell on all four faces.
  g.add(rounded(1.8, 5.8, 2, plaster, -2.2, 3.5, 2.4));
  g.add(box(2.04, 0.2, 2.24, P.cream, -2.2, 6.3, 2.4));
  for (const x of [-2.95, -1.45]) for (const z of [1.57, 3.23]) g.add(rounded(0.25, 1.65, 0.26, plaster, x, 7.13, z));
  g.add(box(2.04, 0.18, 2.24, P.cream, -2.2, 7.99, 2.4));
  const cap = mesh(new THREE.ConeGeometry(1.55, 1.0, 4), clay, -2.2, 8.55, 2.4); cap.rotation.y = Math.PI / 4; g.add(cap);
  const bell = [[0.06, 0], [0.39, 0], [0.41, 0.12], [0.3, 0.18], [0.22, 0.55], [0.05, 0.65]].map(p => new THREE.Vector2(...p));
  g.add(mesh(new THREE.LatheGeometry(bell, 20), P.brass, -2.2, 6.85, 2.4));
  g.add(tube([-2.2, 7.4, 2.4], [-2.2, 7.9, 2.4], 0.035, P.iron));
  g.add(mesh(new THREE.SphereGeometry(0.085, 8, 6), P.iron, -2.2, 6.82, 2.4));
  g.add(box(0.1, 1.0, 0.1, P.iron, -2.2, 9.39, 2.4), box(0.6, 0.1, 0.1, P.iron, -2.2, 9.53, 2.4));
  for (const s of [-1, 1]) {
    const side = new THREE.Group(); side.rotation.y = s * Math.PI / 2;
    for (const x of [-1.5, 1.5]) { side.add(archPanel(0.65, 1.7, 0.05, blue, x, 2.3, 3.025), archFrame(0.65, 1.7, 0.12, P.cream, x, 2.3, 3.04)); }
    g.add(side);
  }
  return finish(g, 'colonialChurch');
}

// 014 · Open shelter with cantilever roof, route panel and separate seat bays.
export function busStopShelter() {
  const g = new THREE.Group(); g.add(rounded(5.7, 0.18, 2.6, P.stone, 0, 0.09, 0));
  for (const x of [-2.25, 2.25]) g.add(rounded(0.14, 2.8, 0.16, teal, x, 1.58, -0.72));
  const roof = rounded(5.5, 0.14, 2.6, teal, 0, 3.02, 0); roof.rotation.x = -0.08; g.add(roof);
  for (const x of [-2.25, 2.25]) g.add(tube([x, 2.25, -0.72], [x, 2.96, 0.78], 0.045, P.iron));
  for (const x of [-1.6, -0.6, 0.4]) {
    for (let k = 0; k < 3; k++) g.add(rounded(0.82, 0.07, 0.17, P.wood, x, 0.73, -0.25 + k * 0.2));
    g.add(box(0.12, 0.55, 0.1, P.iron, x, 0.45, 0), rounded(0.84, 0.32, 0.09, P.wood, x, 1.1, -0.43));
  }
  for (let i = 0; i < 7; i++) g.add(box(3.5, 0.07, 0.06, teal, -0.5, 1.45 + i * 0.16, -0.75));
  g.add(box(0.85, 1.9, 0.1, P.cream, 1.65, 1.58, -0.71));
  const route = sign(['RUTA 02', 'PLAZA · MERCADO'], 0.71, 0.65); route.position.set(1.65, 2.12, -0.65); g.add(route);
  for (let i = 0; i < 4; i++) {
    g.add(mesh(new THREE.CircleGeometry(0.045, 8), teal, 1.4, 1.55 - i * 0.22, -0.648));
    g.add(box(0.28, 0.025, 0.01, teal, 1.66, 1.55 - i * 0.22, -0.648));
  }
  const title = sign('PARADA · PANA', 2.4, 0.34, { border: false }); title.position.set(-0.7, 2.9, 1.27); g.add(title);
  return finish(g, 'busStopShelter');
}

// 015 · Arepa stand: griddle, food, condiments and hinged serving shelf.
export function streetFoodKiosk() {
  const g = new THREE.Group(), steel = M(0xb8c0bc, { metalness: 0.65, roughness: 0.36 });
  g.add(rounded(3.4, 0.18, 2.45, P.timber, 0, 0.09, 0));
  g.add(rounded(3.05, 1.03, 2.05, coral, 0, 0.7, 0));
  for (const x of [-1.45, 1.45]) for (const z of [-0.92, 0.92]) g.add(box(0.11, 2.95, 0.11, teal, x, 1.64, z));
  g.add(rounded(3.25, 0.13, 2.2, steel, 0, 1.28, 0), rounded(3.25, 0.09, 0.45, P.wood, 0, 1.17, 1.23));
  const canopy = new THREE.Group(); canopy.position.z = -1; awning(canopy, 3.55, 3.18, 1.0, [0xc35945, 0xf0dfb9]);
  // The rear roof continues behind the striped serving canopy.
  g.add(box(3.55, 0.09, 1.75, P.cream, 0, 3.24, -0.3), canopy);
  const title = sign('AREPAS CALIENTICAS', 2.8, 0.4); title.position.set(0, 2.74, 1.07); g.add(title);
  const menu = sign(['HECHAS AL MOMENTO', 'queso · reina pepiada'], 1.65, 0.65, { background: '#9a4534' }); menu.position.set(0, 0.7, 1.04); g.add(menu);
  g.add(rounded(1.22, 0.13, 0.95, P.iron, -0.72, 1.42, -0.1));
  for (const [x, z] of [[-0.95, -0.32], [-0.47, -0.32], [-0.8, 0.1]]) {
    const arepa = food('arepa', { plated: false }); arepa.scale.setScalar(0.27); arepa.position.set(x, 1.48, z); g.add(arepa);
  }
  for (const [i, color] of [0xd49d36, 0xae4534, 0x52865c].entries()) {
    g.add(mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.27, 10), M(color), 0.62 + i * 0.22, 1.48, 0.52));
    g.add(mesh(new THREE.ConeGeometry(0.045, 0.1, 8), P.cream, 0.62 + i * 0.22, 1.67, 0.52));
  }
  g.add(mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.38, 14), steel, 0.7, 1.54, -0.45));
  g.add(mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.04, 14), P.iron, 0.7, 1.75, -0.45));
  return finish(g, 'streetFoodKiosk');
}

// 016 · Clock hands are real geometry, visible from every side of the tower.
export function plazaClockTower({ hour = 10, minute = 10 } = {}) {
  const g = new THREE.Group(), wall = M(0xd3a15e, { roughness: 0.9 });
  for (let i = 0; i < 3; i++) g.add(rounded(3.3 - i * 0.35, 0.22, 3.3 - i * 0.35, P.cream, 0, 0.11 + i * 0.22, 0));
  g.add(rounded(1.95, 5.65, 1.95, wall, 0, 3.47, 0));
  for (const y of [0.85, 4.5, 6.25]) g.add(rounded(2.22, 0.18, 2.22, P.cream, 0, y, 0));
  for (const x of [-0.83, 0.83]) for (const z of [-0.83, 0.83]) g.add(box(0.12, 3.4, 0.12, P.cream, x, 2.65, z));
  const clockFace = M(0xf4e5c3, { roughness: 0.9 });
  const faces = [];
  for (let i = 0; i < 4; i++) {
    const face = new THREE.Group(); face.rotation.y = i * Math.PI / 2;
    const disk = mesh(new THREE.CircleGeometry(0.73, 40), clockFace, 0, 5.35, 1.0); face.add(disk);
    face.add(mesh(new THREE.TorusGeometry(0.76, 0.055, 6, 36), P.iron, 0, 5.35, 1.035));
    for (let n = 0; n < 12; n++) {
      const a = n * Math.PI / 6, mark = box(n % 3 ? 0.025 : 0.045, n % 3 ? 0.08 : 0.13, 0.018, P.iron, Math.sin(a) * 0.61, 5.35 + Math.cos(a) * 0.61, 1.04); mark.rotation.z = -a; face.add(mark);
    }
    g.add(face);
    const hands = new THREE.Group(); hands.rotation.y = i * Math.PI / 2;
    const pivots = [0.36, 0.53, 0.57].map((length, j) => {
      const pivot = new THREE.Group(); pivot.position.set(0, 5.35, 1.065 + j * 0.012);
      pivot.add(rounded(j === 2 ? 0.016 : 0.05, length, 0.025, j === 2 ? coral : P.iron, 0, length / 2, 0)); hands.add(pivot); return pivot;
    });
    hands.add(mesh(new THREE.SphereGeometry(0.065, 10, 6), P.brass, 0, 5.35, 1.13)); faces.push({ hands, pivots });
  }
  const roof = mesh(new THREE.ConeGeometry(1.75, 1.35, 4), teal, 0, 7.02, 0); roof.rotation.y = Math.PI / 4; g.add(roof);
  g.add(mesh(new THREE.SphereGeometry(0.12, 12, 8), P.brass, 0, 7.82, 0));
  const out = finish(g, 'plazaClockTower'); faces.forEach(f => out.add(f.hands));
  out.userData.tick = t => faces.forEach(({ pivots }) => {
    pivots[0].rotation.z = -(hour / 12 + minute / 720 + t / 43200) * Math.PI * 2;
    pivots[1].rotation.z = -(minute / 60 + t / 3600) * Math.PI * 2;
    pivots[2].rotation.z = -t / 60 * Math.PI * 2;
  });
  out.userData.tick(0); return out;
}

// 017 · Regulation-height rim with an open woven net.
export function basketballHoop() {
  const g = new THREE.Group(), white = M(0xe9e9d9, { roughness: 0.8 }), orange = M(0xc95c36);
  g.add(rounded(0.8, 0.18, 0.8, P.stone, 0, 0.09, -0.55));
  g.add(curve([[0, 0.18, -0.55], [0, 2.9, -0.55], [0, 3.65, -0.2], [0, 3.65, 0.54]], 0.09, P.iron));
  g.add(rounded(1.8, 1.05, 0.12, white, 0, 3.55, 0.6));
  for (const x of [-0.86, 0.86]) g.add(box(0.04, 0.98, 0.02, P.iron, x, 3.55, 0.67));
  for (const y of [3.06, 4.04]) g.add(box(1.76, 0.04, 0.02, P.iron, 0, y, 0.67));
  for (const x of [-0.28, 0.28]) g.add(box(0.025, 0.4, 0.02, orange, x, 3.32, 0.68));
  for (const y of [3.12, 3.52]) g.add(box(0.58, 0.025, 0.02, orange, 0, y, 0.68));
  g.add(box(0.15, 0.08, 0.25, orange, 0, 3.05, 0.8));
  const rim = mesh(new THREE.TorusGeometry(0.23, 0.023, 8, 32), orange, 0, 3.05, 1.08); rim.rotation.x = Math.PI / 2; g.add(rim);
  for (let i = 0; i < 12; i++) for (const dir of [-1, 1]) {
    const pts = Array.from({ length: 5 }, (_, j) => {
      const t = j / 4, a = i * Math.PI / 6 + dir * t * Math.PI / 3, radius = 0.23 - t * 0.1;
      return [Math.cos(a) * radius, 3.03 - t * 0.43, 1.08 + Math.sin(a) * radius];
    });
    g.add(curve(pts, 0.007, white, 8));
  }
  return finish(g, 'basketballHoop');
}

// 018 · Ribbed polyethylene tank on a roof-mounting steel stand.
export function rooftopWaterTank() {
  const g = new THREE.Group(), plastic = M(0x344c4c, { flatShading: false, roughness: 0.7 });
  for (const x of [-0.72, 0.72]) for (const z of [-0.72, 0.72]) g.add(box(0.1, 0.55, 0.1, P.iron, x, 0.275, z));
  for (const z of [-0.72, 0.72]) g.add(tube([-0.72, 0.08, z], [0.72, 0.5, z], 0.025, P.iron));
  g.add(box(1.9, 0.1, 1.9, P.iron, 0, 0.55, 0));
  const profile = [[0, 0], [0.85, 0], [0.98, 0.15], [1, 0.35], [1, 1.65], [0.92, 1.88], [0.55, 2.02], [0, 2.02]].map(p => new THREE.Vector2(...p));
  g.add(mesh(new THREE.LatheGeometry(profile, 32), plastic, 0, 0.6, 0));
  for (let i = 0; i < 6; i++) { const ring = mesh(new THREE.TorusGeometry(1.0, 0.035, 6, 32), plastic, 0, 0.98 + i * 0.24, 0); ring.rotation.x = Math.PI / 2; g.add(ring); }
  g.add(mesh(new THREE.CylinderGeometry(0.39, 0.43, 0.12, 24), plastic, 0, 2.67, 0));
  g.add(curve([[0.8, 0.88, 0.5], [1.18, 0.88, 0.5], [1.24, 0.62, 0.5], [1.24, 0.12, 0.5]], 0.055, P.cream));
  const valve = mesh(new THREE.TorusGeometry(0.11, 0.018, 5, 12), coral, 1.18, 0.87, 0.61); g.add(valve);
  for (const x of [-0.23, 0.23]) g.add(tube([x, 0.02, -1.13], [x, 2.65, -1.13], 0.025, P.iron));
  for (let i = 0; i < 8; i++) g.add(tube([-0.23, 0.2 + i * 0.3, -1.13], [0.23, 0.2 + i * 0.3, -1.13], 0.02, P.iron));
  return finish(g, 'rooftopWaterTank');
}

// 019 · A swan-neck streetlight, distinct from the existing plaza lantern.
export function streetlightPole() {
  const g = new THREE.Group(), light = M(0xffe1a0, { emissive: 0xffc270, emissiveIntensity: 0.45, roughness: 0.5 });
  g.add(rounded(0.55, 0.15, 0.55, P.stone, 0, 0.075, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.12, 0.21, 0.65, 12), P.iron, 0, 0.48, 0));
  g.add(curve([[0, 0.7, 0], [0, 4.6, 0], [0, 5.5, 0.2], [0, 5.65, 1.05], [0, 5.25, 1.3]], 0.07, P.iron, 24));
  g.add(curve([[0, 4.5, 0], [0, 5.05, 0.48], [0, 5.27, 1.0]], 0.026, P.brass));
  g.add(mesh(new THREE.CylinderGeometry(0.23, 0.36, 0.15, 12), P.iron, 0, 5.19, 1.3));
  g.add(mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.48, 12), light, 0, 4.88, 1.3));
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; g.add(tube([Math.cos(a) * 0.23, 5.12, 1.3 + Math.sin(a) * 0.23], [Math.cos(a) * 0.17, 4.65, 1.3 + Math.sin(a) * 0.17], 0.016, P.iron)); }
  g.add(mesh(new THREE.CylinderGeometry(0.22, 0.12, 0.1, 12), P.iron, 0, 4.59, 1.3));
  return finish(g, 'streetlightPole');
}

// 020 · Slatted hardwood seat with curved cast-iron armrests and bolted feet.
export function parkBench() {
  const g = new THREE.Group();
  for (const x of [-1.05, 1.05]) {
    for (const z of [-0.37, 0.37]) {
      g.add(rounded(0.23, 0.07, 0.3, P.iron, x, 0.035, z));
      g.add(curve([[x, 0.07, z], [x, 0.4, z * 0.8], [x, 0.74, z * 0.9]], 0.045, P.iron));
    }
    g.add(curve([[x, 0.65, 0.4], [x, 1.04, 0.37], [x, 1.12, 0.08], [x, 1.18, -0.36]], 0.037, P.iron));
    g.add(curve([[x, 0.35, -0.3], [x, 0.83, -0.42], [x, 1.48, -0.57]], 0.04, P.iron));
  }
  for (let i = 0; i < 5; i++) g.add(rounded(2.7, 0.09, 0.15, P.wood, 0, 0.73 - Math.sin(i * Math.PI / 4) * 0.025, -0.34 + i * 0.17));
  for (let i = 0; i < 4; i++) {
    const slat = rounded(2.7, 0.14, 0.08, i % 2 ? P.wood : M(0xa67649), 0, 0.93 + i * 0.17, -0.43 - i * 0.037); slat.rotation.x = -0.15; g.add(slat);
    for (const x of [-1.05, 1.05]) g.add(mesh(new THREE.SphereGeometry(0.018, 6, 4), P.brass, x, 0.93 + i * 0.17, -0.38 - i * 0.037));
  }
  return finish(g, 'parkBench');
}
