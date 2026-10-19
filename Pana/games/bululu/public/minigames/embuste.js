import { random, inputFor } from '../online-rules.js';
// ¡Embuste! in miniature: six panas crank their camp chores, one of them is
// secretly a mummy faking it, then everyone votes. A real crank lights that
// pana's lantern; a mummy's crank sometimes puffs sand from under the shirt.
// Cranking too fast makes more sand, so a sly mummy (you, maybe) takes it easy.

import * as THREE from 'three';
import { Puffs, sound } from '/engine/fx.js';
import { M, mesh } from '/engine/models/core/primitives.js';
import { expeditionWinch, expeditionLantern, sunRelic } from '/engine/models/props/reliquia.js';
import { campfire } from '/engine/models/props/llano-life.js';
import { campTent, bandageWrap } from '/engine/models/props/embuste.js';
import { sunnyStage, makeActors, animateActor, rand, pick } from './stage.js';

const TIME = 30, WORK = 19, VOTE = 27;        // seconds: work until WORK, vote until VOTE, then the verdict
// Stations are spaced to fit the complete roster.
// Tuned on 60 seeds against five bots: a careful mummy (a crank every ~0.8 s)
// wins ~45%, a bot mummy ~30%, a masher ~2%, one that never cranks never.
const SAND = 0.28, SAND_FAST = 0.63, SAND_CAREFUL = 0.05;   // chance a mummy crank puffs sand
const FAST = 0.28, CAREFUL = 0.75;      // gaps (s) that count as mashing, and as careful
const NOTICE = 0.6, NOTICE_DIM = 0.02;  // chance a bot sees a lit lantern; spots a dim one
const SEE_NEAR = 0.55, SEE_FAR = 0.15;  // chance a bot sees sand within two stations; farther
const IDLE = 2, NOISE = 2.1;            // weight of never seeing someone work; vote noise

export default {
  id: 'embuste',
  title: '¡Embuste!',
  howto: 'Uno de los panas es una momia que finge trabajar. Gira tu malacate con Espacio y mira bien: la momia suelta arena. Al final, elige con ← → y vota con Espacio. Si te toca ser la momia, gira sin apuro: así casi no suelta arena. Pero si no giras, se nota.',
  keys: [['Espacio', 'girar · votar'], ['← →', 'elegir a quién']],
  touch: { action: '¡Dale!' },
  icon: 'mummy',
  time: TIME,

  create(ctx) {
    const scene = new THREE.Scene();
    const stage = sunnyStage(scene, { ground: 0x8a7a58, horizon: 0xf0c99a, sky: 0x6e8fd0 });
    const puffs = new Puffs(scene);
    const fire = campfire(); fire.position.set(0, 0, -4.5); fire.scale.setScalar(1.4); scene.add(fire);
    const tent = campTent(); tent.position.set(-9, 0, -7); tent.rotation.y = 0.5; scene.add(tent);
    const relic = sunRelic(); relic.position.set(0, 1.2, -7.5); scene.add(relic);
    scene.add(mesh(new THREE.BoxGeometry(1.4, 1.1, 1.4), M(0x7c7a68, { roughness: 1 }), 0, 0.55, -7.5));

    const camera = new THREE.PerspectiveCamera(48, (ctx.aspect || innerWidth / innerHeight), 0.1, 400);
    camera.position.set(0, 9.5, 18); camera.lookAt(0, 1.2, -1);

    const actors = makeActors(scene, ctx.players);
    const XS = actors.map((_, i) => (i - (actors.length - 1) / 2) * 3);
    const mummyAt = Math.floor(random() * actors.length);
    const human = (a) => a.player.human && !ctx.auto;
    actors.forEach((a, i) => {
      a.x = XS[i]; a.z = 2; a.y = 0;
      a.mummy = i === mummyAt;
      a.winch = expeditionWinch(); a.winch.position.set(XS[i], 0, 0.4); a.winch.rotation.y = Math.PI; scene.add(a.winch);
      a.lamp = expeditionLantern(); a.lamp.scale.setScalar(1.6); a.lamp.position.set(XS[i] + 1, 0, 0.2); scene.add(a.lamp);
      a.lamp.traverse(o => { if (o.material?.emissive && o.material.emissiveIntensity > 1) { o.material = o.material.clone(); a.glow = o.material; } });
      a.glow.emissiveIntensity = 0.1;
      a.turn = 0; a.last = -1; a.work = 0; a.light = 0; a.sand = 0;
      a.vote = null; a.votes = 0; a.voteAt = rand(WORK + 1.5, VOTE - 1);
      a.ai = { every: rand(0.5, 0.8), next: rand(0.2, 0.8) };
      a.suspect = new Map(); a.seen = new Map();
      a.ring = mesh(new THREE.RingGeometry(0.9, 1.1, 32), new THREE.MeshBasicMaterial({ color: 0xffc629, transparent: true, opacity: 0.85, side: THREE.DoubleSide }), XS[i], 0.05, 2);
      a.ring.rotation.x = -Math.PI / 2; a.ring.visible = false; scene.add(a.ring);
    });
    const me = ctx.auto ? null : actors[ctx.localIndex ?? 0];
    if (me) me.bubble.say(me.mummy ? '¡Eres la momia! Gira despacito.' : 'Gira y vigila. ¿Quién suelta arena?', 2.6);

    let clock = 0, verdict = null;
    const picks = actors.map(() => 0), lastXs = actors.map(() => 0);

    // One crank of a pana's winch. A real one lights the lantern; a fake one may puff sand.
    function crank(a) {
      const gap = clock - a.last;
      a.last = clock; a.turn += 0.6;
      // Bots watch the lanterns: a lit one counts as work they saw, a dim one
      // is a tell some of them catch. A pana nobody sees working is suspect.
      const bots = actors.filter(b => b !== a && !human(b));
      if (!a.mummy) {
        a.work++; a.light = 1; sound.tone(520 + a.i * 60, 0, 0.06, 'triangle', 0.03);
        for (const b of bots) if (random() < NOTICE) b.seen.set(a.i, (b.seen.get(a.i) || 0) + 1);
        return;
      }
      a.light = 0.35;   // a lantern that barely flickers is a tell too, for sharp eyes
      for (const b of bots) {
        if (random() < NOTICE) b.seen.set(a.i, (b.seen.get(a.i) || 0) + 1);
        if (random() < NOTICE_DIM) b.suspect.set(a.i, (b.suspect.get(a.i) || 0) + 0.4);
      }
      // Mashing spills sand; a careful, unhurried crank hardly does, but a
      // lantern that seldom lights is its own giveaway.
      if (random() < (gap < FAST ? SAND_FAST : gap >= CAREFUL ? SAND_CAREFUL : SAND)) {
        a.sand++;
        puffs.spawn(new THREE.Vector3(a.x, 1.1, a.z + 0.2), { color: 0xd8c08a, count: 6, spread: 0.7, size: 0.45 });
        for (const b of bots) if (random() < (Math.abs(b.i - a.i) <= 2 ? SEE_NEAR : SEE_FAR)) b.suspect.set(a.i, (b.suspect.get(a.i) || 0) + 1);
      }
    }

    // AI suspicion: the sand and dim lanterns they saw, how little they saw
    // someone work compared with the rest, a little noise, never themselves.
    function aiVote(a) {
      if (a.mummy) { const others = actors.filter(b => b !== a); return pick(others).i; }
      const others = actors.filter(b => b !== a);
      const usual = Math.max(1, others.reduce((n, b) => n + (a.seen.get(b.i) || 0), 0) / others.length);
      let best = null, score = -Infinity;
      for (const b of others) {
        const idle = Math.max(0, 1 - (a.seen.get(b.i) || 0) / usual);
        const s = (a.suspect.get(b.i) || 0) + idle * IDLE + random() * NOISE;
        if (s > score) { score = s; best = b.i; }
      }
      return best;
    }

    function cast(a, target) {
      if (a.vote != null || target == null) return;
      a.vote = target; actors[target].votes++;
      a.bubble.say(pick(['¡Fue ' + actors[target].player.name + '!', 'Yo voto…', '¡Embuste!']), 1.2);
      sound.tone(330, 0, 0.1, 'square', 0.04);
    }

    function decide() {
      const top = Math.max(...actors.map(a => a.votes)), most = actors.filter(a => a.votes === top);
      const out = most.length === 1 ? most[0] : null, caught = out?.mummy;
      verdict = { out, caught };
      for (const a of actors) {
        if (a.mummy) a.score = caught ? 0 : 100;
        else a.score = (caught ? 50 : 10) + (actors[a.vote ?? -1]?.mummy ? 50 : 0) + Math.min(10, Math.round(a.work / 4));
      }
      const m = actors[mummyAt];
      m.wrap = bandageWrap({ height: 1.3, radius: 0.45 }); m.wrap.position.set(m.x, 0, m.z); m.wrap.scale.y = 0.01; scene.add(m.wrap);
      m.bubble.say(caught ? '¡Me descubrieron!' : '¡Era yo, la momia!', 2.4);
      if (out && !caught) out.bubble.say('¡Yo no era!', 2);
      sound.horn(caught ? 'fiesta' : 'cucaracha');
    }

    let skyTime = 0;
    function update(dt, input) {
      skyTime += dt; stage.update(skyTime);
      clock += dt; fire.userData.tick?.(clock); relic.rotation.y = clock * 0.5;
      const voting = clock >= WORK && clock < VOTE;
      for (const a of actors) {
        if (clock < WORK) {
          if (human(a)) { if (inputFor(input, a.i).jump) crank(a); }
          else if (clock >= a.ai.next) {
            crank(a);
            // An AI mummy cranks carefully, a touch slower than the rest, as the sly ones do.
            a.ai.next = clock + (a.mummy ? rand(0.72, 0.95) : a.ai.every * rand(0.85, 1.15));
          }
        } else if (voting && !human(a) && clock >= a.voteAt) cast(a, aiVote(a));
        a.light = Math.max(0, a.light - dt * 1.6);
        a.glow.emissiveIntensity = 0.1 + a.light * 1.8;
        a.winch.userData.wheel.rotation.z = -a.turn;
        animateActor(a, dt, { moving: clock < WORK && clock - a.last < 0.3 ? 0.5 : 0, armsUp: clock < WORK ? 0.6 + Math.sin(a.turn * 4) * 0.3 : 0.3 });
        a.pana.group.rotation.y = clock < WORK ? Math.PI : 0;
        a.ring.visible = false;
      }
      // You pick with ← → and lock your vote with Space.
      for (const a of actors) if (voting && human(a) && a.vote == null) {
        const others = actors.filter(b => b !== a);
        const dir = Math.sign(inputFor(input, a.i).x || 0);
        if (dir && dir !== lastXs[a.i]) picks[a.i] = (picks[a.i] + dir + others.length) % others.length;
        lastXs[a.i] = dir;
        const target = others[picks[a.i]];
        if (a === me) { target.ring.visible = true; target.ring.material.opacity = 0.6 + Math.sin(clock * 8) * 0.3; }
        if (inputFor(input, a.i).jump) cast(a, target.i);
      }
      if (clock >= VOTE && !verdict) {
        for (const a of actors) if (a.vote == null) cast(a, human(a) ? null : aiVote(a));
        decide();
      }
      if (verdict) {
        const m = actors[mummyAt];
        m.wrap.scale.y = Math.min(1, m.wrap.scale.y + dt * 1.2);
        if (verdict.out) verdict.out.y = Math.abs(Math.sin(clock * 5)) * 0.3;
      }
      puffs.update(dt);
    }

    function outro(dt, winners) {
      clock += dt; fire.userData.tick?.(clock);
      for (const a of actors) {
        const win = winners.includes(a.i);
        a.y = win ? Math.abs(Math.sin(clock * 6)) * 0.8 : 0;
        a.ring.visible = false;
        animateActor(a, dt, { moving: 0, open: win, armsUp: win ? 1.8 : 0.3 });
        a.pana.group.rotation.y = 0;
      }
      puffs.update(dt);
    }

    // What you should be doing right now, for the runner's hint line.
    function hint() {
      if (!me || verdict) return null;
      if (clock < WORK) return me.mummy ? { text: 'Eres la MOMIA: gira despacito. Si no giras, se nota.', tone: 'bad' } : { text: 'Gira tu malacate y mira quién suelta arena', tone: '' };
      if (me.vote != null) return { text: `Votaste por ${actors[me.vote].player.name}`, tone: '' };
      const others = actors.filter(b => b !== me);
      return { text: `¡A votar! ← → elige · Espacio vota por ${others[picks[me.i]].player.name}`, tone: 'go' };
    }

    return {
      scene, camera, update, outro, actors, hint,
      scores: () => actors.map((a) => a.score || 0),
      over: () => !!verdict && clock > VOTE + 2.5,
      winners: () => { const top = Math.max(...actors.map(a => a.score || 0)); return actors.filter(a => (a.score || 0) === top).map(a => a.i); },
      // For suites and balance checks.
      stats: () => ({ mummy: mummyAt, sand: actors[mummyAt].sand, votes: actors.map(a => a.votes), verdict: verdict && { out: verdict.out?.i ?? null, caught: !!verdict.caught } }),
    };
  },
};
