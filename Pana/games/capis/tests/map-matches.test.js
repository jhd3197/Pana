// Whole matches on generated maps, machine against machine through the pure
// rules, with the whole arsenal: every match ends (a winner, a draw, or the
// turn limit's verdict when the teams cannot get at each other), no bot gets
// stuck, and ammo running out never stalls a match (La Piñita never runs out).
// Prints how many finished, how, how long they took, which weapons were fired
// and what they painted, the bot's thinking time a turn, and the same by kind.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, tickMatch, takeEvents, RULES } from '../public/rules.js';
import { createBot } from '../public/bot.js';
import { WEAPON_IDS } from '../public/weapons.js';

const CAP = RULES.turnLimit + 2, DT = 1 / 60;

function play(seed, size, difficulty) {
  const m = createMatch({ seconds: 30, seed, size, difficulty });
  const bots = [createBot({ team: 0, difficulty, seed: seed * 3 }), createBot({ team: 1, difficulty, seed: seed * 3 + 1 })];
  let shots = 0, timeouts = 0, drowned = 0, think = 0, slowest = 0, turn = m.turn.n, turnMs = 0;
  const painted = {};
  while (m.phase !== 'finished' && m.turn.n <= CAP) {
    const t0 = performance.now(), input = bots[m.turn.team].input(m);
    turnMs += performance.now() - t0;
    tickMatch(m, DT, input);
    if (m.turn.n !== turn) { think += turnMs; slowest = Math.max(slowest, turnMs); turnMs = 0; turn = m.turn.n; }
    for (const e of takeEvents(m)) {
      if (e.type === 'fire') shots++;
      if (e.type === 'timeout') timeouts++;
      if (e.type === 'out' && e.reason === 'water') drowned++;
      if (e.type === 'hit' && e.team !== e.by) painted[e.weapon] = (painted[e.weapon] || 0) + e.paint;
    }
  }
  return { seed, size, kind: m.map.kind, finished: m.phase === 'finished', winner: m.winner, by: m.endedBy, turns: m.turn.n, shots, timeouts, drowned,
    used: { ...m.used }, painted, think: think / m.turn.n, slowest, ammo: m.ammo, left: m.capys.filter(c => !c.out).map(c => `${c.id}@${c.x.toFixed(1)}`) };
}

const ending = r => (!r.finished ? 'unfinished' : r.winner === -1 ? 'draw' : `team ${r.winner}`) + (r.by === 'turns' ? ' at the limit' : '');
const all = [];
for (const [size, count, difficulty] of [['medium', 45, 'experto'], ['small', 20, 'experto'], ['large', 20, 'experto'], ['medium', 15, 'normal'], ['medium', 10, 'facil']]) {
  test(`${count} ${size} maps, ${difficulty} bots: every match finishes, with every weapon`, t => {
    const start = performance.now(), results = [];
    for (let i = 1; i <= count; i++) results.push(play(i * 104729 % 99991, size, difficulty));
    all.push(...results);
    const done = results.filter(r => r.finished), turns = results.reduce((s, r) => s + r.turns, 0) / results.length;
    const tally = (list, key) => list.reduce((o, r) => { o[key(r)] = (o[key(r)] || 0) + 1; return o; }, {});
    const sum = (list, key) => list.reduce((o, r) => { for (const [k, v] of Object.entries(r[key])) o[k] = (o[k] || 0) + v; return o; }, {});
    t.diagnostic(`${done.length}/${count} finished, ${turns.toFixed(1)} turns on average (most ${Math.max(...results.map(r => r.turns))}), ${results.reduce((s, r) => s + r.shots, 0)} shots, ${results.reduce((s, r) => s + r.drowned, 0)} capis into the water, ${results.reduce((s, r) => s + r.timeouts, 0)} turns timed out, ${((performance.now() - start) / 1000).toFixed(1)} s`);
    t.diagnostic(`endings ${JSON.stringify(tally(results, ending))}`);
    t.diagnostic(`weapons fired ${JSON.stringify(sum(results, 'used'))}; paint they put on rivals ${JSON.stringify(sum(results, 'painted'))}`);
    t.diagnostic(`bot thinking: ${(results.reduce((s, r) => s + r.think, 0) / results.length).toFixed(1)} ms a turn on average, ${Math.max(...results.map(r => r.slowest)).toFixed(0)} ms at most`);
    const kinds = {};
    for (const r of results) (kinds[r.kind] ||= []).push(r);
    t.diagnostic(Object.entries(kinds).map(([k, list]) => `${k}: ${list.length} matches, ${(list.reduce((s, r) => s + r.turns, 0) / list.length).toFixed(1)} turns, ${JSON.stringify(tally(list, ending))}`).join('; '));
    for (const r of results) {
      assert.ok(r.finished, `seed ${r.seed} (${r.kind}) still going after ${CAP} turns: ${r.left.join(' ')}`);
      // A bot always shoots: a turn that runs out of time means it got stuck.
      assert.ok(r.timeouts <= 1, `seed ${r.seed}: ${r.timeouts} turns ran out of time`);
      for (const team of [0, 1]) for (const [w, n] of Object.entries(r.ammo[team])) assert.ok(n >= 0, `seed ${r.seed}: team ${team} fired ${w} past its ammo`);
    }
  });
}

test('over every match, every weapon was fired and the last word was never a stall', () => {
  const used = {};
  for (const r of all) for (const [k, v] of Object.entries(r.used)) used[k] = (used[k] || 0) + v;
  for (const id of WEAPON_IDS) assert.ok(used[id] > 0, `${id} was never fired (${JSON.stringify(used)})`);
  assert.ok(all.length >= 100, `${all.length} matches`);
  assert.ok(all.filter(r => r.by === 'turns').length <= all.length * .2, 'most matches end with a team standing');
});
