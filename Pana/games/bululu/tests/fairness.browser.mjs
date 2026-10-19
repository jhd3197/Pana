// Fairness regressions from the Bululú audit, run on the real minigame
// modules with the game's seeded random stream at the online 20 Hz step:
// Remada keeps a trailing local canoe in view, Caída never lets seat order
// win a same-step slam, Atrapa gives the fruit to the closest basket, and an
// Embuste mummy who does nothing no longer beats five bots.
import assert from 'node:assert/strict';
import { launch } from '../../../tests/browser-kit.js';

const base = process.env.PANA_TEST_URL || 'http://localhost:8461';
const browser = await launch();
try {
  const page = await browser.newPage();
  await page.goto(`${base}/api/health`);
  await page.setContent(`<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script>`);
  // Builds a six-seat game on seed `seed`; `humans` are the seats players drive.
  await page.evaluate(async () => {
    const { seeded, withRandom } = await import('/g/bululu/online-rules.js');
    const { normalizeAvatar } = await import('/engine/avatar.js');
    const { release } = await import('/g/bululu/minigames/lifetime.js');
    window.makeGame = async (id, seed, humans, extra = {}) => {
      const { default: def } = await import(`/g/bululu/minigames/${id}.js`);
      const players = ['#ff4b4b', '#3d7bf2', '#ffc629', '#2ad1b2', '#ad70ec', '#ff8e3d'].map((color, i) => ({ i, color, name: `Pana ${i}`, human: humans.includes(i), avatar: normalizeAvatar({}) }));
      const rng = seeded(seed);
      const game = withRandom(rng, () => def.create({ players, auto: false, aspect: 16 / 9, ...extra }));
      return { game, players, step: (input, dt = 0.05) => withRandom(rng, () => game.update(dt, input)), done: () => release(game.scene) };
    };
  });

  // ---------- Remada: an idle local canoe at either end stays on screen ----------
  for (const seat of [0, 5]) {
    const view = await page.evaluate(async seat => {
      const g = await makeGame('remada', 5, [seat], { localIndex: seat });
      for (let f = 0; f < 12 * 20; f++) g.step([]);
      const cam = g.game.camera, p = g.game.actors[seat].canoe.group.position.clone();
      cam.updateMatrixWorld(); p.y += 1; p.project(cam);
      const lead = Math.max(...g.game.sim.racers.map(r => r.s));
      g.done();
      return { x: p.x, y: p.y, z: p.z, lead, mine: 0 };
    }, seat);
    assert(view.lead > 30, `the bots raced ahead (${view.lead} m)`);
    assert(Math.abs(view.x) < 1 && Math.abs(view.y) < 1 && view.z < 1, `seat ${seat}'s idle canoe in view: ${JSON.stringify(view)}`);
  }
  console.log('PASS Remada keeps an idle local canoe in view at seats 1 and 6 while the bots lead');

  // ---------- Caída: six identical tappers; seat order must not take the ties ----------
  const tops = await page.evaluate(async () => {
    const count = [0, 0, 0, 0, 0, 0];
    for (let seed = 1; seed <= 20; seed++) {
      const g = await makeGame('caida', seed, [0, 1, 2, 3, 4, 5]);
      for (let f = 0; f < 30 * 20; f++) { const jump = f % 10 === 0; g.step(g.players.map(() => ({ x: 0, jump }))); }
      const scores = g.game.scores(), best = Math.max(...scores), top = scores.flatMap((s, i) => s === best ? [i] : []);
      if (top.length === 1) count[top[0]]++;
      g.done();
    }
    return count;
  });
  assert(Math.max(...tops) <= 9, `no seat keeps winning the same-step ties: sole tops per seat ${tops}`);
  console.log(`PASS Caída: same-step slams resolve without seat order (sole wins per seat over 20 seeds: ${tops})`);

  // ---------- Atrapa: the closest basket gets the fruit, not the lower seat ----------
  const catchBy = await page.evaluate(async () => {
    const g = await makeGame('atrapa', 3, [0, 1, 2, 3, 4, 5]);
    for (let f = 0; f < 10; f++) g.step([]);   // the first fruit drops at 0.4 s
    const xs = [0, -10, -8.6, -7.2, 10, 1.4];   // seat 0 and seat 5 both reach x = 0.9
    g.game.actors.forEach((a, i) => { a.x = xs[i]; a.vx = 0; });
    const list = g.game.falling();
    list.forEach(f => { f.obj.position.y = 30; });
    const fruit = list[0];
    Object.assign(fruit, { kind: 'mango', vy: -1 });
    fruit.obj.position.set(0.9, 1.76, fruit.obj.position.z);
    g.step([]);
    const scores = g.game.scores();
    g.done();
    return scores;
  });
  assert.equal(catchBy[5], 1, `seat 6 is 0.5 away and catches it (${catchBy})`);
  assert.equal(catchBy[0], 0, `seat 1 is 0.9 away and does not (${catchBy})`);
  console.log('PASS Atrapa: the nearer basket catches, whatever its seat');

  // ---------- Embuste: an idle human mummy against five bots ----------
  const mummy = await page.evaluate(async () => {
    const out = { idle: 0, slow: 0 };   // slow: a careful crank every 0.8 s
    for (const strategy of ['idle', 'slow']) for (let seed = 1; seed <= 30; seed++) {
      const g = await makeGame('embuste', seed, []);
      const m = g.game.stats().mummy;
      g.players.forEach((p, i) => { p.human = i === m; });
      for (let f = 0; f < 32 * 20 && !g.game.over(); f++) {
        const input = g.players.map((_, i) => ({ x: 0, jump: strategy === 'slow' && i === m && f % 16 === 0 }));
        g.step(input);
      }
      if (g.game.winners().includes(m)) out[strategy]++;
      g.done();
    }
    return out;
  });
  assert(mummy.idle <= 3, `an idle mummy almost never wins (won ${mummy.idle}/30)`);
  assert(mummy.slow > mummy.idle, `cranking slowly beats doing nothing (${JSON.stringify(mummy)})`);
  console.log(`PASS Embuste: an idle mummy won ${mummy.idle}/30, a slow-cranking one ${mummy.slow}/30`);
} finally { await browser.close(); }
