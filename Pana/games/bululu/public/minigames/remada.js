// ¡Remada! Four curiaras, a straight 120 m sprint down a caño. No steering:
// alternate A and D in rhythm. Mashing splashes; the sweet spot is a ¡Remazo!.
// The paddle model is Curiara's (/engine/paddle.js); the race is river-sims.js.

import * as THREE from 'three';
import { sound, Puffs } from '/engine/fx.js';
import { finishArch } from '/engine/models/props/amazonas.js';
import { sunnyStage, pick } from './stage.js';
import { riverWater, riverBanks, canoeActors, drawCanoe } from './river-stage.js';
import { remadaSim, REMADA } from './river-sims.js';

const LANES = [-4.5, -1.5, 1.5, 4.5];

export default {
  id: 'remada',
  title: '¡Remada!',
  howto: 'Rema alternando A y D para llegar primero a la meta, a 120 metros. Con ritmo vas más rápido que machacando: rema cuando el canalete termina su jalón.',
  keys: [['A D / ← →', 'remar alternando']],
  icon: 'canoe',
  time: REMADA.time,

  create(ctx) {
    const scene = new THREE.Scene();
    const stage = sunnyStage(scene, { ground: null, grass: false, decor: false, horizon: 0xd8e8d0 });
    const puffs = new Puffs(scene);
    const animateWater = riverWater(scene, { w: 24, z0: 30, z1: -REMADA.length - 60 });
    riverBanks(scene, { half: 9, z0: 30, z1: -REMADA.length - 50, seed: 11 });
    const arch = finishArch({ span: 18, label: 'META', secondary: '¡REMADA!' }); arch.position.set(0, -.1, -REMADA.length); scene.add(arch);
    // Distance buoys every 20 m.
    for (let s = 20; s < REMADA.length; s += 20) for (const x of [-6.2, 6.2]) {
      const buoy = new THREE.Mesh(new THREE.SphereGeometry(.28, 10, 8), new THREE.MeshStandardMaterial({ color: s % 40 ? 0xffc629 : 0xff6b4a, roughness: .5 }));
      buoy.position.set(x, .1, -s); scene.add(buoy);
    }
    const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, .1, 500);
    const humans = new Set(ctx.players.filter(p => p.human && !ctx.auto).map(p => p.i));
    const sim = remadaSim({ humans });
    const actors = canoeActors(scene, ctx.players);
    let time = 0, lastCount = 0, cam = 0;
    const said = new Set();

    function draw(dt) {
      for (const a of actors) {
        const r = sim.racers[a.i];
        drawCanoe(a, dt, time, { x: LANES[a.i], z: -r.s, h: Math.PI, paddle: r.paddle });
      }
      // Follow the pack, leaning toward the leader.
      const lead = Math.max(...sim.racers.map(r => r.s)), mean = sim.racers.reduce((n, r) => n + r.s, 0) / 4;
      cam += ((lead * .6 + mean * .4) - cam) * Math.min(1, dt * 3);
      camera.position.set(0, 7.5, -cam + 11); camera.lookAt(0, .5, -cam - 9);
      stage.update(time); animateWater(time); puffs.update(dt);
    }
    function update(dt, input) {
      time += dt;
      const inputs = []; for (const i of humans) inputs[i] = input;
      sim.update(dt, inputs);
      for (const a of actors) {
        const r = sim.racers[a.i];
        if (humans.has(a.i) && r.paddle.count > lastCount) {
          lastCount = r.paddle.count;
          if (r.paddle.quality === 'remazo') { sound.tone(1180, 0, .045, 'triangle', .07); sound.tone(590, .01, .07, 'sine', .08); }
          else if (r.paddle.quality === 'chapoteo') sound.sweep(900, 300, .12, 'triangle', .05);
          else sound.tone(420, 0, .05, 'triangle', .04);
        }
        if (r.paddle.quality === 'remazo' && r.paddle.streak === 4 && !said.has(`${a.i}-${r.paddle.count}`)) { said.add(`${a.i}-${r.paddle.count}`); a.bubble.say('¡Remazo!', .8); }
        if (r.paddle.quality === 'chapoteo' && Math.random() < .02) { a.bubble.say(pick(['¡Chapoteo!', '¡Splash!']), .6); puffs.spawn(new THREE.Vector3(LANES[a.i], .3, -r.s), { color: 0xeaf6f2, count: 4, spread: .8, size: .5 }); }
        if (r.finish != null && !said.has(`fin-${a.i}`)) { said.add(`fin-${a.i}`); a.bubble.say(sim.order[0] === a.i ? '¡Primero!' : '¡Llegué!', 1.2); if (humans.has(a.i)) sound.pickup(); }
      }
      draw(dt);
    }
    function outro(dt, winners) {
      time += dt;
      sim.update(dt, []);
      for (const a of actors) a.cheer = winners.includes(a.i) ? 1 : 0;
      draw(dt);
    }
    return { scene, camera, update, outro, actors, over: sim.over, scores: sim.scores, winners: sim.winners, sim,
      stats: () => ({ times: sim.racers.map(r => r.finish == null ? null : +r.finish.toFixed(1)), strokes: sim.racers.map(r => r.strokes) }) };
  },
};
