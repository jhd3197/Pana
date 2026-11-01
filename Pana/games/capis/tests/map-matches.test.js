// Whole matches on generated maps, machine against machine through the pure
// rules: every match ends (a winner, a draw, or the turn limit's verdict when
// the teams cannot get at each other), and no bot gets stuck. Prints how many
// finished, how, how long they took, and the same by kind of map.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, tickMatch, takeEvents, RULES } from '../public/rules.js';
import { createBot } from '../public/bot.js';

const CAP = RULES.turnLimit + 2, DT = 1 / 60;

function play(seed, size, difficulty) {
  const m = createMatch({ seconds: 30, seed, size, difficulty });
  const bots = [createBot({ team: 0, difficulty, seed: seed * 3 }), createBot({ team: 1, difficulty, seed: seed * 3 + 1 })];
  let shots = 0, timeouts = 0, drowned = 0;
  while (m.phase !== 'finished' && m.turn.n <= CAP) {
    tickMatch(m, DT, bots[m.turn.team].input(m));
    for (const e of takeEvents(m)) { if (e.type === 'fire') shots++; if (e.type === 'timeout') timeouts++; if (e.type === 'out' && e.reason === 'water') drowned++; }
  }
  return { seed, size, kind: m.map.kind, finished: m.phase === 'finished', winner: m.winner, by: m.endedBy, turns: m.turn.n, shots, timeouts, drowned,
    left: m.capys.filter(c => !c.out).map(c => `${c.id}@${c.x.toFixed(1)}`) };
}

const ending = r => (!r.finished ? 'unfinished' : r.winner === -1 ? 'draw' : `team ${r.winner}`) + (r.by === 'turns' ? ' at the limit' : '');
for (const [size, count, difficulty] of [['medium', 40, 'experto'], ['small', 15, 'experto'], ['large', 15, 'experto'], ['medium', 10, 'normal']]) {
  test(`${count} ${size} maps, ${difficulty} bots: every match finishes`, t => {
    const start = performance.now(), results = [];
    for (let i = 1; i <= count; i++) results.push(play(i * 104729 % 99991, size, difficulty));
    const done = results.filter(r => r.finished), turns = results.reduce((s, r) => s + r.turns, 0) / results.length;
    const tally = (list, key) => list.reduce((o, r) => { o[key(r)] = (o[key(r)] || 0) + 1; return o; }, {});
    t.diagnostic(`${done.length}/${count} finished, ${turns.toFixed(1)} turns on average (most ${Math.max(...results.map(r => r.turns))}), ${results.reduce((s, r) => s + r.shots, 0)} shots, ${results.reduce((s, r) => s + r.drowned, 0)} capis into the water, ${results.reduce((s, r) => s + r.timeouts, 0)} turns timed out, ${((performance.now() - start) / 1000).toFixed(1)} s`);
    t.diagnostic(`endings ${JSON.stringify(tally(results, ending))}`);
    const kinds = {};
    for (const r of results) (kinds[r.kind] ||= []).push(r);
    t.diagnostic(Object.entries(kinds).map(([k, list]) => `${k}: ${list.length} matches, ${(list.reduce((s, r) => s + r.turns, 0) / list.length).toFixed(1)} turns, ${JSON.stringify(tally(list, ending))}`).join('; '));
    for (const r of results) {
      assert.ok(r.finished, `seed ${r.seed} (${r.kind}) still going after ${CAP} turns: ${r.left.join(' ')}`);
      // A bot always shoots: a turn that runs out of time means it got stuck.
      assert.ok(r.timeouts <= 1, `seed ${r.seed}: ${r.timeouts} turns ran out of time`);
    }
  });
}
