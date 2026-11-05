// Todos contra todos: six capis each on its own side, spread over the big map;
// the last one standing wins, every side has its own shots, and a room seats
// each pana on its own capi with the machine playing the rest.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, tickMatch, takeEvents, activeCapy, explode, byCount, ammoLeft, fire, TEAM_COLORS, FFA_CAPIS, RULES } from '../public/rules.js';
import { generateMap, spreadSpawns, MAP_SIZES, WATER } from '../public/map-rules.js';
import { createBot, behindOf } from '../public/bot.js';
import { CapisTable, botTeams, controllerOf, mirror, sidesOf } from '../public/online.js';
import { defaultOptions, roomOptions } from '../public/options.js';
import { surfaceY, fillHeights } from '../../../engine/play/terrain-mask.js';

const DT = 1 / 60;
const wire = x => JSON.parse(JSON.stringify(x));
const ffa = (seed = 6, extra = {}) => createMatch({ seed, mode: 'ffa', ...extra });
// Takes the turn to the next one, nobody shooting.
function pass(m) { const n = m.turn.n; m.turn.time = 0; for (let i = 0; i < 60 * 8 && m.turn.n === n && m.phase !== 'finished'; i++) tickMatch(m, DT, {}); }

test('the option is there, Equipos by default; todos contra todos forces the big map', () => {
  assert.equal(defaultOptions().mode, 'teams');
  const next = roomOptions({ ...defaultOptions(), size: 'small' }, { mode: 'ffa' });
  assert.equal(next.mode, 'ffa'); assert.equal(next.size, 'large');
  assert.equal(roomOptions(next, { size: 'small' }).size, 'large', 'the big map stays while it is todos contra todos');
  assert.equal(roomOptions(next, { mode: 'teams' }).mode, 'teams');
  assert.equal(roomOptions(defaultOptions(), { mode: 'nope' }), null);
});

test('six capis, each its own side and colour, on the large map, whatever size was asked for', () => {
  const m = ffa(6, { size: 'small' });
  assert.equal(m.map.size, 'large'); assert.equal(m.map.width, MAP_SIZES.large.width);
  assert.equal(m.teams, 6); assert.equal(m.capys.length, FFA_CAPIS);
  assert.deepEqual(m.capys.map(c => c.team), [0, 1, 2, 3, 4, 5]);
  assert.equal(new Set(m.capys.map(c => c.name)).size, 6, 'six names');
  assert.equal(new Set(m.capys.map(c => TEAM_COLORS[c.team])).size, 6, 'six colours');
  assert.equal(m.ammo.length, 6);
  const teams = createMatch({ seed: 6 });
  assert.equal(teams.teams, 2); assert.equal(teams.capys.length, 6); assert.equal(teams.ammo.length, 2);
});

test('spawns are spread over the whole map, not two clumps, on every kind of ground', () => {
  const kinds = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    const { map, mask } = generateMap(seed, 'large'), xs = spreadSpawns(map, mask), sorted = [...xs].sort((a, b) => a - b);
    kinds.add(map.kind);
    assert.equal(xs.length, 6);
    assert.ok(sorted.at(-1) - sorted[0] > map.width * .55, `seed ${seed} ${map.kind}: they cover ${(sorted.at(-1) - sorted[0]).toFixed(0)} of ${map.width}`);
    for (let i = 1; i < 6; i++) assert.ok(sorted[i] - sorted[i - 1] >= 10, `seed ${seed} ${map.kind}: ${sorted[i - 1].toFixed(1)} and ${sorted[i].toFixed(1)} are too close`);
    for (const x of xs) assert.ok(surfaceY(mask, x) > WATER, `seed ${seed}: dry at ${x.toFixed(1)}`);
    assert.deepEqual(xs, spreadSpawns(map, mask), 'the same on every copy');
  }
  assert.ok(kinds.size >= 4, [...kinds].join());
});

test('a free-for-all map is never cuevas or islas, seats six capis on the large map, and teams still get every kind', () => {
  const kinds = new Set(), teamKinds = new Set();
  for (let seed = 1; seed <= 60; seed++) {
    const m = ffa(seed), xs = m.capys.map(c => c.x).sort((a, b) => a - b);
    kinds.add(m.map.kind);
    assert.ok(!['cuevas', 'islas'].includes(m.map.kind), `seed ${seed}: ${m.map.kind}`);
    assert.equal(m.map.size, 'large');
    assert.equal(m.capys.length, FFA_CAPIS);
    assert.equal(FFA_CAPIS, 6);
    assert.ok(xs.at(-1) - xs[0] > m.map.width * .55, `seed ${seed} ${m.map.kind}: they cover ${(xs.at(-1) - xs[0]).toFixed(0)} of ${m.map.width}`);
    for (let i = 1; i < 6; i++) assert.ok(xs[i] - xs[i - 1] >= 10, `seed ${seed} ${m.map.kind}: ${xs[i - 1].toFixed(1)} and ${xs[i].toFixed(1)} are too close`);
    for (const c of m.capys) assert.ok(c.y > WATER, `seed ${seed}: dry at ${c.x.toFixed(1)}`);
    const t = createMatch({ seed, size: 'large' });
    teamKinds.add(t.map.kind);
    assert.equal(t.mode, 'teams'); assert.equal(t.teams, 2); assert.equal(t.capys.length, 6);
    assert.equal(t.map.spawns.length, 2);
  }
  assert.ok(kinds.size >= 3, [...kinds].join());
  assert.ok(teamKinds.has('cuevas') && teamKinds.has('islas'), `teams still get them: ${[...teamKinds].join()}`);
});

test('every copy of a room builds the same free-for-all map from the seed', () => {
  const t = new CapisTable({ seed: 6, options: { ...defaultOptions(), mode: 'ffa' } });
  t.addPlayer(1, 'Ana'); t.start();
  const { view } = mirror(null, wire(t.snapshot()));
  assert.equal(view.map.kind, t.match.map.kind);
  assert.ok(!['cuevas', 'islas'].includes(view.map.kind));
  assert.ok(Buffer.from(view.mask.solid).equals(Buffer.from(t.match.mask.solid)), 'the same ground');
});

test('the turn goes round every side still standing', () => {
  const m = ffa(), order = [m.turn.team];
  for (let i = 0; i < 6; i++) { pass(m); order.push(m.turn.team); }
  assert.deepEqual(order, [0, 1, 2, 3, 4, 5, 0]);
  m.capys[1].out = 'paint'; m.capys[3].out = 'water';
  const after = [];
  for (let i = 0; i < 4; i++) { pass(m); after.push(m.turn.team); }
  assert.deepEqual(after, [2, 4, 5, 0], 'the ones out are skipped');
});

test('the last capi standing wins, no team-mates to wait for; everyone out is a draw', () => {
  const m = ffa();
  for (const c of m.capys) if (c.team !== 4) c.out = 'paint';
  takeEvents(m); pass(m);
  assert.equal(m.phase, 'finished'); assert.equal(m.winner, 4);
  assert.deepEqual(takeEvents(m).filter(e => e.type === 'finished').map(e => e.winner), [4]);
  const none = ffa();
  for (const c of none.capys) c.out = 'paint';
  pass(none);
  assert.equal(none.winner, -1);
  // Two left: not over yet.
  const two = ffa();
  for (const c of two.capys) if (c.team > 1) c.out = 'paint';
  pass(two);
  assert.notEqual(two.phase, 'finished');
});

test('at the turn limit: most capis, then least paint, and a tie is a draw', () => {
  const m = ffa();
  m.capys.forEach(c => { if (c.team < 3) c.out = 'paint'; });
  m.capys[3].paint = 40; m.capys[4].paint = 10; m.capys[5].paint = 70;
  assert.equal(byCount(m), 4);
  m.capys[3].paint = 10;
  assert.equal(byCount(m), -1);
  const teams = createMatch({ seed: 6 });
  teams.capys.find(c => c.team === 1).out = 'paint';
  assert.equal(byCount(teams), 0, 'two teams count capis as before');
  assert.ok(RULES.ffaTurnLimit > RULES.turnLimit);
});

test('each side has its own shots, and a blast paints in the colour of its side', () => {
  const m = ffa();
  assert.equal(ammoLeft(m, 0, 'bazooka'), RULES.ammo.bazooka);
  fire(m, .5);
  assert.equal(ammoLeft(m, 0, 'bazooka'), RULES.ammo.bazooka - 1);
  assert.equal(ammoLeft(m, 3, 'bazooka'), RULES.ammo.bazooka, 'another capi has its own');
  const n = ffa();
  fillHeights(n.mask, () => 12);
  const target = n.capys[5]; target.x = 40; target.y = 12; target.grounded = true; takeEvents(n);
  explode(n, 40, 12.5, 2);
  assert.equal(target.by, 2, 'it soaks up the colour of who hit it');
  assert.ok(n.mask.tint.some(v => v === 2), 'the ground takes that paint');
});

test('a bot takes any other capi for a rival and plays a free-for-all to an end', { timeout: 200000 }, () => {
  const m = ffa(6, { seconds: 30 }), bots = Array.from({ length: 6 }, (_, team) => createBot({ team, difficulty: 'experto', seed: 40 + team }));
  const targets = new Set();
  for (let i = 0; i < 60 * 60 * 40 && m.phase !== 'finished'; i++) {
    tickMatch(m, DT, bots[m.turn.team].input(m));
    for (const e of takeEvents(m)) if (e.type === 'hit' && e.team !== e.by) targets.add(`${e.by}>${e.team}`);
  }
  assert.equal(m.phase, 'finished', `over by turn ${m.turn.n}`);
  assert.ok(m.winner === -1 || m.capys.filter(c => !c.out).every(c => c.team === m.winner) || m.endedBy === 'turns');
  assert.ok(targets.size >= 3, `hits between several capis: ${[...targets].join(' ')}`);
});

test('behind: fewer capis than some other side, or as many with clearly more paint', () => {
  const m = ffa();
  assert.equal(behindOf(m, 0), false);
  m.capys[0].paint = 50;
  assert.equal(behindOf(m, 0), true);
});

test('a room seats each pana on its own capi; the machine plays the rest; a copy keeps up', () => {
  const t = new CapisTable({ seed: 6, options: { ...defaultOptions(), seconds: 30 } });
  ['Ana', 'Beto', 'Caro'].forEach((name, i) => t.addPlayer(i + 1, name));
  assert.deepEqual(t.players.map(p => p.team), [0, 1, 0], 'teams at first');
  assert.equal(t.configure({ mode: 'ffa' }), true);
  assert.deepEqual(t.players.map(p => p.team), [0, 1, 2], 'one capi each');
  assert.equal(t.options.size, 'large');
  assert.equal(sidesOf(t.options), 6);
  assert.deepEqual(botTeams(t.players, 6), [3, 4, 5]);
  assert.equal(t.setTeam(1, 1), false, 'no teams to move between');
  t.addPlayer(4, 'Dani');
  assert.equal(t.players[3].team, 3);
  t.removePlayer(2); t.addPlayer(5, 'Eli');
  assert.equal(t.players.at(-1).team, 1, 'the free capi');
  t.start();
  assert.equal(t.match.mode, 'ffa'); assert.equal(t.bots.length, 6);
  assert.equal(t.controller, 1, 'Ana opens');
  assert.equal(controllerOf(t.players, { phase: 'aim', turn: { team: 5, k: 1 } }), null, 'capi 5 is the machine');

  const snap = wire(t.snapshot()), { view } = mirror(null, snap);
  assert.equal(view.mode, 'ffa'); assert.equal(view.teams, 6);
  assert.deepEqual(view.capys.map(c => [c.id, c.x]), t.match.capys.map(c => [c.id, c.x]), 'the same six at the same spots');
  assert.equal(mirror(view, snap).view, view, 'the same copy kept');
  // Back to teams reseats too.
  const again = new CapisTable({ seed: 6, options: defaultOptions() });
  again.addPlayer(1, 'Ana'); again.addPlayer(2, 'Beto'); again.configure({ mode: 'ffa' }); again.configure({ mode: 'teams' });
  assert.deepEqual(again.players.map(p => p.team), [0, 1]);
});

test('a new host in a free-for-all carries on with a machine for every side', () => {
  const t = new CapisTable({ seed: 6, options: { ...defaultOptions(), mode: 'ffa' } });
  t.addPlayer(1, 'Ana'); t.start();
  const { view } = mirror(null, wire(t.snapshot())), next = CapisTable.restore(wire(t.snapshot()), view);
  assert.equal(next.bots.length, 6);
  assert.equal(next.match.teams, 6);
  assert.equal(activeCapy(next.match).team, 0);
});
