import test from 'node:test';
import assert from 'node:assert/strict';
import { Arena, blocked, spawnsFor, boundsFor, coverFor, VARIANTS, RADIUS } from '../public/rules.js';
import { DOM_ZONES, DOM_RULES, ZONE_IDS, zonesFor, domStep, domOutcome, domBotGoal, zoneStatus, zoneCue, zoneOf } from '../public/domination.js';
import { PAINT_ARENAS } from '../../../engine/worlds/arena-layouts.js';
import { validOptions, DEFAULT_OPTIONS, teamPlay, livesOf, roundTime } from '../public/options.js';
import { race } from '../public/hud-model.js';
import { rng } from '../../../engine/random.js';

// Four panas, two a side (ids 1, 3 orange; 2, 4 turquoise), parked away from every zone.
function match(options = {}, map = 'plaza') {
  const g = new Arena(map, 'normal', { mode: 'dom', ...options });
  for (let id = 1; id <= 4; id++) g.add(id, { name: `Pana ${id}` });
  g.start(); g.go(); park(g); return g;
}
const park = g => g.players.forEach((p, i) => Object.assign(p, { x: -20 + i * 2, z: 24, shield: 0, respawn: 0 }));
const into = (g, p, id, dx = 0) => { const z = g.zones.find(q => q.id === id); return Object.assign(p, { x: z.x + dx, z: z.z }); };
const run = (g, seconds, dt = .05) => { for (let t = 0; t < seconds - 1e-9; t += dt) domStep(g, dt); };
const zone = (g, id) => g.zones.find(z => z.id === id);
const types = g => g.zoneEvents.map(e => `${e.type}:${e.zone}`);

test('every map has A, B and C: clear of cover in every layout, off the spawns, apart, B in the middle, reachable by both teams', () => {
  for (const { id } of PAINT_ARENAS) {
    const zones = DOM_ZONES[id];
    assert.equal(zones?.length, 3, `${id} has three zones`);
    const spawns = spawnsFor(id), team = t => spawns.filter((_, i) => i % 2 === t);
    const near = (pts, z) => Math.min(...pts.map(p => Math.hypot(p.x - z.x, p.z - z.z)));
    // Mean distance to a team's spawns: how far that team runs to a zone on average.
    const mean = (pts, z) => pts.reduce((sum, p) => sum + Math.hypot(p.x - z.x, p.z - z.z), 0) / pts.length;
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
      const d = Math.hypot(zones[i].x - zones[j].x, zones[i].z - zones[j].z);
      assert.ok(d >= 2 * DOM_RULES.radius + 6, `${id} ${ZONE_IDS[i]}-${ZONE_IDS[j]} are ${d.toFixed(1)} m apart (no overlap, room between)`);
    }
    zones.forEach((z, i) => assert.ok(near(spawns, z) >= DOM_RULES.radius + 4, `${id} zone ${ZONE_IDS[i]} is not on a spawn`));
    // A on orange's half, C on turquoise's, B about even.
    assert.ok(mean(team(0), zones[0]) + 4 < mean(team(1), zones[0]), `${id} A sits on orange's side`);
    assert.ok(mean(team(1), zones[2]) + 4 < mean(team(0), zones[2]), `${id} C sits on turquoise's side`);
    const mid = Math.abs(mean(team(0), zones[1]) - mean(team(1), zones[1]));
    assert.ok(mid <= 4, `${id} B is mid (mean spawn distance gap ${mid.toFixed(1)} m)`);
    const b = boundsFor(id);
    for (let variant = 0; variant < VARIANTS; variant++) {
      // The middle is open ground and most of the ring is walkable.
      zones.forEach((z, i) => {
        assert.equal(blocked(z.x, z.z, 1.6, id, variant), false, `${id}:${variant} zone ${ZONE_IDS[i]} middle clear of cover`);
        let n = 0, open = 0;
        for (let a = -DOM_RULES.radius; a <= DOM_RULES.radius; a += .5) for (let c = -DOM_RULES.radius; c <= DOM_RULES.radius; c += .5) if (a * a + c * c <= DOM_RULES.radius ** 2) { n++; if (!blocked(z.x + a, z.z + c, .3, id, variant)) open++; }
        assert.ok(open / n >= .7, `${id}:${variant} zone ${ZONE_IDS[i]} is ${Math.round(open / n * 100)}% walkable`);
        assert.ok(!coverFor(id, variant).some(o => Math.abs(z.x - o.x) < o.w / 2 && Math.abs(z.z - o.z) < o.d / 2), `${id}:${variant} zone ${ZONE_IDS[i]} not inside a hitbox`);
      });
      // A walkable 0.5 m grid flood-filled from each team's spawns reaches every zone.
      const step = .5, nx = Math.floor(b.x * 2 / step), nz = Math.floor(b.z * 2 / step), walk = new Uint8Array(nx * nz), seen = new Uint8Array(nx * nz);
      const cell = (x, z) => Math.floor((z + b.z) / step) * nx + Math.floor((x + b.x) / step);
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) walk[j * nx + i] = blocked(i * step + step / 2 - b.x, j * step + step / 2 - b.z, RADIUS, id, variant) ? 0 : 1;
      for (const t of [0, 1]) {
        seen.fill(0); const queue = team(t).map(p => cell(p.x, p.z)); queue.forEach(c => { seen[c] = 1; });
        while (queue.length) {
          const c = queue.pop(), i = c % nx, j = (c - i) / nx;
          for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, k = j + dj, n = k * nx + a; if (a >= 0 && k >= 0 && a < nx && k < nz && walk[n] && !seen[n]) { seen[n] = 1; queue.push(n); } }
        }
        zones.forEach((z, i) => assert.ok(seen[cell(z.x, z.z)], `${id}:${variant} team ${t} can walk to zone ${ZONE_IDS[i]}`));
      }
    }
  }
});

test('the lobby offers Dominación with its score and time limits; rounds are team rounds that always respawn', () => {
  assert.ok(validOptions({ mode: 'dom', domGoal: 300, flagTime: 900 }));
  assert.ok(validOptions({ mode: 'dom', domGoal: 100, flagTime: 300 }));
  assert.equal(validOptions({ domGoal: 250 }), false);
  assert.equal(DEFAULT_OPTIONS.domGoal, 200);
  const o = { mode: 'dom', lives: 3, flagTime: 600 }; assert.ok(teamPlay(o)); assert.equal(livesOf(o), 0); assert.equal(roundTime(o), 600);
  const g = match(); assert.equal(g.time, 600); assert.deepEqual(g.zones.map(z => z.id), ['A', 'B', 'C']);
  assert.deepEqual(g.zones.map(z => ({ x: z.x, z: z.z })), zonesFor('plaza'));
  assert.ok(g.zones.every(z => z.owner === null && z.progress === 0));
  assert.equal(match({ flagTime: 300 }).time, 300);
  // The race bar reads the points race.
  assert.deepEqual([race(g.view(), 1, 10).goal, race(g.view(), 1, 10).dom], [200, true]);
});

test('a lone team captures a neutral zone in the capture time', () => {
  const g = match(), [a] = g.players; into(g, a, 'B');
  run(g, DOM_RULES.captureTime - .1); assert.equal(zone(g, 'B').owner, null); assert.equal(zone(g, 'B').claim, 0);
  run(g, .2); assert.equal(zone(g, 'B').owner, 0); assert.deepEqual(types(g), ['captured:B']);
  assert.equal(a.captures, 1); assert.equal(g.message, 'El equipo {team} tomó la zona {zone}.'); assert.deepEqual(g.messageVars, { team: 'naranja', zone: 'B' });
});

test('more panas inside capture faster (+50% each, capped at 3×)', () => {
  const two = match(), [a, , c] = two.players; into(two, a, 'A'); into(two, c, 'A', 1);
  run(two, DOM_RULES.captureTime / 1.5 + .05); assert.equal(zone(two, 'A').owner, 0);
  assert.equal(a.captures, 1); assert.equal(c.captures, 1);
  const g = new Arena('plaza', 'normal', { mode: 'dom', bots: 0 }); for (let id = 1; id <= 8; id++) g.add(id, { name: `P${id}` }); g.start(); g.go();
  g.players.filter(p => p.team === 0).forEach((p, i) => into(g, p, 'C', i * .4 - .6)); g.players.filter(p => p.team === 1).forEach(p => Object.assign(p, { x: -20, z: 24 }));
  run(g, DOM_RULES.captureTime / 2.5 + .05); assert.equal(zone(g, 'C').owner, 0, 'four panas: 2.5×');
});

test('two teams inside contest the zone: progress freezes, nobody captures', () => {
  const g = match(), [a, b] = g.players; into(g, a, 'B'); run(g, 2);
  const before = zone(g, 'B').progress; into(g, b, 'B', 1); run(g, 10);
  assert.equal(zone(g, 'B').contested, true); assert.equal(zone(g, 'B').progress, before); assert.equal(zone(g, 'B').owner, null);
  assert.deepEqual(types(g), ['contested:B']);
  // The banner says so to both sides.
  assert.equal(zoneStatus(zone(g, 'B'), 0).kind, 'contested'); assert.equal(zoneCue(g.zoneEvents[0], 1), 'contested');
});

test('a rival owner\'s zone is neutralised first, then captured', () => {
  const g = match(), [a, b] = g.players; into(g, a, 'A'); run(g, DOM_RULES.captureTime + .1); park(g);
  into(g, b, 'A'); run(g, DOM_RULES.captureTime + .1);
  assert.equal(zone(g, 'A').owner, null); assert.equal(zone(g, 'A').claim, 1);
  assert.equal(zoneStatus(zone(g, 'A'), 1).kind, 'capturing'); assert.equal(zoneStatus(zone(g, 'A'), 0).kind, 'neutralizing');
  run(g, DOM_RULES.captureTime + .1); assert.equal(zone(g, 'A').owner, 1);
  assert.deepEqual(types(g), ['captured:A', 'neutral:A', 'captured:A']);
  assert.deepEqual(g.zoneEvents.map(e => zoneCue(e, 0)), ['captured', 'lost', 'lost']);
});

test('an empty zone keeps its last owner and keeps paying', () => {
  const g = match(), [a] = g.players; into(g, a, 'C'); run(g, DOM_RULES.captureTime + .1); park(g);
  const score = g.teamScores[0]; run(g, 30);
  assert.equal(zone(g, 'C').owner, 0); assert.equal(g.teamScores[0], score + 30);
});

test('points: one per owned zone per second, summed per team', () => {
  const g = match(), [a, b] = g.players;
  Object.assign(zone(g, 'A'), { owner: 0, claim: 0, progress: 1 }); Object.assign(zone(g, 'C'), { owner: 0, claim: 0, progress: 1 }); Object.assign(zone(g, 'B'), { owner: 1, claim: 1, progress: 1 });
  run(g, 10); assert.deepEqual(g.teamScores, [20, 10]);
  // Paint knockouts score for the pana, never for the team.
  g.hit(b, a, a.color, {}, Infinity); assert.equal(a.score, 1); assert.deepEqual(g.teamScores, [20, 10]);
});

test('the score limit ends the round for the team that reached it', () => {
  const g = match({ domGoal: 100 });
  for (const z of g.zones) Object.assign(z, { owner: 0, claim: 0, progress: 1 });
  g.teamScores = [97, 40]; g.step(.05); assert.equal(g.phase, 'playing');
  for (let i = 0; i < 40 && g.phase === 'playing'; i++) g.step(.05);
  assert.equal(g.phase, 'finished'); assert.deepEqual(g.outcome, { winner: 0, reason: 'limit' }); assert.deepEqual(g.winners(), [1, 3]);
  assert.deepEqual(g.view().outcome, g.outcome); assert.equal(g.view().zones.length, 3);
});

test('time up: higher score wins; a tie goes to more zones held now; else a draw', () => {
  const end = setup => { const g = match(); park(g); setup(g); g.time = .01; g.step(.05); assert.equal(g.phase, 'finished'); assert.equal(g.outcome.reason, 'time'); return g; };
  assert.deepEqual(end(g => { g.teamScores = [50, 80]; }).winners(), [2, 4]);
  assert.deepEqual(end(g => { g.teamScores = [80, 80]; zone(g, 'A').owner = 0; zone(g, 'B').owner = 1; zone(g, 'C').owner = 1; g.domBank = [0, 0]; }).outcome.winner !== null, true);
  const tie = end(g => { g.teamScores = [80, 80]; g.domBank = [0, 0]; Object.assign(zone(g, 'B'), { owner: 1, claim: 1, progress: 1 }); });
  // B paid turquoise a fraction this last tick at most; zones held decides even if points tie.
  assert.deepEqual(tie.winners(), [2, 4]);
  const draw = end(g => { g.teamScores = [80, 80]; });
  assert.equal(draw.outcome.winner, null); assert.deepEqual(draw.winners(), [1, 2, 3, 4]);
  assert.equal(domOutcome(match()), null);
});

test('a painted or disconnected pana leaves the zone at once', () => {
  const g = match(), [a, b] = g.players; into(g, a, 'B'); into(g, b, 'B', 1); run(g, 1);
  assert.equal(zone(g, 'B').contested, true);
  g.hit(b, a, a.color, {}, Infinity); assert.ok(b.respawn > 0); assert.equal(zoneOf(g.zones, b), null);
  run(g, DOM_RULES.captureTime + .1); assert.equal(zone(g, 'B').owner, 0);
  const h = match(), [x, y] = h.players; into(h, x, 'A'); into(h, y, 'A', 1); run(h, 1); y.connected = false;
  run(h, DOM_RULES.captureTime + .1); assert.equal(zone(h, 'A').owner, 0);
});

test('a new round and the lobby reset the zones, the points and the bank', () => {
  const g = match(), [a] = g.players; into(g, a, 'A'); run(g, DOM_RULES.captureTime + 3.5); g.phase = 'finished';
  assert.ok(g.teamScores[0] > 0);
  assert.ok(g.toLobby()); assert.deepEqual(g.zones, []); assert.deepEqual(g.teamScores, [0, 0]); assert.equal(g.outcome, null); assert.equal(g.time, 600);
  assert.ok(g.start()); assert.ok(g.zones.every(z => z.owner === null && z.progress === 0 && !z.contested)); assert.deepEqual(g.zoneEvents, []); assert.deepEqual(g.domBank, [0, 0]);
  // Lives never apply: a domination round always respawns.
  const lives = match({ lives: 1 }), [p, q] = lives.players; lives.hit(q, p, p.color, {}, Infinity); lives.step(.05);
  assert.equal(q.eliminated, false); assert.equal(lives.phase, 'playing');
});

test('bots: capturers split over zones they do not own, a defender answers an attacked zone, support helps', () => {
  const g = new Arena('plaza', 'normal', { mode: 'dom', bots: 7 }); g.add(1, { name: 'Ana' });
  g.seatBots(i => ({ name: `Bot ${i}` })); g.start(); g.go();
  const team = t => g.players.filter(p => p.bot && p.team === t).sort((a, b) => a.id - b.id);
  const [first, defender, second, support] = team(1);
  const goal = p => { const z = domBotGoal(g, p); return g.zones.find(q => q.x === z?.x && q.z === z?.z)?.id || null; };
  assert.notEqual(goal(first), goal(second), 'the two capturers go to different zones');
  assert.ok(['A', 'B', 'C'].includes(goal(defender)));
  // Turquoise holds all three; orange steps into C: defender and support answer.
  for (const z of g.zones) Object.assign(z, { owner: 1, claim: 1, progress: 1 });
  const thief = g.players.find(p => p.team === 0); into(g, thief, 'C'); Object.assign(thief, { respawn: 0 });
  assert.equal(goal(defender), 'C'); assert.equal(goal(support), 'C');
  // Capturers with nothing left to take hunt rivals instead.
  assert.equal(domBotGoal(g, first), null);
  // Inside its target zone a bot fights instead of walking (goal radius).
  assert.ok(domBotGoal(g, defender).near > 0 && domBotGoal(g, defender).near < DOM_RULES.radius);
});

test('a bots-only round plays to the end with captures', () => {
  const g = new Arena('puerto', 'facil', { mode: 'dom', bots: 7, domGoal: 100, flagTime: 300 }); g.add(1, { name: 'Ana' }); g.random = rng(7);
  g.seatBots(i => ({ name: `Bot ${i}` })); g.players[0].bot = true; g.start(); g.go();
  let n = 0, captures = 0;
  for (; n < 20 * 301 && g.phase === 'playing'; n++) { const seen = g.zoneSerial; g.step(.05); captures += g.zoneEvents.filter(e => e.n > seen && e.type === 'captured').length; }
  assert.equal(g.phase, 'finished', `ended after ${n * .05} s`);
  assert.ok(captures >= 3, `${captures} captures`); assert.ok(g.outcome && Math.max(...g.teamScores) > 0, JSON.stringify(g.outcome));
});
