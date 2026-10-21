// Trifulca's arenas, dressed from the shared model library around a ring at
// the origin: la calle del barrio (a moto passes through), el toldo (a real
// little ring with the Ávila behind), el mercado mayorista (crates that tumble)
// and la plaza de las motos at night (parked motos that fall like dominoes).
// Each returns { group, floor, light, npcSpots, update(t, dt), react(event), reset(), dispose() }.
import * as THREE from 'three';
import { house } from '/engine/models/props/plaza-buildings.js';
import { cornerBodega, streetlightPole, streetFoodKiosk, rooftopWaterTank, parkBench, busStopShelter } from '/engine/models/props/pueblo.js';
import { marketStall, streetLamp } from '/engine/models/props/plaza.js';
import { buntingLine } from '/engine/models/props/fiesta.js';
import { bulbWire } from '/engine/models/props/mine.js';
import { iceCreamCart } from '/engine/models/props/ice-cream-cart.js';
import { fruitDeliveryTruck } from '/engine/models/props/fruit-delivery-truck.js';
import { cargoHandcart } from '/engine/models/props/cargo-handcart.js';
import { parkedMoto, cablePole, cableSpan, produceCrates, marketHandTruck, plasticChair, woodenStands, lakeBridge, MOTO_COLORS } from '/engine/models/props/barrio.js';
import { ranchFence, corralGate, hayBale, waterWindmill } from '/engine/models/props/ranch.js';
import { ranchCaney, hitchingRail } from '/engine/models/props/llano-life.js';
import { cemeteryLampPost } from '/engine/models/props/cemetery.js';
import { hatoCow } from '/engine/models/fauna/farm/hato-cow.js';
import { llaneroHorse } from '/engine/models/fauna/farm/llanero-horse.js';
import { createColonialStreet } from '/engine/worlds/colonial-street.js';
import { palm, araguaney, saman } from '/engine/models/vegetation/index.js';
import { CAR_BUILDERS } from '/engine/models/vehicles/cars.js';
import { randomAvatar } from '/engine/avatar.js';
import { rng } from '/engine/random.js';
import { Puffs } from '/engine/fx.js';
import { disposeModel } from '/engine/models/props/game-table.js';
import { tentRing, avilaRidge, RING } from './set.js';

const COLORS = [0xf2a65a, 0x7cc6a4, 0xf28bb0, 0xffd166, 0x8ecae6, 0xe76f51, 0xb5a1e0, 0xf4e285];
const STYLES = ['balcon', 'terraza', 'tienda', 'balcon', 'tejas', 'terraza'];

// Light for each arena: the sun, the sky and the lamps.
export const LIGHTS = {
  calle: { sun: ['#ffd9a0', 3.1, [-12, 22, 10]], hemi: ['#fff3da', '#c08a5a', 2.1], exposure: 1.06, daylight: 1, background: '#f4e2bd' },
  toldo: { sun: ['#ffb36b', 2.7, [-18, 9, -6]], hemi: ['#ffe2c2', '#8a5a48', 1.8], exposure: 1.08, daylight: .75, background: '#f2c49a', ringLight: 30 },
  mercado: { sun: ['#ffe2b0', 3, [10, 24, 8]], hemi: ['#fff6e6', '#b08a62', 2.2], exposure: 1.04, daylight: 1, background: '#f1e4c8' },
  manga: { sun: ['#ffd08a', 3.2, [14, 20, 12]], hemi: ['#fff1d0', '#b5824e', 2], exposure: 1.06, daylight: 1, background: '#f6dfb4' },
  cebra: { sun: ['#ff9e6b', 1.5, [-30, 8, -10]], hemi: ['#a99ad8', '#4a3550', 1.5], exposure: 1.14, daylight: .3, background: '#4b3c6b', ringLight: 45 },
  colonial: { sun: ['#ffe2b0', 3, [-12, 22, 14]], hemi: ['#fff6e6', '#b98a5a', 2.1], exposure: 1.05, daylight: 1, background: '#f3e2bf' },
  motos: { sun: ['#9fbcff', 1.1, [-10, 20, -12]], hemi: ['#7d8fd6', '#3a2f48', 1.5], exposure: 1.2, daylight: 0, background: '#1b2340', ringLight: 70 },
};

function placed(parent, object, x, z, angle = 0, y = 0) {
  object.position.set(x, y, z); object.rotation.y = angle; parent.add(object); return object;
}
// A house whose front stands on a line facing the street.
function frontAt(parent, object, x, z, angle) {
  object.rotation.y = angle; object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  object.position.set(x, 0, z);
  if (angle === 0) object.position.z = z - box.max.z;
  else if (Math.abs(angle) === Math.PI) object.position.z = z - box.min.z;
  else if (angle > 0) object.position.x = x - box.max.x;
  else object.position.x = x - box.min.x;
  parent.add(object); return object;
}
function ground(parent, w, d, color, y = 0, x = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, .2, d), new THREE.MeshStandardMaterial({ color, roughness: .95 }));
  mesh.position.set(x, y - .1, z); mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function parkedCar(id, seed) {
  const car = CAR_BUILDERS[id](randomAvatar(rng(seed)));
  if (car.driver?.group) car.driver.group.visible = false;
  return car.root;
}
// Painted chalk circle on the street: where the human ring stands.
function chalkRing(parent, r) {
  const mesh = new THREE.Mesh(new THREE.RingGeometry(r - .08, r + .08, 64), new THREE.MeshBasicMaterial({ color: '#f6f1e4', transparent: true, opacity: .75 }));
  mesh.rotation.x = -Math.PI / 2; mesh.position.y = .012; parent.add(mesh); return mesh;
}

export function createArena(id, arena) {
  const group = new THREE.Group(), animated = [], random = rng({ calle: 41, toldo: 12, mercado: 77, motos: 5 }[id] || 1);
  const ctx = { group, animated, random, npcSpots: [], dominoes: [], crates: [], moto: null, bull: null, bus: null, ropes: null, floor: 0, lamps: [], camBox: null, hats: false };
  group.name = { calle: 'La calle del barrio', toldo: 'El toldo', mercado: 'El mercado mayorista', motos: 'La plaza de las motos', manga: 'La manga de coleo', cebra: 'El paso de cebra', colonial: 'La calle colonial' }[id];
  ({ calle: buildCalle, toldo: buildToldo, mercado: buildMercado, motos: buildMotos, manga: buildManga, cebra: buildCebra, colonial: buildColonial }[id] || buildCalle)(ctx, arena);
  const splash = new Puffs(group);
  let wobble = 0, motoRun = null, bullRun = null, busRun = null;
  return {
    group, floor: ctx.floor, camBox: ctx.camBox, camHeight: ctx.camHeight, hats: ctx.hats, light: LIGHTS[id] || LIGHTS.calle, npcSpots: ctx.npcSpots, lamps: ctx.lamps,
    update(t, dt) {
      for (const a of animated) a(t, dt);
      // The moto crossing la calle.
      if (motoRun && ctx.moto) {
        motoRun.t += dt;
        const z = -38 * motoRun.dir + motoRun.t * 26 * motoRun.dir;
        ctx.moto.visible = true; ctx.moto.position.set(motoRun.x, 0, z); ctx.moto.rotation.y = motoRun.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
        ctx.moto.rotation.z = Math.sin(motoRun.t * 9) * .03;
        if (motoRun.t > 3) { motoRun = null; ctx.moto.visible = false; }
      }
      // La manga's bull charging across, the bus passing the zebra crossing.
      if (bullRun && ctx.bull) {
        bullRun.t += dt;
        const x = -22 * bullRun.dir + bullRun.t * 22 * bullRun.dir;
        ctx.bull.visible = true; ctx.bull.position.set(x, 0, bullRun.z); ctx.bull.rotation.y = bullRun.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        ctx.bull.userData.gallop?.(bullRun.t * 9, 1, 0);
        if (bullRun.t > 2.2) { bullRun = null; ctx.bull.visible = false; }
      }
      if (busRun && ctx.bus) {
        busRun.t += dt;
        ctx.bus.visible = true; ctx.bus.position.set(-40 * busRun.dir + busRun.t * 24 * busRun.dir, 0, 6.2); ctx.bus.rotation.y = busRun.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        if (busRun.t > 3.4) { busRun = null; ctx.bus.visible = false; }
      }
      splash.update(dt);
      // Ropes wobble after a fighter bounces on them.
      if (ctx.ropes) { wobble = Math.max(0, wobble - dt * 1.6); ctx.ropes.scale.set(1 + Math.sin(t * 40) * .012 * wobble, 1, 1 + Math.cos(t * 37) * .012 * wobble); }
      // Dominoes and crates falling.
      for (const d of ctx.dominoes) {
        if (d.fall >= 0) { d.fall += dt; const k = Math.min(1, Math.max(0, d.fall) * 2.2); d.tipper.rotation.x = -k * k * 1.42; }
      }
      for (const c of ctx.crates) {
        if (c.fall >= 0) { c.fall += dt; const k = Math.min(1, c.fall * 2); c.object.rotation.z = c.dir * k * k * 1.3; c.object.position.y = -k * .25; }
      }
    },
    // An event from the fight that the arena answers.
    react(event) {
      if (event.type === 'moto' && ctx.moto) motoRun = { t: 0, x: event.x ?? 0, dir: event.dir || 1 };
      if (event.type === 'ropes') wobble = 1;
      if (event.type === 'toro' && ctx.bull) bullRun = { t: 0, z: event.z ?? 0, dir: event.dir || 1 };
      if (event.type === 'pito' && ctx.bus) busRun = { t: 0, dir: event.dir || 1 };
      if (event.type === 'balde') {
        const side = event.side || 1;
        for (let i = 0; i < 4; i++) splash.spawn(new THREE.Vector3((Math.random() - .5) * 2, 3.4 - i * .7, side * (4.4 - i * 1.1)), { color: 0x7fd4ff, count: 6, spread: .5, size: .6, rise: -1.2, life: .7 });
      }
      if ((event.type === 'out' || event.type === 'vecino') && ctx.dominoes.length) {
        // The nearest parked moto goes first, then the rest of its row.
        const x = Math.sin(event.angle) * 6, z = Math.cos(event.angle) * 6;
        const near = ctx.dominoes.filter(d => d.fall < 0).map(d => ({ d, dist: Math.hypot(d.x - x, d.z - z) })).sort((a, b) => a.dist - b.dist)[0];
        if (near && near.dist < 3.2) {
          const row = ctx.dominoes.filter(d => d.row === near.d.row && d.fall < 0 && d.z <= near.d.z).sort((a, b) => b.z - a.z);
          row.forEach((d, i) => { d.fall = -i * .16; });
          return 'domino';
        }
      }
      if ((event.type === 'out' || event.type === 'vecino') && ctx.crates.length) {
        const x = Math.sin(event.angle) * 6, z = Math.cos(event.angle) * 6;
        const near = ctx.crates.filter(c => c.fall < 0 && Math.hypot(c.x - x, c.z - z) < 3.5);
        near.forEach((c, i) => { c.fall = -i * .1; });
        if (near.length) return 'cajas';
      }
      return null;
    },
    // Between fights the barrio tidies up.
    reset() {
      for (const d of ctx.dominoes) { d.fall = -1e9; d.tipper.rotation.x = 0; }
      for (const c of ctx.crates) { c.fall = -1e9; c.object.rotation.z = 0; c.object.position.y = 0; }
    },
    dispose() {
      splash.clear();
      const owned = []; group.traverse(o => { if (o !== group && o.userData.dispose) owned.push(o.userData.dispose); });
      owned.forEach(d => d()); disposeModel(group);
    },
  };
}

// The NPC neighbours around a ring: a second row behind the panas.
// Two rows of them, the back row in the gaps of the front one.
function ringNeighbours(ctx, arena, count, skip = () => false) {
  const r0 = arena.shape === 'square' ? arena.half * 1.12 + 2.3 : arena.r + 1.9;
  for (const [row, r, n] of [[0, r0, count], [1, r0 + 1.25, Math.round(count * 1.3)]]) for (let i = 0; i < n; i++) {
    const a = (i + .5 + row * .5) / n * Math.PI * 2 + (ctx.random() - .5) * .15;
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    if (skip(x, z)) continue;
    ctx.npcSpots.push({ x, z, face: a + Math.PI, seated: false });
  }
}

function buildCalle(ctx, arena) {
  const { group, random } = ctx;
  ctx.camBox = [8.6, 36];
  ground(group, 15, 90, 0x5d6068);
  for (const s of [-1, 1]) ground(group, 3, 90, 0xd8cdb8, .15, s * 9, 0);
  for (let z = -40; z <= 40; z += 6) ground(group, .18, 2.6, 0xf2e6c2, .012, 0, z).material.color.set(0xf2e6c2);
  chalkRing(group, arena.r);
  // House fronts down both sides of the street.
  for (const s of [-1, 1]) {
    let i = 0;
    for (let z = -38; z <= 38; z += 7.6, i++) {
      const h = house({ w: 7.2, h: i % 3 === 1 ? 8.2 : 6.2, seed: 11 + i * 3 + (s > 0 ? 40 : 0), color: COLORS[(i + (s > 0 ? 3 : 0)) % COLORS.length], style: STYLES[(i + (s > 0 ? 2 : 0)) % STYLES.length], label: i === 4 && s < 0 ? 'ABASTO EL TROMPÓN' : '' });
      frontAt(group, h, s * 10.5, z, s < 0 ? Math.PI / 2 : -Math.PI / 2);
    }
  }
  // Closing the street at both ends.
  for (const e of [-1, 1]) [-9, 0, 9].forEach((x, i) => {
    const h = house({ w: 8.6, h: 8.4, seed: 70 + i + (e > 0 ? 9 : 0), color: COLORS[(i * 3 + (e > 0 ? 1 : 4)) % COLORS.length], style: 'balcon' });
    frontAt(group, h, x, e * 44, e < 0 ? 0 : Math.PI);
  });
  // Poles and the spaghetti of cables across the street.
  const poles = [];
  for (const z of [-24, -8, 10, 26]) for (const s of [-1, 1]) {
    const pole = placed(group, cablePole({ height: 8, seed: Math.floor(random() * 99) }), s * 7.9, z + s * .8, s > 0 ? Math.PI : 0);
    poles.push([s * 7.9, pole.userData.top, z + s * .8]);
  }
  for (let i = 0; i < poles.length; i += 2) group.add(cableSpan(poles[i], poles[i + 1], { seed: i + 3 }));
  for (let i = 0; i + 2 < poles.length; i++) group.add(cableSpan(poles[i], poles[i + 2], { strands: 3, seed: i + 30 }));
  for (const z of [-15, 16]) { const line = buntingLine({ span: 15, seed: Math.floor(random() * 99), height: 5.2 }); line.position.set(0, 0, z); line.rotation.y = Math.PI / 2; group.add(line); }
  // Parked motos and a car along the curbs; the bodega and the señora.
  for (const [s, z0] of [[-1, -20], [1, 12], [1, -16]]) for (let k = 0; k < 4; k++) {
    placed(group, parkedMoto({ color: MOTO_COLORS[Math.abs(k + z0) % MOTO_COLORS.length], seed: k + z0 + 50, detail: 'light' }), s * 6.6, z0 + k * 1.1, s > 0 ? -Math.PI / 2 + .3 : Math.PI / 2 - .3);
  }
  placed(group, parkedCar('familiar', 9), -6.1, 22, 0);
  placed(group, parkedCar('chamo', 3), 6.1, -30, Math.PI);
  placed(group, streetFoodKiosk(), 8.2, 20, -Math.PI / 2);
  placed(group, iceCreamCart(), -7.4, -10.5, Math.PI / 2 + .4);
  for (const z of [-30, 30]) placed(group, streetlightPole(), -7.6, z, Math.PI / 2);
  placed(group, plasticChair({ color: '#2ad1b2' }), 8, -5, -Math.PI / 2 - .3, .15);
  ctx.npcSpots.push({ x: 8, z: -5, face: -Math.PI / 2 - .3, seated: true, y: .15 + .74, senora: true });
  placed(group, plasticChair({ color: '#ffc629' }), -8.1, 4.5, Math.PI / 2 + .2, .15);
  ctx.npcSpots.push({ x: -8.1, z: 4.5, face: Math.PI / 2 + .2, seated: true, y: .15 + .74 });
  [-6, 3.5, 14].forEach((z, i) => placed(group, rooftopWaterTank(), (i % 2 ? 12.6 : -12.6), z, i, 6.6));
  ringNeighbours(ctx, arena, 12);
  for (const z of [-14, -2, 7, 18]) ctx.npcSpots.push({ x: (z > 0 ? -1 : 1) * 8.6, z, face: z > 0 ? Math.PI / 2 : -Math.PI / 2, seated: false, y: .15 });
  // The moto that crosses the fight.
  const moto = parkedMoto({ color: '#ffc629', seed: 8 }); moto.visible = false; group.add(moto); ctx.moto = moto;
}

function buildToldo(ctx) {
  const { group, random } = ctx;
  ground(group, 120, 120, 0xd9b48a);
  ground(group, 34, 34, 0xe7d3b3, .02);
  const ring = tentRing({ seed: 3 }); group.add(ring); ctx.ropes = ring.getObjectByName('ropes');
  ctx.floor = RING.floor; ctx.camHeight = 2.5;
  ring.getObjectByName('lamps')?.children.forEach(l => { const p = new THREE.Vector3(); l.getWorldPosition(p); ctx.lamps.push(p); });
  const avila = avilaRidge({ width: 300, height: 52, depth: 70 }); avila.position.set(0, 0, -62); group.add(avila);
  // The audience in plastic chairs, palms and araguaneyes around the plaza.
  const colors = ['#ff4b4b', '#2ad1b2', '#ffc629', '#3d7bf2', '#ff6fae'];
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * Math.PI * 2, x = Math.sin(a) * 8.6, z = Math.cos(a) * 8.6;
    placed(group, plasticChair({ color: colors[i % colors.length] }), x, z, a + Math.PI);
    if (i % 2 === 0) ctx.npcSpots.push({ x, z, face: a + Math.PI, seated: true, y: .74 });
  }
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2 + .3, r = 16 + random() * 4;
    placed(group, i % 3 ? palm({ h: 8 + random() * 2, seed: i + 3 }) : araguaney({ seed: i + 1 }), Math.sin(a) * r, Math.cos(a) * r, random() * 6);
  }
  for (const a of [.8, 2.4, 3.9, 5.5]) placed(group, streetLamp(), Math.sin(a) * 12, Math.cos(a) * 12, 0);
  placed(group, streetFoodKiosk(), 13, 6, -Math.PI / 2);
  placed(group, iceCreamCart(), -12, 7, Math.PI / 2);
  for (const z of [-10, 10]) { const line = buntingLine({ span: 24, seed: Math.floor(random() * 99), height: 5 }); line.position.set(z, 0, 0); group.add(line); }
  // Panas standing at the apron between the chairs.
  for (let i = 0; i < 8; i++) { const a = (i + .5) / 8 * Math.PI * 2, r = 5.7; ctx.npcSpots.push({ x: Math.sin(a) * r, z: Math.cos(a) * r, face: a + Math.PI, seated: false }); }
}

function buildMercado(ctx, arena) {
  const { group, random } = ctx;
  ctx.camBox = [7.6, 30];
  ground(group, 22, 90, 0xb8b2a6);
  for (const s of [-1, 1]) ground(group, 40, 90, 0xa79a83, -.01, s * 31, 0);
  chalkRing(group, arena.r);
  // Two rows of stalls facing the aisle, crates heaped in front.
  for (const s of [-1, 1]) {
    for (let z = -34, i = 0; z <= 34; z += 5.4, i++) {
      placed(group, marketStall({ seed: i * 3 + (s > 0 ? 7 : 0), colors: [[0xd94f45, 0xf5bc3c], [0x2ab0a5, 0xf7f0de], [0x3d7bf2, 0xffd166], [0x6bbf59, 0xf7f0de]][(i + (s > 0 ? 2 : 0)) % 4] }), s * 9.6, z, s > 0 ? -Math.PI / 2 : Math.PI / 2);
      if (Math.abs(z) < 30) {
        const crates = produceCrates({ w: 1.2 + random() * .6, d: .9, h: .64 + Math.floor(random() * 3) * .32, seed: i + (s > 0 ? 50 : 0), detail: Math.abs(z) < 10 ? 'full' : 'light' });
        const pivot = new THREE.Group(); crates.position.x = -s * .1; pivot.add(crates);
        placed(group, pivot, s * 7.4, z + 1.6, s > 0 ? -Math.PI / 2 : Math.PI / 2);
        ctx.crates.push({ object: crates, x: s * 7.4, z: z + 1.6, dir: s, fall: -1e9 });
      }
    }
  }
  for (const [x, z, a] of [[-5.6, -9, .4], [6.1, 8, -2.4], [5.4, -14, 2.9], [-6.2, 15, .9]]) placed(group, marketHandTruck({ seed: Math.floor(x * z) }), x, z, a);
  placed(group, fruitDeliveryTruck(), -4, -30, 0);
  placed(group, cargoHandcart(), 5.2, 24, -2.6);
  for (const z of [-12, -4, 4, 12, 20]) { const wire = bulbWire({ span: 18, height: 4.8, sag: .6, posts: false }); wire.position.z = z; group.add(wire); }
  for (const z of [-26, 26]) placed(group, cornerBodega({ seed: z > 0 ? 3 : 9 }), 0, z * 1.6, z > 0 ? Math.PI : 0);
  ringNeighbours(ctx, arena, 11, (x) => Math.abs(x) > 6.6);
  for (const z of [-20, -11, 9, 17]) ctx.npcSpots.push({ x: (z > 0 ? 1 : -1) * 7.6, z: z - 1.2, face: z > 0 ? -Math.PI / 2 : Math.PI / 2, seated: false });
}

function buildMotos(ctx, arena) {
  const { group, random, dominoes } = ctx;
  ground(group, 120, 120, 0x3b3e48);
  ground(group, 30, 30, 0x6a6470, .02);
  chalkRing(group, arena.r);
  // Two rows of parked motos, side by side: they topple toward −Z.
  for (const [row, x] of [[0, -7], [1, 7]]) for (let k = 0; k < 10; k++) {
    const z = -5.4 + k * 1.15, moto = parkedMoto({ color: MOTO_COLORS[(k * 3 + row) % MOTO_COLORS.length], seed: k * 7 + row, detail: k % 2 ? 'light' : 'full' });
    placed(group, moto, x, z, 0);
    dominoes.push({ row, x, z, tipper: moto.userData.tipper, fall: -1e9 });
  }
  // Lamps, bulbs and the kiosk light the plaza.
  for (const [x, z] of [[-11, -11], [11, -11], [-11, 11], [11, 11]]) { placed(group, streetLamp(), x, z); ctx.lamps.push(new THREE.Vector3(x, 4, z)); }
  for (const z of [-9, 0, 9]) { const wire = bulbWire({ span: 24, height: 5, sag: .8, posts: z !== 0 }); wire.position.z = z; group.add(wire); }
  placed(group, streetFoodKiosk(), 0, -14, 0); ctx.lamps.push(new THREE.Vector3(0, 3, -12.5));
  placed(group, parkBench(), -9, 10, 2.4); placed(group, parkBench(), 9, 10, -2.4);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, r = 24 + random() * 6; placed(group, i % 2 ? saman({ seed: i }) : palm({ h: 9, seed: i }), Math.sin(a) * r, Math.cos(a) * r); }
  [-16, 0, 16].forEach((x, i) => { const h = house({ w: 9, h: 8.4, seed: 90 + i, color: COLORS[(i * 2 + 1) % COLORS.length], style: 'balcon' }); frontAt(group, h, x, -20, 0); });
  ringNeighbours(ctx, arena, 10, (x) => Math.abs(x) > 6);
}

function buildManga(ctx, arena) {
  const { group, random } = ctx;
  ctx.hats = true; ctx.camBox = [40, 6.4];
  ground(group, 140, 140, 0xc9a873);
  ground(group, 70, 15, 0xb88c56, .01);
  chalkRing(group, arena.r);
  // The manga: a long dirt lane between fences, stands behind them.
  for (const side of [-1, 1]) {
    for (let x = -30; x <= 30; x += 8) placed(group, ranchFence({ span: 8 }), x, side * 7.4, 0);
    for (const x of [-14, 0, 14]) {
      const stands = woodenStands({ length: 12, rows: 4, seed: Math.floor(x + side * 7) });
      placed(group, stands, x, side * 9.2, side > 0 ? Math.PI : 0);
      stands.updateMatrixWorld(true);
      stands.userData.seats.filter((_, i) => i % 3 === 0).forEach(([sx, sy, sz]) => {
        const v = new THREE.Vector3(sx, sy, sz).applyMatrix4(stands.matrixWorld);
        ctx.npcSpots.push({ x: v.x, z: v.z, y: v.y, face: side > 0 ? Math.PI : 0, seated: true });
      });
    }
  }
  placed(group, corralGate({ span: 8, open: .1 }), -34, 0, Math.PI / 2);
  placed(group, corralGate({ span: 8, open: .9 }), 34, 0, Math.PI / 2);
  placed(group, ranchCaney(), -42, -16, .4);
  placed(group, waterWindmill({ height: 10 }), 44, -22, 0);
  for (let i = 0; i < 6; i++) placed(group, hayBale(), -40 + i * 1.6, 13, random());
  placed(group, hitchingRail({ span: 4 }), 38, 13, 0);
  for (const [x, a] of [[36.5, .2], [39.5, -.3]]) { const horse = llaneroHorse({ seed: Math.floor(x) }); placed(group, horse, x, 14, a); }
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, r = 46 + random() * 10; placed(group, i % 3 ? saman({ seed: i + 2 }) : palm({ h: 10, seed: i }), Math.sin(a) * r, Math.cos(a) * r); }
  ringNeighbours(ctx, arena, 10, (x, z) => Math.abs(z) > 6.6);
  const bull = hatoCow({ seed: 11, coat: 'brown', locomotion: true }); bull.visible = false; group.add(bull); ctx.bull = bull;
}

function buildCebra(ctx, arena) {
  const { group, random } = ctx;
  ctx.camBox = [40, 7.6];
  ground(group, 140, 140, 0x3d3f47);
  for (const s of [-1, 1]) ground(group, 140, 4, 0xbdb6a6, .16, 0, s * 9.5);
  // The zebra crossing the ring stands on.
  for (let z = -6.4; z <= 6.4; z += 1.1) ground(group, 6.4, .55, 0xf4f1ea, .012, 0, z);
  for (const x of [-30, -20, -10, 10, 20, 30]) ground(group, 3, .18, 0xf2d24a, .012, x, 0);
  chalkRing(group, arena.r);
  // The bridge above, its lamps lighting the crossing.
  const bridge = lakeBridge({ length: 160, height: 15, span: 40 }); bridge.position.set(0, 0, -4); bridge.rotation.y = .12; group.add(bridge);
  bridge.updateMatrixWorld(true);
  bridge.userData.lamps.filter(([x]) => Math.abs(x) < 14).filter((_, i) => i % 2 === 0).forEach(([x, y, z]) => ctx.lamps.push(new THREE.Vector3(x, y, z).applyMatrix4(bridge.matrixWorld)));
  for (const s of [-1, 1]) {
    for (const x of [-24, -8, 8, 24]) placed(group, streetlightPole(), x, s * 8.3, s > 0 ? Math.PI : 0);
    placed(group, busStopShelter(), s * 14, s * 10.2, s > 0 ? Math.PI : 0);
    let i = 0;
    for (let x = -40; x <= 40; x += 9, i++) {
      const h = house({ w: 8.4, h: i % 2 ? 8.4 : 6.2, seed: 120 + i + (s > 0 ? 30 : 0), color: COLORS[(i * 3 + (s > 0 ? 2 : 0)) % COLORS.length], style: STYLES[(i + (s > 0 ? 1 : 0)) % STYLES.length] });
      frontAt(group, h, x, s * 11.6, s > 0 ? Math.PI : 0);
    }
  }
  placed(group, parkedCar('familiar', 21), -16, -6.2, Math.PI / 2);
  placed(group, parkedCar('chamo', 5), 18, 6.4, -Math.PI / 2);
  placed(group, streetFoodKiosk(), -6, 9.6, Math.PI);
  for (let k = 0; k < 4; k++) placed(group, parkedMoto({ color: MOTO_COLORS[k], seed: k + 70, detail: 'light' }), 9 + k * 1.1, -8.4, 0);
  ringNeighbours(ctx, arena, 10, (x, z) => Math.abs(z) > 7.4);
  for (const x of [-9, -5, 5, 9]) ctx.npcSpots.push({ x, z: (x > 0 ? -1 : 1) * 8.6, face: x > 0 ? 0 : Math.PI, seated: false, y: .16 });
  const bus = parkedCar('familiar', 33); bus.scale.setScalar(1.25); bus.visible = false; group.add(bus); ctx.bus = bus;
  void random;
}

function buildColonial(ctx, arena) {
  const { group, random } = ctx;
  ctx.camBox = [24, 5.6];
  ground(group, 120, 120, 0xb0b38c, -.02);
  const street = createColonialStreet({ seed: 70 }).group; street.position.y = -.8; group.add(street);
  const mirror = createColonialStreet({ seed: 91 }).group; mirror.position.set(56, -.8 - .5, 0); group.add(mirror);
  const back = createColonialStreet({ seed: 33 }).group; back.position.set(-56, -.8 + .5, 0); group.add(back);
  chalkRing(group, arena.r);
  for (const s of [-1, 1]) for (const x of [-16, -6, 6, 16]) placed(group, cemeteryLampPost(), x, s * 5.6, 0);
  for (const x of [-10, 10]) { const line = buntingLine({ span: 12, seed: Math.floor(random() * 99), height: 5.6 }); line.position.set(x, 0, 0); group.add(line); }
  placed(group, plasticChair({ color: '#ff6fae' }), -8.5, -5.2, .3);
  ctx.npcSpots.push({ x: -8.5, z: -5.2, face: .3, seated: true, y: .74, senora: true });
  placed(group, plasticChair({ color: '#2ad1b2' }), 9.2, 5.1, Math.PI - .2);
  ctx.npcSpots.push({ x: 9.2, z: 5.1, face: Math.PI - .2, seated: true, y: .74 });
  placed(group, iceCreamCart(), 12.5, -4.6, -.4);
  ringNeighbours(ctx, arena, 11, (x, z) => Math.abs(z) > 5.4);
}
