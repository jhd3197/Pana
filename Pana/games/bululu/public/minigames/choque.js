// ¡Choque de carritos! Bumper karts on a round wooden platform over the sea.
// Knock the others into the water: whoever touched a kart last before it fell
// gets the point. In the last seconds the outer ring of planks falls away.

import * as THREE from 'three';
import { Puffs, sound, makeBubble } from '/engine/fx.js';
import { M, mesh } from '/engine/models/core/primitives.js';
import { CAR_BUILDERS } from '/engine/models/vehicles/cars.js';
import { palm } from '/engine/models/vegetation/palm.js';
import { sunnyStage, rand, pick } from './stage.js';

const TIME = 45;
const R = 12, INNER = 8, WEDGES = 12;   // platform radius, the part that never falls, outer pieces
const CRUMBLE = 15;                      // the outer ring falls during the last CRUMBLE seconds
const SCALE = 0.72;                      // Derrape's cars are big for this arena
const BODY = 1.25;                       // collision radius
const TOP = 9, ACCEL = 16, TURN = 4.2;
const BOOST = 17, BOOST_COOL = 3;
const CREDIT = 3;                        // seconds a bump still counts when the kart drops
const RESPAWN = 2;
// heavier karts shove harder and get shoved less
const MASS = { chamo: 1, lancha: 1.1, machito: 1.2, bala: 0.85, toro: 1.45, familiar: 1.3, rumbera: 1, montanero: 1.3 };

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const angleOf = (x, z) => (Math.atan2(-z, x) + Math.PI * 2) % (Math.PI * 2);

// one piece of the outer ring, as a solid annular sector with its top at y = 0
function wedge(k, material) {
  const a0 = k / WEDGES * Math.PI * 2, a1 = (k + 1) / WEDGES * Math.PI * 2;
  const shape = new THREE.Shape();
  shape.absarc(0, 0, R, a0, a1, false);
  shape.absarc(0, 0, INNER - 0.02, a1, a0, true);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 6 });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -1, 0);
  const m = new THREE.Mesh(geo, material);
  m.castShadow = m.receiveShadow = true;
  return m;
}

export default {
  id: 'choque',
  title: '¡Choque de carritos!',
  howto: 'Empuja a los demás carritos al agua. Cada uno que tumbes es un punto. Al final, el borde de la tarima se cae… ¡quédate en el centro!',
  keys: [['WASD / flechas', 'manejar'], ['Espacio', 'turbo']],
  icon: 'car',
  time: TIME,
  input: '2d',

  create(ctx) {
    const scene = new THREE.Scene();
    const stage = sunnyStage(scene, { ground: null, grass: false });
    const puffs = new Puffs(scene);

    // the sea, gently rolling
    const seaGeo = new THREE.PlaneGeometry(220, 220, 50, 50);
    seaGeo.rotateX(-Math.PI / 2);
    const seaBase = seaGeo.attributes.position.array.slice();
    const sea = new THREE.Mesh(seaGeo, new THREE.MeshStandardMaterial({ color: 0x2fa3c9, roughness: 0.3, flatShading: true }));
    sea.position.y = -1.7;
    sea.receiveShadow = true;
    scene.add(sea);
    for (const [x, z, s] of [[-26, -24, 1], [30, -20, 0.8], [-34, 6, 0.7], [24, -40, 1.2]]) {
      const isle = mesh(new THREE.CylinderGeometry(4 * s, 5 * s, 2, 12), M(0xe2c48a, { roughness: 1 }), x, -1.2, z);
      scene.add(isle);
      const p = palm({ h: 6 * s + 2, seed: Math.round(x) + 90 });
      p.position.set(x, -0.2, z);
      scene.add(p);
    }

    // the platform: a solid middle and a ring of pieces that can drop
    const wood = M(0xb3793f, { roughness: 0.95 }), edge = M(0x8a5a2e, { roughness: 1 });
    const middle = mesh(new THREE.CylinderGeometry(INNER, INNER, 1, 48), wood, 0, -0.5, 0);
    middle.receiveShadow = true;
    scene.add(middle);
    for (const r of [2.5, 5.2]) {
      const ring = mesh(new THREE.RingGeometry(r - 0.06, r + 0.06, 64), edge, 0, 0.01, 0);
      ring.rotation.x = -Math.PI / 2;
      scene.add(ring);
    }
    const ringLine = mesh(new THREE.RingGeometry(INNER - 0.08, INNER + 0.08, 64), M(0xffc629, { roughness: 0.8 }), 0, 0.012, 0);
    ringLine.rotation.x = -Math.PI / 2;
    scene.add(ringLine);
    const pieces = Array.from({ length: WEDGES }, (_, k) => {
      const m = wedge(k, k % 2 ? wood : M(0xa86f3a, { roughness: 0.95 }));
      scene.add(m);
      return { m, alive: true, vy: 0, spin: 0 };
    });
    let crumbleOrder = [...pieces.keys()].sort(() => Math.random() - 0.5);
    let crumbleNext = TIME - CRUMBLE;

    const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 500);
    camera.position.set(0, 25, 21);
    camera.lookAt(0, -1.5, -1.6);

    // the karts: a different car for each pana
    const ids = Object.keys(CAR_BUILDERS).sort(() => Math.random() - 0.5);
    const actors = ctx.players.map((p, i) => {
      const id = ids[i % ids.length];
      const car = CAR_BUILDERS[id](p.avatar);
      car.root.scale.setScalar(SCALE);
      scene.add(car.root);
      const ring = mesh(new THREE.RingGeometry(1.25, 1.55, 28), new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.85 }), 0, 0.03, 0);
      ring.rotation.x = -Math.PI / 2;
      scene.add(ring);
      const bubble = makeBubble();
      scene.add(bubble.sprite);
      const a0 = Math.PI / 4 + i * Math.PI / 2;
      return {
        i, player: p, car, ring, bubble, id, mass: MASS[id] ?? 1, score: 0,
        x: Math.cos(a0) * 5, z: -Math.sin(a0) * 5, y: 0, h: 0,
        vf: 0, ex: 0, ez: 0, steer: 0,
        boost: 0, cool: 0, falling: false, vy: 0, down: 0, safe: 0, hit: null,
        ai: { think: 0, dx: 0, dz: 0, target: null, wobble: rand(-0.3, 0.3) },
      };
    });
    for (const a of actors) a.h = Math.atan2(-a.x, -a.z);   // face the middle
    const human = (a) => a.player.human && !ctx.auto;

    const solidAt = (x, z) => {
      const r = Math.hypot(x, z);
      if (r <= INNER) return true;
      if (r > R) return false;
      return pieces[Math.floor(angleOf(x, z) / (Math.PI * 2) * WEDGES) % WEDGES].alive;
    };
    // distance from a point to the nearest drop, looking outward
    const edgeRoom = (x, z) => {
      const r = Math.hypot(x, z);
      return (solidAt(x / (r || 1) * (R - 0.01), z / (r || 1) * (R - 0.01)) ? R : INNER) - r;
    };

    let clock = 0;

    function respawn(a) {
      for (let tries = 0; tries < 20; tries++) {
        const ang = rand(0, Math.PI * 2), r = rand(0, 3.5);
        const x = Math.cos(ang) * r, z = Math.sin(ang) * r;
        if (actors.every((o) => o === a || o.falling || Math.hypot(o.x - x, o.z - z) > BODY * 2.4)) { a.x = x; a.z = z; break; }
      }
      Object.assign(a, { y: 0, vy: 0, vf: 0, ex: 0, ez: 0, falling: false, down: 0, safe: 1.2, hit: null });
      a.car.tumble.rotation.set(0, 0, 0);
      puffs.spawn(new THREE.Vector3(a.x, 1, a.z), { color: 0xffffff, count: 6, spread: 1, size: 0.8 });
    }

    function drop(a) {
      a.falling = true;
      a.down = RESPAWN;
      a.vy = 2;
      const by = a.hit && clock - a.hit.t < CREDIT ? a.hit.by : null;
      if (by) {
        by.score += 1;
        by.bubble.say(pick(['¡Al agua!', '¡Chao!', '¡Pa\' fuera!']), 1);
        if (human(by)) sound.pickup();
      } else a.bubble.say(pick(['¡Me caí solito!', '¡Upa!']), 1);
      sound.slip();
    }

    // AI: aim behind the target (on the middle's side) so the hit pushes it outward
    function think(a, dt) {
      const ai = a.ai;
      ai.think -= dt;
      if (ai.think <= 0) {
        ai.think = rand(0.15, 0.3);
        const others = actors.filter((o) => o !== a && !o.falling && o.safe <= 0);
        ai.target = others.sort((p, q) => (edgeRoom(p.x, p.z) - Math.hypot(p.x - a.x, p.z - a.z) * 0.15) - (edgeRoom(q.x, q.z) - Math.hypot(q.x - a.x, q.z - a.z) * 0.15))[0] ?? null;
        ai.wobble = rand(-0.35, 0.35);
      }
      let tx = 0, tz = 0;
      if (edgeRoom(a.x, a.z) < 2.6) { tx = -a.x; tz = -a.z; }   // too close to the drop: back to the middle
      else if (ai.target) {
        const t = ai.target, r = Math.hypot(t.x, t.z) || 1;
        tx = t.x - t.x / r * 1.2 - a.x;
        tz = t.z - t.z / r * 1.2 - a.z;
        if (Math.hypot(tx, tz) < 1.5) { tx = t.x - a.x; tz = t.z - a.z; }
      }
      const len = Math.hypot(tx, tz);
      if (len < 0.3) return { x: 0, z: 0, boost: false };
      const ang = Math.atan2(tx, tz) + ai.wobble;
      const aligned = Math.abs(wrap(ang - a.h)) < 0.3;
      const close = ai.target && Math.hypot(ai.target.x - a.x, ai.target.z - a.z) < 5.5;
      return { x: Math.sin(ang), z: -Math.cos(ang), boost: aligned && close && Math.random() < dt * 3 };
    }

    function drive(a, dt, input) {
      a.cool = Math.max(0, a.cool - dt);
      a.boost = Math.max(0, a.boost - dt);
      a.safe = Math.max(0, a.safe - dt);
      // the stick points where the kart should go (screen-relative); the kart turns to it
      const mag = Math.min(1, Math.hypot(input.x, input.z));
      let throttle = 0;
      if (mag > 0.1) {
        const want = Math.atan2(input.x, -input.z);
        const diff = wrap(want - a.h);
        const turn = Math.sign(diff) * Math.min(Math.abs(diff), TURN * dt);
        a.h += turn;
        a.steer = turn / (TURN * dt || 1);
        throttle = mag * (Math.abs(diff) < Math.PI / 2 ? 1 : 0.25);
      } else a.steer *= 0.8;
      if (input.boost && a.cool <= 0) {
        a.cool = BOOST_COOL;
        a.boost = 0.45;
        a.vf = Math.max(a.vf, BOOST);
        if (human(a)) sound.turbo();
        puffs.spawn(new THREE.Vector3(a.x - Math.sin(a.h) * 1.4, 0.6, a.z - Math.cos(a.h) * 1.4), { color: 0xffc629, count: 4, spread: 0.5, size: 0.5, life: 0.4 });
      }
      const top = a.boost > 0 ? BOOST : TOP;
      a.vf += (throttle * top - a.vf) * Math.min(1, dt * (throttle ? ACCEL / top : 2.5));
      const k = Math.exp(-3 * dt);
      a.ex *= k; a.ez *= k;
      a.x += (Math.sin(a.h) * a.vf + a.ex) * dt;
      a.z += (Math.cos(a.h) * a.vf + a.ez) * dt;
    }

    function bumps() {
      for (let i = 0; i < actors.length; i++) {
        for (let j = i + 1; j < actors.length; j++) {
          const A = actors[i], B = actors[j];
          if (A.falling || B.falling) continue;
          let nx = B.x - A.x, nz = B.z - A.z;
          const d = Math.hypot(nx, nz);
          if (d >= BODY * 2 || d === 0) continue;
          nx /= d; nz /= d;
          // push apart, then trade momentum along the line between them
          const overlap = BODY * 2 - d, share = A.mass + B.mass;
          A.x -= nx * overlap * B.mass / share; A.z -= nz * overlap * B.mass / share;
          B.x += nx * overlap * A.mass / share; B.z += nz * overlap * A.mass / share;
          const va = [Math.sin(A.h) * A.vf + A.ex, Math.cos(A.h) * A.vf + A.ez];
          const vb = [Math.sin(B.h) * B.vf + B.ex, Math.cos(B.h) * B.vf + B.ez];
          const rel = (va[0] - vb[0]) * nx + (va[1] - vb[1]) * nz;
          if (rel <= 0) continue;
          const impulse = rel * 1.9 / (1 / A.mass + 1 / B.mass) * 1.25;   // a bit bouncier than real
          if (A.safe <= 0) { A.ex -= nx * impulse / A.mass; A.ez -= nz * impulse / A.mass; }
          if (B.safe <= 0) { B.ex += nx * impulse / B.mass; B.ez += nz * impulse / B.mass; }
          A.vf *= 0.5; B.vf *= 0.5;
          // whoever was driving into the other gets the credit if it drops
          const aPush = va[0] * nx + va[1] * nz, bPush = -(vb[0] * nx + vb[1] * nz);
          if (aPush > 0.5) B.hit = { by: A, t: clock };
          if (bPush > 0.5) A.hit = { by: B, t: clock };
          sound.bonk(Math.min(1, rel / 12));
          puffs.spawn(new THREE.Vector3(A.x + nx * BODY, 0.8, A.z + nz * BODY), { color: 0xffffff, count: 3, spread: 0.4, size: 0.5, rise: 1, life: 0.35 });
        }
      }
    }

    function crumble(dt) {
      if (clock >= crumbleNext && crumbleOrder.length) {
        const k = crumbleOrder.pop();
        pieces[k].alive = false;
        pieces[k].spin = rand(-0.6, 0.6);
        sound.whoosh();
        crumbleNext += CRUMBLE / WEDGES * 0.9;
      }
      for (const p of pieces) {
        if (p.alive || p.m.position.y < -14) continue;
        p.vy -= 14 * dt;
        p.m.position.y += p.vy * dt;
        p.m.rotation.x += p.spin * dt;
      }
    }

    function draw(dt) {
      for (const a of actors) {
        const c = a.car;
        c.root.position.set(a.x, a.y, a.z);
        c.root.rotation.y = a.h;
        for (const w of c.wheels) {
          w.spin.rotation.x += a.vf * dt / (c.radius * SCALE);
          if (w.front) w.steer.rotation.y = a.steer * 0.45;
        }
        c.driver?.update(dt, { look: 0 });
        c.root.visible = a.safe <= 0 || Math.sin(clock * 30) > -0.3;
        a.ring.visible = !a.falling;
        a.ring.position.set(a.x, 0.03, a.z);
        a.bubble.sprite.position.set(a.x, a.y + 3.4, a.z);
        a.bubble.update(dt);
      }
    }

    function fall(a, dt) {
      a.down -= dt;
      a.vy -= 20 * dt;
      a.y += a.vy * dt;
      a.x += a.ex * dt * 0.5 + Math.sin(a.h) * a.vf * dt * 0.5;
      a.z += a.ez * dt * 0.5 + Math.cos(a.h) * a.vf * dt * 0.5;
      a.car.tumble.rotation.x += dt * 3;
      if (a.y < -1.6 && a.vy < 0 && !a.splashed) {
        a.splashed = true;
        sound.splat();
        puffs.spawn(new THREE.Vector3(a.x, -1.2, a.z), { color: 0xe6f6ff, count: 10, spread: 1.6, size: 1, rise: 2.5, life: 0.8 });
      }
      if (a.down <= 0) { a.splashed = false; respawn(a); }
    }

    let skyTime = 0;
    function update(dt, input) {
      skyTime += dt; stage.update(skyTime);
      clock += dt;
      const pos = seaGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setY(i, seaBase[i * 3 + 1] + Math.sin(seaBase[i * 3] * 0.15 + clock * 1.3) * 0.25 + Math.cos(seaBase[i * 3 + 2] * 0.2 + clock) * 0.2);
      pos.needsUpdate = true;
      crumble(dt);
      for (const a of actors) {
        if (a.falling) { fall(a, dt); continue; }
        let ctl;
        if (human(a)) ctl = { x: input.x, z: input.z ?? 0, boost: input.jump };
        else ctl = think(a, dt);
        drive(a, dt, ctl);
      }
      bumps();
      for (const a of actors) if (!a.falling && !solidAt(a.x, a.z)) drop(a);
      draw(dt);
      puffs.update(dt);
    }

    function outro(dt, winners) {
      clock += dt;
      for (const a of actors) {
        if (a.falling) { fall(a, dt); continue; }
        drive(a, dt, { x: 0, z: 0, boost: false });
        if (winners.includes(a.i)) a.h += dt * 4;   // victory donuts
      }
      crumble(dt);
      draw(dt);
      puffs.update(dt);
    }

    return { scene, camera, update, outro, actors, scores: () => actors.map((a) => a.score) };
  },
};
