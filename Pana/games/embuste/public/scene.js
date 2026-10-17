// El Campamento y el Templo at night, built from layout.js with the shared
// factories (jungle ruins, Reliquia's expedition kit, Llanos camp life, plaza
// props and the camp pieces in engine/models/props/embuste.js). Statics are
// spatially batched; only what moves stays live.
import * as THREE from 'three';
import { bake } from '/engine/models/core/static-batch.js';
import { templeEntrance, ropeBridge, waterfallRocks, vineArch, stoneTotem, hollowLog } from '/engine/models/props/jungle.js';
import { mummy, sunRelic, expeditionWinch, expeditionLantern } from '/engine/models/props/reliquia.js';
import { campfire, riverCanoe, wetlandLanding, coffeeTable } from '/engine/models/props/llano-life.js';
import { barrel, crate, cooler } from '/engine/models/props/plaza.js';
import { food } from '/engine/models/props/kitchen.js';
import { campBell, radioSet, damGate, campTent } from '/engine/models/props/embuste.js';
import { fern } from '/engine/models/vegetation/fern.js';
import { palm } from '/engine/models/vegetation/palm.js';
import { tickWind } from '/engine/models/vegetation/plant-kit.js';
import { waterSurface, sampleWaterWave } from '/engine/models/effects/water-surface.js';
import { ZONES, BOUNDS, FIRE, RELIC, BELL, STATIONS, VENTS, HIDES, FIXES, floorAt, zoneAt, stationById } from './layout.js';

function box(root, material, w, h, d, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; root.add(m); return m; }
function place(root, object, x, y, z, ry = 0, s = 1) { object.position.set(x, y, z); object.rotation.y = ry; object.scale.multiplyScalar(s); root.add(object); return object; }

// The rope bridge's deck sags into the ravine; actors follow it.
const BRIDGE_HALF = 4.5, BRIDGE_X = -17, BRIDGE_SAG = 0.75;
export function groundAt(x, z) {
  if (Math.abs(z) < 3.2 && Math.abs(x - BRIDGE_X) < BRIDGE_HALF) return -BRIDGE_SAG * (1 - ((x - BRIDGE_X) / BRIDGE_HALF) ** 2);
  return 0;
}
// Which way is the wall from a spot near it (for logs, arches and props)?
function wallDirection(p) {
  for (let r = 1; r <= 4; r += 0.5) for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2, x = p.x + Math.sin(a) * r, z = p.z + Math.cos(a) * r;
    if (!floorAt(x, z)) return a;
  }
  return 0;
}
const STONE_ZONES = new Set(['templo', 'tunel', 'mina', 'rieles', 'escalinata']);

export function createCampWorld() {
  const group = new THREE.Group(); group.name = '¡Embuste! · El campamento y el templo';
  const owned = new Set();
  const mat = (color, extra = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.95, ...extra }); owned.add(m); return m; };
  const staticRoot = new THREE.Group(), dynamic = new THREE.Group(); group.add(dynamic);
  let seed = 5419; const rand = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  const earth = mat(0x1f2a1f), hedge = mat(0x24402c), hedgeTop = mat(0x2f5a36), stoneWall = mat(0x4b5148), stoneTop = mat(0x6b6e5d);
  const wood = mat(0x5e4330), darkWood = mat(0x3b2a1d), sand = mat(0x8b7a58);

  // Jungle floor under everything; the ravine and the river cut into it.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(BOUNDS.maxX - BOUNDS.minX + 60, BOUNDS.maxZ - BOUNDS.minZ + 60), earth);
  ground.rotation.x = -Math.PI / 2; ground.position.set((BOUNDS.minX + BOUNDS.maxX) / 2, -0.32, (BOUNDS.minZ + BOUNDS.maxZ) / 2 - 8); ground.receiveShadow = true; group.add(ground);
  const ravine = box(group, mat(0x07090c), 9.4, 0.2, 14, BRIDGE_X, -3.2, 0); ravine.receiveShadow = false;
  const riverGeo = new THREE.PlaneGeometry(90, 16, 48, 12); riverGeo.rotateX(-Math.PI / 2);
  const river = waterSurface(riverGeo, { kind: 'river', color: 0x28788a, depth: 3.2, amplitude: 0.035 });
  river.position.set(18, -0.3, 40); group.add(river);

  // Floor: one-metre tiles, instanced, coloured by zone.
  const tiles = [];
  for (let x = Math.floor(BOUNDS.minX); x < BOUNDS.maxX; x++) for (let z = Math.floor(BOUNDS.minZ); z < BOUNDS.maxZ; z++) {
    const cx = x + 0.5, cz = z + 0.5;
    if (floorAt(cx, cz) && !(Math.abs(cz) < 3.2 && Math.abs(cx - BRIDGE_X) < BRIDGE_HALF)) tiles.push({ x: cx, z: cz });
  }
  const palette = { fogata: 0x7a6247, path: 0x7d6b4a, stone: 0x6a6c5e, grass: 0x4d6040, wood: 0x6e5236 };
  const floors = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.3, 1), mat(0xffffff), tiles.length); floors.receiveShadow = true;
  const m4 = new THREE.Object3D(), color = new THREE.Color();
  tiles.forEach((p, i) => {
    m4.position.set(p.x, -0.15, p.z); m4.updateMatrix(); floors.setMatrixAt(i, m4.matrix);
    const zone = zoneAt(p), kind = zone.id === 'fogata' ? 'fogata' : STONE_ZONES.has(zone.id) ? 'stone' : zone.id === 'muelle' && p.z > 27 ? 'wood' : zone.path ? 'path' : 'grass';
    color.setHex(palette[kind]).multiplyScalar(0.82 + rand() * 0.26); floors.setColorAt(i, color);
  });
  group.add(floors);

  // Walls: a hedge of jungle (stone inside the temple and mine) on every edge.
  for (const p of tiles) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = p.x + dx, nz = p.z + dz;
    if (floorAt(nx, nz) || (Math.abs(nz) < 3.2 && Math.abs(nx - BRIDGE_X) < BRIDGE_HALF + 0.6)) continue;
    const stone = STONE_ZONES.has(zoneAt(p).id), h = stone ? 2.2 : 1.3 + rand() * 0.5;
    const x = p.x + dx * 0.75, z = p.z + dz * 0.75;
    box(staticRoot, stone ? stoneWall : hedge, dx ? 0.5 : 1.02, h, dz ? 0.5 : 1.02, x, h / 2 - 0.1, z);
    box(staticRoot, stone ? stoneTop : hedgeTop, dx ? 0.6 : 1.04, 0.16, dz ? 0.6 : 1.04, x, h - 0.1, z);
  }
  // The jungle beyond the walls.
  for (let i = 0, placed = 0; i < 900 && placed < 110; i++) {
    const x = BOUNDS.minX - 4 + rand() * (BOUNDS.maxX - BOUNDS.minX + 8), z = BOUNDS.minZ - 4 + rand() * (BOUNDS.maxZ - BOUNDS.minZ + 4);
    let clear = true;
    for (let a = 0; a < 8 && clear; a++) if (floorAt(x + Math.sin(a) * 2.2, z + Math.cos(a) * 2.2) || floorAt(x, z)) clear = false;
    if (!clear || (z > 30 && x > -12 && x < 50)) continue;
    const plant = placed % 5 === 0 ? palm({ seed: placed + 3, h: 6 + rand() * 4 }) : fern({ seed: placed + 9 });
    place(staticRoot, plant, x, -0.3, z, rand() * 6.28, placed % 5 === 0 ? 1 : 1.2 + rand() * 0.8); placed++;
  }

  // ---- La fogata ----
  const fire = place(dynamic, campfire(), FIRE.x, 0, FIRE.z, 0, 1.8);
  box(staticRoot, mat(0x6b6e5d), 1.5, 0.9, 1.5, RELIC.x, 0.45, RELIC.z);
  box(staticRoot, mat(0x8d8a6e), 1.8, 0.16, 1.8, RELIC.x, 0.9, RELIC.z);
  const relic = place(dynamic, sunRelic(), RELIC.x, 1.05, RELIC.z, 0, 0.9);
  const relicGlow = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 10), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.18, depthWrite: false }));
  relicGlow.position.set(RELIC.x, 1.8, RELIC.z); dynamic.add(relicGlow);
  const bell = place(dynamic, campBell(), BELL.x, 0, BELL.z, -0.6);
  place(staticRoot, campTent(), 6.5, 0, -6.5, -Math.PI * 0.75, 1);
  place(staticRoot, campTent({ color: 0x8c6f4e }), -6.5, 0, -6.5, Math.PI * 0.75, 1);
  for (const [x, z] of [[-9, -3], [9, 3], [-3, 9], [9, -9]]) place(staticRoot, expeditionLantern(), x, 0, z, 0, 1.6);

  // ---- El puente colgante ----
  const bridge = place(dynamic, ropeBridge({ span: BRIDGE_HALF * 2, seed: 54 }), BRIDGE_X, -1.7, 0);
  bridge.scale.z = 3.4;
  const broken = new THREE.Group(); broken.visible = false; dynamic.add(broken);
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
    const plank = box(broken, wood, 0.4, 0.08, 4.6, BRIDGE_X + s * (BRIDGE_HALF - 0.3), -0.4 - i * 0.55, 0); plank.rotation.z = s * 1.2;
    plank.position.x += s * -0.15 * i;
  }

  // ---- El cruce ----
  const lanterns = [];
  { const s = stationById('faroles');
    box(staticRoot, darkWood, 0.18, 2.4, 0.18, s.x, 1.2, s.z); box(staticRoot, darkWood, 2.2, 0.12, 0.12, s.x, 2.35, s.z);
    for (let i = 0; i < 4; i++) {
      const l = place(dynamic, expeditionLantern(), s.x - 0.9 + i * 0.6, 1.55, s.z, 0, 1.1); lanterns.push(l);
      l.traverse(o => { if (o.material?.emissive && o.material.emissiveIntensity > 1) { o.material = o.material.clone(); owned.add(o.material); l.userData.glow = o.material; } });
    }
  }
  { const s = stationById('tabla');
    for (let i = 0; i < 5; i++) box(staticRoot, i % 2 ? wood : darkWood, 1.8, 0.1, 0.32, s.x, 0.05 + i * 0.1, s.z + (i % 2 ? 0.05 : -0.05)).rotation.y = (i - 2) * 0.05;
    box(staticRoot, mat(0x3a3f3d), 0.08, 0.06, 0.5, s.x + 0.4, 0.58, s.z); }
  place(staticRoot, vineArch({ seed: 54 }), -30, 0, -8.5, 0, 1).scale.x = 1.32;

  // ---- La cascada ----
  const falls = place(dynamic, waterfallRocks({ seed: 54 }), -30, -0.1, -39.2);
  { const s = stationById('agua');
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.26, 0.55, 12), mat(0x7b5a3a)); bucket.position.set(s.x, 0.28, s.z); staticRoot.add(bucket);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 12), mat(0x3fb4b8, { emissive: 0x0f3f44 })); water.position.set(s.x, 0.5, s.z); staticRoot.add(water); }

  // ---- El templo ----
  place(staticRoot, templeEntrance({ seed: 54 }), -30, -0.1, -69.6, 0, 0.9);
  for (const [x, z] of [[-36, -54], [-24, -54]]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.15, 4.6, 10), mat(0x7f806b)); col.position.set(x, 2.3, z); col.castShadow = true; staticRoot.add(col);
    box(staticRoot, mat(0xbdab7d), 2.3, 0.3, 2.3, x, 4.6, z);
  }
  for (const [x, z] of [[-39, -49], [-21, -49]]) place(staticRoot, stoneTotem({ seed: 54 }), x, 0, z, x < -30 ? Math.PI / 2 : -Math.PI / 2, 0.8);
  { const s = stationById('jeroglificos');
    box(staticRoot, mat(0x8a8466), 2.6, 2.4, 0.5, s.x, 1.2, s.z - 0.3);
    const jade = mat(0x4cba94, { emissive: 0x1b7858, emissiveIntensity: 0.5 });
    for (let i = 0; i < 6; i++) { const g = box(staticRoot, jade, 0.26, 0.26, 0.08, s.x - 0.8 + (i % 3) * 0.8, 0.9 + Math.floor(i / 3) * 0.7, s.z - 0.03); g.rotation.z = Math.PI / 4; } }

  // ---- El túnel y la mina ----
  for (let x = -16; x <= 12; x += 4) { box(staticRoot, darkWood, 0.4, 3.2, 0.4, x, 1.6, -60.6); box(staticRoot, darkWood, 0.4, 3.2, 0.4, x, 1.6, -55.4); box(staticRoot, darkWood, 0.4, 0.4, 5.6, x, 3.2, -58); }
  for (let z = -44; z >= -38; z -= 6) { for (const x of [21.4, 26.6]) box(staticRoot, darkWood, 0.45, 3.4, 0.45, x, 1.7, z); box(staticRoot, darkWood, 6, 0.45, 0.6, 24, 3.4, z); }
  for (const x of [23.2, 24.8]) box(staticRoot, mat(0x3a4c46), 0.08, 0.06, 26, x, 0.03, -46);
  for (let z = -59; z <= -34; z += 1.2) box(staticRoot, darkWood, 2.2, 0.05, 0.22, 24, 0.01, z);
  const winch = place(dynamic, expeditionWinch(), stationById('malacate').x, 0, stationById('malacate').z, 0, 1.15);
  for (const [x, z] of [[18, -50], [29, -52]]) {
    box(staticRoot, mat(0x4a4f4a), 1.6, 0.9, 1.1, x, 0.75, z);
    for (const s of [-1, 1]) for (const t of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.12, 10), mat(0x2b2f2c)); w.rotation.x = Math.PI / 2; w.position.set(x + s * 0.55, 0.22, z + t * 0.58); staticRoot.add(w); }
    for (let i = 0; i < 3; i++) { const ore = new THREE.Mesh(new THREE.DodecahedronGeometry(0.25), mat(0xd3ad62, { metalness: 0.5 })); ore.position.set(x - 0.4 + i * 0.4, 1.25, z); staticRoot.add(ore); }
  }

  // ---- El depósito ----
  { const s = stationById('reliquia');
    box(staticRoot, wood, 2, 0.1, 1.1, s.x, 0.85, s.z); for (const x of [-0.85, 0.85]) for (const z of [-0.4, 0.4]) box(staticRoot, darkWood, 0.1, 0.85, 0.1, s.x + x, 0.42, s.z + z);
    const gold = mat(0xe6b65d, { metalness: 0.6, roughness: 0.35 });
    for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 4), gold); f.position.set(s.x - 0.6 + i * 0.4, 1.0, s.z + (i % 2 ? 0.15 : -0.15)); f.rotation.z = Math.PI / 2 + i; staticRoot.add(f); } }
  for (const [x, z, kind] of [[16.8, -22, 'barrel'], [31.2, -25.5, 'crate'], [16.8, -34, 'crate'], [31, -34.2, 'barrel']]) place(staticRoot, kind === 'barrel' ? barrel() : crate(), x, 0, z, rand(), 0.8);

  // ---- La carpa de la radio ----
  place(staticRoot, campTent({ color: 0x55603f }), 36, 0, -9.2, 0, 1.6);
  const radio = place(dynamic, radioSet(), stationById('radio').x, 0, stationById('radio').z, Math.PI);
  { const f = FIXES.radio[0];
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 5, 6), mat(0x3a3f3d, { metalness: 0.5 })); mast.position.set(f.x, 2.5, f.z - 1.1); staticRoot.add(mast);
    box(staticRoot, mat(0x4a5a3c), 0.8, 0.9, 0.6, f.x, 0.45, f.z - 1); }

  // ---- La cocina ----
  { const s = stationById('arepas');
    for (let i = 0; i < 7; i++) { const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28), mat(0x767b6c)); const a = i / 7 * Math.PI * 2; st.position.set(s.x + Math.sin(a) * 0.55, 0.2, s.z + Math.cos(a) * 0.55); staticRoot.add(st); }
    const budare = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 0.06, 18), mat(0x26282a, { metalness: 0.4 })); budare.position.set(s.x, 0.48, s.z); staticRoot.add(budare);
    for (let i = 0; i < 3; i++) place(staticRoot, food('arepa'), s.x - 0.3 + i * 0.3, 0.5, s.z + (i - 1) * 0.15, 0, 0.6); }
  place(staticRoot, coffeeTable(), -2, 0, 22, 0, 1.3);
  { const s = stationById('prov-cocina');
    box(staticRoot, darkWood, 2, 2.2, 0.5, s.x, 1.1, s.z - 0.5);
    for (let i = 0; i < 3; i++) place(staticRoot, crate(), s.x - 0.6 + i * 0.6, 0, s.z + 0.2, 0, 0.35); }

  // ---- El muelle ----
  place(staticRoot, wetlandLanding({ length: 8 }), 27, -0.95, 33.5);
  const canoe = place(dynamic, riverCanoe(), 23, -0.45, 36.5, -Math.PI / 2, 1);
  { const s = stationById('prov-muelle'); for (let i = 0; i < 3; i++) place(staticRoot, crate(), s.x + (i - 1) * 0.5, i === 2 ? 0.5 : 0, s.z + (i === 2 ? 0 : 0.2), rand(), 0.4); }
  const dam = place(dynamic, damGate(), 36.5, -0.6, 33, Math.PI / 2, 1.2);
  const levers = FIXES.crecida.map(f => { const g = new THREE.Group(); g.position.set(f.x, 0, f.z); box(g, stoneWall, 0.6, 0.7, 0.6, 0, 0.35, 0); const arm = box(g, mat(0xb4472f), 0.12, 1.1, 0.12, 0, 0.9, 0); arm.rotation.z = 0.5; dynamic.add(g); return arm; });

  // ---- Vents and hiding spots ----
  const vents = new Map();
  for (const v of VENTS) {
    const a = wallDirection(v), g = new THREE.Group();
    // Logs lie along the wall just outside it, open end at the vent.
    if (v.kind === 'log') { const log = hollowLog({ seed: v.x | 0, length: 3.4 }); log.rotation.y = a; log.position.set(Math.sin(a) * 1.25 + Math.cos(a) * 1.2, -0.15, Math.cos(a) * 1.25 - Math.sin(a) * 1.2); log.scale.setScalar(0.85); g.add(log); }
    else { box(g, stoneWall, 2.6, 2.4, 0.6, Math.sin(a) * 0.8, 1.2, Math.cos(a) * 0.8).rotation.y = a; box(g, mat(0x050608), 1.6, 1.6, 0.62, Math.sin(a) * 0.75, 0.8, Math.cos(a) * 0.75).rotation.y = a; }
    g.position.set(v.x, 0, v.z); dynamic.add(g); vents.set(v.id, { group: g, shake: 0 });
  }
  const hides = new Map();
  for (const h of HIDES) {
    const model = h.prop === 'tent' ? campTent() : h.prop === 'cooler' ? cooler() : h.prop === 'crate' ? crate() : h.prop === 'barrel' ? barrel() : null;
    if (!model) continue;
    const g = place(dynamic, model, h.x, 0, h.z, h.prop === 'tent' ? Math.PI / 4 : rand(), h.prop === 'tent' ? 0.7 : 0.9); hides.set(h.id, { group: g, shake: 0 });
  }

  // Station rings: lit for the stations in your task list.
  const rings = new Map();
  for (const s of STATIONS) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.3, 40), new THREE.MeshBasicMaterial({ color: 0xffc629, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(s.x, 0.04, s.z); ring.visible = false; dynamic.add(ring); rings.set(s.id, ring);
  }

  const staticBatch = bake(staticRoot, { cellSize: 24 }); group.add(staticBatch);
  const originals = new Set(); staticRoot.traverse(o => { if (o.geometry) originals.add(o.geometry); }); originals.forEach(g => g.dispose());

  let winchTurn = 0, flood = 0;
  // view: the seat's latest view (may be null in Studio).
  function update(t, view = null, dt = 0.016) {
    const w = view?.world || {};
    tickWind(t, 0.85);
    river.userData.tick?.(t);
    fire.userData.tick?.(t); falls.userData.tick?.(t);
    relic.rotation.y = t * 0.5; relic.position.y = 1.05 + Math.sin(t * 1.6) * 0.06;
    const blaze = view?.ending?.winner === 'panas';
    relicGlow.material.opacity = w.lightsOut ? 0.03 : blaze ? 0.45 + Math.sin(t * 3) * 0.08 : 0.16 + Math.sin(t * 2) * 0.03;
    relicGlow.scale.setScalar(THREE.MathUtils.damp(relicGlow.scale.x, blaze ? 3.2 : 1, 1.5, dt));
    bell.userData.ring(t, w.bell > 0 ? 1 : 0);
    bridge.visible = !w.bridgeCut; broken.visible = !!w.bridgeCut;
    winchTurn += dt * (w.winch > 0 ? 6 : 0); winch.userData.wheel.rotation.z = -winchTurn;
    lanterns.forEach((l, i) => { if (l.userData.glow) l.userData.glow.emissiveIntensity = (w.lanterns ?? 4) > i ? 1.5 + Math.sin(t * 7 + i) * 0.15 : 0.05; });
    radio.userData.dial.rotation.z = w.jammed ? Math.sin(t * 20) * 0.6 : Math.sin(t * 0.4) * 0.2;
    flood = THREE.MathUtils.damp(flood, w.flood ? 1 : 0, 1.5, dt);
    river.position.y = -0.3 + flood * 0.25; dam.userData.setOpen(flood);
    levers.forEach(arm => { arm.rotation.z = w.flood ? 0.5 + Math.sin(t * 6) * 0.1 : -0.5; });
    const cw = sampleWaterWave(canoe.position.x, canoe.position.z, t, 0.055);
    canoe.position.y = -0.45 + cw.y + flood * 0.2;
    canoe.rotation.x = cw.pitch;
    canoe.rotation.z = cw.roll;
    for (const [, v] of vents) { v.shake = Math.max(0, v.shake - dt); v.group.rotation.z = v.shake > 0 ? Math.sin(t * 40) * 0.04 : 0; }
    for (const [, h] of hides) { h.shake = Math.max(0, h.shake - dt); h.group.position.y = h.shake > 0 ? Math.abs(Math.sin(t * 30)) * 0.05 : 0; }
    for (const ring of rings.values()) if (ring.visible) ring.material.opacity = 0.45 + Math.sin(t * 4) * 0.25;
  }
  function mark(ids = new Set()) { for (const [id, ring] of rings) ring.visible = ids.has(id); }
  function shake(id) { const v = vents.get(id) || hides.get(id); if (v) v.shake = 0.9; }
  function dispose() {
    river.userData.dispose?.();
    const geometries = new Set(); group.traverse(o => { if (o.geometry) geometries.add(o.geometry); if (o.material?.isMeshBasicMaterial) o.material.dispose(); });
    geometries.forEach(g => g.dispose()); owned.forEach(m => m.dispose()); owned.clear();
  }
  return { group, update, dispose, mark, shake, groundAt, canoe, bounds: new THREE.Box3(new THREE.Vector3(BOUNDS.minX - 6, -4, BOUNDS.minZ - 8), new THREE.Vector3(BOUNDS.maxX + 6, 14, BOUNDS.maxZ + 16)) };
}

// The guardian of ¡Un, dos, tres, momia! (built on demand by the game).
export const guardianModel = () => mummy({ guardian: true });
