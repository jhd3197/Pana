// Wooden supply crates, coin trails, two-slot inventory and mango combat.

import * as THREE from 'three';
import { makeMango } from '/engine/props.js';
import { FragmentBurst } from './fragments.js';
import { crateArt, coinArt } from './pickup-art.js';
import { activeItem, addItem, consumeItem, selectItem, canBlock, isMango, MAX_COINS, segmentDistanceSq } from './item-rules.js';

export const ITEMS = {
  mango: { icon: '🥭', name: 'Mango' },
  mango3: { icon: '🥭', name: 'Mata de mango', n: 3 },
  jugo: { icon: '🧃', name: 'Jugo de mango' },
  concha: {
    icon: '<svg viewBox="0 0 40 40" width="1em" height="1em"><path d="M20 6c-4 6-14 10-14 22 4-4 8-6 12-6-3 4-4 8-3 12 2-5 5-8 9-9 2 3 5 5 10 6-2-5-2-10-5-13 2-5 0-9-9-12z" fill="#ffae2b" stroke="#16161a" stroke-width="2.5" stroke-linejoin="round"/><path d="M20 6c-2 5-6 8-9 12" fill="none" stroke="#7cc242" stroke-width="3" stroke-linecap="round"/><path d="M29 16c1 3 0 5-2 6" fill="none" stroke="#e8452c" stroke-width="3" stroke-linecap="round"/></svg>',
    name: 'Concha de mango',
  },
};

// odds for the leader (k=0) and the last car (k=1): the back of the pack gets the good stuff
const ODDS = {
  mango: [3, 2],
  mango3: [0, 2],
  jugo: [1, 4],
  concha: [4, 1],
};

const BOX_RESPAWN = 2.5;
const COIN_RESPAWN = 8;
const PAD_W = 4, PAD_L = 6;
export const SPIN = 1.1;             // seconds a mango peel spins you around

const LINES = {
  throw: ['¡Toma tu mango!', '¡Mangazo!', '¡Ahí va!'],
  hit: ['¡Me cayó un mango!', '¡Qué mango!', '¡Pegajoso!', '¡Ñooo!'],
  jugo: ['¡Jugo de mango!', '¡Qué rico!', '¡Recargado!'],
  peel: ['¡Me resbalé!', '¡Epa!', '¡Uyyy!'],
  drop: ['¡Cuidado atrás!', '¡Jejeje!'],
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

// hooks: { scene, puffs, sound, G, track, crash, say, standings }
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
  const held = new Map();
  const previous = new Map();
  let t = 0;
  const disposeGeometry = root => root.traverse(o => o.geometry?.dispose());

  function clear() {
    for (const entry of [...flying, ...peels, ...sparks]) entry.m.removeFromParent();
    for (const m of held.values()) m.removeFromParent();
    held.clear(); previous.clear(); fragments.clear();
    flying = []; peels = []; sparks = [];
    for (const pickup of [...boxes, ...coins]) {
      pickup.down = 0; pickup.m.visible = true; pickup.m.scale.setScalar(1);
    }
  }

  function dispose() {
    clear();
    // Materials on the four art templates are shared within their modules.
    for (const template of [crate.visual, crate.pieces, coin, mango, peel]) disposeGeometry(template);
    // Peel materials are created per item system; mango/wood/coin paints are cached.
    const peelMaterials = new Set();
    peel.traverse(o => { if (o.material) peelMaterials.add(o.material); });
    peelMaterials.forEach(m => m.dispose());
    padTex.dispose(); padMat.dispose();
  }

  function roll(place, count) {
    const k = count > 1 ? Math.max(0, Math.min(1, place / (count - 1))) : 0.5;
    const bag = Object.entries(ODDS).map(([kind, [lead, last]]) => [kind, lead + (last - lead) * k]);
    let r = Math.random() * bag.reduce((n, [, w]) => n + w, 0);
    for (const [kind, w] of bag) if ((r -= w) <= 0) return kind;
    return 'mango';
  }

  function feedback(c, message, duration = 1.5) {
    if (c.isPlayer) { c.itemMessage = message; c.itemMessageT = duration; }
  }

  function give(c, place, count) {
    if (!addItem(c, roll(place, count))) return false;
    c.useT = rand(0.8, 3.5);
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
    if (isMango(item)) {
      const m = mango.clone();
      const speed = 34 + Math.max(0, c.vf * direction);
      m.position.set(c.x + fx * 3.4, c.y + 1.5, c.z + fz * 3.4);
      scene.add(m);
      // Find the direction along the circuit from the actual launch heading.
      // A reverse throw keeps travelling backward when it seeks the road.
      const s = paramOf(c.x, c.z), a = pointAt(s), b = pointAt(s + 0.5);
      const travel = (b.x - a.x) * fx + (b.y - a.y) * fz >= 0 ? 1 : -1;
      flying.push({ m, owner: c, h, speed, travel, vy: 3.5, t: 0, spin: rand(8, 14) });
      sound.whoosh();
      feedback(c, direction < 0 ? '¡Mango hacia atrás!' : '¡Ahí va ese mango!');
      if (Math.random() < 0.5) hooks.say(c, LINES.throw, 0.9);
    } else if (kind === 'jugo') {
      c.boost = Math.max(c.boost, 2.2);
      sound.turbo();
      hooks.say(c, LINES.jugo, 1);
      puffs.spawn(new THREE.Vector3(c.x, c.y + 0.6, c.z), { color: 0xffae2b, count: 6, spread: 1.4 });
    } else if (kind === 'concha') {
      const m = peel.clone();
      m.position.set(c.x + fx * 3.4, groundAt(c.x + fx * 3.4, c.z + fz * 3.4) + 0.15, c.z + fz * 3.4);
      m.rotation.y = Math.random() * 6;
      scene.add(m);
      peels.push({ m, owner: c, safe: 1, t: 0 });
      sound.plop();
      feedback(c, direction < 0 ? '¡Concha detrás!' : '¡Concha adelante!');
    }
    consumeItem(c);
    return true;
  }

  function slip(c) {
    c.spin = SPIN;
    c.dizzy = Math.max(c.dizzy, 2);
    c.vx *= 0.35; c.vz *= 0.35; c.boost = 0;
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
    if (item.kind === 'jugo') { if (c.useT <= 0) use(c); return; }
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
    } else if ((rear && c.useT <= 0) || c.useT < -6) use(c, -1);
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

  function update(dt, cars, racing) {
    t += dt;
    padTex.offset.y -= dt * 1.6;
    fragments.update(dt);
    for (const b of boxes) {
      b.down = Math.max(0, b.down - dt);
      b.m.visible = b.down === 0;
      b.m.scale.setScalar(Math.min(1, b.m.scale.x + dt * 6));
    }
    for (const coin of coins) {
      coin.down = Math.max(0, coin.down - dt);
      coin.m.visible = coin.down === 0;
      coin.m.position.y = coin.y + 1.3 + Math.sin(t * 3 + coin.phase) * 0.12;
      coin.m.rotation.y = t * 2.2 + coin.phase;
    }
    sparks = sparks.filter(s => {
      s.age += dt;
      if (s.age >= 0.32) { s.m.removeFromParent(); return false; }
      s.m.position.lerp(new THREE.Vector3(s.car.x, s.car.y + 1.8, s.car.z), Math.min(1, dt * 15));
      s.m.scale.setScalar(1 - s.age / 0.32);
      s.m.rotation.y += dt * 12;
      return true;
    });
    if (!racing) { for (const c of cars) syncHeld(c); return; }

    const order = hooks.standings();
    for (const c of cars) {
      c.boost = Math.max(0, c.boost - dt);
      c.spin = Math.max(0, c.spin - dt);
      c.itemMessageT = Math.max(0, (c.itemMessageT || 0) - dt);
      c.coinFlash = Math.max(0, (c.coinFlash || 0) - dt);
      for (const item of c.inventory) if (item) item.rolling = Math.max(0, item.rolling - dt);
      // Ignore discontinuities (respawn/debug teleports), but sweep real turbo steps.
      const prev = previous.get(c);
      const start = prev && Math.hypot(prev.x - c.x, prev.z - c.z) < 12 ? prev : c;
      const touches = (pickup, radius) => Math.abs(c.y - pickup.y) < 2.6 &&
        segmentDistanceSq(pickup.x, pickup.z, start.x, start.z, c.x, c.z) < radius * radius;
      previous.set(c, { x: c.x, z: c.z });
      if (c.done) continue;

      for (const b of boxes) {
        if (b.down > 0 || !touches(b, 2.2)) continue;
        // A full inventory leaves the supply crate for another racer.
        if (!c.inventory.includes(null)) {
          if (c.isPlayer && !c.itemMessageT) feedback(c, 'Dos objetos: usa uno para abrir otra caja');
          continue;
        }
        give(c, order.indexOf(c), cars.length);
        crate.pieces.position.copy(b.m.position);
        crate.pieces.quaternion.copy(b.m.quaternion);
        crate.pieces.scale.setScalar(1);
        fragments.burst(crate.pieces, { velocity: new THREE.Vector3(c.vx, 0, c.vz), power: 5 });
        b.down = BOX_RESPAWN; b.m.visible = false; b.m.scale.setScalar(0.85);
        if (c.isPlayer) sound.bonk(0.4);
        puffs.spawn(b.m.position, { color: 0xc79c63, count: 4, spread: 1.3, size: 0.45, life: 0.4 });
      }

      for (const coin of coins) {
        if (coin.down > 0 || !touches(coin, 1.9)) continue;
        coin.down = COIN_RESPAWN; coin.m.visible = false;
        c.coins = Math.min(MAX_COINS, (c.coins || 0) + 1);
        c.coinsCollected = (c.coinsCollected || 0) + 1;
        c.coinFlash = 0.35;
        const m = coin.m.clone(); m.visible = true; scene.add(m);
        sparks.push({ m, car: c, age: 0 });
        if (c.isPlayer) {
          const pitch = 880 + c.coins * 35;
          sound.tone(pitch, 0, 0.08, 'sine', 0.1);
          sound.tone(pitch * 1.5, 0.055, 0.1, 'sine', 0.08);
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
        if (p.dead || (p.owner === c && p.t < p.safe) || !c.onGround || c.spin > 0) continue;
        if (Math.hypot(c.x - p.m.position.x, c.z - p.m.position.z) < 1.8) {
          slip(c); p.dead = true;
        }
      }
      if (!c.isPlayer) aiThink(c, cars, dt);
    }

    for (const f of flying) {
      f.t += dt;
      const pos = f.m.position, old = pos.clone();
      const s = paramOf(pos.x, pos.z), aim = pointAt(s + f.travel * 10);
      let want = Math.atan2(aim.x - pos.x, aim.y - pos.z), best = 22;
      for (const c of cars) {
        if (c === f.owner || c.done) continue;
        const dx = c.x - pos.x, dz = c.z - pos.z, d = Math.hypot(dx, dz);
        if (d < best && d > 0.01 && (dx * Math.sin(f.h) + dz * Math.cos(f.h)) / d > 0.6) {
          best = d; want = Math.atan2(dx, dz);
        }
      }
      const diff = Math.atan2(Math.sin(want - f.h), Math.cos(want - f.h));
      f.h += Math.max(-3.5 * dt, Math.min(3.5 * dt, diff));
      pos.x += Math.sin(f.h) * f.speed * dt;
      pos.z += Math.cos(f.h) * f.speed * dt;
      f.vy -= hooks.G * 0.6 * dt; pos.y += f.vy * dt;
      const floor = groundAt(pos.x, pos.z) + 0.6;
      if (pos.y < floor) { pos.y = floor; f.vy = Math.abs(f.vy) * 0.55 + 2; }
      f.m.rotation.x += f.spin * dt; f.m.rotation.y = f.h;
      // Resolve the nearest swept impact, independent of racer array order.
      const hits = cars.filter(c => !c.done && !(c === f.owner && f.t < 0.6) &&
        segmentDistanceSq(c.x, c.z, old.x, old.z, pos.x, pos.z) < 2.4 ** 2 &&
        Math.abs(c.y + 1 - pos.y) < 2.2).sort((a, b) =>
          Math.hypot(a.x - old.x, a.z - old.z) - Math.hypot(b.x - old.x, b.z - old.z));
      const c = hits[0];
      if (c) {
        if (!block(c, pos)) {
          const side = Math.sign((pos.x - c.x) * -Math.cos(c.h) + (pos.z - c.z) * Math.sin(c.h)) || 1;
          hooks.crash(c, 16, -side);
          c.vx *= 0.4; c.vz *= 0.4; c.boost = 0;
          hooks.say(c, LINES.hit, 1.2);
        }
        f.dead = true;
      }
      if (Math.abs(offsetOf(pos.x, pos.z)) > T.HW - 0.4 || f.t > 3) f.dead = true;
      if (f.dead) splat(pos.clone());
    }
    flying = flying.filter(f => !f.dead || (f.m.removeFromParent(), false));
    peels = peels.filter(p => {
      p.t += dt;
      if (!p.dead && p.t < 30) return true;
      puffs.spawn(p.m.position, { color: 0xffae2b, count: 4, spread: 1, size: 0.5, life: 0.5 });
      p.m.removeFromParent(); return false;
    });
    for (const c of cars) syncHeld(c);
  }

  return { clear, dispose, update, use, select, boxes, coins, pads, fragments,
    get projectiles() { return flying; }, get peels() { return peels; } };
}
