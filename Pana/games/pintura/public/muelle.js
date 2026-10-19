import * as THREE from 'three';
import { shippingContainer, transitWarehouse, portBollard } from '/engine/models/props/port-cargo.js';
import { portCrane } from '/engine/models/props/port-crane.js';
import { cargoShip } from '/engine/models/props/cargo-ship.js';
import { colonialHouse } from '/engine/models/props/colonial-house.js';
import { marketStall, streetLamp } from '/engine/models/props/plaza.js';
import { palm } from '/engine/models/vegetation/palm.js';
import { bake } from '/engine/models/core/static-batch.js';
import { disposeModel } from '/engine/models/props/game-table.js';
import { waterSurface } from '/engine/models/effects/water-surface.js';
import { rng } from '/engine/random.js';
import { MUELLE_SIZE, STACK_SETS, CRANE, STALLS, MUELLE_COVERS } from './muelle-layout.js';

const PAINT = [0xc95339, 0x2f6f8f, 0x3e8a5c, 0xe0a63a, 0x7a4f8f, 0xd9d2c3, 0x355c7d, 0xd8793a];
// Containers stacked beyond the fence on the west yard: [x, z, levels].
const YARD = [[-40, -24, 3], [-40, -10, 4], [-40, 4, 2], [-40, 18, 3], [-46, -17, 2], [-46, -3, 3], [-46, 11, 4], [-52, -24, 4], [-52, -10, 2], [-52, 4, 3], [-52, 18, 2]];

// The container yard on the La Guaira waterfront. Collision comes from
// MUELLE_COVERS[variant]; every visible stack, crane leg and stall is built from those rows.
export function createMuelle(variant = 0) {
  const group = new THREE.Group(), statics = new THREE.Group(), animated = [], cameraBounds = [], materials = new Map(), r = rng(220106);
  group.name = 'Muelle de La Guaira'; group.userData.mapId = 'muelle';
  const material = color => { if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .9 })); return materials.get(color); };
  const box = (w, h, d, color, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color)); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; statics.add(m); return m; };
  const put = (object, x, z, angle = 0, y = 0) => { object.position.set(x, y, z); object.rotation.y = angle; statics.add(object); return object; };
  const size = MUELLE_SIZE, span = size * 2;

  // Concrete yard, a darker play court with painted bay lines, and the quay.
  box(220, .3, 200, '#9a948a', 0, -.25, 20);
  box(span + 1, .12, span + 1, '#827d74', 0, -.07, 0);
  for (let x = -size + 6; x < size; x += 8) box(.14, .02, span - 2, '#e6c34f', x, .0, 0);
  for (const z of [-size + 1.2, size - 1.2]) box(span - 2, .02, .14, '#e6c34f', 0, .0, z);
  box(220, .4, 14, '#aaa398', 0, -.2, -size - 7);
  box(220, .05, .5, '#e6c34f', 0, .02, -size - 13.6);
  for (let x = -60; x <= 60; x += 9) put(portBollard(), x, -size - 12.6);
  // Concrete barriers mark the fence on all four sides, painted like the quay.
  for (const side of [-1, 1]) for (let u = -size; u < size; u += 2.2) {
    const color = Math.round((u + size) / 2.2) % 2 ? '#e6c34f' : '#3a3f42';
    box(2, .7, .5, color, u + 1.1, .35, side * (size + .5)); box(.5, .7, 2, color, side * (size + .5), .35, u + 1.1);
  }
  const sea = waterSurface(new THREE.PlaneGeometry(320, 200, 80, 50).rotateX(-Math.PI / 2), { kind: 'sea', amplitude: .08, color: '#3f97ad' });
  sea.position.set(0, -.7, -size - 114); group.add(sea); animated.push(sea);
  const ship = put(cargoShip(), 6, -size - 34, Math.PI / 2, -2.9); statics.remove(ship); group.add(ship);
  ship.userData.tick = t => { ship.position.y = -2.9 + Math.sin(t * .5) * .08; ship.rotation.z = Math.sin(t * .37) * .006; }; animated.push(ship);

  // Shipping containers: the court's stacks, then the yard beyond the fence.
  let n = 0;
  const stack = (x, z, axis, levels, length) => {
    for (let level = 0; level < levels; level++, n++) {
      const container = shippingContainer({ color: PAINT[Math.floor(r() * PAINT.length)], length, markings: level === levels - 1 && n % 2 === 0 });
      const angle = (axis === 'x' ? Math.PI / 2 : 0) + (r() > .5 ? Math.PI : 0), nudge = level ? (r() - .5) * .12 : 0;
      put(container, x + (axis === 'z' ? nudge : 0), z + (axis === 'x' ? nudge : 0), angle + (level ? (r() - .5) * .03 : 0), level * 2.65);
    }
  };
  for (const row of STACK_SETS[variant]) stack(...row);
  for (const [x, z, levels] of YARD) stack(x, z, 'z', levels, 12.2);
  for (const o of MUELLE_COVERS[variant]) cameraBounds.push(new THREE.Box3(new THREE.Vector3(o.x - o.w / 2, 0, o.z - o.d / 2), new THREE.Vector3(o.x + o.w / 2, o.h, o.z + o.d / 2)));

  // Gantry cranes: one straddles the quay edge, the other works the far berth.
  put(portCrane(), CRANE.x, CRANE.z); put(portCrane(), 47, -size - 11);
  put(transitWarehouse(), 50, 4);
  for (const [x, z] of STALLS) put(marketStall({ seed: Math.round(x), colors: [0x3b9298, 0xf2d292] }), x, z, Math.PI);

  // The colonial street facing the yard, with lamps and palms on its sidewalk.
  box(220, .1, 9, '#5f5e5b', 0, -.04, size + 6);
  box(220, .22, 2.6, '#c9bca2', 0, .02, size + 11.4);
  const families = ['casa-balcon', 'casa-baja', 'casa-esquina', 'casa-portal', 'casa-remate', 'casa-larga'], palettes = ['crema', 'turquesa', 'coral-crema', 'amarillo', 'azul', 'cielo'];
  for (let i = 0, x = -52; x < 56; i++) {
    const width = families[i % 6] === 'casa-larga' ? 11.5 : 9.4 + (i % 4) * .6;
    const house = colonialHouse({ seed: 410 + i, family: families[i % 6], palette: palettes[(i * 5) % 6], width, depth: 7.8, floorHeight: 3.6 + (i % 3) * .4,
      partyWalls: ['left', 'right'], wallFinish: ['cal', 'ladrillo-pintado', 'ladrillo-visto'][i % 3], roof: i % 3 === 0 ? 'azotea' : 'tejas', detail: 'low' });
    put(house, x + width / 2, size + 16.6, Math.PI); x += width;
  }
  for (let x = -48; x <= 48; x += 12) { put(streetLamp(), x, size + 10.6, Math.PI); put(palm({ h: 7 + (x / 12 + 4) % 3, seed: x + 70 }), x + 6, size + 10.8); }
  for (const z of [-24, -8, 8, 24]) put(palm({ h: 8, seed: z + 30 }), 36.5, z);

  const batch = bake(statics), original = new Set();
  statics.traverse(o => { if (o.geometry) original.add(o.geometry); }); original.forEach(g => g.dispose()); group.add(batch);
  // Canonical factories cache materials: own clones before this map is ever freed.
  const owned = new Map();
  group.traverse(o => { if (o.material) { const own = m => { if (!owned.has(m)) owned.set(m, m.clone()); return owned.get(m); }; o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material); } });
  let disposed = false;
  return { id: 'muelle', group, cameraBounds,
    update(t, dt) { animated.forEach(o => o.userData.tick?.(t, dt)); },
    dispose() { if (disposed) return; disposed = true; group.traverse(o => o.userData.dispose?.()); disposeModel(group); },
  };
}
