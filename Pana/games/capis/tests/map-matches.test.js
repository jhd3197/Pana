// Whole matches on generated maps, machine against machine through the pure
// rules, with the whole arsenal, at every difficulty: every match ends (a
// winner, a draw, or the turn limit's verdict when the teams cannot get at
// each other) and few at the limit, no bot gets stuck, ammo running out never
// stalls a match (La Piñita never runs out), and the bots mix their weapons.
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
  let shots = 0, timeouts = 0, drowned = 0, think = 0, slowest = 0, turn = m.turn.n, turnMs = 0, hits = 0;
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
      if (e.type === 'hit' && e.team !== e.by) { painted[e.weapon] = (painted[e.weapon] || 0) + e.paint; hits++; }
    }
  }
  return { seed, size, kind: m.map.kind, finished: m.phase === 'finished', winner: m.winner, by: m.endedBy, turns: m.turn.n, shots, timeouts, drowned,
    used: { ...m.used }, painted, hits, think: think / m.turn.n, slowest, ammo: m.ammo, left: m.capys.filter(c => !c.out).map(c => `${c.id}@${c.x.toFixed(1)}`) };
}

const ending = r => (!r.finished ? 'unfinished' : r.winner === -1 ? 'draw' : `team ${r.winner}`) + (r.by === 'turns' ? ' at the limit' : '');
const SIZES = ['small', 'medium', 'large'];
const all = [];
// Every difficulty on every map size and kind: 40 fácil, 30 normal, 40 experto. A match at
// the turn limit is decided by who is left, so a few are allowed (a pit or a pillar the
// jump cannot leave); over the bigger sweep (tools, 330 matches) it stays at or under 5 %
// for each difficulty. Here a seed or two of slack, as any tuning moves single seeds.
for (const [difficulty, count] of [['facil', 40], ['normal', 30], ['experto', 40]]) {
  test(`${count} ${difficulty} matches on every map size: every match finishes, few at the turn limit, with every weapon`, t => {
    const start = performance.now(), results = [];
    for (let i = 1; i <= count; i++) results.push(play((i * 104729 + difficulty.length * 7) % 99991, SIZES[i % 3], difficulty));
    all.push(...results.map(r => ({ ...r, difficulty })));
    const done = results.filter(r => r.finished), turns = results.reduce((s, r) => s + r.turns, 0) / results.length;
    const tally = (list, key) => list.reduce((o, r) => { o[key(r)] = (o[key(r)] || 0) + 1; return o; }, {});
    const sum = (list, key) => list.reduce((o, r) => { for (const [k, v] of Object.entries(r[key])) o[k] = (o[k] || 0) + v; return o; }, {});
    const limit = results.filter(r => r.by === 'turns');
    t.diagnostic(`${done.length}/${count} finished, ${turns.toFixed(1)} turns on average (most ${Math.max(...results.map(r => r.turns))}), ${limit.length} at the turn limit, ${results.reduce((s, r) => s + r.shots, 0)} shots, ${results.reduce((s, r) => s + r.drowned, 0)} capis into the water, ${results.reduce((s, r) => s + r.timeouts, 0)} turns timed out, ${((performance.now() - start) / 1000).toFixed(1)} s`);
    t.diagnostic(`endings ${JSON.stringify(tally(results, ending))}; at the limit: ${limit.map(r => `${r.seed}/${r.size}/${r.kind}`).join(' ') || 'none'}`);
    t.diagnostic(`weapons fired ${JSON.stringify(sum(results, 'used'))}; paint they put on rivals ${JSON.stringify(sum(results, 'painted'))}; hits on rivals a shot ${(results.reduce((s, r) => s + r.hits, 0) / results.reduce((s, r) => s + r.shots, 0)).toFixed(2)}`);
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
    assert.ok(limit.length <= Math.ceil(count * .05) + 1, `${limit.length}/${count} ${difficulty} matches reached the turn limit`);
  });
}

test('over every match: a healthy mix of weapons, easy bots easier than experto', () => {
  assert.ok(all.length >= 100, `${all.length} matches`);
  const used = {}, shots = all.reduce((s, r) => s + r.shots, 0);
  for (const r of all) for (const [k, v] of Object.entries(r.used)) used[k] = (used[k] || 0) + v;
  for (const id of WEAPON_IDS) assert.ok(used[id] > 0, `${id} was never fired (${JSON.stringify(used)})`);
  // La Piñita never runs out, but it is not the default: no weapon is most of the shots.
  for (const [id, n] of Object.entries(used)) assert.ok(n / shots <= .58, `${id} is ${(n / shots * 100).toFixed(1)} % of the shots (${JSON.stringify(used)})`);
  assert.ok(used.scatter / shots >= .04, `El Trueno is ${(used.scatter / shots * 100).toFixed(1)} % of the shots`);
  // Its scarce shots get spent: most of La Bazuca's, and a good share of the rest.
  const offered = id => all.reduce((s, r) => s + 2 * RULES.ammo[id], 0);
  assert.ok(used.bazooka / offered('bazooka') >= .8, `La Bazuca: ${used.bazooka}/${offered('bazooka')} shots spent`);
  const paintOf = d => { const list = all.filter(r => r.difficulty === d); return list.reduce((s, r) => s + Object.values(r.painted).reduce((a, b) => a + b, 0), 0) / list.reduce((s, r) => s + r.shots, 0); };
  assert.ok(paintOf('facil') < paintOf('experto'), `paint on rivals a shot: fácil ${paintOf('facil').toFixed(1)}, experto ${paintOf('experto').toFixed(1)}`);
});
