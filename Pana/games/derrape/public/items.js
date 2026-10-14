// Power-ups: turbo pads on the track, "?" boxes that hand out a random item,
// and the items themselves: everything is mango. Throw one, drink the juice,
// or drop the slippery peel.

import * as THREE from 'three';
import { makeMango } from '/engine/props.js';

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

function boxTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 128, 128);
  ['#ff5e7a', '#ffd23f', '#5ee07a', '#4fb6ff', '#b46bff'].forEach((col, i) => grad.addColorStop(i / 4, col));
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#fff';
  g.lineWidth = 10;
  g.strokeRect(5, 5, 118, 118);
  g.fillStyle = '#fff';
  g.strokeStyle = '#16161a';
  g.lineWidth = 6;
  g.font = '92px "Luckiest Guy", system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.strokeText('?', 64, 72);
  g.fillText('?', 64, 72);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
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
// track is the runtime from tracks.js; box/pad positions come from its def
// as fractions of the lap so every map can place its own.
export function createItems(hooks) {
  const { scene, puffs, sound, track: T } = hooks;
  const { pointAt, paramOf, offsetOf, groundAt } = T;
  const HW = T.HW;
  const itemDef = T.def.items || {};
  const boxRows = (itemDef.boxes || [0.125, 0.521]).map((u) => u * T.TOTAL);
  const boxLanes = itemDef.boxLanes || [-6, -2, 2, 6];
  const padDefs = (itemDef.pads || []).map((p) => ({ s: p.u * T.TOTAL, off: p.off }));

  // a point on the track plus the heading pointing along it
  const along = (s, off = 0) => {
    const p = pointAt(s), p2 = pointAt(s + 0.5);
    const tx = p2.x - p.x, tz = p2.y - p.y, l = Math.hypot(tx, tz);
    return { x: p.x - tz / l * off, z: p.y + tx / l * off, h: Math.atan2(tx, tz) };
  };

  // ---- turbo pads ----
  const padTex = padTexture();
  const padGeo = new THREE.PlaneGeometry(PAD_W, PAD_L);
  padGeo.rotateX(-Math.PI / 2);
  padGeo.rotateY(Math.PI);           // texture "up" now points along +Z (forward)
  const padMat = new THREE.MeshStandardMaterial({ map: padTex, emissive: 0xff7b1c, emissiveIntensity: 0.35, roughness: 0.6 });
  const pads = padDefs.map((def) => {
    const a = along(def.s, def.off);
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

  // ---- "?" boxes ----
  const boxGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
  const boxMat = new THREE.MeshStandardMaterial({ map: boxTexture(), emissive: 0xffffff, emissiveIntensity: 0.15, transparent: true, opacity: 0.92 });
  const boxes = [];
  for (const s of boxRows) {
    for (const off of boxLanes) {
      const a = along(s, off);
      const m = new THREE.Mesh(boxGeo, boxMat);
      m.castShadow = true;
      scene.add(m);
      boxes.push({ x: a.x, z: a.z, y: groundAt(a.x, a.z), m, down: 0, phase: Math.random() * 6 });
    }
  }

  let flying = [];    // thrown mangos
  let peels = [];     // dropped mango peels
  let t = 0;

  function clear() {
    for (const f of flying) scene.remove(f.m);
    for (const p of peels) scene.remove(p.m);
    flying = [];
    peels = [];
    for (const b of boxes) b.down = 0;
  }

  function roll(place, count) {
    const k = count > 1 ? place / (count - 1) : 0.5;
    const bag = Object.entries(ODDS).map(([kind, [lead, last]]) => [kind, lead + (last - lead) * k]);
    let r = Math.random() * bag.reduce((n, [, w]) => n + w, 0);
    for (const [kind, w] of bag) if ((r -= w) <= 0) return kind;
    return 'mango';
  }

  function give(c, place, count) {
    const kind = roll(place, count);
    c.item = { kind, n: ITEMS[kind].n || 1 };
    c.rolling = c.isPlayer ? 1 : 0.6;
    c.useT = rand(0.6, 3.5);
    if (c.isPlayer) sound.pickup();
  }

  // ---- using items ----
  function use(c) {
    if (!c.item || c.rolling > 0 || c.done) return false;
    const kind = c.item.kind;
    const fx = Math.sin(c.h), fz = Math.cos(c.h);
    if (kind === 'mango' || kind === 'mango3') {
      const m = makeMango();
      const speed = Math.max(0, c.vf) + 34;
      m.position.set(c.x + fx * 2.4, c.y + 1.8, c.z + fz * 2.4);
      scene.add(m);
      flying.push({ m, owner: c, h: c.h, speed, vy: 5, t: 0, spin: rand(8, 14) });
      sound.whoosh();
      if (Math.random() < 0.6) hooks.say(c, LINES.throw, 0.9);
    } else if (kind === 'jugo') {
      c.boost = Math.max(c.boost, 2.2);
      sound.turbo();
      hooks.say(c, LINES.jugo, 1);
      puffs.spawn(new THREE.Vector3(c.x - fx * 2, c.y + 0.6, c.z - fz * 2), { color: 0xffae2b, count: 6, spread: 1.4 });
    } else if (kind === 'concha') {
      const m = makePeel();
      m.position.set(c.x - fx * 3, groundAt(c.x - fx * 3, c.z - fz * 3) + 0.15, c.z - fz * 3);
      m.rotation.y = Math.random() * 6;
      scene.add(m);
      peels.push({ m, owner: c, safe: 1, t: 0 });
      sound.plop();
      if (Math.random() < 0.5) hooks.say(c, LINES.drop, 0.9);
    }
    if (--c.item.n <= 0) c.item = null;
    return true;
  }

  function slip(c) {
    c.spin = SPIN;
    c.dizzy = Math.max(c.dizzy, 2);
    c.vx *= 0.35;
    c.vz *= 0.35;
    c.boost = 0;
    c.heave.v += 4;
    hooks.say(c, LINES.peel, 1);
    sound.slip();
  }

  function splat(pos) {
    puffs.spawn(pos, { color: 0xffae2b, count: 9, spread: 1.6, size: 0.9, rise: 2.2, life: 0.9 });
    puffs.spawn(pos, { color: 0xe8452c, count: 3, spread: 1.2, size: 0.6, rise: 1.6, life: 0.7 });
    sound.splat();
  }

  // ---- AI decides when to use its item ----
  function aiThink(c, cars, dt) {
    if (!c.item || c.rolling > 0 || c.done || c.spin > 0) return;
    c.useT -= dt;
    const kind = c.item.kind;
    const fx = Math.sin(c.h), fz = Math.cos(c.h);
    if (kind === 'jugo') {
      if (c.useT <= 0) use(c);
      return;
    }
    if (kind === 'mango' || kind === 'mango3') {
      const target = cars.some((o) => {
        if (o === c || o.done) return false;
        const dx = o.x - c.x, dz = o.z - c.z, d = Math.hypot(dx, dz);
        return d < 32 && d > 3 && (dx * fx + dz * fz) / d > 0.93;
      });
      if ((target && c.useT <= 0) || c.useT < -8) { use(c); c.useT = rand(0.5, 1.5); }
      return;
    }
    const chaser = cars.some((o) => {
      if (o === c || o.done) return false;
      const dx = o.x - c.x, dz = o.z - c.z, d = Math.hypot(dx, dz);
      return d < 16 && (dx * fx + dz * fz) / d < -0.8;
    });
    if ((chaser && c.useT <= 0) || c.useT < -6) use(c);
  }

  function update(dt, cars, racing) {
    t += dt;
    padTex.offset.y -= dt * 1.6;

    // boxes spin, bob, and pop back after a moment
    for (const b of boxes) {
      b.down = Math.max(0, b.down - dt);
      const grow = b.down > 0 ? 0 : 1;
      const s = b.m.scale.x + (grow - b.m.scale.x) * Math.min(1, dt * 8);
      b.m.scale.setScalar(Math.max(0.001, s));
      b.m.visible = s > 0.02;
      b.m.position.set(b.x, b.y + 1.4 + Math.sin(t * 2.5 + b.phase) * 0.25, b.z);
      b.m.rotation.set(0.5, t * 1.4 + b.phase, 0.3);
    }
    if (!racing) return;

    const order = hooks.standings();
    for (const c of cars) {
      c.boost = Math.max(0, c.boost - dt);
      c.spin = Math.max(0, c.spin - dt);
      if (c.rolling > 0) {
        c.rolling = Math.max(0, c.rolling - dt);
        if (c.isPlayer && Math.floor(c.rolling * 14) !== Math.floor((c.rolling + dt) * 14)) sound.tick();
      }
      if (c.done) continue;

      // grab a box
      for (const b of boxes) {
        if (b.down > 0 || Math.abs(c.y - b.y) > 3) continue;
        if (Math.hypot(c.x - b.x, c.z - b.z) < 2.3) {
          b.down = BOX_RESPAWN;
          puffs.spawn(b.m.position, { color: 0xffffff, count: 5, spread: 1.2, size: 0.6, rise: 1.5, life: 0.5 });
          if (!c.item && !(c.rolling > 0)) give(c, order.indexOf(c), cars.length);
          else if (c.isPlayer) sound.tick();
        }
      }

      // hit a turbo pad
      if (c.onGround) {
        for (const p of pads) {
          const dx = c.x - p.x, dz = c.z - p.z;
          const fwd = dx * Math.sin(p.h) + dz * Math.cos(p.h);
          const side = dx * Math.cos(p.h) - dz * Math.sin(p.h);
          if (Math.abs(fwd) < PAD_L / 2 && Math.abs(side) < PAD_W / 2 + 0.6) {
            if (c.boost < 0.5) sound.turbo();
            c.boost = Math.max(c.boost, 1.2);
          }
        }
      }

      // skid on a peel
      for (const p of peels) {
        if (p.owner === c && p.t < p.safe) continue;
        if (!c.onGround || c.spin > 0) continue;
        if (Math.hypot(c.x - p.m.position.x, c.z - p.m.position.z) < 1.8) {
          slip(c);
          p.dead = true;
        }
      }

      if (!c.isPlayer) aiThink(c, cars, dt);
    }

    // mangos: follow the track, lean toward a car ahead, bounce, splat
    for (const f of flying) {
      f.t += dt;
      const s = paramOf(f.m.position.x, f.m.position.z);
      const aim = pointAt(s + 10);
      let want = Math.atan2(aim.x - f.m.position.x, aim.y - f.m.position.z);
      let best = 22;
      for (const c of cars) {
        if (c === f.owner) continue;
        const dx = c.x - f.m.position.x, dz = c.z - f.m.position.z, d = Math.hypot(dx, dz);
        if (d < best && (dx * Math.sin(f.h) + dz * Math.cos(f.h)) / d > 0.6) {
          best = d;
          want = Math.atan2(dx, dz);
        }
      }
      const diff = Math.atan2(Math.sin(want - f.h), Math.cos(want - f.h));
      f.h += Math.max(-3.5 * dt, Math.min(3.5 * dt, diff));
      const pos = f.m.position;
      pos.x += Math.sin(f.h) * f.speed * dt;
      pos.z += Math.cos(f.h) * f.speed * dt;
      f.vy -= hooks.G * 0.6 * dt;
      pos.y += f.vy * dt;
      const g = groundAt(pos.x, pos.z) + 0.6;
      if (pos.y < g) {
        pos.y = g;
        f.vy = Math.abs(f.vy) * 0.55 + 2;
      }
      f.m.rotation.x += f.spin * dt;
      f.m.rotation.y = f.h;

      for (const c of cars) {
        if (c === f.owner && f.t < 0.6) continue;
        if (Math.hypot(c.x - pos.x, c.z - pos.z) < 2.4 && Math.abs(c.y + 1 - pos.y) < 2.2) {
          const side = Math.sign((pos.x - c.x) * -Math.cos(c.h) + (pos.z - c.z) * Math.sin(c.h)) || 1;
          hooks.crash(c, 16, -side);
          c.vx *= 0.4;
          c.vz *= 0.4;
          c.boost = 0;
          hooks.say(c, LINES.hit, 1.2);
          f.dead = true;
          break;
        }
      }
      if (Math.abs(offsetOf(pos.x, pos.z)) > HW - 0.4 || f.t > 3) f.dead = true;
      if (f.dead) splat(pos.clone());
    }
    flying = flying.filter((f) => !f.dead || (scene.remove(f.m), false));

    for (const p of peels) {
      p.t += dt;
      if (p.t > 30) p.dead = true;
    }
    peels = peels.filter((p) => {
      if (!p.dead) return true;
      puffs.spawn(p.m.position, { color: 0xffae2b, count: 4, spread: 1, size: 0.5, rise: 1.4, life: 0.5 });
      scene.remove(p.m);
      return false;
    });
  }

  return { clear, update, use, boxes, pads };
}
