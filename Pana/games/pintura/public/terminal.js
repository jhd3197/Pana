import * as THREE from 'three';
import { shippingContainer, transitWarehouse, portBollard, steelShed, oilDrum } from '/engine/models/props/port-cargo.js';
import { portCrane, yardGantry } from '/engine/models/props/port-crane.js';
import { cargoShip } from '/engine/models/props/cargo-ship.js';
import { portSilos } from '/engine/models/props/port-silos.js';
import { colonialHouse } from '/engine/models/props/colonial-house.js';
import { crate, streetLamp } from '/engine/models/props/plaza.js';
import { flagPole } from '/engine/models/props/flags.js';
import { splatTexture, teamCanopy, sandbagWall } from '/engine/models/props/paintball.js';
import { palm } from '/engine/models/vegetation/palm.js';
import { bake } from '/engine/models/core/static-batch.js';
import { disposeModel } from '/engine/models/props/game-table.js';
import { waterSurface } from '/engine/models/effects/water-surface.js';
import { rng } from '/engine/random.js';
import { TERMINAL_BOUNDS, TERMINAL_STACKS, TERMINAL_COVERS, TERMINAL_SPAWNS, CONTAINER, BASES, BASE, SHED } from './terminal-layout.js';
import { COLORS } from './rules.js';

const PAINT = [0xe8582a, 0x2f7cf0, 0x36a85a, 0xf2c12e, 0xd8323a, 0x1fa8a8, 0x8a5ad0, 0xf2f2f2];
const OLD_PAINT = ['#ffd23a', '#2f7cf0', '#ff4fa8', '#3ac85a'];
// The quay sits well south of the court, so the overview camera never flies through a crane boom.
const QUAY = 80;
// The court runs 116 m between the bases: the fog and far plane open up to keep the other base in view.
export const LONG_VIEW = { fog: [150, 460], far: 700 };

// El Puerto's container terminal. Collision comes from TERMINAL_COVERS[variant];
// every container, shed column, sandbag run and base pile is fitted to those rows.
export function createTerminal(variant = 0) {
  const group = new THREE.Group(), statics = new THREE.Group(), animated = [], cameraBounds = [], materials = new Map(), r = rng(20261023);
  group.name = 'El Puerto'; group.userData.mapId = 'terminal'; // i18n-ignore: scene object name
  const material = color => { if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .9 })); return materials.get(color); };
  const box = (w, h, d, color, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color)); m.position.set(x, y, z); m.receiveShadow = true; statics.add(m); return m; };
  const put = (object, x, z, angle = 0, y = 0) => { object.position.set(x, y, z); object.rotation.y = angle; statics.add(object); return object; };
  const { x: hx, z: hz } = TERMINAL_BOUNDS, cover = TERMINAL_COVERS[variant];

  // Yard concrete, the darker court with bay lines, the painted bases and the centre line.
  box(420, .3, QUAY + 170, '#a8a194', 0, -.25, (QUAY - 170) / 2);
  box(hx * 2 + 1, .12, hz * 2 + 1, '#8f897e', 0, -.07, 0);
  for (let x = -hx + 8; x < hx - 6; x += 12) box(.14, .02, hz * 2 - 2, '#e6c34f', x, 0, 0);
  for (const z of [-hz + 1.2, hz - 1.2]) box(hx * 2 - 2, .02, .14, '#e6c34f', 0, 0, z);
  box(.4, .025, hz * 2, '#f4f1ea', 0, .005, 0);
  BASES.forEach(({ x, side }, team) => {
    box(BASE.depth, .02, BASE.halfWidth * 2, COLORS[team], x + side * 1.5, .01, 0).material = new THREE.MeshStandardMaterial({ color: COLORS[team], roughness: .9, transparent: true, opacity: .6, depthWrite: false });
  });
  const ring = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  for (const s of TERMINAL_SPAWNS) { const pad = new THREE.Mesh(new THREE.RingGeometry(.7, .95, 32).rotateX(-Math.PI / 2), ring); pad.position.set(s.x, .03, s.z); group.add(pad); }

  // Paint left by earlier rounds on the concrete.
  const splats = [1, 2, 3, 4].map(seed => splatTexture(seed)), stains = new Map();
  const stain = (color, n) => { const key = `${color}:${n % 4}`; if (!stains.has(key)) stains.set(key, new THREE.MeshStandardMaterial({ color, map: splats[n % 4], transparent: true, alphaTest: .4, roughness: .35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })); return stains.get(key); };
  for (let k = 0; k < 120; k++) {
    const s = .6 + r() * 1.6, mark = new THREE.Mesh(new THREE.PlaneGeometry(s, s), stain(OLD_PAINT[k % 4], k));
    mark.rotation.set(-Math.PI / 2, 0, r() * 6); mark.position.set((r() * 2 - 1) * (hx - 2), .03 + k * .0002, (r() * 2 - 1) * (hz - 2)); group.add(mark);
  }

  // A tall netting fence round the court.
  const post = new THREE.MeshStandardMaterial({ color: '#3a4048', roughness: .6, metalness: .3 }), net = new THREE.MeshStandardMaterial({ color: '#1c242c', transparent: true, opacity: .32, side: THREE.DoubleSide, depthWrite: false });
  for (const [length, along, at] of [[hx * 2, 'x', -hz - .6], [hx * 2, 'x', hz + .6], [hz * 2, 'z', -hx - .6], [hz * 2, 'z', hx + .6]]) {
    for (let u = -length / 2; u <= length / 2 + .01; u += 6) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, 7.3, 6), post); p.position.set(along === 'x' ? u : at, 3.65, along === 'x' ? at : u); p.castShadow = true; statics.add(p); }
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(length + 1.2, 7), net); sheet.position.set(along === 'x' ? 0 : at, 3.5, along === 'x' ? at : 0); if (along === 'z') sheet.rotation.y = Math.PI / 2; group.add(sheet);
  }

  // Containers: each stack of the round's yard, with splats from older battles on top-level sides.
  let n = 0;
  for (const { x, z, turned, feet, levels } of TERMINAL_STACKS[variant]) {
    const length = CONTAINER.lengths[feet];
    for (let level = 0; level < levels; level++, n++) {
      const container = shippingContainer({ color: PAINT[(n * 5 + Math.floor(r() * 3)) % PAINT.length], length, markings: n % 3 === 0 });
      put(container, x, z, (turned ? 0 : Math.PI / 2) + (r() > .5 ? Math.PI : 0) + (level ? (r() - .5) * .02 : 0), level * CONTAINER.h);
    }
    const o = { w: turned ? 2.6 : length + .3, d: turned ? length + .3 : 2.6 };
    for (let k = 0; k < 1 + (n % 3); k++) {
      const s = .8 + r() * 1, mark = new THREE.Mesh(new THREE.PlaneGeometry(s, s), stain(OLD_PAINT[(n + k) % 4], n + k)), face = r() > .5 ? 1 : -1, u = (r() - .5) * .7, y = .6 + r() * (levels * CONTAINER.h - 1.2);
      if (turned) { mark.position.set(x + face * (o.w / 2 + .02), y, z + u * o.d); mark.rotation.set(0, face * Math.PI / 2, r() * 6); }
      else { mark.position.set(x + u * o.w, y, z + face * (o.d / 2 + .02)); mark.rotation.set(0, face > 0 ? 0 : Math.PI, r() * 6); }
      group.add(mark);
    }
  }

  // The steel shed in the middle, its sandbags, and each base's gear: only rows this yard keeps.
  put(steelShed(SHED), 0, 0);
  for (const o of cover) {
    cameraBounds.push(new THREE.Box3(new THREE.Vector3(o.x - o.w / 2, 0, o.z - o.d / 2), new THREE.Vector3(o.x + o.w / 2, o.h, o.z + o.d / 2)));
    if (o.kind === 'sandbags') put(sandbagWall({ w: o.w, h: o.h, d: o.d, seed: Math.round(o.x) + 9 }), o.x, o.z);
    else if (o.kind === 'ammo') for (let i = 0; i < 4; i++) {
      const model = crate(), size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()), wrapper = new THREE.Group();
      wrapper.add(model); wrapper.scale.set(o.w / 2 / size.x * .94, o.h / size.y, o.d / 2 / size.z * .94);
      put(wrapper, o.x + (i % 2 - .5) * o.w / 2, o.z + (Math.floor(i / 2) - .5) * o.d / 2, 0, 0);
    } else if (o.kind === 'barrels') for (let i = 0; i < 3; i++) put(oilDrum({ color: [0x2f7cf0, 0xe8402a, 0x3aa85a][(i + Math.round(o.z)) % 3] }), o.x + (i - 1) * .9, o.z + (i - 1) * .6, r() * 6);
  }
  BASES.forEach(({ x, side }, team) => {
    put(teamCanopy({ color: COLORS[team], size: 5.2 }), x + side * 2, 13);
    const pole = put(flagPole({ h: 8, flag: 'pana' }), x + side * 4, -12, side > 0 ? Math.PI : 0); statics.remove(pole); group.add(pole); animated.push(pole);
  });

  // Yard gantries straddle the court beyond each base, legs outside the fence.
  for (const x of [-74, 74]) put(yardGantry({ span: 72, height: 20 }), x, 0);

  // The quay, its bollards, the ship-to-shore cranes and two carriers at the berth.
  box(420, 4, 4, '#9a9488', 0, -2, QUAY - 2);
  box(420, .05, .5, '#e6c34f', 0, .02, QUAY - 1.2);
  for (let x = -186; x <= 186; x += 12) put(portBollard(), x, QUAY - .9);
  for (const x of [-50, 0, 50]) put(portCrane(), x, QUAY - 3);
  const sea = waterSurface(new THREE.PlaneGeometry(600, 300, 90, 45).rotateX(-Math.PI / 2), { kind: 'sea', amplitude: .08, color: '#2f8fb5' });
  sea.position.set(0, -.9, QUAY + 150); group.add(sea); animated.push(sea);
  for (const [x, phase] of [[-46, 0], [48, 2.1]]) {
    const ship = put(cargoShip(), x, QUAY + 16, Math.PI / 2 * (x < 0 ? 1 : -1), -2.9); statics.remove(ship); group.add(ship);
    ship.userData.tick = t => { ship.position.y = -2.9 + Math.sin(t * .5 + phase) * .08; ship.rotation.z = Math.sin(t * .37 + phase) * .006; }; animated.push(ship);
  }

  // Beyond the north fence: warehouses, the silos, palms and the town on the hill.
  for (const x of [-56, -6, 44]) put(transitWarehouse(), x, -54, Math.PI / 2);
  put(portSilos(), -112, -58);
  for (let x = -118; x <= 118; x += 9) if (Math.abs(((x + 56) % 50 + 50) % 50 - 25) > 16 || Math.abs(x) > 80) put(palm({ h: 8 + r() * 4, seed: x + 200 }), x + (r() - .5) * 3, -40 - r() * 2, r() * 6);
  for (const x of [-64, 64]) for (const z of [-20, -6, 8, 22]) put(palm({ h: 9 + r() * 3, seed: x + z }), x, z, r() * 6);
  for (const x of [-30, 30]) put(streetLamp(), x, -38);
  const hillHeight = (x, z) => Math.max(0, (-z - 80) * .3) * (.85 + .3 * Math.sin(x * .02) * Math.cos(z * .03));
  const hill = new THREE.PlaneGeometry(700, 300, 70, 30).rotateX(-Math.PI / 2); hill.translate(0, 0, -230);
  const p = hill.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, hillHeight(p.getX(i), p.getZ(i)) + Math.sin(p.getX(i) * .1) * Math.sin(p.getZ(i) * .13) * .8 - .2);
  hill.computeVertexNormals();
  const land = new THREE.Mesh(hill, new THREE.MeshStandardMaterial({ color: '#5aa040', roughness: .95, flatShading: true })); land.receiveShadow = true; statics.add(land);
  const families = ['casa-balcon', 'casa-baja', 'casa-esquina', 'casa-portal', 'casa-remate'], palettes = ['crema', 'turquesa', 'coral-crema', 'amarillo', 'azul', 'cielo'];
  for (let i = 0; i < 36; i++) {
    const x = (r() * 2 - 1) * 210, z = -110 - r() * 120;
    put(colonialHouse({ seed: 600 + i, family: families[i % 5], palette: palettes[(i * 5) % 6], width: 8 + r() * 3, depth: 7.5, floorHeight: 3.6 + r() * .7, roof: i % 3 ? 'tejas' : 'azotea', detail: 'low' }), x, z, Math.PI + Math.round(r() * 2 - 1) * .3, hillHeight(x, z) - .3);
  }
  for (let i = 0; i < 26; i++) { const x = (r() * 2 - 1) * 230, z = -95 - r() * 140; put(palm({ h: 8 + r() * 4, seed: 900 + i, detail: 'low' }), x, z, r() * 6, hillHeight(x, z) - .2); }

  statics.traverse(o => { if (o.isMesh && o !== land) o.castShadow = true; });
  const batch = bake(statics), original = new Set();
  statics.traverse(o => { if (o.geometry) original.add(o.geometry); }); original.forEach(g => g.dispose()); group.add(batch);
  // Canonical factories cache materials: own clones before this map is ever freed.
  const owned = new Map();
  group.traverse(o => { if (o.material) { const own = m => { if (!owned.has(m)) owned.set(m, m.clone()); return owned.get(m); }; o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material); } });
  let disposed = false;
  return { id: 'terminal', group, cameraBounds, lighting: LONG_VIEW,
    update(t, dt) { animated.forEach(o => o.userData.tick?.(t, dt)); },
    dispose() { if (disposed) return; disposed = true; group.traverse(o => o.userData.dispose?.()); splats.forEach(t => t.dispose()); disposeModel(group); },
  };
}
