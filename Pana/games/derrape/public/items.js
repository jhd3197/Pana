// Wooden supply crates, coin trails, two-slot inventory and mango combat.

import * as THREE from 'three';
import { makeMango } from '/engine/models/props/mango.js';
import { FragmentBurst } from './fragments.js';
import { ICONS as SVG } from '/engine/icons.js';
import { crateArt, coinArt } from './pickup-art.js';
import { activeItem, addItem, consumeItem, selectItem, canBlock, isMango, isJuiced, MAX_COINS, segmentDistanceSq } from './item-rules.js';
import { makeRocket, makeChancleta, makeShield, makeTrap, makeCloud, ITEM_ICONS } from './item-art.js';
import { loseCoins } from './drive-rules.js';

export const ITEMS = {
  mango: { icon: SVG.mango, name: 'Mango', rarity: 'blue' },
  mango3: { icon: SVG.mango, name: 'Mata de mango', n: 3, rarity: 'purple' },
  jugo: { icon: SVG.juice, name: 'Jugo de mango', rarity: 'blue' },
  concha: {
    icon: '<svg viewBox="0 0 40 40" width="1em" height="1em"><path d="M20 6c-4 6-14 10-14 22 4-4 8-6 12-6-3 4-4 8-3 12 2-5 5-8 9-9 2 3 5 5 10 6-2-5-2-10-5-13 2-5 0-9-9-12z" fill="#ffae2b" stroke="#16161a" stroke-width="2.5" stroke-linejoin="round"/><path d="M20 6c-2 5-6 8-9 12" fill="none" stroke="#7cc242" stroke-width="3" stroke-linecap="round"/><path d="M29 16c1 3 0 5-2 6" fill="none" stroke="#e8452c" stroke-width="3" stroke-linecap="round"/></svg>',
    name: 'Concha de mango',
    rarity: 'blue',
  },
  jugo3: { icon: SVG.juice, name: 'Jarra de jugo', n: 3, rarity: 'gold' },
  cohete: { icon: ITEM_ICONS.cohete, name: 'Cohete', rarity: 'purple' },
  chancleta: { icon: ITEM_ICONS.chancleta, name: 'La chancleta', rarity: 'gold' },
  totuma: { icon: ITEM_ICONS.totuma, name: 'Totuma protectora', rarity: 'purple' },
  trampa: { icon: ITEM_ICONS.trampa, name: 'Caja trampa', rarity: 'purple' },
  aguacero: { icon: ITEM_ICONS.aguacero, name: 'Aguacero', rarity: 'gold' },
};

// odds for the leader (k=0) and the last car (k=1): the back of the pack gets the good stuff
const ODDS = {
  mango: [3, 2],
  mango3: [0, 2],
  jugo: [1, 3],
  jugo3: [0, 2],
  concha: [4, 1],
  trampa: [3, 1],
  cohete: [1, 2],
  chancleta: [0, 1.2],
  totuma: [1.5, 1],
  aguacero: [0, 1.2],
};
// Battle mode (balloons) has no leader to hunt and no laps to cut.
const BATTLE_ODDS = { mango: [3, 3], mango3: [1, 1], concha: [2, 2], trampa: [2, 2], cohete: [2, 2], totuma: [1, 1], jugo: [1, 1] };

const BOX_RESPAWN = 2.5;
const COIN_RESPAWN = 8;
const PAD_W = 4, PAD_L = 6;
export const SPIN = 1.1;             // seconds a mango peel spins you around

export const SHIELD_TIME = 10;
export const CLOUD_TIME = 3.5;

const LINES = {
  throw: ['¡Toma tu mango!', '¡Mangazo!', '¡Ahí va!'],
  hit: ['¡Me cayó un mango!', '¡Qué mango!', '¡Pegajoso!', '¡Ñooo!'],
  jugo: ['¡Jugo de mango!', '¡Qué rico!', '¡Recargado!'],
  peel: ['¡Me resbalé!', '¡Epa!', '¡Uyyy!'],
  drop: ['¡Cuidado atrás!', '¡Jejeje!'],
  rocket: ['¡Cohetazo!', '¡Ahí te va el cohete!'],
  chancla: ['¡La chancleta!', '¡Vente pa’ acá!', '¡Ya vas a ver!'],
  chanclaHit: ['¡La chancleta de mi mamá!', '¡Ayyy, la chancla!'],
  shield: ['¡Con mi totuma!', '¡Protegido!'],
  saved: ['¡La totuma me salvó!', '¡Ja, no me pegó!'],
  boom: ['¡Era una trampa!', '¡BUM!', '¡Esa caja era chimba!'],
  rain: ['¡Se largó el aguacero!', '¡Me mojé!', '¡Qué palo de agua!'],
};

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

const mat = (color) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.7 });


// a mango peeled in three strips: orange inside, green/red skin on the tips
function makePeel() {
  const g = new THREE.Group();
  const inside = mat(0xffae2b);
  const skins = [mat(0x7cc242), mat(0xe8452c), mat(0x7cc242)];
  for (let i = 0; i < 3; i++) {
    const flap = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.2, 5), inside);
    const skin = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.45, 5), skins[i]);
    skin.position.y = 0.4;
    flap.add(skin);
    flap.position.y = 0.6;
    const arm = new THREE.Group();
    arm.rotation.set(1.25, i * 2.1, 0, 'YXZ');
    arm.add(flap);
    g.add(arm);
  }
  const seed = new THREE.Mesh(new THREE.SphereGeometry(0.3, 7, 5), mat(0xf2d27a));   // the slippery pit
  seed.scale.set(1, 0.6, 1.4);
  seed.position.y = 0.2;
  g.add(seed);
  g.traverse((m) => (m.castShadow = true));
  g.scale.setScalar(1.3);
  return g;
}

function padTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ff7b1c';
  g.fillRect(0, 0, 64, 128);
  g.fillStyle = '#ffe14d';
  for (const y of [8, 72]) {        // two chevrons pointing up (= forward)
    g.beginPath();
    g.moveTo(32, y); g.lineTo(60, y + 30); g.lineTo(60, y + 48); g.lineTo(32, y + 18);
    g.lineTo(4, y + 48); g.lineTo(4, y + 30);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 1.5);
  return tex;
}

// hooks: { scene, puffs, sound, G, track, crash, say, standings, emit? }
// Online races mark rival cars `remote`: their own client decides what they
// pick up and what hits them. `emit(kind, car, data)` reports what this
// client's cars do, and the remote* functions replay what others did.
export function createItems(hooks) {
  const { scene, puffs, sound, track: T } = hooks;
  const { pointAt, paramOf, offsetOf, groundAt } = T;
  const itemDef = T.def.items || {};
  const boxRows = (itemDef.boxes || [0.125, 0.521]).map(u => u * T.TOTAL);
  const boxLanes = itemDef.boxLanes || [-6, -2, 2, 6];
  const along = (s, off = 0) => {
    const p = pointAt(s), p2 = pointAt(s + 0.5);
    const tx = p2.x - p.x, tz = p2.y - p.y, l = Math.hypot(tx, tz) || 1;
    return { x: p.x - tz / l * off, z: p.y + tx / l * off, h: Math.atan2(tx, tz) };
  };
  const fragments = new FragmentBurst(scene, groundAt);
  const padTex = padTexture();
  const padGeo = new THREE.PlaneGeometry(PAD_W, PAD_L);
  padGeo.rotateX(-Math.PI / 2);
  padGeo.rotateY(Math.PI);
  const padMat = new THREE.MeshStandardMaterial({ map: padTex, emissive: 0xff7b1c, emissiveIntensity: 0.35, roughness: 0.6 });
  const pads = (itemDef.pads || []).map(def => {
    const a = along(def.u * T.TOTAL, def.off);
    const geo = padGeo.clone();
    geo.rotateY(a.h); geo.translate(a.x, 0, a.z);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, groundAt(pos.getX(i), pos.getZ(i)) + (T.def.environment ? 0.16 : 0.06));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, padMat);
    m.receiveShadow = true;
    scene.add(m);
    return a;
  });
  padGeo.dispose();

  const crate = crateArt(), coin = coinArt(), mango = makeMango(), peel = makePeel();
  const rocket = makeRocket(), chancla = makeChancleta(), trap = makeTrap(crate.visual);
  const battling = () => !!hooks.battle?.();
  const boxes = [];
  for (const s of boxRows) for (const off of boxLanes) {
    const a = along(s, off), m = crate.visual.clone();
    const y = groundAt(a.x, a.z);
    m.position.set(a.x, y + 0.86, a.z);
    m.rotation.y = a.h;
    scene.add(m);
    boxes.push({ ...a, y, m, down: 0 });
  }

  // Short alternating racing lines reward steering without blocking the road.
  // Every map may override the trail starts; spacing is in world units.
  const trailStarts = itemDef.coins || [0.045, 0.19, 0.32, 0.43, 0.58, 0.71, 0.84, 0.94];
  const coins = [];
  trailStarts.forEach((u, row) => {
    for (let i = 0; i < 5; i++) {
      const off = [-3, 0, 3, 0][row % 4] + Math.sin(i / 4 * Math.PI) * (row % 2 ? -0.8 : 0.8);
      const a = along(u * T.TOTAL + i * 5, off), m = coin.clone();
      const y = groundAt(a.x, a.z);
      m.position.set(a.x, y + 1.3, a.z);
      scene.add(m);
      coins.push({ ...a, y, m, down: 0, phase: i * 0.3 });
    }
  });

  let flying = [], peels = [], sparks = [];
  const held = new Map(), shields = new Map(), clouds = new Map();
  const byId = (id) => hooks.byId?.(id);
  const previous = new Map();
  let t = 0, seq = 0;
  const gone = new Set();   // projectile ids already burst here, so a late remote hit doesn't splat twice
  const emit = (kind, c, data) => hooks.emit?.(kind, c, data);
  const nextId = (c) => `${c.netId ?? 'local'}:${++seq}`;
  const disposeGeometry = root => root.traverse(o => o.geometry?.dispose());

  function clear() {
    for (const entry of [...flying, ...peels, ...sparks]) entry.m.removeFromParent();
    for (const m of [...held.values(), ...shields.values(), ...clouds.values()]) m.removeFromParent();
    held.clear(); shields.clear(); clouds.clear(); previous.clear(); gone.clear(); fragments.clear();
    flying = []; peels = []; sparks = [];
    for (const pickup of [...boxes, ...coins]) {
      pickup.down = 0; pickup.m.visible = true; pickup.m.scale.setScalar(1);
    }
  }

  function dispose() {
    clear();
    // Materials on the four art templates are shared within their modules.
    for (const template of [crate.visual, crate.pieces, coin, mango, peel, rocket, chancla]) disposeGeometry(template);
    // Peel materials are created per item system; mango/wood/coin paints are cached.
    const peelMaterials = new Set();
    peel.traverse(o => { if (o.material) peelMaterials.add(o.material); });
    peelMaterials.forEach(m => m.dispose());
    padTex.dispose(); padMat.dispose();
  }

  function roll(place, count) {
    const k = count > 1 ? Math.max(0, Math.min(1, place / (count - 1))) : 0.5;
    const bag = Object.entries(battling() ? BATTLE_ODDS : ODDS).map(([kind, [lead, last]]) => [kind, lead + (last - lead) * k]);
    let r = Math.random() * bag.reduce((n, [, w]) => n + w, 0);
    for (const [kind, w] of bag) if ((r -= w) <= 0) return kind;
    return 'mango';
  }

  function feedback(c, message, duration = 1.5) {
    if (c.isPlayer) { c.itemMessage = message; c.itemMessageT = duration; }
  }

  function give(c, place, count) {
    if (!addItem(c, roll(place, count))) return false;
    c.useT = rand(0.8, 3.5) * (hooks.itemDelay?.() ?? 1);
    if (c.isPlayer) sound.pickup();
    return true;
  }

  function select(c, slot = 1 - c.selected) {
    const changed = slot !== c.selected && selectItem(c, slot);
    if (changed && c.isPlayer) sound.tick();
    return changed;
  }

  function use(c, direction = 1) {
    const item = activeItem(c);
    if (!item || item.rolling > 0 || c.done || c.spin > 0) return false;
    direction = direction < 0 ? -1 : 1;
    const kind = item.kind, h = c.h + (direction < 0 ? Math.PI : 0);
    const fx = Math.sin(h), fz = Math.cos(h);
    const juiced = isJuiced(c);
    if (juiced && c.isPlayer) feedback(c, '¡Objeto potenciado con 10 monedas!', 1.2);
    if (isMango(item)) {
      const m = mango.clone();
      const speed = 34 + (juiced ? 12 : 0) + Math.max(0, c.vf * direction);
      m.position.set(c.x + fx * 3.4, c.y + 1.5, c.z + fz * 3.4);
      scene.add(m);
      // Find the direction along the circuit from the actual launch heading.
      // A reverse throw keeps travelling backward when it seeks the road.
      const s = paramOf(c.x, c.z), a = pointAt(s), b = pointAt(s + 0.5);
      const travel = (b.x - a.x) * fx + (b.y - a.y) * fz >= 0 ? 1 : -1;
      const id = nextId(c);
      flying.push({ id, kind: 'mango', m, owner: c, h, speed, travel, vy: 3.5, t: 0, spin: rand(8, 14), seek: juiced ? 34 : 22 });
      emit('throw', c, { id, kind: 'mango', x: m.position.x, y: m.position.y, z: m.position.z, h, speed, travel, seek: juiced ? 34 : 22 });
      sound.whoosh();
      feedback(c, direction < 0 ? '¡Mango hacia atrás!' : '¡Ahí va ese mango!');
      if (Math.random() < 0.5) hooks.say(c, LINES.throw, 0.9);
    } else if (kind === 'cohete') {
      // Locks on to the racer just ahead (or just behind, fired backward).
      const order = hooks.standings().filter(o => !o.done), at = order.indexOf(c);
      const target = battling() ? nearest(c, direction) : order[at - direction] ?? null;
      const m = rocket.clone();
      m.position.set(c.x + fx * 3.6, c.y + 1.2, c.z + fz * 3.6);
      m.rotation.y = h;
      scene.add(m);
      const id = nextId(c), speed = 50 + (juiced ? 12 : 0) + Math.max(0, c.vf * direction);
      const s = paramOf(c.x, c.z), a = pointAt(s), b = pointAt(s + 0.5);
      const travel = (b.x - a.x) * fx + (b.y - a.y) * fz >= 0 ? 1 : -1;
      flying.push({ id, kind: 'cohete', m, owner: c, h, speed, travel, vy: 0, t: 0, target });
      emit('throw', c, { id, kind: 'cohete', x: m.position.x, y: m.position.y, z: m.position.z, h, speed, travel, target: target?.netId });
      sound.sweep(300, 1400, 0.5, 'sawtooth', 0.08);
      feedback(c, target ? `¡Cohete tras ${target.isPlayer ? 'ti' : target.name}!` : '¡Cohete!');
      hooks.say(c, LINES.rocket, 0.9);
    } else if (kind === 'chancleta') {
      // Flies high along the circuit and drops on whoever leads.
      const order = hooks.standings().filter(o => !o.done);   // finished cars are out of reach
      const target = order[0] === c ? order[1] : order[0];
      if (!target) return false;
      const m = chancla.clone();
      m.position.set(c.x, c.y + 6, c.z);
      scene.add(m);
      const id = nextId(c), s = paramOf(c.x, c.z);
      flying.push({ id, kind: 'chancleta', m, owner: c, h: c.h, speed: 72, travel: 1, vy: 0, t: 0, target, s, spin: 9 });
      emit('throw', c, { id, kind: 'chancleta', x: c.x, y: c.y + 6, z: c.z, h: c.h, speed: 72, travel: 1, target: target.netId, s });
      sound.sweep(1200, 400, 0.6, 'triangle', 0.12);
      feedback(c, `¡La chancleta va por ${target.isPlayer ? 'ti' : target.name}!`, 1.6);
      hooks.say(c, LINES.chancla, 1.1);
    } else if (kind === 'totuma') {
      c.shield = juiced ? SHIELD_TIME * 1.6 : SHIELD_TIME;
      sound.tone(520, 0, 0.12, 'triangle', 0.1); sound.tone(780, 0.1, 0.18, 'triangle', 0.09);
      hooks.say(c, LINES.shield, 1);
    } else if (kind === 'aguacero') {
      // A downpour on everyone ahead: slower and slippery, unless on rain cauchos.
      const order = hooks.standings(), at = order.indexOf(c);
      const victims = (battling() ? order.filter(o => o !== c) : order.slice(0, at)).filter(o => !o.done);
      const time = juiced ? CLOUD_TIME * 1.5 : CLOUD_TIME;
      for (const v of victims) rainOn(v, time);
      emit('cloud', c, { ids: victims.map(v => v.netId), time });
      sound.sweep(220, 90, 0.9, 'sawtooth', 0.06);
      feedback(c, victims.length ? `¡Aguacero sobre ${victims.length} ${victims.length === 1 ? 'rival' : 'rivales'}!` : 'Nadie adelante: llovió en vano');
    } else if (kind === 'jugo' || kind === 'jugo3') {
      c.boost = Math.max(c.boost, juiced ? 3.2 : 2.2);
      sound.turbo();
      hooks.say(c, LINES.jugo, 1);
      puffs.spawn(new THREE.Vector3(c.x, c.y + 0.6, c.z), { color: 0xffae2b, count: 6, spread: 1.4 });
    } else if (kind === 'trampa') {
      const m = trap.clone();
      const x = c.x + fx * 3.6, z = c.z + fz * 3.6;
      m.position.set(x, groundAt(x, z) + 0.86, z);
      m.rotation.y = c.h;
      scene.add(m);
      const id = nextId(c);
      peels.push({ id, kind: 'trampa', m, owner: c, safe: 1, t: 0, radius: juiced ? 2.8 : 2.2 });
      emit('peel', c, { id, kind: 'trampa', x: m.position.x, y: m.position.y, z: m.position.z, r: m.rotation.y, juiced });
      sound.plop();
      feedback(c, direction < 0 ? '¡Caja trampa detrás!' : '¡Caja trampa adelante!');
    } else if (kind === 'concha') {
      const m = peel.clone();
      m.position.set(c.x + fx * 3.4, groundAt(c.x + fx * 3.4, c.z + fz * 3.4) + 0.15, c.z + fz * 3.4);
      m.rotation.y = Math.random() * 6;
      scene.add(m);
      const id = nextId(c);
      peels.push({ id, kind: 'concha', m, owner: c, safe: 1, t: 0, radius: juiced ? 2.6 : 1.8 });
      if (juiced) m.scale.multiplyScalar(1.4);
      emit('peel', c, { id, kind: 'concha', x: m.position.x, y: m.position.y, z: m.position.z, r: m.rotation.y, juiced });
      sound.plop();
      feedback(c, direction < 0 ? '¡Concha detrás!' : '¡Concha adelante!');
    }
    consumeItem(c);
    return true;
  }

  // The racer nearest in front (direction 1) or behind (-1), for battles.
  function nearest(c, direction) {
    let best = null, bestD = 90;
    for (const o of hooks.cars()) {
      if (o === c || o.done) continue;
      const dx = o.x - c.x, dz = o.z - c.z, d = Math.hypot(dx, dz);
      if (d < bestD && (dx * Math.sin(c.h) + dz * Math.cos(c.h)) * direction > 0) { best = o; bestD = d; }
    }
    return best;
  }

  function rainOn(v, time) {
    v.cloud = Math.max(v.cloud || 0, time);
    if (!v.remote) hooks.say(v, LINES.rain, 1);
  }

  // A totuma soaks up one hit of any kind.
  function shielded(c, pos) {
    if (!(c.shield > 0)) return false;
    c.shield = 0;
    feedback(c, '¡La totuma te salvó!');
    hooks.say(c, LINES.saved, 1);
    puffs.spawn(pos, { color: 0xffd36b, count: 10, spread: 2.6, size: 0.5, life: 0.5 });
    if (c.isPlayer) { sound.tone(990, 0, 0.08, 'triangle', 0.1); sound.tone(660, 0.07, 0.14, 'triangle', 0.08); }
    return true;
  }

  function slip(c) {
    if (shielded(c, new THREE.Vector3(c.x, c.y + 1, c.z))) return;
    c.spin = SPIN;
    c.dizzy = Math.max(c.dizzy, 2);
    hooks.slipped?.(c);
    c.vx *= 0.35; c.vz *= 0.35; c.boost = 0;
    c.drift = 0; c.driftT = 0;
    if (loseCoins(c, 1)) puffs.spawn(new THREE.Vector3(c.x, c.y + 1.6, c.z), { color: 0xffc629, count: 4, spread: 2, size: 0.5, rise: 3, life: 0.7 });
    c.heave.v += 4;
    hooks.say(c, LINES.peel, 1);
    sound.slip();
  }

  function splat(pos) {
    puffs.spawn(pos, { color: 0xffae2b, count: 9, spread: 1.6, size: 0.9, rise: 2.2, life: 0.9 });
    puffs.spawn(pos, { color: 0xe8452c, count: 3, spread: 1.2, size: 0.6, rise: 1.6, life: 0.7 });
    sound.splat();
  }

  function block(c, pos) {
    if (shielded(c, pos)) return true;
    if (!canBlock(c)) return false;
    consumeItem(c);
    feedback(c, '¡Bloqueaste un mangazo!');
    hooks.say(c, '¡Mango salvador!', 1);
    puffs.spawn(pos, { color: 0xfff0ac, count: 8, spread: 2.2, size: 0.5, life: 0.45 });
    if (c.isPlayer) {
      sound.tone(880, 0, 0.08, 'triangle', 0.1);
      sound.tone(1320, 0.07, 0.12, 'triangle', 0.08);
    }
    return true;
  }

  function aiThink(c, cars, dt) {
    let item = activeItem(c);
    if (!item || c.done || c.spin > 0) return;
    c.useT -= dt;
    // A bot may equip its reserve mango in response to a nearby projectile.
    const danger = flying.some(f => f.owner !== c && Math.hypot(f.m.position.x - c.x, f.m.position.z - c.z) < 13);
    if (danger && !isMango(item) && isMango(c.inventory[1 - c.selected])) {
      select(c); item = activeItem(c);
    }
    if (item.rolling > 0 || (danger && isMango(item))) return;
    const kind = item.kind;
    if (kind === 'jugo' || kind === 'jugo3') { if (c.useT <= 0) { use(c); c.useT = rand(0.6, 1.6); } return; }
    if (kind === 'totuma') { if (danger || c.useT <= 0) use(c); return; }
    if (kind === 'chancleta' || kind === 'aguacero') {
      const order = hooks.standings();
      if (c.useT <= 0 && (battling() || order.indexOf(c) > 0)) use(c);
      else if (c.useT < -10) use(c);
      return;
    }
    if (kind === 'cohete') { if (c.useT <= 0) { use(c, 1); c.useT = rand(1, 2.5); } return; }
    const fx = Math.sin(c.h), fz = Math.cos(c.h);
    let front = false, rear = false;
    for (const other of cars) {
      if (other === c || other.done) continue;
      const dx = other.x - c.x, dz = other.z - c.z, distance = Math.hypot(dx, dz);
      if (distance < 4 || distance > 32) continue;
      const dot = (dx * fx + dz * fz) / distance;
      if (dot > 0.94) front = true;
      if (dot < -0.94) rear = true;
    }
    if (isMango(item)) {
      if (((front || rear) && c.useT <= 0) || c.useT < -8) {
        use(c, rear && !front ? -1 : 1); c.useT = rand(0.7, 2);
      }
    } else if ((rear && c.useT <= 0) || c.useT < -6) use(c, -1);   // concha, trampa
  }

  // Bubbles and rain clouds follow their cars on every screen.
  function syncAuras(c) {
    let bubble = shields.get(c);
    if (c.shield > 0) {
      if (!bubble) { bubble = makeShield(); scene.add(bubble); shields.set(c, bubble); }
      bubble.visible = true;
      bubble.position.set(c.x, c.y + 1.3, c.z);
      bubble.scale.setScalar(1 + Math.sin(t * 6) * 0.03);
    } else if (bubble) bubble.visible = false;
    let cloud = clouds.get(c);
    if (c.cloud > 0) {
      if (!cloud) { cloud = makeCloud(); scene.add(cloud); clouds.set(c, cloud); }
      cloud.visible = true;
      cloud.position.set(c.x, c.y + 6.2, c.z);
      cloud.rotation.y = t * 0.4;
      if (Math.random() < 0.5) puffs.spawn(new THREE.Vector3(c.x + rand(-1.6, 1.6), c.y + 5, c.z + rand(-1.6, 1.6)),
        { color: 0x7cc4ff, count: 1, size: 0.18, rise: -9, life: 0.5, spread: 0.2 });
    } else if (cloud) cloud.visible = false;
  }

  function syncHeld(c) {
    let m = held.get(c);
    if (!canBlock(c)) { if (m) m.visible = false; return; }
    if (!m) {
      m = mango.clone(); m.name = 'held-mango'; m.scale.setScalar(1.25);
      scene.add(m); held.set(c, m);
    }
    m.visible = true;
    m.position.set(c.x - Math.sin(c.h) * 3, c.y + 1.35 + Math.sin(t * 4) * 0.1, c.z - Math.cos(c.h) * 3);
    m.rotation.set(0, c.h + t * 0.7, 0.15);
  }

  function breakCrate(b, c) {
    crate.pieces.position.copy(b.m.position);
    crate.pieces.quaternion.copy(b.m.quaternion);
    crate.pieces.scale.setScalar(1);
    fragments.burst(crate.pieces, { velocity: new THREE.Vector3(c.vx, 0, c.vz), power: 5 });
    b.down = BOX_RESPAWN; b.m.visible = false; b.m.scale.setScalar(0.85);
    puffs.spawn(b.m.position, { color: 0xc79c63, count: 4, spread: 1.3, size: 0.45, life: 0.4 });
  }

  // A remote rival drives through pickups on this screen too, so they vanish
  // where everyone saw them taken. Only its own client gives it the item.
  function touchRemote(c, touches) {
    for (const b of boxes) if (b.down === 0 && !c.full && touches(b, 2.2)) breakCrate(b, c);
    for (const coin of coins) {
      if (coin.down > 0 || !touches(coin, 1.9)) continue;
      coin.down = COIN_RESPAWN; coin.m.visible = false;
    }
  }

  function remoteThrow(owner, d) {
    const kind = ['cohete', 'chancleta'].includes(d.kind) ? d.kind : 'mango';
    const m = (kind === 'cohete' ? rocket : kind === 'chancleta' ? chancla : mango).clone();
    m.position.set(d.x, d.y, d.z);
    m.rotation.y = d.h;
    scene.add(m);
    flying.push({ id: d.id, kind, m, owner, h: d.h, speed: d.speed, travel: d.travel, vy: kind === 'mango' ? 3.5 : 0, t: 0,
      spin: kind === 'chancleta' ? 9 : rand(8, 14), seek: Number(d.seek) || 22, target: d.target ? byId(d.target) : null, s: Number(d.s) || 0 });
    sound.whoosh();
  }

  function remotePeel(owner, d) {
    const kind = d.kind === 'trampa' ? 'trampa' : 'concha';
    const m = (kind === 'trampa' ? trap : peel).clone();
    m.position.set(d.x, d.y, d.z);
    m.rotation.y = d.r || 0;
    if (kind === 'concha' && d.juiced) m.scale.multiplyScalar(1.4);
    scene.add(m);
    peels.push({ id: d.id, kind, m, owner, safe: 1, t: 0, radius: kind === 'trampa' ? (d.juiced ? 2.8 : 2.2) : d.juiced ? 2.6 : 1.8 });
    sound.plop();
  }

  function remoteCloud(d) {
    const time = Math.min(8, Number(d.time) || CLOUD_TIME);
    for (const id of Array.isArray(d.ids) ? d.ids : []) {
      const v = byId(id);
      if (v) rainOn(v, time);
    }
  }

  // The victim's client resolved a hit: burst the mango where it landed there.
  function remoteHit(victim, d) {
    const f = flying.find(f => f.id === d.id);
    if (f) f.dead = true;
    const pos = f ? f.m.position.clone() : new THREE.Vector3(d.x, d.y, d.z);
    if (d.blocked) puffs.spawn(pos, { color: 0xfff0ac, count: 8, spread: 2.2, size: 0.5, life: 0.45 });
    else if (!f && !gone.has(d.id)) {
      if (f?.kind === 'cohete' || f?.kind === 'chancleta' || d.kind === 'cohete' || d.kind === 'chancleta') explode(pos);
      else splat(pos);
    }
  }

  function remoteSlip(d) {
    const p = peels.find(p => p.id === d.id);
    if (p) { p.dead = true; if (p.kind === 'trampa') explode(p.m.position.clone()); }
  }

  function explode(pos) {
    crate.pieces.position.copy(pos);
    crate.pieces.scale.setScalar(1);
    puffs.spawn(pos, { color: 0xff9a1f, count: 14, spread: 3.2, size: 1.25, rise: 3.4, life: 0.75 });
    puffs.spawn(pos, { color: 0x2e2c30, count: 12, spread: 3.6, size: 1.45, rise: 2.4, life: 1.65 });
    fragments.burst(crate.pieces, { velocity: new THREE.Vector3(0, 5, 0), power: 11 });
    hooks.explode?.(pos);
    if (sound.explode) sound.explode(1.4);
    else sound.bonk(1.4);
  }

  function update(dt, cars, racing) {
    t += dt;
    padTex.offset.y -= dt * 1.6;
    fragments.update(dt);
    for (const b of boxes) {
      const wasDown = b.down > 0;
      b.down = Math.max(0, b.down - dt);
      b.m.visible = b.down === 0;
      if (wasDown && b.down === 0) {
        b.respawnT = 0.36;
        puffs.spawn(b.m.position, { color: 0xe6d4b2, count: 3, spread: 1.1, size: 0.35, rise: 0.6, life: 0.35 });
      }
      if (b.respawnT > 0) {
        b.respawnT = Math.max(0, b.respawnT - dt);
        const u = 1 - b.respawnT / 0.36;
        // Squash down then overshoot bounce up
        const bounce = u < 0.35 ? 0.65 + (u / 0.35) * 0.55 : 1 + Math.sin((u - 0.35) / 0.65 * Math.PI) * 0.18 * (1 - u);
        b.m.scale.set(1 / Math.sqrt(bounce), bounce, 1 / Math.sqrt(bounce));
      } else {
        b.m.scale.setScalar(Math.min(1, b.m.scale.x + dt * 6));
      }
      b.m.position.y = b.y + 0.86 + Math.sin(t * 2.4 + b.x * 0.2) * 0.06;
      b.m.rotation.z = Math.sin(t * 1.8 + b.z * 0.2) * 0.035;
    }
    for (const coin of coins) {
      coin.down = Math.max(0, coin.down - dt);
      coin.m.visible = coin.down === 0;
      if (coin.down > 0) {
        coin.m.position.x = coin.x;
        coin.m.position.z = coin.z;
        continue;
      }
      // Step 1 (Magnet): pull nearby coins in smoothly before touching
      let pulled = false;
      if (racing) {
        for (const c of cars) {
          if (c.done || c.remote) continue;
          const d = Math.hypot(c.x - coin.x, c.z - coin.z);
          if (d < 3.4 && Math.abs(c.y - coin.y) < 2.6) {
            coin.m.position.x += (c.x - coin.m.position.x) * Math.min(1, dt * 11);
            coin.m.position.z += (c.z - coin.m.position.z) * Math.min(1, dt * 11);
            pulled = true;
            break;
          }
        }
      }
      if (!pulled) {
        coin.m.position.x += (coin.x - coin.m.position.x) * Math.min(1, dt * 10);
        coin.m.position.z += (coin.z - coin.m.position.z) * Math.min(1, dt * 10);
      }
      coin.m.position.y = coin.y + 1.3 + Math.sin(t * 3 + coin.phase) * 0.12;
      coin.m.rotation.y = t * 2.2 + coin.phase;
    }
    sparks = sparks.filter(s => {
      s.age += dt;
      if (s.age >= 0.34) { s.m.removeFromParent(); return false; }
      const k = s.age / 0.34;
      s.m.position.lerp(new THREE.Vector3(s.car.x, s.car.y + 2.1, s.car.z), Math.min(1, dt * 16));
      // Step 2 (Pop): scale up real quick (1 -> 1.48), then shrink away
      const popScale = k < 0.28 ? 1 + (k / 0.28) * 0.48 : Math.max(0.01, 1.48 * (1 - (k - 0.28) / 0.72));
      s.m.scale.setScalar(popScale);
      s.m.rotation.y += dt * 16;
      return true;
    });
    if (!racing) { for (const c of cars) { syncHeld(c); syncAuras(c); } return; }

    const order = hooks.standings();
    for (const c of cars) {
      c.boost = Math.max(0, c.boost - dt);
      c.spin = Math.max(0, c.spin - dt);
      if (!c.remote) c.shield = Math.max(0, (c.shield || 0) - dt);
      c.cloud = Math.max(0, (c.cloud || 0) - dt);
      c.itemMessageT = Math.max(0, (c.itemMessageT || 0) - dt);
      c.coinFlash = Math.max(0, (c.coinFlash || 0) - dt);
      c.coinStreakT = Math.max(0, (c.coinStreakT || 0) - dt);
      if (c.coinStreakT <= 0) c.coinStreak = 0;
      for (const item of c.inventory) {
        if (!item) continue;
        const prevRoll = item.rolling || 0;
        item.rolling = Math.max(0, prevRoll - dt);
        if (c.isPlayer && prevRoll > 0) {
          if (Math.floor(prevRoll * 11) !== Math.floor(item.rolling * 11) && item.rolling > 0.05) {
            sound.tick(Math.floor((1 - item.rolling) * 10));
          }
          if (item.rolling === 0) {
            const rarity = isJuiced(c) ? 'gold' : ITEMS[item.kind]?.rarity || 'blue';
            sound.chestOpen?.(rarity);
          }
        }
      }
      // Ignore discontinuities (respawn/debug teleports), but sweep real turbo steps.
      const prev = previous.get(c);
      const start = prev && Math.hypot(prev.x - c.x, prev.z - c.z) < 12 ? prev : c;
      const touches = (pickup, radius) => Math.abs(c.y - pickup.y) < 2.6 &&
        segmentDistanceSq(pickup.x, pickup.z, start.x, start.z, c.x, c.z) < radius * radius;
      previous.set(c, { x: c.x, z: c.z });
      if (c.done) continue;
      if (c.remote) { touchRemote(c, touches); continue; }

      for (const b of boxes) {
        if (b.down > 0 || !touches(b, 2.2)) continue;
        // A full inventory leaves the supply crate for another racer.
        if (!c.inventory.includes(null)) {
          if (c.isPlayer && !c.itemMessageT) feedback(c, 'Dos objetos: usa uno para abrir otra caja');
          continue;
        }
        give(c, order.indexOf(c), cars.length);
        breakCrate(b, c);
        if (c.isPlayer) sound.bonk(0.4);
      }

      for (const coin of coins) {
        const coinTouch = touches(coin, 2.1) || Math.hypot(c.x - coin.m.position.x, c.z - coin.m.position.z) < 1.85;
        if (coin.down > 0 || !coinTouch) continue;
        const worldPos = coin.m.position.clone();
        coin.down = COIN_RESPAWN; coin.m.visible = false;
        c.coins = Math.min(MAX_COINS, (c.coins || 0) + 1);
        c.coinsCollected = (c.coinsCollected || 0) + 1;
        c.coinFlash = 0.35;
        c.coinStreak = (c.coinStreak || 0) + 1;
        c.coinStreakT = 1.45;
        const m = coin.m.clone(); m.visible = true; scene.add(m);
        sparks.push({ m, car: c, age: 0 });
        hooks.coinPicked?.(c, worldPos, c.coinStreak);
        if (c.isPlayer) {
          // Step 3: bright chime whose pitch climbs with every coin in a row
          const pitch = 880 + c.coins * 26 + Math.min(10, c.coinStreak) * 58;
          sound.tone(pitch, 0, 0.08, 'sine', 0.11);
          sound.tone(pitch * 1.5, 0.05, 0.1, 'sine', 0.085);
        }
      }
      if (c.onGround) for (const p of pads) {
        const dx = c.x - p.x, dz = c.z - p.z;
        const fwd = dx * Math.sin(p.h) + dz * Math.cos(p.h);
        const side = dx * Math.cos(p.h) - dz * Math.sin(p.h);
        if (Math.abs(fwd) < PAD_L / 2 && Math.abs(side) < PAD_W / 2 + 0.6) {
          if (c.boost < 0.5) sound.turbo();
          c.boost = Math.max(c.boost, 1.2);
        }
      }
      for (const p of peels) {
        if (p.dead || (p.owner === c && p.t < p.safe) || c.spin > 0) continue;
        if (p.kind !== 'trampa' && !c.onGround) continue;
        const dist = Math.hypot(c.x - p.m.position.x, c.z - p.m.position.z);
        // Step 1 (Explosion Anticipation): swell & pulse trap crate when a car gets close
        if (p.kind === 'trampa' && dist < 6.5) {
          const swell = 1 + Math.sin(t * 32) * 0.16;
          p.m.scale.set(swell, 1 / Math.sqrt(swell), swell);
        }
        if (dist < (p.radius || 1.8) && Math.abs(c.y - p.m.position.y) < 3) {
          p.dead = true;
          if (p.kind === 'trampa') {
            const pos = p.m.position.clone();
            explode(pos);
            if (!shielded(c, pos)) {
              hooks.crash(c, 14, Math.random() < 0.5 ? -1 : 1);
              c.vx *= 0.35; c.vz *= 0.35; c.boost = 0;
              hooks.say(c, LINES.boom, 1.1);
            }
          } else slip(c);
          emit('slip', c, { id: p.id });
        }
      }
      if (!c.isPlayer && !c.human) aiThink(c, cars, dt);
    }

    for (const f of flying) {
      f.t += dt;
      const pos = f.m.position, old = pos.clone();
      if (f.kind === 'chancleta') {
        flyChancleta(f, dt);
      } else {
        const s = paramOf(pos.x, pos.z), aim = pointAt(s + f.travel * 10);
        let want = Math.atan2(aim.x - pos.x, aim.y - pos.z), best = f.seek || 22;
        if (f.kind === 'cohete' && f.target && !f.target.done) {
          // Rockets follow the road until the target is close, then lock on.
          const d = Math.hypot(f.target.x - pos.x, f.target.z - pos.z);
          if (d < 45) want = Math.atan2(f.target.x - pos.x, f.target.z - pos.z);
          else { const ahead = pointAt(s + f.travel * 16); want = Math.atan2(ahead.x - pos.x, ahead.y - pos.z); }
        } else if (f.kind === 'mango') {
          for (const c of cars) {
            if (c === f.owner || c.done) continue;
            const dx = c.x - pos.x, dz = c.z - pos.z, d = Math.hypot(dx, dz);
            if (d < best && d > 0.01 && (dx * Math.sin(f.h) + dz * Math.cos(f.h)) / d > 0.6) {
              best = d; want = Math.atan2(dx, dz);
            }
          }
        }
        const turnRate = f.kind === 'cohete' ? 5.5 : 3.5;
        const diff = Math.atan2(Math.sin(want - f.h), Math.cos(want - f.h));
        f.h += Math.max(-turnRate * dt, Math.min(turnRate * dt, diff));
        pos.x += Math.sin(f.h) * f.speed * dt;
        pos.z += Math.cos(f.h) * f.speed * dt;
        if (f.kind === 'cohete') {
          pos.y += (groundAt(pos.x, pos.z) + 1.3 - pos.y) * Math.min(1, dt * 10);
          f.m.rotation.set(0, f.h, 0);
          if (Math.random() < 0.6) puffs.spawn(pos.clone(), { color: pick([0xffae2b, 0xd8d8de]), count: 1, size: 0.4, rise: 0.3, life: 0.35, spread: 0.2 });
        } else {
          f.vy -= hooks.G * 0.6 * dt; pos.y += f.vy * dt;
          const floor = groundAt(pos.x, pos.z) + 0.6;
          if (pos.y < floor) { pos.y = floor; f.vy = Math.abs(f.vy) * 0.55 + 2; }
          f.m.rotation.x += f.spin * dt; f.m.rotation.y = f.h;
        }
      }
      // Resolve the nearest swept impact, independent of racer array order.
      const reach = f.kind === 'chancleta' ? 3.6 : 2.4;
      const hits = cars.filter(c => !c.done && !(c === f.owner && f.t < (f.kind === 'chancleta' ? 99 : 0.6)) &&
        (f.kind !== 'chancleta' || f.diving) &&
        segmentDistanceSq(c.x, c.z, old.x, old.z, pos.x, pos.z) < reach ** 2 &&
        Math.abs(c.y + 1 - pos.y) < (f.kind === 'chancleta' ? 3.5 : 2.2)).sort((a, b) =>
          Math.hypot(a.x - old.x, a.z - old.z) - Math.hypot(b.x - old.x, b.z - old.z));
      const c = hits[0];
      // A remote rival's own client decides the hit; here the mango just bursts.
      if (c && !c.remote) {
        // A held mango can stop a mango, not a rocket or a chancleta.
        const blocked = f.kind === 'mango' ? block(c, pos) : shielded(c, pos);
        if (!blocked) {
          const side = Math.sign((pos.x - c.x) * -Math.cos(c.h) + (pos.z - c.z) * Math.sin(c.h)) || 1;
          hooks.crash(c, f.kind === 'chancleta' ? 20 : 16, -side);
          c.vx *= f.kind === 'chancleta' ? 0.2 : 0.4; c.vz *= f.kind === 'chancleta' ? 0.2 : 0.4; c.boost = 0;
          hooks.say(c, f.kind === 'chancleta' ? LINES.chanclaHit : LINES.hit, 1.2);
        }
        emit('hit', c, { id: f.id, kind: f.kind, blocked, x: pos.x, y: pos.y, z: pos.z });
      }
      if (c) f.dead = true;
      const life = f.kind === 'chancleta' ? 16 : f.kind === 'cohete' ? 6 : 3;
      if ((f.kind === 'mango' && Math.abs(offsetOf(pos.x, pos.z)) > T.HW - 0.4) || f.t > life) f.dead = true;
      if (f.dead) {
        if (f.kind === 'cohete' || f.kind === 'chancleta') explode(pos.clone());
        else splat(pos.clone());
      }
    }
    flying = flying.filter(f => {
      if (!f.dead) return true;
      f.m.removeFromParent();
      gone.add(f.id);
      if (gone.size > 64) gone.delete(gone.values().next().value);
      return false;
    });
    peels = peels.filter(p => {
      p.t += dt;
      if (!p.dead && p.t < 30) return true;
      puffs.spawn(p.m.position, { color: 0xffae2b, count: 4, spread: 1, size: 0.5, life: 0.5 });
      p.m.removeFromParent(); return false;
    });
    for (const c of cars) { syncHeld(c); syncAuras(c); }
  }

  // The chancleta rides high along the circuit, then dives on its target.
  function flyChancleta(f, dt) {
    const pos = f.m.position, target = f.target;
    f.m.rotation.y += f.spin * dt;
    f.m.rotation.x = Math.sin(f.t * 7) * 0.5;
    if (!target || target.done) { f.dead = true; return; }
    const close = Math.hypot(target.x - pos.x, target.z - pos.z) < 16;
    if (f.diving || close) {
      f.diving = true;
      const dx = target.x - pos.x, dy = target.y + 1 - pos.y, dz = target.z - pos.z, d = Math.hypot(dx, dy, dz) || 1;
      const v = 55 * dt;
      pos.x += dx / d * Math.min(v, d); pos.y += dy / d * Math.min(v, d); pos.z += dz / d * Math.min(v, d);
      return;
    }
    f.s += f.speed * dt;
    const p = pointAt(f.s);
    pos.x += (p.x - pos.x) * Math.min(1, dt * 8);
    pos.z += (p.y - pos.z) * Math.min(1, dt * 8);
    pos.y += (groundAt(pos.x, pos.z) + 7 - pos.y) * Math.min(1, dt * 4);
  }

  return { clear, dispose, update, use, select, boxes, coins, pads, fragments,
    remoteThrow, remotePeel, remoteHit, remoteSlip, remoteCloud,
    get projectiles() { return flying; }, get peels() { return peels; } };
}
