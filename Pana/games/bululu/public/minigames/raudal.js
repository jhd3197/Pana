import { random, inputFor } from '../online-rules.js';
// ¡Raudal! The current carries six curiaras down six rapids side by side,
// three lanes each, over the same rocks, mangos and ledges. A/D switch lanes,
// Space jumps a ledge just before it. Mangos are points; rocks cost one.

import * as THREE from 'three';
import { sound, Puffs } from '/engine/fx.js';
import { makeMango } from '/engine/models/props/mango.js';
import { lajaRock } from '/engine/models/props/amazonas.js';
import { instancePlacements } from '/engine/models/core/static-batch.js';
import { sunnyStage, pick } from './stage.js';
import { riverWater, riverBanks, canoeActors, drawCanoe } from './river-stage.js';
import { raudalSim, RAUDAL } from './river-sims.js';
import { loc, locKey } from '/engine/i18n.js';

const CHANNEL = 5.4, LANE = 1.55;


export default {
  id: 'raudal',
  title: locKey('¡Raudal!'),
  howto: locKey('La corriente te lleva. Cambia de carril con A y D para esquivar las piedras y agarrar mangos. Antes de cada salto, Espacio: ¡salta el raudal!'),
  keys: [['A D / ← →', locKey('cambiar de carril')], [locKey('Espacio'), locKey('saltar el raudal')]],
  icon: 'mango',
  time: RAUDAL.time,

  create(ctx) {
    const count = ctx.players.length;
    const centre = c => (c - (count - 1) / 2) * CHANNEL, laneX = (c, x) => centre(c) + (x - 1) * LANE;
    const scene = new THREE.Scene();
    const stage = sunnyStage(scene, { ground: null, grass: false, decor: false, horizon: 0xdfe6d2 });
    const puffs = new Puffs(scene);
    const humans = new Set(ctx.players.filter(p => p.human && !ctx.auto).map(p => p.i));
    const sim = raudalSim({ humans, random, count: ctx.players.length }), end = sim.pattern.at(-1).s + 30;
    const animateWater = riverWater(scene, { w: count * CHANNEL + 4, z0: 30, z1: -end, color: 0x86704a, deep: 0x3b2a14 });
    riverBanks(scene, { half: count / 2 * CHANNEL + 2, z0: 30, z1: -end, seed: 21 });
    // Laja walls between the rapids, rocks in the lanes, ledges across all channels.
    const walls = [], rocks = [];
    for (let s = -10; s < end; s += 2.4) for (let c = 0; c <= count; c++) walls.push({ x: centre(c) - CHANNEL / 2, y: -.15, z: -s, rot: s, scale: c % count ? .38 : .55 });
    for (const row of sim.pattern) if (!row.ledge) for (let c = 0; c < count; c++) for (const l of row.rocks) rocks.push({ x: laneX(c, l), y: -.2, z: -row.s, rot: row.s * 3 + c, scale: .34 });
    instancePlacements(scene, lajaRock({ seed: 5, radius: 2 }), walls, { name: 'Muros de laja' });   // i18n-ignore: object names
    instancePlacements(scene, lajaRock({ seed: 9, radius: 2 }), rocks, { name: 'Piedras del raudal' });   // i18n-ignore: object names
    const foam = new THREE.MeshStandardMaterial({ color: 0xf4f8f2, roughness: .4, transparent: true, opacity: .85 });
    for (const row of sim.pattern) if (row.ledge) {
      const lip = new THREE.Mesh(new THREE.BoxGeometry(count * CHANNEL, .18, 1.4), foam); lip.position.set(0, .05, -row.s); scene.add(lip);
    }
    // One floating mango per channel and row, picked or not.
    const mangos = [];
    for (const row of sim.pattern) if (!row.ledge && row.mango >= 0) for (let c = 0; c < count; c++) {
      const m = makeMango(); m.scale.setScalar(.75); m.position.set(laneX(c, row.mango), .35, -row.s); scene.add(m); mangos.push({ m, row, c, phase: random() * 6 });
    }
    const camera = new THREE.PerspectiveCamera(54, (ctx.aspect || innerWidth / innerHeight), .1, 500);
    const actors = canoeActors(scene, ctx.players);
    const seen = actors.map(() => ({ hits: 0, jumps: 0, splashes: 0, score: 0 }));
    // Your own channel, tinted in your colour a stretch ahead of your canoe.
    const me = actors[ctx.localIndex ?? ctx.players.findIndex(p => p.human && !ctx.auto)];
    const lane = me && new THREE.Mesh(new THREE.PlaneGeometry(CHANNEL - .5, 60), new THREE.MeshBasicMaterial({ color: me.player.color, transparent: true, opacity: .16, depthWrite: false }));
    if (lane) { lane.rotation.x = -Math.PI / 2; lane.renderOrder = 1; scene.add(lane); }
    let time = 0;

    function draw(dt) {
      for (const a of actors) {
        const c = sim.canoes[a.i], jump = Math.max(0, c.jumping) / .55;
        const y = Math.sin(jump * Math.PI) * .9 + Math.sin(time * 5 + a.i) * .04;
        drawCanoe(a, dt, time, { x: laneX(a.i, c.x), y, z: -sim.s, h: Math.PI + (c.stun > 0 ? Math.sin(time * 18) * .35 : 0), paddle: { last: time - .7, side: 1 } });
        a.canoe.hull.rotation.x = -jump * .2;
      }
      for (const g of mangos) { g.m.visible = !sim.canoes[g.c].got.has(g.row) && -g.row.s < -sim.s + 6 && g.row.s - sim.s < 90; g.m.position.y = .35 + Math.sin(time * 3 + g.phase) * .06; g.m.rotation.y += dt; }
      if (lane) lane.position.set(centre(me.i), .08, -sim.s - 26);
      camera.position.set(0, 12 + (count - 4) * 3, -sim.s + 14.5 + (count - 4) * 4); camera.lookAt(0, 0, -sim.s - 10);
      stage.update(time); animateWater(time); puffs.update(dt);
    }
    function update(dt, input) {
      time += dt;
      const inputs = []; for (const i of humans) inputs[i] = inputFor(input, i);
      sim.update(dt, inputs);
      for (const a of actors) {
        const c = sim.canoes[a.i], was = seen[a.i], at = new THREE.Vector3(laneX(a.i, c.x), .4, -sim.s), me = humans.has(a.i);
        if (c.hits > was.hits) { a.bubble.say(loc(pick([locKey('¡Ay, la piedra!'), locKey('¡Pum!'), locKey('¡Mi curiara!')])), .8); puffs.spawn(at, { color: 0xe8efe8, count: 6, spread: 1, size: .6 }); if (me) sound.boing(); }
        if (c.jumps > was.jumps) { if (random() < .5) a.bubble.say(loc('¡Salto!'), .6); puffs.spawn(at, { color: 0xffffff, count: 8, spread: 1.4, size: .7, rise: 1.4 }); if (me) sound.tone(760, 0, .1, 'triangle', .06); }
        if (c.splashes > was.splashes) { a.bubble.say(loc(pick([locKey('¡Splash!'), locKey('¡Me mojé!')])), .7); puffs.spawn(at, { color: 0xffffff, count: 10, spread: 1.6, size: .8 }); if (me) sound.plop(); }
        if (c.score > was.score && c.jumps === was.jumps && me) sound.pickup();
        Object.assign(was, { hits: c.hits, jumps: c.jumps, splashes: c.splashes, score: c.score });
      }
      draw(dt);
    }
    function outro(dt, winners) {
      time += dt; sim.update(dt, []);
      for (const a of actors) a.cheer = winners.includes(a.i) ? 1 : 0;
      draw(dt);
    }
    // What's coming down your channel next.
    function hint() {
      if (!me) return null;
      const c = sim.canoes[me.i], soon = sim.pattern.filter(r => r.s > sim.s && r.s - sim.s < RAUDAL.speed * 1.1);
      if (c.stun > 0) return { text: loc('¡Pum! Te pegaste con una piedra'), tone: 'bad' };
      if (soon.some(r => r.ledge)) return { text: loc('¡Raudal! Salta con Espacio justo antes'), tone: 'go' };
      if (soon.some(r => !r.ledge && r.rocks.includes(c.lane))) return { text: loc('¡Piedra en tu carril! Cámbiate con A o D'), tone: 'bad' };
      return { text: loc('Agarra los mangos y esquiva las piedras'), tone: '' };
    }
    return { scene, camera, update, outro, actors, hint, scores: sim.scores, sim,
      stats: () => ({ hits: sim.canoes.map(c => c.hits), jumps: sim.canoes.map(c => c.jumps), splashes: sim.canoes.map(c => c.splashes) }) };
  },
};
