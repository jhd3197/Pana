import { random, inputFor } from '../online-rules.js';
// ¡Coleo! The llanero rodeo: six panas on horseback chase a bull down the
// manga. Get right behind it and pull its tail to tumble it. Each tumble is a
// point, and a new bull bursts out ahead. Grab at air and your horse stumbles.

import * as THREE from 'three';
import { Puffs, sound, makeBubble } from '/engine/fx.js';
import { M, mesh } from '/engine/models/core/primitives.js';
import { bake } from '/engine/models/core/static-batch.js';
import { createRider } from '/engine/models/fauna/farm/llanero-rider.js';
import { hatoCow } from '/engine/models/fauna/farm/hato-cow.js';
import { ranchFence } from '/engine/models/props/ranch.js';
import { moriche } from '/engine/models/vegetation/moriche.js';
import { savannaGrass } from '/engine/models/vegetation/savanna-grass.js';
import { sunnyStage, rand, pick } from './stage.js';

const TIME = 40;
const MANGA = 4.4;                 // riders and bull stay within ±MANGA
const BULL_SPEED = 11;
const FOLLOW = 3;                  // how far behind the bull riders settle
const REACH = { near: 2.5, far: 3.9, dx: 0.65 };   // where the tail can be grabbed from
const LATERAL = 4.6;
const LOOP = 240;                  // scenery recycles every LOOP metres
const COATS = ['bay', 'palomino', 'grey', 'bay'];

export default {
  id: 'coleo',
  title: '¡Coleo!',
  howto: 'Ponte justo detrás del toro y jálale la cola para tumbarlo. Cada toro tumbado es un punto. Si jalas al aire, tu caballo tropieza.',
  keys: [['A D / ← →', 'moverte'], ['Espacio', 'jalar la cola']],
  icon: 'bull',
  time: TIME,

  create(ctx) {
    const scene = new THREE.Scene();
    const stage = sunnyStage(scene, { ground: null, decor: false, horizon: 0xf6e3b4 });
    const puffs = new Puffs(scene);

    const camera = new THREE.PerspectiveCamera(50, (ctx.aspect || innerWidth / innerHeight), 0.1, 500);
    camera.position.set(0, 8.5, 7.5);
    camera.lookAt(0, 0.6, -6.5);

    // The camera stays put and the world scrolls: everything has a forward
    // distance `s`, drawn at z = -(s - anchor).
    let anchor = 0;
    const zOf = (s) => -(s - anchor);

    const dirt = mesh(new THREE.PlaneGeometry(2 * MANGA + 2.4, 400), M(0xc49a64, { roughness: 1 }), 0, 0.02, -180);
    dirt.rotation.x = -Math.PI / 2;
    dirt.receiveShadow = true;
    scene.add(dirt);

    // scenery that recycles as it passes behind the camera
    const scenery = [];
    const place = (obj, s, x) => { scene.add(obj); scenery.push({ obj, s, x }); };
    const fenceSpan = 24;
    const fence = bake(ranchFence({ span: fenceSpan }));
    for (let k = 0; k < LOOP / fenceSpan; k++) {
      for (const side of [-1, 1]) {
        const f = fence.clone();
        f.rotation.y = Math.PI / 2;
        place(f, k * fenceSpan - 10, side * (MANGA + 1.3));
      }
    }
    for (let k = 0; k < 14; k++) {
      const side = k % 2 ? 1 : -1;
      place(moriche({ seed: 60 + k, h: rand(8, 13) }), rand(0, LOOP), side * rand(12, 38));
    }
    for (let k = 0; k < 26; k++) {
      const side = k % 2 ? 1 : -1;
      place(savannaGrass({ seed: 90 + k, dry: k % 3 === 0 }), rand(0, LOOP), side * rand(7, 22));
    }

    // the riders
    const actors = ctx.players.map((p, i) => {
      const rider = createRider(p.avatar, COATS[i % COATS.length], 7 + i);
      rider.group.rotation.order = 'YXZ';
      scene.add(rider.group);
      const bubble = makeBubble();
      scene.add(bubble.sprite);
      return {
        i, player: p, rider, bubble, score: 0,
        x: -3 + i * 6 / (ctx.players.length - 1), s: 0, v: BULL_SPEED, vx: 0,
        stumble: 0, reach: 0, cool: 0,
        ai: { tx: 0, think: 0, inReach: 0, react: rand(0.18, 0.42), lane: rand(-0.3, 0.3) },
      };
    });
    const human = (a) => a.player.human && !ctx.auto;

    // bulls: a small pool, one running, the tumbled ones sliding away behind
    const bulls = [0, 1, 2].map((k) => {
      const m = hatoCow({ seed: 41 + k, coat: k === 1 ? 'pinto' : 'brown', locomotion: true });
      m.scale.setScalar(1.35);
      m.rotation.order = 'YXZ';
      m.visible = false;
      scene.add(m);
      return { m, s: 0, x: 0, tx: 0, swerve: 0, v: 0, phase: 0, roll: 0, rollDir: 1, state: 'idle' };
    });
    let bull = null, nextBull = 0, clock = 0;
    const stats = { grabs: 0, misses: 0, bulls: 0, reachTime: 0 };

    function release(s) {
      const b = bulls.find((o) => o.state === 'idle');
      Object.assign(b, { s, x: rand(-2.5, 2.5), swerve: 0.6, v: BULL_SPEED + clock * 0.05, roll: 0, state: 'run' });
      b.tx = b.x;
      b.m.visible = true;
      b.m.rotation.set(0, Math.PI, 0);
      puffs.spawn(new THREE.Vector3(b.x, 1, zOf(s)), { color: 0xc49a64, count: 8, spread: 1.4, size: 0.9 });
      bull = b;
      stats.bulls++;
    }
    release(16);

    const gapOf = (a) => (bull ? bull.s - a.s : 99);
    const inReach = (a) => {
      if (!bull || a.stumble > 0) return false;
      const gap = gapOf(a);
      return gap > REACH.near && gap < REACH.far && Math.abs(a.x - bull.x) < REACH.dx;
    };

    function grab(a) {
      if (a.cool > 0 || a.stumble > 0) return;
      a.cool = 0.35;
      a.reach = 0.4;
      stats.grabs++;
      if (inReach(a)) {
        a.score += 1;
        a.bubble.say(pick(['¡COLEAO!', '¡Tumbao!', '¡Eso es!']), 1);
        sound.bonk(1);
        if (human(a)) sound.pickup();
        bull.state = 'tumble';
        bull.rollDir = pick([-1, 1]);
        puffs.spawn(new THREE.Vector3(bull.x, 0.8, zOf(bull.s)), { color: 0xc49a64, count: 12, spread: 1.8, size: 1.1, rise: 1.2 });
        nextBull = bull.s + 18;
        bull = null;
      } else {
        stats.misses++;
        a.stumble = 0.6;
        a.bubble.say(pick(['¡Fallé!', '¡Epa!', '¡Ay, mi caballo!']), 0.8);
        sound.boing();
        puffs.spawn(new THREE.Vector3(a.x, 0.5, zOf(a.s)), { color: 0xc49a64, count: 5, spread: 1, size: 0.7 });
      }
    }

    function think(a, dt) {
      const ai = a.ai;
      ai.think -= dt;
      // steer toward where the bull was a moment ago, a little off-centre
      if (ai.think <= 0) {
        ai.think = rand(0.2, 0.4);
        ai.tx = bull ? bull.x + ai.lane * 0.5 : a.x;
        ai.lane = rand(-0.35, 0.35);
      }
      const d = ai.tx - a.x;
      const dir = Math.abs(d) < 0.15 ? 0 : Math.sign(d) * Math.min(1, Math.abs(d) * 2);
      let press = false;
      if (inReach(a)) {
        ai.inReach += dt;
        if (ai.inReach > ai.react) { press = true; ai.react = rand(0.18, 0.42); }
      } else {
        ai.inReach = 0;
        // now and then it misjudges and grabs from just too far
        if (bull && random() < dt * 0.25 && Math.abs(gapOf(a) - FOLLOW) < 1 && Math.abs(a.x - bull.x) < 1.1) press = true;
      }
      return { dir, press };
    }

    function stepRiders(dt, input, racing) {
      for (const a of actors) {
        a.stumble = Math.max(0, a.stumble - dt);
        a.cool = Math.max(0, a.cool - dt);
        a.reach = Math.max(0, a.reach - dt);
        let dir = 0;
        if (racing) {
          if (human(a)) {
            dir = inputFor(input, a.i).x;
            if (inputFor(input, a.i).jump) grab(a);
          } else {
            const plan = think(a, dt);
            dir = plan.dir;
            if (plan.press) grab(a);
          }
        }
        a.vx += (dir * LATERAL * (a.stumble > 0 ? 0.3 : 1) - a.vx) * Math.min(1, dt * 10);
        a.x = Math.max(-MANGA, Math.min(MANGA, a.x + a.vx * dt));
        // ride up behind the bull (or the spot where the next one comes out)
        const lead = bull ? bull.s : nextBull;
        const pace = BULL_SPEED + clock * 0.05;
        let target = racing ? pace + Math.max(-5, Math.min(6, (lead - a.s - FOLLOW) * 1.6)) : 0;
        if (a.stumble > 0) target = 4;
        a.v += (target - a.v) * Math.min(1, dt * 3);
        a.s += a.v * dt;
        // the bull's body is in the way: nobody rides through it
        if (bull && Math.abs(a.x - bull.x) < 1.3 && bull.s - a.s < REACH.near) a.s = bull.s - REACH.near;
      }
      // Overlapping horses near the bull fight for the spot behind it: the one
      // farther from the bull's line gives way by dropping back, so riders cut
      // across behind each other. Pushing everyone sideways instead kept them
      // in their starting left-to-right row, and the end seats won far more.
      for (let i = 0; i < actors.length; i++) {
        for (let j = i + 1; j < actors.length; j++) {
          const A = actors[i], B = actors[j];
          const dx = B.x - A.x, ds = B.s - A.s;
          const penX = 1.15 - Math.abs(dx), penS = 2.4 - Math.abs(ds);
          if (penX <= 0 || penS <= 0) continue;
          const contest = bull && Math.abs(A.x - bull.x) < 2.5 && Math.abs(B.x - bull.x) < 2.5;
          if (contest) {
            const back = Math.abs(A.x - bull.x) > Math.abs(B.x - bull.x) ? A : B;
            back.s -= penS * 0.25;
            back.v = Math.min(back.v, BULL_SPEED);
          } else if (penX < penS * 0.5) {
            const push = penX / 2 * (Math.sign(dx) || (i % 2 ? 1 : -1));
            A.x = Math.max(-MANGA, Math.min(MANGA, A.x - push));
            B.x = Math.max(-MANGA, Math.min(MANGA, B.x + push));
          } else {
            const back = ds > 0 ? A : B;
            back.s -= penS;
            back.v = Math.min(back.v, BULL_SPEED);
          }
        }
      }
    }

    function stepBulls(dt) {
      for (const b of bulls) {
        if (b.state === 'idle') continue;
        if (b.state === 'run') {
          b.swerve -= dt;
          if (b.swerve <= 0) {
            let tx;
            do tx = rand(-MANGA + 0.6, MANGA - 0.6); while (Math.abs(tx - b.x) < 1.5);
            b.tx = tx;
            b.swerve = rand(1.0, 1.9) - clock / TIME * 0.3;
          }
          b.x += Math.sign(b.tx - b.x) * Math.min(Math.abs(b.tx - b.x), 3.4 * dt);
          b.v = BULL_SPEED + clock * 0.05;
        } else {
          // tumbled: roll onto its side and skid to a stop
          b.roll = Math.min(1, b.roll + dt * 2.5);
          b.v = Math.max(0, b.v - dt * 14);
          if (zOf(b.s) > 16) { b.state = 'idle'; b.m.visible = false; }
        }
        b.s += b.v * dt;
        b.phase += dt * (b.state === 'run' ? 5 + b.v * 0.5 : 9);
        b.m.userData.gallop(b.phase, b.state === 'run' ? b.v : 6, 0);
        b.m.position.set(b.x, b.roll * 0.35, zOf(b.s));
        b.m.rotation.z = b.rollDir * b.roll * 1.45;
        b.m.rotation.y = Math.PI + (b.state === 'run' ? (b.tx - b.x) * 0.06 : 0);
      }
      if (!bull && actors.some((a) => a.s > nextBull - 18)) release(nextBull);
    }

    function draw(dt) {
      // follow the pack, leaning toward the bull
      const lead = Math.max(...actors.map((a) => a.s));
      const goal = (bull ? (lead * 0.5 + bull.s * 0.5) : lead) - 1;
      anchor += (goal - anchor) * Math.min(1, dt * 3);
      for (const o of scenery) {
        while (zOf(o.s) > 14) o.s += LOOP;
        o.obj.position.set(o.x, 0, zOf(o.s));
      }
      for (const a of actors) {
        const g = a.rider.group;
        g.position.set(a.x, 0, zOf(a.s));
        g.rotation.y = Math.PI - a.vx * 0.05;
        g.rotation.x = a.stumble > 0 ? -0.18 : 0;
        a.rider.update(dt, { speed: a.v, jumpY: 0 });
        // the right arm reaches down for the tail
        if (a.reach > 0) a.rider.rider.arms[1].rotation.set(-0.2, 0, -0.9);
        a.bubble.sprite.position.set(a.x, 3.8, zOf(a.s));
        a.bubble.update(dt);
      }
    }

    let skyTime = 0;
    function update(dt, input) {
      skyTime += dt; stage.update(skyTime);
      clock += dt;
      stepRiders(dt, input, true);
      if (actors.some(inReach)) stats.reachTime += dt;
      stepBulls(dt);
      draw(dt);
      puffs.update(dt);
    }

    function outro(dt, winners) {
      clock += dt;
      stepRiders(dt, { x: 0, jump: false }, false);
      stepBulls(dt);
      draw(dt);
      for (const a of actors) {
        if (winners.includes(a.i)) {
          a.rider.rider.arms[0].rotation.set(-2.6, 0, 0.3);
          a.rider.rider.arms[1].rotation.set(-2.6, 0, -0.3);
        }
      }
      puffs.update(dt);
    }

    return { scene, camera, update, outro, actors, scores: () => actors.map((a) => a.score), stats: () => ({ ...stats, reachTime: +stats.reachTime.toFixed(1) }) };
  },
};
