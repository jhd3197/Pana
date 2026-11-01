import test from 'node:test';
import assert from 'node:assert/strict';
import { Arena, blocked, spawnsFor, boundsFor, VARIANTS, RADIUS } from '../public/rules.js';
import { FLAG_STANDS, standsFor, ctfStep, ctfOutcome, ctfGoal, CTF_RULES } from '../public/ctf.js';
import { createFlag, stepFlags, takeFlag } from '../../../engine/play/objectives.js';
import { PAINT_ARENAS } from '../../../engine/worlds/arena-layouts.js';
import { validOptions, DEFAULT_OPTIONS } from '../public/options.js';

// Four panas, two a side (ids 1, 3 orange; 2, 4 turquoise), parked far from the flags.
function match(options = {}, map = 'plaza') {
  const g = new Arena(map, 'normal', { mode: 'ctf', lives: 0, ...options });
  for (let id = 1; id <= 4; id++) g.add(id, { name: `Pana ${id}` });
  g.start(); g.go(); park(g); return g;
}
const park = g => g.players.forEach((p, i) => Object.assign(p, { x: -6 + i * 4, z: 0, shield: 0, respawn: 0 }));
const at = (p, x, z) => Object.assign(p, { x, z });
const stand = (g, team) => ({ x: g.flags[team].homeX, z: g.flags[team].homeZ });
const types = g => g.flagEvents.map(e => e.type);

test('every map has both stands, open in every layout, reachable from the team spawns and far apart', () => {
  for (const { id } of PAINT_ARENAS) {
    const stands = FLAG_STANDS[id];
    assert.ok(stands?.length === 2, `${id} has two stands`);
    assert.ok(Math.hypot(stands[0].x - stands[1].x, stands[0].z - stands[1].z) >= 30, `${id} stands are 30 m apart or more`);
    const b = boundsFor(id);
    for (let variant = 0; variant < VARIANTS; variant++) {
      // A walkable 0.5 m grid flood-filled from the team's spawns.
      const step = .5, nx = Math.floor(b.x * 2 / step), nz = Math.floor(b.z * 2 / step), open = new Uint8Array(nx * nz), seen = new Uint8Array(nx * nz);
      const cell = (x, z) => Math.floor((z + b.z) / step) * nx + Math.floor((x + b.x) / step);
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) open[j * nx + i] = blocked(i * step + step / 2 - b.x, j * step + step / 2 - b.z, RADIUS, id, variant) ? 0 : 1;
      stands.forEach((s, team) => {
        assert.equal(blocked(s.x, s.z, CTF_RULES.capture * .7, id, variant), false, `${id}:${variant} stand ${team} clear of cover`);
        const spawns = spawnsFor(id).filter((_, i) => i % 2 === team);
        const nearest = Math.min(...spawns.map(p => Math.hypot(p.x - s.x, p.z - s.z)));
        assert.ok(nearest >= 4 && nearest <= 12, `${id} stand ${team} sits near its spawns, not on them (${nearest.toFixed(1)} m)`);
        seen.fill(0); const queue = spawns.map(p => cell(p.x, p.z)); queue.forEach(c => { seen[c] = 1; });
        while (queue.length) {
          const c = queue.pop(), i = c % nx, j = (c - i) / nx;
          for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, k = j + dj, n = k * nx + a; if (a >= 0 && k >= 0 && a < nx && k < nz && open[n] && !seen[n]) { seen[n] = 1; queue.push(n); } }
        }
        for (const target of stands) assert.ok(seen[cell(target.x, target.z)], `${id}:${variant} team ${team} can walk to the stand at ${target.x},${target.z}`);
      });
    }
  }
});

test('the lobby offers the mode with its score and time limits', () => {
  assert.ok(validOptions({ mode: 'ctf', flagGoal: 5, flagTime: 900 }));
  assert.equal(validOptions({ flagGoal: 4 }), false);
  assert.equal(DEFAULT_OPTIONS.flagGoal, 3); assert.equal(DEFAULT_OPTIONS.flagTime, 600);
  const g = match(); assert.equal(g.time, 600); assert.deepEqual(stand(g, 0), standsFor('plaza')[0]);
  assert.equal(match({ flagTime: 300 }).time, 300);
});

test('touching the rival flag lifts it; your own flag at its stand stays put', () => {
  const g = match(), [a, b] = g.players;
  at(a, stand(g, 0).x, stand(g, 0).z); ctfStep(g, .05); assert.equal(g.flags[0].state, 'home'); assert.deepEqual(types(g), []);
  at(a, stand(g, 1).x + 1, stand(g, 1).z); ctfStep(g, .05);
  assert.equal(g.flags[1].state, 'carried'); assert.equal(g.flags[1].carrier, a.id); assert.deepEqual(types(g), ['pickup']);
  assert.equal(g.message, '{name} tomó la bandera {flag}.');
  // The flag rides with its carrier.
  at(a, 5, 5); ctfStep(g, .05); assert.deepEqual([g.flags[1].x, g.flags[1].z], [5, 5]);
  assert.equal(b.team, 1);
});

test('a capture needs your own flag home, scores one and resets the flag', () => {
  const g = match(), [a, b] = g.players;
  at(a, stand(g, 1).x, stand(g, 1).z); ctfStep(g, .05);
  at(b, stand(g, 0).x, stand(g, 0).z); ctfStep(g, .05); assert.equal(g.flags[0].carrier, b.id);
  // Both carriers home, both flags away: nobody scores.
  at(a, stand(g, 0).x, stand(g, 0).z); at(b, stand(g, 1).x, stand(g, 1).z); ctfStep(g, .05);
  assert.deepEqual(g.teamScores, [0, 0]);
  // b is painted out: the orange flag drops where b stood; a returns it by touching, then captures.
  g.hit(b, a, a.color, {}, Infinity); assert.equal(g.flags[0].state, 'dropped'); assert.deepEqual([g.flags[0].x, g.flags[0].z], [b.x, b.z]);
  ctfStep(g, .05); assert.deepEqual(g.teamScores, [0, 0]);
  const c = g.players[2]; at(c, b.x, b.z); ctfStep(g, .05); assert.equal(g.flags[0].state, 'home');
  at(c, 0, 10); ctfStep(g, .05);
  assert.deepEqual(g.teamScores, [1, 0]); assert.equal(g.flags[1].state, 'home'); assert.equal(a.captures, 1); assert.equal(c.returns, 1);
  assert.deepEqual(types(g), ['pickup', 'pickup', 'drop', 'return', 'capture']);
});

test('a rival touching a dropped flag lifts it again; a dropped flag goes home after 30 s', () => {
  const g = match(), [a, b] = g.players;
  at(a, stand(g, 1).x, stand(g, 1).z); ctfStep(g, .05); at(a, 0, 3); g.hit(a, b, b.color, {}, Infinity);
  assert.equal(g.flags[1].state, 'dropped'); assert.equal(a.respawn > 0, true);
  const c = g.players[2]; at(c, 0, 3.5); ctfStep(g, .05); assert.equal(g.flags[1].carrier, c.id);
  g.hit(c, b, b.color, {}, Infinity); at(c, 20, 0);
  for (let t = 0; t < CTF_RULES.returnAfter - .2; t += .05) ctfStep(g, .05);
  assert.equal(g.flags[1].state, 'dropped');
  for (let i = 0; i < 6; i++) ctfStep(g, .05);
  assert.equal(g.flags[1].state, 'home'); assert.equal(g.flagEvents.at(-1).auto, true); assert.equal(g.message, 'La bandera {flag} volvió a su base.');
});

test('simultaneous contact: the defender\'s return beats the attacker\'s pickup; the nearest rival lifts first', () => {
  const flags = [createFlag(0, { x: -20, z: 0 }), createFlag(1, { x: 20, z: 0 })];
  Object.assign(flags[0], { state: 'dropped', x: 0, z: 0 });
  stepFlags(flags, [{ id: 2, team: 1, x: .2, z: 0, alive: true }, { id: 1, team: 0, x: 1, z: 0, alive: true }], .05);
  assert.equal(flags[0].state, 'home');
  const e = stepFlags(flags, [{ id: 5, team: 0, x: 20.8, z: 0, alive: true }, { id: 4, team: 0, x: 20.3, z: 0, alive: true }], .05);
  assert.equal(flags[1].carrier, 4); assert.equal(e.length, 1);
  // A dead pana touches nothing.
  const fresh = [createFlag(0, { x: -20, z: 0 }), createFlag(1, { x: 20, z: 0 })];
  assert.deepEqual(stepFlags(fresh, [{ id: 7, team: 0, x: 20, z: 0, alive: false }], .05), []);
});

test('a carrier who disconnects drops the flag where they were', () => {
  const g = match(), [a] = g.players;
  at(a, stand(g, 1).x, stand(g, 1).z); ctfStep(g, .05); at(a, 4, 4); ctfStep(g, .05);
  a.connected = false; g.step(.05);
  assert.equal(g.flags[1].state, 'dropped'); assert.deepEqual([g.flags[1].x, g.flags[1].z], [4, 4]);
});

test('the score limit ends the round for the team that reached it', () => {
  const g = match({ flagGoal: 1 }), [a] = g.players;
  at(a, stand(g, 1).x, stand(g, 1).z); g.step(.05); at(a, stand(g, 0).x, stand(g, 0).z); g.step(.05);
  assert.equal(g.phase, 'finished'); assert.deepEqual(g.outcome, { winner: 0, reason: 'limit' }); assert.deepEqual(g.winners(), [1, 3]);
  assert.deepEqual(g.view().outcome, g.outcome);
});

test('time up: more captures wins, a tie goes to the flag at home, then to fewer flags taken, else a draw', () => {
  const end = (setup) => { const g = match(); setup(g); g.time = .01; g.step(.05); assert.equal(g.phase, 'finished'); return g; };
  assert.deepEqual(end(g => { g.teamScores = [1, 2]; }).winners(), [2, 4]);
  // Tied, and turquoise's flag is out on the field: orange keeps the round.
  assert.deepEqual(end(g => { g.teamScores = [1, 1]; takeFlag(g.flags[1], g.players[0]); Object.assign(g.flags[1], { state: 'dropped', x: 0, z: 30 }); }).winners(), [1, 3]);
  // Both home, orange's was taken more often.
  assert.deepEqual(end(g => { g.teamScores = [1, 1]; g.flags[0].taken = 3; g.flags[1].taken = 1; }).winners(), [2, 4]);
  const draw = end(g => { g.teamScores = [2, 2]; });
  assert.equal(draw.outcome.winner, null); assert.deepEqual(draw.winners(), [1, 2, 3, 4]);
  assert.equal(ctfOutcome(match()), null);
});

test('a new round and the lobby reset the flags and the scores', () => {
  const g = match(), [a] = g.players;
  at(a, stand(g, 1).x, stand(g, 1).z); ctfStep(g, .05); g.teamScores = [2, 1]; g.phase = 'finished';
  assert.ok(g.toLobby()); assert.deepEqual(g.flags, []); assert.deepEqual(g.teamScores, [0, 0]); assert.equal(g.outcome, null); assert.equal(g.time, 600);
  assert.ok(g.start()); assert.ok(g.flags.every(f => f.state === 'home' && f.taken === 0)); assert.deepEqual(g.flagEvents, []);
});

test('paint kills still count for players but not for the team score', () => {
  const g = match(), [a, b] = g.players;
  g.hit(b, a, a.color, {}, Infinity); assert.equal(a.score, 1); assert.deepEqual(g.teamScores, [0, 0]);
  // Lives never apply: a flag round always respawns.
  const lives = match({ lives: 1 }), [x, y] = lives.players; lives.hit(y, x, x.color, {}, Infinity); lives.step(.05);
  assert.equal(y.eliminated, false); assert.equal(lives.phase, 'playing');
});

test('bots: a carrier runs home, defenders return a dropped flag and chase a carrier, the rest attack or escort', () => {
  const g = new Arena('plaza', 'normal', { mode: 'ctf', lives: 0, bots: 7 }); g.add(1, { name: 'Ana' });
  g.seatBots(i => ({ name: `Bot ${i}` })); g.start(); g.go();
  const team = t => g.players.filter(p => p.bot && p.team === t).sort((a, b) => a.id - b.id);
  const [attacker, defender, second, escort] = team(1), guard = team(0)[1];
  assert.deepEqual(ctfGoal(g, attacker), { x: stand(g, 0).x, z: stand(g, 0).z, near: 0 });
  assert.equal(ctfGoal(g, defender).near, 7);
  at(attacker, 0, -10); takeFlag(g.flags[0], attacker);
  assert.deepEqual(ctfGoal(g, attacker), { x: stand(g, 1).x, z: stand(g, 1).z, near: 0 });
  assert.deepEqual(ctfGoal(g, escort), { x: 0, z: -10, near: 5 }); assert.equal(ctfGoal(g, second).near, 5);
  assert.deepEqual(ctfGoal(g, guard), { x: 0, z: -10, near: 4 }, 'a defender chases the carrier');
  Object.assign(g.flags[1], { state: 'dropped', x: 3, z: 3 });
  assert.deepEqual(ctfGoal(g, defender), { x: 3, z: 3, near: 0 });
});

test('a bots-only round plays to the end: flags are captured', () => {
  const g = new Arena('plaza', 'facil', { mode: 'ctf', lives: 0, bots: 7, flagGoal: 1 }); g.add(1, { name: 'Ana' });
  g.seatBots(i => ({ name: `Bot ${i}` })); g.players[0].connected = false; g.start(); g.go();
  let n = 0; for (; n < 20 * 300 && g.phase === 'playing'; n++) g.step(.05);
  assert.equal(g.phase, 'finished', `ended after ${n * .05} s`);
  assert.ok(g.flagEvents.some(e => e.type === 'capture') || g.outcome.reason === 'time');
});
