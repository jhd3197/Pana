import { random, inputFor } from '../online-rules.js';
// ¡Atrapa los mangos! Panas with baskets under a mango tree. Mangos fall,
// golden ones are worth 3, coconuts knock you silly for a moment.

import * as THREE from 'three';
import { Puffs, Shockwaves, sound } from '/engine/fx.js';
import { M, mesh } from '/engine/models/core/primitives.js';
import { makeMango } from '/engine/models/props/mango.js';
import { woodSign } from '/engine/models/props/wood-sign.js';
import { sunnyStage, makeActors, animateActor, rand, pick } from './stage.js';

const LANE_Z = 3;            // where the panas stand
const BASKET_Z = LANE_Z + 0.85;
const CATCH_Y = 1.75;
const HALF = 10.5;           // how far left/right anyone can go
const SPEED = 8.5;
const G = 7;

function basket() {
  const g = new THREE.Group();
  const wicker = M(0xb07a3e, { roughness: 1, side: THREE.DoubleSide });
  const body = mesh(new THREE.CylinderGeometry(0.72, 0.5, 0.55, 10, 1, true), wicker);
  const bottom = mesh(new THREE.CircleGeometry(0.5, 10), wicker, 0, -0.27, 0);
  bottom.rotation.x = -Math.PI / 2;
  const rim = mesh(new THREE.TorusGeometry(0.72, 0.07, 5, 14), M(0x8a5a2b, { roughness: 1 }), 0, 0.27, 0);
  rim.rotation.x = Math.PI / 2;
  g.add(body, bottom, rim);
  return g;
}

function coconut() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.IcosahedronGeometry(0.45, 1), M(0x6b4a2a, { roughness: 1 })));
  for (const [x, y] of [[-0.12, 0.1], [0.12, 0.1], [0, -0.1]]) {
    g.add(mesh(new THREE.SphereGeometry(0.07, 5, 4), M(0x2a1a0e), x, y, 0.4));
  }
  return g;
}

function mangoTree() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(1.1, 1.8, 8, 7), M(0x7a5232, { roughness: 1 }), 0, 4, 0));
  const leaf = M(0x3d9142, { roughness: 0.9 }), dark = M(0x2f7a37, { roughness: 0.9 });
  for (const [x, y, z, r, d] of [[0, 10, 0, 5, 0], [-5.5, 8.6, 0.8, 3.8, 1], [5.5, 8.8, 0.5, 3.9, 1], [-2.6, 11.6, -0.6, 3.2, 1], [2.8, 11.8, -0.4, 3.3, 0], [-8.4, 8, -0.5, 2.6, 0], [8.4, 8.2, -0.6, 2.6, 0]]) {
    g.add(mesh(new THREE.IcosahedronGeometry(r, 0), d ? dark : leaf, x, y, z));
  }
  for (let i = 0; i < 12; i++) {
    const m = makeMango();
    m.scale.setScalar(0.8);
    m.position.set(rand(-9, 9), rand(6.8, 8.2), rand(2.4, 3.6));
    m.rotation.z = rand(-0.4, 0.4);
    g.add(m);
  }
  return g;
}

export default {
  id: 'atrapa',
  title: '¡Atrapa los mangos!',
  howto: 'Muévete y atrapa los mangos con tu cesta. Los de oro valen 3. ¡Ojo con los cocos!',
  keys: [['A D / ← →', 'moverte']],
  icon: 'mango',
  time: 30,

  create(ctx) {
    const scene = new THREE.Scene();
    const stage=sunnyStage(scene);
    const tree = mangoTree();
    tree.position.set(0, 0, -3.5);
    scene.add(tree);
    const sign = woodSign(['ENTRE MÁS', 'MANGOS', '¡MEJOR!'], { w: 4.6, h: 3.4 });
    sign.position.set(13.5, 0, -2);
    sign.rotation.y = -0.4;
    scene.add(sign);
    const puffs = new Puffs(scene);
    const shockwaves = new Shockwaves(scene);

    const camera = new THREE.PerspectiveCamera(50, (ctx.aspect || innerWidth / innerHeight), 0.1, 400);
    camera.position.set(0, 6.2, 19);
    camera.lookAt(0, 4.2, 0);

    const actors = makeActors(scene, ctx.players);
    actors.forEach((a, i) => {
      a.x = a.home = -7.5 + i * 5;
      a.z = LANE_Z;
      const b = basket();
      b.position.set(0, 1.25, 0.85);
      a.pana.group.add(b);
      a.basket = b;
      a.catchPop = 0;
      a.streak = 0;
      a.streakT = 0;
      a.ai = { target: null, think: 0, err: 0, speed: SPEED * rand(0.78, 0.92) };
    });

    let falling = [];
    let spawnT = 0.4;
    let clock = 0;

    function spawn() {
      const r = random();
      const kind = r < 0.12 ? 'gold' : r < 0.3 ? 'coco' : 'mango';
      const obj = kind === 'coco' ? coconut() : makeMango({ gold: kind === 'gold' });
      if (kind !== 'coco') obj.scale.setScalar(kind === 'gold' ? 0.95 : 0.85);
      const x = rand(-HALF + 0.5, HALF - 0.5);
      obj.position.set(x, rand(8.5, 9.5), BASKET_Z);
      scene.add(obj);
      falling.push({ obj, kind, vy: rand(-1, 0), spin: rand(-4, 4) });
    }

    // time until a falling thing reaches basket height
    const landIn = (f) => {
      const h = f.obj.position.y - CATCH_Y;
      const v = -f.vy;
      return (-v + Math.sqrt(v * v + 2 * G * Math.max(0, h))) / G;
    };

    function think(a) {
      const ai = a.ai;
      // dodge coconuts about to land on us
      const danger = falling.find((f) => f.kind === 'coco' && Math.abs(f.obj.position.x - a.x) < 1.2 && landIn(f) < 0.7);
      if (danger) {
        ai.target = a.x + (a.x > danger.obj.position.x ? 2.5 : -2.5);
        return;
      }
      let best = null, bestScore = 0;
      for (const f of falling) {
        if (f.kind === 'coco') continue;
        const t = landIn(f);
        const dist = Math.abs(f.obj.position.x - a.x);
        if (dist / ai.speed > t + 0.05) continue;
        // leave it to a pana who's closer, and favor our own side of the yard
        const beaten = actors.some((o) => o !== a && Math.abs(o.x - f.obj.position.x) < dist - 0.6);
        const roam = 1 + Math.abs(f.obj.position.x - a.home) * 0.12;
        const score = (f.kind === 'gold' ? 3 : 1) / (t + 0.4 + dist * 0.05) / roam * (beaten ? 0.15 : 1);
        if (score > bestScore) { bestScore = score; best = f; }
      }
      ai.target = best ? best.obj.position.x + ai.err : null;
    }

    let skyTime=0;
    function update(dt, input) {
      skyTime+=dt;stage.update(skyTime);
      clock += dt;
      spawnT -= dt;
      if (spawnT <= 0) {
        spawn();
        if (random() < 0.25) spawn();
        spawnT = rand(0.3, 0.55);
      }

      // move panas
      for (const a of actors) {
        a.stun = Math.max(0, a.stun - dt);
        a.streakT = Math.max(0, (a.streakT || 0) - dt);
        if (a.streakT <= 0) a.streak = 0;
        let dir = 0;
        if (a.stun > 0) dir = 0;
        else if (a.player.human && !ctx.auto) dir = inputFor(input, a.i).x;
        else {
          a.ai.think -= dt;
          if (a.ai.think <= 0) {
            a.ai.err = rand(-0.5, 0.5);
            think(a);
            a.ai.think = rand(0.18, 0.4);
          }
          if (a.ai.target != null) {
            const d = a.ai.target - a.x;
            dir = Math.abs(d) < 0.2 ? 0 : Math.sign(d) * Math.min(1, Math.abs(d) * 2);
          }
        }
        const speed = a.player.human && !ctx.auto ? SPEED : a.ai.speed;
        a.vx += (dir * speed - a.vx) * Math.min(1, dt * 14);
        a.x = Math.max(-HALF, Math.min(HALF, a.x + a.vx * dt));
      }
      // panas bump each other
      for (let i = 0; i < actors.length; i++) {
        for (let j = i + 1; j < actors.length; j++) {
          const A = actors[i], B = actors[j];
          const d = B.x - A.x;
          if (Math.abs(d) < 1.3) {
            const push = (1.3 - Math.abs(d)) / 2 * (Math.sign(d) || 1);
            A.x -= push;
            B.x += push;
          }
        }
      }

      // falling things
      for (const f of falling) {
        const p = f.obj.position;
        const prev = p.y;
        f.vy -= G * dt;
        p.y += f.vy * dt;
        // Magnetic pull-in toward the nearest unstunned basket when close
        if (f.kind !== 'coco' && p.y > CATCH_Y && p.y < CATCH_Y + 1.45) {
          const magnet = actors.find((c) => c.stun <= 0 && Math.abs(c.x - p.x) < 1.45);
          if (magnet) p.x += (magnet.x - p.x) * Math.min(1, dt * 9.5);
        }
        f.obj.rotation.z += f.spin * dt;
        f.obj.rotation.x += f.spin * 0.5 * dt;
        if (prev > CATCH_Y && p.y <= CATCH_Y) {
          const a = actors.find((c) => Math.abs(c.x - p.x) < 0.95 && c.stun <= 0);
          if (a) {
            f.dead = true;
            if (f.kind === 'coco') {
              a.stun = 1.3;
              a.streak = 0;
              a.bubble.say(pick(['¡COCO!', '¡Ay, mi cabeza!', '¡Pum!']), 1);
              sound.bonk(0.9);
              puffs.spawn(p.clone(), { color: 0x8a6a4a, count: 5, spread: 0.8, size: 0.6 });
            } else {
              const pts = f.kind === 'gold' ? 3 : 1;
              a.score += pts;
              a.streak = Math.min(8, (a.streak || 0) + 1);
              a.streakT = 2.4;
              a.catchPop = 0.22;
              if (f.kind === 'gold') a.bubble.say('¡DE ORO!', 0.8);
              else if (a.streak >= 3) a.bubble.say(`×${a.streak}!`, 0.65);
              if (a.player.human || f.kind === 'gold') sound.pickup(a.streak - 1);
              puffs.spawn(p.clone(), { color: f.kind === 'gold' ? 0xffd23f : 0xffae2b, count: 3, spread: 0.5, size: 0.4, rise: 1.5, life: 0.5 });
              shockwaves.sparkle(p.clone(), { color: f.kind === 'gold' ? 0xffe066 : 0xffc629 });
            }
          }
        }
        if (p.y < 0.35) {
          f.dead = true;
          if (f.kind !== 'coco') {
            puffs.spawn(p.clone(), { color: 0xffae2b, count: 5, spread: 0.9, size: 0.5, rise: 1, life: 0.6 });
            if (random() < 0.3) sound.splat();
          } else sound.plop();
        }
      }
      falling = falling.filter((f) => !f.dead || (scene.remove(f.obj), false));

      for (const a of actors) {
        animateActor(a, dt, { moving: Math.abs(a.vx) / SPEED, open: a.stun > 0, dizzy: a.stun > 0, armsUp: 0.8 });
        a.pana.group.rotation.y = a.vx * 0.04;
        if (a.catchPop > 0) {
          a.catchPop = Math.max(0, a.catchPop - dt);
          const u = 1 - a.catchPop / 0.22;
          const s = 1 + Math.sin(u * Math.PI) * 0.28;
          a.basket.scale.set(s, 2 - s, s);
        } else {
          a.basket.scale.set(1, 1, 1);
        }
      }
      puffs.update(dt);
      shockwaves.update(dt);
    }

    // everyone celebrates (or not) once time is up
    function outro(dt, winners) {
      for (const a of actors) {
        const win = winners.includes(a.i);
        a.y = win ? Math.abs(Math.sin(clock * 6)) * 0.8 : 0;
        clock += dt / actors.length;
        animateActor(a, dt, { moving: 0, open: win, armsUp: win ? 1.8 : 0.4 });
      }
      for (const f of falling) f.obj.position.y = Math.max(0.4, f.obj.position.y - dt * 5);
      puffs.update(dt);
      shockwaves.update(dt);
    }

    return { scene, camera, update, outro, scores: () => actors.map((a) => a.score), actors };
  },
};
