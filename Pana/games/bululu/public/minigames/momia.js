import { random, inputFor } from '../online-rules.js';
// ¡Un, dos, tres, momia! Red light, green light at the temple. Run for the
// relic while the mummy counts; freeze when she turns, or back to the start.
// Space turns you into a barrel for a moment: barrels may creep while she looks.

import * as THREE from 'three';
import { Puffs, sound, makeBubble } from '/engine/fx.js';
import { M, mesh } from '/engine/models/core/primitives.js';
import { mummy, sunRelic, expeditionLantern } from '/engine/models/props/reliquia.js';
import { templeEntrance, stoneTotem } from '/engine/models/props/jungle.js';
import { createPlazaProp } from '/engine/models/props/plaza.js';
import { sunnyStage, makeActors, animateActor, rand, pick } from './stage.js';

const TIME = 30;
const START = -11, GOAL = 7.5;      // x where the panas start and where the relic is touched
const SPEED = 1.8;
const CREEP = 0.4;                 // disguised speed, as a share of SPEED
const STILL = 0.6;                 // slower than this counts as frozen
const GRACE = 0.4;                 // seconds to freeze after she starts turning
const DISGUISE = 1.5, DISGUISES = 3;
const PROPS = ['barrel', 'crate', 'cooler'];
const FACE_WALL = Math.PI / 2, FACE_PANAS = -Math.PI / 2;

const progress = (x) => Math.max(0, Math.min(1, (x - START) / (GOAL - START)));

export default {
  id: 'momia',
  title: '¡Un, dos, tres, momia!',
  howto: 'Corre hacia la reliquia mientras la momia cuenta. Cuando se voltee, ¡quieto! Si te ve moviéndote, vuelves al inicio. Disfrazado de barril puedes avanzar despacito (tres veces).',
  keys: [['D / →', 'correr'], ['Espacio', 'disfrazarte']],
  touch: { pad: 'r', action: 'Disfraz' },
  icon: 'relic',
  time: TIME,

  create(ctx) {
    const scene = new THREE.Scene();
    const stage = sunnyStage(scene, { ground: null, horizon: 0xf3e2b8 });
    const puffs = new Puffs(scene);

    // the courtyard: a stone causeway with a lane per pana
    const stone = M(0x9a9682, { roughness: 1 }), seam = M(0x6f6c5c, { roughness: 1 });
    const floor = mesh(new THREE.BoxGeometry(GOAL - START + 9, 0.2, 10), stone, (START + GOAL) / 2 + 1.5, 0.1, 0);
    floor.receiveShadow = true;
    scene.add(floor);
    for (const z of [-2, 0, 2]) scene.add(mesh(new THREE.BoxGeometry(GOAL - START + 9, 0.02, 0.08), seam, (START + GOAL) / 2 + 1.5, 0.21, z));
    const startLine = mesh(new THREE.BoxGeometry(0.25, 0.03, 8.2), M(0xf3ead2), START - 0.6, 0.22, 0);
    const goalLine = mesh(new THREE.BoxGeometry(0.25, 0.03, 8.2), M(0xe6b65d, { metalness: 0.4 }), GOAL, 0.22, 0);
    scene.add(startLine, goalLine);

    const temple = templeEntrance();
    temple.position.set(13, 0, -11);
    temple.rotation.y = -0.45;
    scene.add(temple);
    for (const [x, z, r] of [[-6, -6.5, 0.2], [3, -6.8, -0.1], [-15.5, -4, 0.5]]) {
      const t = stoneTotem({ seed: 38 + Math.round(x) });
      t.position.set(x, 0, z);
      t.rotation.y = r;
      scene.add(t);
    }
    for (const z of [-4.6, 4.6]) {
      const l = expeditionLantern();
      l.scale.setScalar(1.8);
      l.position.set(GOAL, 0.2, z);
      scene.add(l);
    }

    // the relic on its pedestal, the mummy behind it
    const pedestal = mesh(new THREE.BoxGeometry(1.4, 1.2, 1.4), M(0x7c7a68, { roughness: 1 }), GOAL + 1.6, 0.8, 0);
    const relic = sunRelic();
    relic.position.set(GOAL + 1.6, 1.4, 0);
    relic.rotation.y = -Math.PI / 2;
    scene.add(pedestal, relic);
    const mom = mummy({ guardian: true });
    mom.position.set(GOAL + 4.4, 0.2, 0);
    mom.rotation.y = FACE_WALL;
    scene.add(mom);
    const momBubble = makeBubble();
    scene.add(momBubble.sprite);
    momBubble.sprite.position.set(GOAL + 4.4, 5.6, 0);

    const camera = new THREE.PerspectiveCamera(50, (ctx.aspect || innerWidth / innerHeight), 0.1, 400);
    camera.position.set(0.5, 11.5, 19.5);
    camera.lookAt(0.5, 1.6, -1);

    const actors = makeActors(scene, ctx.players, ctx);
    actors.forEach((a, i) => {
      a.x = START;
      a.z = -3 + i * 6 / (actors.length - 1);
      a.y = 0.2;
      a.disguised = 0;
      a.disguises = DISGUISES;
      a.prop = createPlazaProp(PROPS[i % PROPS.length]);
      a.prop.scale.setScalar(0.85);
      a.prop.visible = false;
      scene.add(a.prop);
      a.ai = { react: 0, sneaky: random() < 0.6, speed: rand(0.9, 1) };
    });
    const human = (a) => a.player.human && !ctx.auto;

    // the mummy: count → turn → watch → turn back → count…  (sometimes a fake turn)
    let state = 'count', stateT = 0, stateLen = 2.5, words = 0, clock = 0, winner = null, faked = false;
    let turnedAt = 0;   // when she last started to turn (or fake it): AI reactions count from here
    const momFace = { from: FACE_WALL, to: FACE_WALL };

    function enter(next) {
      if (next === 'fake' || next === 'turn') faked = next === 'fake';
      state = next;
      stateT = 0;
      const late = clock / TIME;
      if (next === 'count') {
        stateLen = Math.max(0.7, rand(0.8, 2.2) - late * 0.5);
        words = 0;
        momFace.from = mom.rotation.y; momFace.to = FACE_WALL;
      } else if (next === 'turn') {
        stateLen = GRACE;
        momFace.from = mom.rotation.y; momFace.to = FACE_PANAS;
        momBubble.say('¡MOMIA!', 1.2);
        sound.sweep(220, 520, 0.35, 'sawtooth', 0.08);
      } else if (next === 'watch') {
        stateLen = rand(1.4, 2.4);
      } else if (next === 'back') {
        stateLen = 0.3;
        momFace.from = mom.rotation.y; momFace.to = FACE_WALL;
      } else if (next === 'fake') {
        stateLen = 0.5;
        momFace.from = mom.rotation.y; momFace.to = FACE_WALL - 0.8;
        momBubble.say('…', 0.5);
      }
      if (next === 'turn' || next === 'fake') {
        turnedAt = clock;
        for (const a of actors) {
          a.ai.react = rand(0.12, 0.26) + (random() < 0.1 ? rand(0.2, 0.35) : 0);
          a.ai.fooled = random() < 0.5;
        }
      }
    }

    function stepMummy(dt) {
      stateT += dt;
      const k = Math.min(1, stateT / (state === 'turn' ? GRACE * 0.8 : state === 'fake' ? 0.25 : 0.3));
      const e = k * k * (3 - 2 * k);
      mom.rotation.y = state === 'fake' && stateT > 0.25
        ? momFace.to + (FACE_WALL - momFace.to) * Math.min(1, (stateT - 0.25) / 0.25)
        : momFace.from + (momFace.to - momFace.from) * e;
      if (state === 'count') {
        if (words < 3 && stateT >= words * stateLen / 3) {
          momBubble.say(['Un…', 'dos…', 'tres…'][words], stateLen / 3);
          sound.tone([392, 440, 494][words], 0, 0.14, 'triangle', 0.08);
          words++;
        }
      }
      if (stateT < stateLen) return;
      if (state === 'count') enter(!faked && random() < 0.15 ? 'fake' : 'turn');
      else if (state === 'turn') enter('watch');
      else if (state === 'watch') enter('back');
      else enter('count');
    }

    const looking = () => state === 'watch';
    const turning = () => state === 'turn' || state === 'watch';

    function catchPana(a) {
      momBubble.say(pick(['¡Te vi!', '¡Para atrás!', '¡Ajá!']), 0.9);
      a.bubble.say(pick(['¡Nooo!', '¡Ay!', '¡Rayos!']), 0.9);
      sound.bonk(0.8);
      puffs.spawn(new THREE.Vector3(a.x, 1.2, a.z), { color: 0xd9cfae, count: 8, spread: 1, size: 0.7 });
      a.x = START;
      a.vx = 0;
      a.stun = 0.6;
      puffs.spawn(new THREE.Vector3(a.x, 1.2, a.z), { color: 0xd9cfae, count: 5, spread: 0.8, size: 0.6 });
    }

    function disguise(a) {
      if (a.disguised > 0 || a.disguises <= 0 || a.stun > 0) return;
      a.disguises--;
      a.disguised = DISGUISE;
      sound.plop();
      puffs.spawn(new THREE.Vector3(a.x, 1, a.z), { color: 0xf3ead2, count: 6, spread: 0.8, size: 0.6 });
      if (human(a)) a.bubble.say(a.disguises ? `Quedan ${a.disguises}` : '¡Último!', 0.8);
    }

    // what an AI pana does this frame: { dir, disguise }
    function think(a) {
      if (a.disguised > 0) return { dir: looking() && a.disguised < 0.15 ? 0 : 1 };
      const since = clock - turnedAt;
      if (state === 'fake') return { dir: a.ai.fooled && since >= a.ai.react ? 0 : 1 };
      if (!turning()) return { dir: 1 };
      // she's turning: freeze after a reaction, or slip into a disguise when it pays
      if (since < a.ai.react) {
        const worth = a.disguises > 0 && a.ai.sneaky && (progress(a.x) > 0.5 || clock > TIME * 0.65);
        return { dir: 1, disguise: worth && state === 'turn' && stateLen - stateT > 0.1 };
      }
      return { dir: 0 };
    }

    let skyTime = 0;
    function update(dt, input) {
      skyTime += dt; stage.update(skyTime);
      clock += dt;
      if (!winner) stepMummy(dt);
      momBubble.update(dt);
      mom.userData.animate(clock, false, false);

      for (const a of actors) {
        a.stun = Math.max(0, a.stun - dt);
        const was = a.disguised;
        a.disguised = Math.max(0, a.disguised - dt);
        if (was > 0 && a.disguised === 0) puffs.spawn(new THREE.Vector3(a.x, 1, a.z), { color: 0xf3ead2, count: 4, spread: 0.6, size: 0.5 });

        let dir = 0;
        if (human(a)) {
          dir = Math.max(0, inputFor(input, a.i).x);
          if (inputFor(input, a.i).jump) disguise(a);
        } else {
          const plan = think(a);
          dir = plan.dir;
          if (plan.disguise) disguise(a);
        }
        if (a.stun > 0 || winner) dir = 0;
        const top = SPEED * (a.disguised > 0 ? CREEP : 1) * (human(a) ? 1 : a.ai.speed);
        // quick to start, quicker to stop: freezing is the whole game
        a.vx += (dir * top - a.vx) * Math.min(1, dt * (dir ? 8 : 20));
        a.x += a.vx * dt;
        if (a.x >= GOAL && !winner) {
          winner = a;
          a.score = 100;
          a.bubble.say('¡La reliquia!', 1.5);
          sound.horn('fiesta');
        }
        if (looking() && a.disguised === 0 && a.vx > STILL && a !== winner) catchPana(a);
        if (a !== winner) a.score = Math.round(progress(a.x) * 99);

        const hidden = a.disguised > 0;
        a.pana.group.visible = !hidden;
        a.prop.visible = hidden && (a.disguised > 0.4 || Math.sin(clock * 40) > 0);   // flickers before it wears off
        a.prop.position.set(a.x, 0.2, a.z);
        animateActor(a, dt, { moving: a.vx / SPEED, open: a.stun > 0, dizzy: a.stun > 0, armsUp: 0.2 });
        a.pana.group.rotation.y = Math.PI / 2;
      }
      puffs.update(dt);
    }

    function outro(dt, winners) {
      clock += dt;
      momBubble.update(dt);
      mom.userData.animate(clock, false, winners.length > 0);
      for (const a of actors) {
        const win = winners.includes(a.i);
        a.disguised = 0;
        a.pana.group.visible = true;
        a.prop.visible = false;
        a.y = 0.2 + (win ? Math.abs(Math.sin(clock * 6)) * 0.8 : 0);
        animateActor(a, dt, { moving: 0, open: win, armsUp: win ? 1.8 : 0.3 });
        a.pana.group.rotation.y = win ? 0 : Math.PI / 2;
      }
      puffs.update(dt);
    }

    // Run or freeze, and the disguises you have left, for the runner's hint line.
    const me = actors[ctx.localIndex ?? ctx.players.findIndex((p) => p.human && !ctx.auto)];
    function hint() {
      if (!me || winner) return null;
      const left = `Disfraces: ${me.disguises}`;
      if (me.stun > 0) return { text: '¡Te pilló! De vuelta al inicio', tone: 'bad' };
      if (me.disguised > 0) return { text: `Disfrazado: avanza despacito · ${left}`, tone: 'ok' };
      if (turning() || state === 'fake') return { text: `¡QUIETO! Te está mirando · ${left}`, tone: 'bad' };
      return { text: `¡CORRE! Está contando · ${left}`, tone: 'go' };
    }

    return {
      scene, camera, update, outro, actors, hint,
      scores: () => actors.map((a) => a.score),
      over: () => !!winner,
      winners: () => (winner ? [winner.i] : []),
    };
  },
};
