import test from 'node:test';
import assert from 'node:assert/strict';
import { remadaSim, raudalSim, remolinoSim, REMADA, RAUDAL, REMOLINO } from '../public/minigames/river-sims.js';
// A small seeded random so every balance run is repeatable.
function seeded(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// Plays one all-AI round the way the runner does: 1/60 s steps for the full
// time, stopping early when the minigame says it is over.
function play(make, time, seed) {
  const random = seeded(seed), sim = make({ random });
  for (let t = 0; t < time && !sim.over?.(); t += 1 / 60) sim.update(1 / 60, []);
  return sim;
}
function winners(sim) {
  if (sim.winners) return sim.winners();
  const scores = sim.scores(), best = Math.max(...scores);
  return best > 0 ? scores.map((s, i) => s === best ? i : -1).filter(i => i >= 0) : [];
}
// Plan 52: over 200 runs no pana wins more than 35% or less than 15%, and
// no run ends with nobody scoring.
function balance(make, time) {
  const wins = [0, 0, 0, 0];
  for (let k = 0; k < 200; k++) {
    const sim = play(make, time, 9000 + k), w = winners(sim);
    assert.ok(w.length > 0, `run ${k}: nobody won`);
    assert.ok(sim.scores().some(s => s > 0), `run ${k}: nobody scored`);
    for (const i of w) wins[i] += 1 / w.length;
  }
  for (const n of wins) assert.ok(n / 200 >= .15 && n / 200 <= .35, `win shares ${wins.map(n => (n / 2).toFixed(0) + '%')}`);
  return wins;
}

test('¡Remada!: AIs finish the 120 m in time; the split is fair', () => {
  const sim = play(remadaSim, REMADA.time, 1);
  assert.ok(sim.racers.every(r => r.finish != null && r.finish > 17 && r.finish < REMADA.time), sim.racers.map(r => r.finish?.toFixed(1)).join(' '));
  balance(remadaSim, REMADA.time);
});

test('¡Remada!: rhythm beats mashing for a human', () => {
  const race = (gap) => {
    const sim = remadaSim({ humans: new Set([0]), random: seeded(4) });
    let x = 0, next = 0, side = -1;
    for (let t = 0; t < 15; t += 1 / 60) {
      if (t >= next) { side = -side; x = side; next = t + gap; } else if (t >= next - gap / 2) x = 0;
      sim.update(1 / 60, [{ x }]);
    }
    return sim.racers[0].s;
  };
  assert.ok(race(.4) > race(.12) * 1.8);
});

test('¡Raudal!: dodging and jumping pay; the split is fair', () => {
  const sim = play(raudalSim, RAUDAL.time, 2);
  assert.ok(sim.canoes.some(c => c.jumps > 0) && sim.canoes.some(c => c.score > 3));
  balance(raudalSim, RAUDAL.time);
});

test('¡Raudal!: a pana who never moves hits rocks; one who jumps on time clears ledges', () => {
  const lazy = raudalSim({ humans: new Set([0]), random: seeded(5) });
  for (let t = 0; t < RAUDAL.time; t += 1 / 60) lazy.update(1 / 60, [{ x: 0, jump: false }]);
  assert.ok(lazy.canoes[0].hits > 2 && lazy.canoes[0].splashes > 2);
  const jumper = raudalSim({ humans: new Set([0]), random: seeded(5) });
  const jumped = new Set();
  for (let t = 0; t < RAUDAL.time; t += 1 / 60) {
    const ledge = jumper.pattern.find(r => r.ledge && r.s > jumper.s), now = !!ledge && !jumped.has(ledge) && (ledge.s - jumper.s) / RAUDAL.speed <= .25;
    if (now) jumped.add(ledge);
    jumper.update(1 / 60, [{ x: 0, jump: now }]);
  }
  assert.ok(jumper.canoes[0].jumps >= 3 && jumper.canoes[0].splashes === 0);
});

test('¡Remolino!: the eye grows until someone is left; the split is fair', () => {
  const sim = play(remolinoSim, REMOLINO.time, 3);
  assert.ok(sim.canoes.filter(c => c.out != null).length >= 2, 'the whirlpool takes canoes');
  assert.ok(sim.canoes.some(c => c.shoves > 0), 'AIs shove each other in');
  balance(remolinoSim, REMOLINO.time);
});

test('¡Remolino!: a pana who stops paddling is pulled in first', () => {
  const sim = remolinoSim({ humans: new Set([0]), random: seeded(6) });
  for (let t = 0; t < REMOLINO.time && !sim.over(); t += 1 / 60) sim.update(1 / 60, [{ x: 0 }]);
  const outs = sim.canoes.map(c => c.out ?? Infinity);
  assert.equal(Math.min(...outs), outs[0]);
});
