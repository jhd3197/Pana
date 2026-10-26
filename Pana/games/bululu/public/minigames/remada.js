import { random, inputFor } from '../online-rules.js';
// ¡Remada! Four curiaras, a straight 120 m sprint down a caño. No steering:
// alternate A and D in rhythm. Mashing splashes; the sweet spot is a ¡Remazo!.
// The paddle model is Curiara's (/engine/play/paddle.js); the race is river-sims.js.

import * as THREE from 'three';
import { sound, Puffs } from '/engine/fx.js';
import { finishArch } from '/engine/models/props/amazonas.js';
import { sunnyStage, pick } from './stage.js';
import { riverWater, riverBanks, canoeActors, drawCanoe } from './river-stage.js';
import { remadaSim, REMADA } from './river-sims.js';
import { PADDLE } from '/engine/play/paddle.js';
import { loc, locKey } from '/engine/i18n.js';



export default {
  id: 'remada',
  title: locKey('¡Remada!'),
  howto: locKey('Rema alternando A y D para llegar primero a la meta, a 120 metros. Con ritmo vas más rápido que machacando: rema cuando el canalete termina su jalón.'),
  keys: [['A D / ← →', locKey('remar alternando')]],
  touch: { action: null },
  icon: 'canoe',
  time: REMADA.time,

  create(ctx) {
    const LANES = ctx.players.map((_, i) => (i - (ctx.players.length - 1) / 2) * 2.5);
    const scene = new THREE.Scene();
    const stage = sunnyStage(scene, { ground: null, grass: false, decor: false, horizon: 0xd8e8d0 });
    const puffs = new Puffs(scene);
    const animateWater = riverWater(scene, { w: 24, z0: 30, z1: -REMADA.length - 60 });
    riverBanks(scene, { half: 9, z0: 30, z1: -REMADA.length - 50, seed: 11 });
    const arch = finishArch({ span: 18, label: 'META', secondary: '¡REMADA!' }); arch.position.set(0, -.1, -REMADA.length); scene.add(arch);   // i18n-ignore: signage painted in the world
    // Distance buoys every 20 m.
    for (let s = 20; s < REMADA.length; s += 20) for (const x of [-8.2, 8.2]) {
      const buoy = new THREE.Mesh(new THREE.SphereGeometry(.28, 10, 8), new THREE.MeshStandardMaterial({ color: s % 40 ? 0xffc629 : 0xff6b4a, roughness: .5 }));
      buoy.position.set(x, .1, -s); scene.add(buoy);
    }
    const camera = new THREE.PerspectiveCamera(52, (ctx.aspect || innerWidth / innerHeight), .1, 500);
    const humans = new Set(ctx.players.filter(p => p.human && !ctx.auto).map(p => p.i));
    const sim = remadaSim({ humans, random, count: ctx.players.length });
    const actors = canoeActors(scene, ctx.players);
    const local = actors[ctx.localIndex ?? ctx.players.findIndex(p => p.human && !ctx.auto)] || null;
    let time = 0, cam = 0;
    const said = new Set(), heard = actors.map(() => 0);
    // Your rhythm, on the water around your canoe: the inner disc grows with
    // the time since your last stroke and the ring turns green in the
    // ¡Remazo! window (coral while mashing, gold once the beat is lost).
    const beat = local && new THREE.Group();
    if (beat) {
      const flat = (geo, color, opacity) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false })); m.rotation.x = -Math.PI / 2; beat.add(m); return m; };
      beat.ring = flat(new THREE.RingGeometry(1.55, 1.85, 40), 0xffffff, .85);
      beat.fill = flat(new THREE.CircleGeometry(1.5, 40), 0xffffff, .22);
      beat.position.y = .06; beat.renderOrder = 2; scene.add(beat);
    }
    const BEAT = { sweet: new THREE.Color(0x5fd35f), mash: new THREE.Color(0xff6b5a), wait: new THREE.Color(0xffffff), late: new THREE.Color(0xffc629) };
    function drawBeat() {
      const r = sim.racers[local.i], gap = r.paddle.last == null ? Infinity : time - r.paddle.last;
      const sweet = gap >= PADDLE.sweet[0] && gap <= PADDLE.sweet[1];
      const color = r.finish != null ? BEAT.wait : gap < PADDLE.rhythm[0] ? BEAT.mash : sweet ? BEAT.sweet : gap > PADDLE.rhythm[1] ? BEAT.late : BEAT.wait;
      beat.ring.material.color.copy(color); beat.fill.material.color.copy(color);
      beat.fill.scale.setScalar(Math.max(.05, Math.min(1, gap / PADDLE.sweet[1])));
      beat.ring.scale.setScalar(sweet ? 1.08 + Math.sin(time * 30) * .03 : 1);
      beat.position.set(LANES[local.i], .06, -r.s);
      beat.visible = r.finish == null;
    }

    function draw(dt) {
      for (const a of actors) {
        const r = sim.racers[a.i];
        drawCanoe(a, dt, time, { x: LANES[a.i], z: -r.s, h: Math.PI, paddle: r.paddle });
      }
      // Follow the pack, leaning toward the leader, but never so far ahead
      // (or behind) that your own canoe leaves the picture.
      const lead = Math.max(...sim.racers.map(r => r.s)), mean = sim.racers.reduce((n, r) => n + r.s, 0) / actors.length;
      let want = lead * .6 + mean * .4;
      if (local) { const s = sim.racers[local.i].s; want = Math.max(s - 25, Math.min(s, want)); }
      cam += (want - cam) * Math.min(1, dt * 3);
      if (beat) drawBeat();
      camera.position.set(0, 7.5, -cam + 11); camera.lookAt(0, .5, -cam - 9);
      stage.update(time); animateWater(time); puffs.update(dt);
    }
    function update(dt, input) {
      time += dt;
      const inputs = []; for (const i of humans) inputs[i] = inputFor(input, i);
      sim.update(dt, inputs);
      for (const a of actors) {
        const r = sim.racers[a.i];
        if (a === local && r.paddle.count > heard[a.i]) {
          heard[a.i] = r.paddle.count;
          if (r.paddle.quality === 'remazo') { sound.tone(1180, 0, .045, 'triangle', .07); sound.tone(590, .01, .07, 'sine', .08); }
          else if (r.paddle.quality === 'chapoteo') sound.sweep(900, 300, .12, 'triangle', .05);
          else sound.tone(420, 0, .05, 'triangle', .04);
        }
        if (r.paddle.quality === 'remazo' && r.paddle.streak === 4 && !said.has(`${a.i}-${r.paddle.count}`)) { said.add(`${a.i}-${r.paddle.count}`); a.bubble.say(loc('¡Remazo!'), .8); }
        if (r.paddle.quality === 'chapoteo' && random() < .02) { a.bubble.say(loc(pick([locKey('¡Chapoteo!'), locKey('¡Splash!')])), .6); puffs.spawn(new THREE.Vector3(LANES[a.i], .3, -r.s), { color: 0xeaf6f2, count: 4, spread: .8, size: .5 }); }
        if (r.finish != null && !said.has(`fin-${a.i}`)) { said.add(`fin-${a.i}`); a.bubble.say(sim.order[0] === a.i ? loc('¡Primero!') : loc('¡Llegué!'), 1.2); if (humans.has(a.i)) sound.pickup(); }
      }
      draw(dt);
    }
    function outro(dt, winners) {
      time += dt;
      sim.update(dt, []);
      for (const a of actors) a.cheer = winners.includes(a.i) ? 1 : 0;
      draw(dt);
    }
    // Everyone's way down the caño, for the runner's progress strip.
    const progress = () => actors.map(a => ({ color: a.player.color, at: Math.min(1, sim.racers[a.i].s / REMADA.length), me: a === local }));
    return { scene, camera, update, outro, actors, progress, over: sim.over, scores: sim.scores, winners: sim.winners, sim,
      stats: () => ({ times: sim.racers.map(r => r.finish == null ? null : +r.finish.toFixed(1)), strokes: sim.racers.map(r => r.strokes) }) };
  },
};
