// ¡No te caigas! Four panas on a raft, a striped log sweeping around a
// post. Jump it or take a swim. It speeds up, and sometimes flips direction.

import * as THREE from 'three';
import { Puffs, sound, makeBubble } from '/engine/fx.js';
import { M, mesh, box } from '/engine/models/core/primitives.js';
import { flagPole } from '/engine/models/props/flags.js';
import { watchtower } from '/engine/models/props/watchtower.js';
import { woodSign } from '/engine/models/props/wood-sign.js';
import { sunnyStage, makeActors, animateActor, rand, pick } from './stage.js';

const DECK = 0.25;          // plank top height
const RING = 3.7;           // where the panas stand
const CLEAR = 0.8;          // feet must be this high over the deck when the log passes
const JUMP = 8, G = 22;          // clears the log if you jump 0.12–0.61 s before it arrives

// how early an AI pana jumps this pass; mistakes get likelier as it speeds up
function aiTiming(clock) {
  if (Math.random() < 0.03 + clock * 0.004) return pick([0.04, rand(0.66, 0.8)]);
  return rand(0.18, 0.45);
}
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export default {
  id: 'caigas',
  title: '¡No te caigas!',
  howto: 'Salta el tronco cuando pase por debajo. Se pone cada vez más rápido… ¡y a veces cambia de dirección!',
  keys: [['Espacio / W', 'saltar']],
  icon: 'jump',
  time: 30,

  create(ctx) {
    const scene = new THREE.Scene();
    const stage=sunnyStage(scene, { ground: null, grass: false });
    const puffs = new Puffs(scene);

    // sea
    const seaGeo = new THREE.PlaneGeometry(200, 200, 40, 40);
    seaGeo.rotateX(-Math.PI / 2);
    const sea = new THREE.Mesh(seaGeo, new THREE.MeshStandardMaterial({ color: 0x2fa3c9, roughness: 0.3, flatShading: true }));
    sea.position.y = -0.3;
    scene.add(sea);
    const seaBase = Float32Array.from(seaGeo.attributes.position.array);

    // raft: one colored platform per player plus a hub
    const colors = ctx.players.map((p) => p.color);
    const raft = new THREE.Group();
    [[1, 1], [-1, 1], [-1, -1], [1, -1]].forEach(([sx, sz], i) => {   // same order as the panas
      const c = new THREE.Color(colors[i]).multiplyScalar(0.85);
      raft.add(box(4.4, 0.5, 4.4, M(`#${c.getHexString()}`, { roughness: 0.8 }), sx * 2.5, 0, sz * 2.5));
      for (let k = -1; k <= 1; k++) {   // plank seams
        raft.add(box(4.3, 0.02, 0.06, M(0x3a2a1a), sx * 2.5, DECK + 0.005, sz * 2.5 + k * 1.1));
      }
    });
    raft.add(mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.5, 12), M(0x6b4a2a), 0, 0, 0));
    for (const [x, z] of [[5.2, 5.2], [-5.2, 5.2], [5.2, -5.2], [-5.2, -5.2]]) {
      raft.add(mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.4, 8), M(0xd9d0c0), x, -0.3, z));   // floats
    }
    scene.add(raft);
    scene.add(mesh(new THREE.CylinderGeometry(0.6, 0.75, 1.6, 8), M(0x3a3a46, { roughness: 0.6 }), 0, 0.8, 0));

    // the log, with yellow stripes, on a pivot
    const pivot = new THREE.Group();
    pivot.position.y = DECK + 0.42;
    const logLen = 13;
    const log = mesh(new THREE.CylinderGeometry(0.36, 0.36, logLen, 10), M(0x8a5a33, { roughness: 0.9 }));
    log.rotation.z = Math.PI / 2;
    pivot.add(log);
    for (const x of [-5.2, -3.4, -1.6, 1.6, 3.4, 5.2]) {
      const band = mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.45, 10), M(0xffc629, { roughness: 0.7 }), x, 0, 0);
      band.rotation.z = Math.PI / 2;
      pivot.add(band);
    }
    pivot.add(mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.9, 8), M(0x2a2a33), 0, 0.2, 0));
    scene.add(pivot);

    // beach dressing: lifeguard tower with the flag, a sign
    const tower = watchtower({ h: 5, roof: 'zinc' });
    tower.position.set(11, 0, -9);
    scene.add(tower);
    const flag = flagPole({ h: 10 });
    flag.position.set(12.6, 0, -10);
    scene.add(flag);
    const sign = woodSign(['PANAS', 'SIEMPRE', '¡JUEGAN!'], { w: 4.4, h: 3.4 });
    sign.position.set(-12, 0, -8);
    sign.rotation.y = 0.5;
    scene.add(sign);
    for (const [x, z] of [[11, -9], [-12, -8]]) {
      scene.add(mesh(new THREE.CylinderGeometry(4, 4.6, 1, 10), M(0xe8c98a, { roughness: 1 }), x, -0.2, z));   // sandbars
    }
    const shout = makeBubble();
    shout.sprite.position.set(0, 3.4, 0);
    scene.add(shout.sprite);

    const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 400);
    camera.position.set(0, 12.5, 15.5);
    camera.lookAt(0, 0.4, 0.6);

    const actors = makeActors(scene, ctx.players);
    actors.forEach((a, i) => {
      a.phi = [-Math.PI / 4, -3 * Math.PI / 4, 3 * Math.PI / 4, Math.PI / 4][i];
      a.x = Math.cos(a.phi) * RING;
      a.z = -Math.sin(a.phi) * RING;
      a.y = DECK;
      a.out = false;
      a.falling = false;
      a.ai = { when: aiTiming(0) };
      a.prev = [0, 0];
      a.pana.group.rotation.y = Math.atan2(-a.x, -a.z);   // face the post
    });

    let theta = 0;
    let dir = 1;
    let clock = 0;
    let flipT = rand(9, 14);

    // angular gap from each log arm to an actor, measured along the spin
    const gaps = (phi) => [wrap(phi - theta), wrap(phi - theta - Math.PI)];

    function jump(a) {
      if (a.y > DECK + 0.01 || a.out) return;
      a.vy = JUMP;
      if (a.player.human) sound.boing();
    }

    let skyTime=0;
    function update(dt, input) {
      skyTime+=dt;stage.update(skyTime);
      clock += dt;
      const w = (1.7 + clock * 0.11) * dir;
      flipT -= dt;
      if (flipT <= 0) {
        dir = -dir;
        flipT = rand(6, 11);
        shout.say('¡AL REVÉS!', 1.2);
        sound.whoosh();
      }
      const prevTheta = theta;
      theta = wrap(theta + w * dt);
      pivot.rotation.y = theta;

      for (const a of actors) {
        if (a.out) continue;
        if (a.falling) {
          a.vy -= G * dt;
          a.x += a.vx * dt;
          a.z += a.vz * dt;
          a.y += a.vy * dt;
          a.pana.group.rotation.x += dt * 8;
          if (a.y < -1.2) {
            a.out = true;
            a.pana.group.visible = false;
            puffs.spawn(new THREE.Vector3(a.x, -0.2, a.z), { color: 0xffffff, count: 10, spread: 1.6, size: 0.8, rise: 3, life: 0.9 });
            sound.plop();
          }
          continue;
        }
        // jumping
        if (a.player.human && !ctx.auto) {
          if (input.jump) jump(a);
        } else {
          // time until the next arm sweeps through us
          const [g1, g2] = gaps(a.phi).map((g) => (dir > 0 ? g : -g));
          const ahead = Math.min(...[g1, g2].map((g) => (g > 0 ? g : g + Math.PI * 2)));
          if (ahead / Math.abs(w) < a.ai.when) jump(a);
        }
        if (a.vy || a.y > DECK) {
          a.vy -= G * dt;
          a.y += a.vy * dt;
          if (a.y <= DECK) { a.y = DECK; a.vy = 0; }
        }

        // did an arm sweep past us this step?
        const before = [wrap(a.phi - prevTheta), wrap(a.phi - prevTheta - Math.PI)];
        const after = gaps(a.phi);
        for (let k = 0; k < 2; k++) {
          if (Math.sign(before[k]) !== Math.sign(after[k]) && Math.abs(before[k]) < 1) {
            if (a.y - DECK < CLEAR) {
              a.falling = true;
              a.vx = Math.cos(a.phi) * 7;
              a.vz = -Math.sin(a.phi) * 7;
              a.vy = 7;
              a.bubble.say(pick(['¡AAAH!', '¡Me caí!', '¡Ñooo!', '¡Al agua!']), 1);
              sound.bonk(1);
              puffs.spawn(new THREE.Vector3(a.x, 1, a.z), { color: 0xc8a070, count: 5, spread: 0.6, size: 0.5 });
            } else {
              a.score += 1;
              a.ai.when = aiTiming(clock);
            }
          }
        }
      }

      const wp = seaGeo.attributes.position;
      for (let i = 0; i < wp.count; i++) {
        wp.setY(i, Math.sin(seaBase[i * 3] * 0.2 + clock * 1.5) * 0.12 + Math.cos(seaBase[i * 3 + 2] * 0.17 + clock) * 0.12);
      }
      wp.needsUpdate = true;
      raft.position.y = Math.sin(clock * 1.3) * 0.04;
      flag.userData.tick?.(clock, dt);
      shout.update(dt);

      for (const a of actors) {
        if (a.out) continue;
        animateActor(a, dt, { open: a.falling || a.y > DECK + 0.3, armsUp: a.y > DECK + 0.1 ? 1.5 : 0 });
      }
      puffs.update(dt);
    }

    function outro(dt, winners) {
      clock += dt;
      for (const a of actors) {
        if (a.out) continue;
        const win = winners.includes(a.i);
        a.y = DECK + (win ? Math.abs(Math.sin(clock * 6)) * 0.8 : 0);
        animateActor(a, dt, { open: win, armsUp: win ? 1.8 : 0 });
      }
      puffs.update(dt);
    }

    // the round ends early once only one pana is left dry
    const dry = () => actors.filter((a) => !a.out && !a.falling);
    const over = () => dry().length <= 1;
    // whoever is still on the raft wins; if everyone fell, the most jumps does
    const winners = () => dry().map((a) => a.i);
    return { scene, camera, update, outro, over, winners, scores: () => actors.map((a) => a.score), actors };
  },
};
