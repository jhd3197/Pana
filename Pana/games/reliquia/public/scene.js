import * as THREE from 'three';
import { bake } from '/engine/models/core/static-batch.js';
import { templeEntrance, ropeBridge, stoneTotem } from '/engine/models/props/jungle.js';
import { fern } from '/engine/models/vegetation/fern.js';
import { palm } from '/engine/models/vegetation/palm.js';
import { expeditionWinch, expeditionLantern, sunRelic } from '/engine/models/props/reliquia.js';
import { ROOMS, GATE, SHORTCUT, CAMP, WINCHES, ALTAR, SUPPLIES, OBSTACLES, floorAt } from './layout.js';

const mat = (color, extra = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.93, ...extra }); m.userData.reliquiaOwned = true; return m; };
function box(root, material, w, h, d, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; root.add(m); return m; }
export function groundAt(x, z) {
  // Shared bridge ledges are wider than its planks and stand 0.75 m high.
  if (Math.abs(z + 32) < 6.6 && ((x >= 11.4 && x <= 14) || (x >= 32 && x <= 34.6))) return 0.75;
  if (z > -36 && z < -28 && x > 12 && x < 34) {
    if (x < 14) return (x - 12) * 0.4;
    if (x > 32) return (34 - x) * 0.4;
    return 0.055 + 0.75 * ((x - 23) / 9) ** 2;
  }
  return 0;
}
export function createExpeditionWorld() {
  const group = new THREE.Group(); group.name = 'Reliquia · Mina del sol';
  const staticRoot = new THREE.Group(), dynamic = new THREE.Group(); group.add(dynamic);
  const sandstone = mat(0x7f806b), darkStone = mat(0x405b50), trim = mat(0xbdab7d), wood = mat(0x60452f), iron = mat(0x3a4c46), gold = mat(0xd3ad62, { metalness: 0.4 }), jade = mat(0x4cba94, { emissive: 0x1b7858, emissiveIntensity: 0.35 });
  let seed = 72831; const rand = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  const earth = mat(0x43594a);
  // Solid banks support the entrance foliage outside the narrow mine floor.
  box(staticRoot, earth, 40, 3.6, 48, 0, -2.05, 2);
  for (const r of ROOMS) if (r.id !== 'bridge') box(staticRoot, earth, r.w + (r.x < 10 ? 16 : 5), 3.6, r.d + 5, r.x, -2.05, r.z);
  box(staticRoot, earth, 14, 3.5, 11, -19, -2.05, -30);
  const tiles = [];
  for (let x = -12; x < 58; x += 2) for (let z = -120; z < 28; z += 2) if (floorAt(x + 1, z + 1)) tiles.push({ x: x + 1, z: z + 1 });
  const matrix = new THREE.Object3D(), color = new THREE.Color();
  const floors = new THREE.InstancedMesh(new THREE.BoxGeometry(1.97, 0.4, 1.97), mat(0xffffff), tiles.length);
  floors.receiveShadow = true;
  tiles.forEach((p, i) => {
    const bridge = p.x >= 12 && p.x <= 34 && p.z > -36 && p.z < -28;
    matrix.position.set(p.x, bridge ? -3 : -0.21, p.z); matrix.updateMatrix(); floors.setMatrixAt(i, matrix.matrix);
    const room = ROOMS.find(r => Math.abs(p.x - r.x) < r.w / 2 + 0.1 && Math.abs(p.z - r.z) < r.d / 2 + 0.1);
    color.setHex(room?.color || 0x7b7761).multiplyScalar(0.87 + rand() * 0.22); floors.setColorAt(i, color);
  });
  group.add(floors);
  // Low cutaway walls keep the follow camera readable. Tall rock masses sit outside.
  for (const p of tiles) for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) if (!floorAt(p.x + dx, p.z + dz)) {
    if (p.x > 12 && p.x < 34 && p.z > -38 && p.z < -26) continue;
    const x = p.x + dx / 2, z = p.z + dz / 2, high = p.z < -15 ? 1.6 : 0.8;
    box(staticRoot, darkStone, dx ? 0.65 : 2.02, high, dz ? 0.65 : 2.02, x, high / 2, z);
    box(staticRoot, trim, dx ? 0.76 : 2.06, 0.14, dz ? 0.76 : 2.06, x, high, z);
    if (rand() < 0.18) {
      const boulder = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), darkStone);
      boulder.position.set(x + dx * 1.1, 0.7, z + dz * 1.1); boulder.scale.set(2 + rand() * 2, 2 + rand() * 3, 2 + rand() * 2); boulder.rotation.set(rand(), rand(), rand()); staticRoot.add(boulder);
    }
  }
  for (const p of OBSTACLES) {
    if (p.furniture) continue;
    if (p.z > 0) {
      const crate = box(staticRoot, wood, p.r * 1.4, 1.4, p.r * 1.4, p.x, 0.7, p.z);
      for (const y of [0.2, 1.1]) box(staticRoot, trim, p.r * 1.45, 0.12, p.r * 1.45, p.x, y, p.z);
      crate.rotation.y = 0.05;
    } else {
      box(staticRoot, darkStone, p.r * 1.7, 0.35, p.r * 1.7, p.x, 0.175, p.z);
      const h = p.z < -90 ? 4.9 : 3.2;
      const column = new THREE.Mesh(new THREE.CylinderGeometry(p.r * 0.65, p.r * 0.8, h, 8), sandstone); column.position.set(p.x, h / 2, p.z); column.castShadow = true; staticRoot.add(column);
      for (const y of [0.55, h - 0.2]) box(staticRoot, trim, p.r * 1.65, 0.25, p.r * 1.65, p.x, y, p.z);
      for (let i = 0; i < 3; i++) { const glyph = box(staticRoot, jade, 0.2, 0.2, 0.05, p.x, 1.2 + i * 0.45, p.z + p.r * 0.8); glyph.rotation.z = Math.PI / 4; }
    }
  }
  // Timber braces, rails and cross ties make the entrance read as an abandoned mine.
  for (let z = 2; z > -21; z -= 7) {
    for (const x of [-4.7, 4.7]) { box(staticRoot, wood, 0.5, 4.7, 0.55, x, 2.35, z); const brace = box(staticRoot, wood, 0.35, 2.4, 0.4, x * 0.85, 3.6, z); brace.rotation.z = Math.sign(x) * 0.5; }
    box(staticRoot, wood, 10, 0.55, 0.7, 0, 4.6, z);
  }
  for (const x of [-0.85, 0.85]) box(staticRoot, iron, 0.1, 0.09, 32, x, 0.06, -8);
  for (let z = 7; z >= -23; z -= 1.5) box(staticRoot, wood, 2.5, 0.08, 0.26, 0, 0.015, z);
  // The shared bridge has a swept deck; groundAt follows that exact sag.
  const bridge = ropeBridge({ span: 18, seed: 71 }); bridge.position.set(23, -0.95, -32); bridge.scale.z = 4.4; staticRoot.add(bridge);
  const chasm = box(staticRoot, mat(0x112b28), 26, 0.3, 24, 23, -5, -32); chasm.receiveShadow = false;
  for (const [x, z, scale] of [[-19, -30, 0.8], [40, -122, 1.3]]) { const temple = templeEntrance({ seed: 39 }); temple.position.set(x, -0.15, z); temple.scale.setScalar(scale); staticRoot.add(temple); }
  for (const x of [28, 52]) { const totem = stoneTotem({ seed: 38 }); totem.position.set(x, 0, -116); totem.scale.setScalar(0.9); staticRoot.add(totem); }
  for (let i = 0; i < 20; i++) {
    const x = (i % 2 ? -1 : 1) * (12 + rand() * 6), z = 25 - rand() * 55;
    const plant = i < 4 ? palm({ seed: i + 5, h: 7 }) : fern({ seed: i + 3 }); plant.position.set(x, 0, z); staticRoot.add(plant);
  }
  for (let i = 0; i < 18; i++) {
    const plant = fern({ seed: i + 33 }); plant.position.set(i % 2 ? 55.5 : 24, 0, -57 - rand() * 60); plant.scale.setScalar(0.8 + rand()); staticRoot.add(plant);
  }
  // Camp canvas tent and table stay outside the playable collision envelope.
  const canvas = mat(0xc5ac77, { side: THREE.DoubleSide });
  const tent = new THREE.Mesh(new THREE.ConeGeometry(3.5, 3.8, 4, 1, true), canvas); tent.position.set(-8, 2.7, 17); tent.rotation.y = Math.PI / 4; staticRoot.add(tent);
  box(staticRoot, wood, 3, 0.15, 1.4, 7, 1.65, 10);
  box(staticRoot, mat(0xe3d4aa), 1.8, 0.03, 0.9, 7, 1.75, 10);
  // Altar remains walkable at the front. Decorative plinth is below the relic.
  for (let i = 0; i < 3; i++) box(staticRoot, i === 2 ? gold : sandstone, 4 - i * 0.8, 0.3, 3 - i * 0.6, ALTAR.x, i * 0.3 + 0.15, ALTAR.z);
  const gate = new THREE.Group(); dynamic.add(gate);
  box(gate, darkStone, GATE.w, 5.5, GATE.d, GATE.x, 2.75, GATE.z);
  for (const x of [-3.5, -1.75, 0, 1.75, 3.5]) {
    box(gate, trim, 0.15, 5.3, 1.5, GATE.x + x, 2.7, GATE.z);
    const glyph = box(gate, jade, 0.5, 0.5, 1.55, GATE.x + x, 2.8, GATE.z); glyph.rotation.z = Math.PI / 4;
  }
  for (const x of [34.4, 45.6]) box(staticRoot, sandstone, 1.3, 6.5, 2, x, 3.25, GATE.z);
  box(staticRoot, trim, 12.5, 0.6, 2.1, 40, 6.1, GATE.z);
  const secret = new THREE.Group(); dynamic.add(secret); box(secret, darkStone, SHORTCUT.w, 3.8, SHORTCUT.d, SHORTCUT.x, 1.9, SHORTCUT.z);
  const wheels = WINCHES.map(w => { const g = expeditionWinch(); g.position.set(w.x, groundAt(w.x, w.z), w.z); dynamic.add(g); return { ...w, group: g }; });
  const supplies = SUPPLIES.map(s => {
    const g = new THREE.Group(); g.position.set(s.x, 0, s.z); box(g, wood, 1.2, 0.7, 0.9, 0, 0.35, 0); box(g, mat(0xe0d8b5), 1.26, 0.12, 0.95, 0, 0.75, 0);
    box(g, mat(0xa84e37), 0.15, 0.03, 0.55, 0, 0.83, 0); box(g, mat(0xa84e37), 0.5, 0.03, 0.15, 0, 0.83, 0); dynamic.add(g); return { ...s, group: g };
  });
  const relic = sunRelic(); dynamic.add(relic);
  const torches = [];
  for (const [x, z] of [[-3, 8], [3, -3], [-4, -16], [-10, -31], [10, -39], [32, -22], [48, -43], [35, -53], [53, -66], [27, -76], [44, -85], [27, -96], [53, -106], [35, -116]]) {
    box(staticRoot, darkStone, 0.5, 1.35, 0.5, x, 0.675, z);
    const lantern = expeditionLantern(); lantern.scale.setScalar(1.5); lantern.position.set(x, 1.35, z); staticRoot.add(lantern);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(2.2, 24), new THREE.MeshBasicMaterial({ color: 0xf8bc69, transparent: true, opacity: 0.12, depthWrite: false })); glow.rotation.x = -Math.PI / 2; glow.position.set(x, 0.025, z); dynamic.add(glow); torches.push(glow);
  }
  const campRing = new THREE.Mesh(new THREE.RingGeometry(4.7, 4.86, 64), new THREE.MeshBasicMaterial({ color: 0xe4c17d, transparent: true, opacity: 0.65, depthWrite: false })); campRing.rotation.x = -Math.PI / 2; campRing.position.set(CAMP.x, 0.04, CAMP.z); dynamic.add(campRing);
  const staticBatch = bake(staticRoot, { cellSize: 24 }); group.add(staticBatch);
  const originalGeometries = new Set(); staticRoot.traverse(o => { if (o.geometry) originalGeometries.add(o.geometry); }); originalGeometries.forEach(g => g.dispose());
  let gateHeight = 0, secretHeight = 0;
  function update(t, state = {}, dt = 0.016) {
    gateHeight = THREE.MathUtils.damp(gateHeight, state.gateOpen ? -6 : 0, 4, dt); gate.position.y = gateHeight;
    secretHeight = THREE.MathUtils.damp(secretHeight, state.relicTaken ? -4 : 0, 4, dt); secret.position.y = secretHeight;
    wheels.forEach(w => { const s = state.winches?.[w.id]; w.group.userData.wheel.rotation.z = -(s?.progress || 0) * Math.PI * 2; });
    supplies.forEach(s => { s.group.visible = !state.supplies?.includes(s.id); });
    relic.visible = state.carrier == null;
    relic.position.set(state.relic?.x ?? ALTAR.x, state.relicTaken ? 0.15 : 1.2 + Math.sin(t * 2) * 0.1, state.relic?.z ?? ALTAR.z); relic.rotation.y = t * 0.6;
    torches.forEach((g, i) => { g.material.opacity = 0.11 + Math.sin(t * 3 + i) * 0.025; });
    campRing.material.color.setHex(state.relicTaken ? 0x77e8b5 : 0xe4c17d);
  }
  function dispose() {
    const geometries = new Set(), materials = new Set(); group.traverse(o => { if (o.geometry) geometries.add(o.geometry); for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) materials.add(m); });
    geometries.forEach(g => g.dispose()); materials.forEach(m => { if (m.userData.reliquiaOwned || m.isMeshBasicMaterial) m.dispose(); });
  }
  return { group, update, dispose, groundAt, bounds: new THREE.Box3(new THREE.Vector3(-25, -5, -128), new THREE.Vector3(61, 18, 29)) };
}
