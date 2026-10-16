import test from 'node:test';
import assert from 'node:assert/strict';
import { chinazoSim, CHINAZO, AI, MANGOS } from '../public/minigames/chinazo-sim.js';
// A small seeded random so every balance run is repeatable.
function seeded(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const DT = 1 / 60;

// One round the way the runner plays it: 1/60 s steps for 40 s.
function play(seed, opts = {}) {
  const sim = chinazoSim({ random: seeded(seed), ...opts });
  for (let t = 0; t < CHINAZO.time; t += DT) { sim.update(DT, []); sim.events.length = 0; }
  return sim;
}
function shares(runs, opts) {
  const wins = [0, 0, 0, 0];
  for (let k = 0; k < runs; k++) {
    const sim = play(9000 + k, opts), w = sim.winners();
    assert.ok(w.length > 0, `run ${k}: nobody won`);
    assert.ok(sim.scores().some((s) => s > 0), `run ${k}: nobody scored`);
    for (const i of w) wins[i] += 1 / w.length;
  }
  return wins.map((n) => n / runs);
}

// Plan 52's rule: over 200 all-AI runs nobody wins more than 35% or less than 15%.
test('¡Chinazo!: four AIs split the wins fairly and someone always scores', () => {
  const w = shares(200);
  for (const n of w) assert.ok(n >= 0.15 && n <= 0.35, `win shares ${w.map((n) => (n * 100).toFixed(0) + '%')}`);
});

// A decent human: perfect lead and 0.2 s reactions. Should win about 1 in 3.
test('¡Chinazo!: a decent human wins about one round in three', () => {
  const w = shares(200, { profiles: [AI.ace] });
  assert.ok(w[0] >= 0.25 && w[0] <= 0.45, `human share ${(w[0] * 100).toFixed(0)}%`);
});

// A human seat driven by hand: aim, pull, fire.
function human(seed = 3) {
  const sim = chinazoSim({ humans: new Set([0]), random: seeded(seed) });
  const step = (input = {}, n = 1) => { for (let k = 0; k < n; k++) sim.update(DT, [{ aim: { x: 0, y: 0 }, ...input }]); };
  return { sim, step, me: sim.shooters[0] };
}

test('a release before 0.15 s still waits for the minimum pull', () => {
  const { sim, step, me } = human();
  step({ pull: true });
  step({ fire: true });
  assert.equal(me.shots, 0);
  step({}, Math.ceil(CHINAZO.minPull / DT));
  assert.equal(me.shots, 1);
  assert.ok(sim.stones.length >= 1 || sim.events.some((e) => e.type === 'miss' || e.type === 'hit'));
});

test('three mamones a load, then a 0.9 s reload', () => {
  const { step, me } = human();
  for (let k = 0; k < 3; k++) { step({ pull: true }, 15); step({ fire: true }); step({}, 2); }
  assert.equal(me.shots, 3);
  assert.equal(me.ammo, 0);
  step({ pull: true }, 15); step({ fire: true });
  assert.equal(me.shots, 3, 'no stones while reloading');
  step({}, Math.ceil(CHINAZO.reload / DT));
  assert.equal(me.ammo, CHINAZO.ammo);
});

test('stones fly 0.25–0.42 s; a longer pull flies faster', () => {
  const { sim, step } = human();
  step({ pull: true }, 10); step({ fire: true }); step();
  const quick = sim.events.find((e) => e.type === 'shot').stone;
  step({}, 60); sim.events.length = 0;
  step({ pull: true }, 50); step({ fire: true }); step();
  const full = sim.events.find((e) => e.type === 'shot').stone;
  for (const s of [quick, full]) assert.ok(s.dur >= 0.25 && s.dur <= 0.42, `flight ${s.dur}`);
  assert.ok(full.dur < quick.dur);
});

test('aiming at an iguana where it will be hits it; the first stone to land scores', () => {
  // wait for one, then lead it perfectly from two seats at once
  const sim = chinazoSim({ humans: new Set([0, 1]), random: seeded(11) });
  let ig;
  for (let t = 0; t < 10 && !ig; t += DT) {
    sim.update(DT, []);
    ig = sim.iguanas.find((g) => sim.live(g) && g.path.kind !== 'caida' && g.path.dur - (sim.time - g.born) > 1.5);
  }
  assert.ok(ig, 'an iguana showed up');
  const lead = (dt) => { const p = sim.cam.project(sim.bodyAt(sim.stateOf(ig, sim.time + dt))); return { x: p.x, y: p.y }; };
  for (let k = 0; k < 12; k++) sim.update(DT, [{ aim: lead(0.33), pull: true }, { aim: lead(0.33), pull: true }]);
  sim.events.length = 0;
  sim.update(DT, [{ aim: lead(0.33), fire: true }, { aim: lead(0.36), fire: true }]);
  for (let k = 0; k < 40; k++) sim.update(DT, []);
  const hits = sim.events.filter((e) => e.type === 'hit' && e.iguana === ig);
  assert.equal(hits.length, 1, 'scored once');
  assert.equal(sim.scores()[hits[0].seat], 1);
  assert.ok(ig.hit, 'bonked');
});

test('the golden iguana shows once in the second half; ¡Plaga! at 30 s', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const sim = chinazoSim({ random: seeded(seed) });
    let plagaAt = null;
    for (let t = 0; t < CHINAZO.time; t += DT) {
      sim.update(DT, []);
      if (sim.events.some((e) => e.type === 'plaga')) plagaAt = sim.time;
      sim.events.length = 0;
    }
    const golden = sim.iguanas.filter((g) => g.golden);
    assert.equal(golden.length, 1);
    assert.ok(golden[0].born >= 20 && golden[0].born <= 30);
    assert.ok(Math.abs(plagaAt - CHINAZO.plaga) < 0.05);
    // the tree crawls in the last 10 s
    const early = sim.iguanas.filter((g) => g.born < 10).length, late = sim.iguanas.filter((g) => g.born >= 30).length;
    assert.ok(late > early, `plaga ${late} vs first 10 s ${early}`);
  }
});

test('hitting the guacamaya costs 2; a mango just falls', () => {
  const sim = chinazoSim({ humans: new Set([0]), random: seeded(5) });
  let bird;
  for (let t = 0; t < 20 && !bird; t += DT) { sim.update(DT, []); bird = sim.birds.find((b) => sim.time - b.born > 1 && sim.time - b.born < b.path.dur - 1.5); }
  assert.ok(bird, 'a guacamaya flew by');
  const at = (dt) => { const p = sim.cam.project(bird.path.at(sim.time + dt - bird.born).pos); return { x: p.x, y: p.y }; };
  for (let k = 0; k < 15; k++) sim.update(DT, [{ aim: at(0.3), pull: true }]);
  const before = sim.scores()[0];
  sim.update(DT, [{ aim: at(0.3), fire: true }]);
  for (let k = 0; k < 40; k++) sim.update(DT, []);
  if (sim.events.some((e) => e.type === 'bird' && e.seat === 0)) assert.equal(sim.scores()[0], before + CHINAZO.bird);
  else assert.fail('the guacamaya should have been hit (an iguana in front is allowed only by chance)');

  const m = chinazoSim({ humans: new Set([0]), random: seeded(6) });
  const p = m.cam.project(MANGOS[0]);
  for (let k = 0; k < 15; k++) m.update(DT, [{ aim: { x: p.x, y: p.y }, pull: true }]);
  m.update(DT, [{ aim: { x: p.x, y: p.y }, fire: true }]);
  for (let k = 0; k < 40; k++) m.update(DT, []);
  const ev = m.events.filter((e) => e.seat === 0 && e.type !== 'shot' && e.type !== 'reloaded');
  assert.ok(ev.some((e) => e.type === 'mango' || e.type === 'hit'), JSON.stringify(ev.map((e) => e.type)));
  if (ev[0].type === 'mango') assert.equal(m.scores()[0], 0);
});
