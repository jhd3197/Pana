// Whole matches on generated maps, machine against machine through the pure
// rules: every match ends (a winner, or a draw) well before the turn cap, and
// no bot gets stuck. Prints how many finished and how long they took.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, tickMatch, takeEvents } from '../public/rules.js';
import { createBot } from '../public/bot.js';

const CAP = 80, DT = 1 / 60;

function play(seed, size, difficulty) {
  const m = createMatch({ seconds: 30, seed, size, difficulty });
  const bots = [createBot({ team: 0, difficulty, seed: seed * 3 }), createBot({ team: 1, difficulty, seed: seed * 3 + 1 })];
  let shots = 0, timeouts = 0;
  while (m.phase !== 'finished' && m.turn.n <= CAP) {
    tickMatch(m, DT, bots[m.turn.team].input(m));
    for (const e of takeEvents(m)) { if (e.type === 'fire') shots++; if (e.type === 'timeout') timeouts++; }
  }
  return { seed, size, kind: m.map.kind, finished: m.phase === 'finished', winner: m.winner, turns: m.turn.n, shots, timeouts,
    left: m.capys.filter(c => !c.out).map(c => `${c.id}@${c.x.toFixed(1)}`) };
}

for (const [size, count, difficulty] of [['medium', 50, 'experto'], ['small', 10, 'experto'], ['large', 10, 'experto'], ['medium', 10, 'normal']]) {
  test(`${count} ${size} maps, ${difficulty} bots: every match finishes`, t => {
    const start = performance.now(), results = [];
    for (let i = 1; i <= count; i++) results.push(play(i * 104729 % 99991, size, difficulty));
    const done = results.filter(r => r.finished), turns = results.reduce((s, r) => s + r.turns, 0) / results.length;
    t.diagnostic(`${done.length}/${count} finished, ${turns.toFixed(1)} turns on average, ${results.reduce((s, r) => s + r.shots, 0)} shots, ${results.reduce((s, r) => s + r.timeouts, 0)} turns timed out, ${((performance.now() - start) / 1000).toFixed(1)} s`);
    for (const r of results) {
      assert.ok(r.finished, `seed ${r.seed} (${r.kind}) still going after ${CAP} turns: ${r.left.join(' ')}`);
      // A bot always shoots: a turn that runs out of time means it got stuck.
      assert.ok(r.timeouts <= 1, `seed ${r.seed}: ${r.timeouts} turns ran out of time`);
    }
  });
}
