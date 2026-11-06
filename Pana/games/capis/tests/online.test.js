// Capis with friends, without a network: who plays which capi, the host's
// table, and a guest's copy of the match (online.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { CapisTable, cleanInput, controllerOf, botTeams, mirror, matchView, freshEvents, MAX_PLAYERS } from '../public/online.js';
import { createMatch, activeCapy, applyEdit, explode, drill } from '../public/rules.js';

const wire = x => JSON.parse(JSON.stringify(x));   // what a snapshot looks like after the network
const sameGround = (a, b) => a.mask.solid.every((v, i) => v === b.mask.solid[i]) && a.mask.stain.every((v, i) => v === b.mask.stain[i]) && a.mask.tint.every((v, i) => v === b.mask.tint[i]);
function table(names = ['Ana', 'Beto']) {
  const t = new CapisTable({ seed: 6, options: { size: 'small', seconds: 30 } });
  names.forEach((name, i) => t.addPlayer(i + 1, name));
  return t;
}
// Steps the table until `done` (or `seconds` of match time pass).
function until(t, done, inputs = new Map(), seconds = 120) {
  for (let s = 0; s < seconds && !done(); s += .05) t.update(.05, inputs);
  return done();
}

test('keys from the network are cleaned to what a capi can do', () => {
  assert.deepEqual(cleanInput({ x: 9, aim: -3, jump: 2, face: 1, aimTo: .5 }), { x: 1, aim: -1, jump: 2, face: 1, aimTo: .5 });
  assert.deepEqual(cleanInput({ x: 'a', jump: -1, face: 3, aimTo: NaN }), { x: 0, aim: 0, jump: 0 });
  assert.deepEqual(cleanInput(null), { x: 0, aim: 0, jump: 0 });
});

test('panas fill the two teams evenly, change team in the lobby, and four is the room', () => {
  const t = table(['Ana', 'Beto', 'Caro', 'Dani', 'Eli']);
  assert.equal(t.players.length, MAX_PLAYERS);
  assert.deepEqual(t.players.map(p => p.team), [0, 1, 0, 1]);
  assert.deepEqual(botTeams(t.players), []);
  assert.equal(t.setTeam(2, 0), true, 'Beto joins Ana and Caro');
  assert.equal(t.setTeam(4, 0), false, 'a team has three capis: three panas at most');
  assert.deepEqual(botTeams(t.players), []);
  t.setTeam(4, 1); t.setTeam(2, 1);
  t.start();
  assert.equal(t.setTeam(1, 1), false, 'teams are set before the match');
});

test('one pana alone plays against the machine; a team with nobody is the machine', () => {
  const t = table(['Ana']);
  assert.deepEqual(botTeams(t.players), [1]);
  t.start();
  assert.equal(t.controller, 1, 'Ana opens');
  t.act(1, 'fire', { power: .7 });
  assert.ok(until(t, () => t.match.turn.team === 1));
  assert.equal(t.controller, null, 'the machine plays its own turn');
  assert.ok(until(t, () => t.log.some(e => e.type === 'fire' && e.team === 1)), 'and fires');
});

test('teammates take turns with the team\'s capis, in the order they arrived', () => {
  const players = [{ id: 1, team: 0 }, { id: 2, team: 1 }, { id: 3, team: 0 }];
  const turn = (team, k) => controllerOf(players, { phase: 'aim', turn: { team, k } });
  assert.deepEqual([turn(0, 1), turn(0, 2), turn(0, 3), turn(1, 1), turn(1, 2)], [1, 3, 1, 2, 2]);
  assert.equal(controllerOf(players, { phase: 'finished', turn: { team: 0, k: 1 } }), null);
  // The rules count each team's turns.
  const t = table(); t.start();
  assert.equal(t.match.turn.k, 1);
  t.act(1, 'fire', { power: .6 });
  assert.ok(until(t, () => t.match.turn.team === 1));
  assert.deepEqual(t.match.teamTurns, [1, 1]);
});

test('only the pana whose turn it is fires or changes weapon, at the aim it saw', () => {
  const t = table(); t.start();
  assert.equal(t.act(2, 'fire', { power: .8 }), false, 'not Beto\'s turn');
  assert.equal(t.act(2, 'weapon', { weapon: 'grenade' }), false);
  assert.equal(t.act(1, 'weapon', { weapon: 'nope' }), false);
  assert.equal(t.act(1, 'weapon', { weapon: 'grenade' }), true);
  assert.equal(activeCapy(t.match).weapon, 'grenade');
  t.act(1, 'fire', { power: .5, aim: .3, face: -1 });
  t.update(.05);
  const shot = t.log.find(e => e.type === 'fire');
  assert.equal(shot.weapon, 'grenade');
  assert.equal(activeCapy(t.match).aim, .3); assert.equal(activeCapy(t.match).facing, -1);
  assert.equal(t.match.phase, 'flight');
});

test('a jump press counts once, never when the turn comes round to a pana', () => {
  const t = table(); t.start();
  const ana = activeCapy(t.match), jumps = () => t.log.filter(e => e.type === 'jump').length;
  t.update(.05, new Map([[1, { jump: 0 }], [2, { jump: 5 }]]));
  t.update(.05, new Map([[1, { jump: 1 }], [2, { jump: 6 }]]));
  t.update(.5, new Map([[1, { jump: 1 }], [2, { jump: 6 }]]));
  assert.equal(jumps(), 1, 'Ana\'s capi jumps once; Beto\'s presses on her turn do nothing');
  // Beto pressed during her turn: his own turn starts without a jump.
  t.act(1, 'fire', { power: .6 }); assert.ok(ana);
  assert.ok(until(t, () => t.match.turn.team === 1 && t.match.phase === 'aim', new Map([[2, { jump: 6 }]])));
  const before = jumps();
  t.update(.3, new Map([[2, { jump: 6 }]]));
  assert.equal(jumps(), before);
});

test('a pana who drops is replaced: by a teammate, else by the machine, even mid-turn', () => {
  const t = table(['Ana', 'Beto', 'Caro']); t.start();
  assert.equal(t.controller, 1);
  t.removePlayer(1);
  assert.equal(t.controller, 3, 'Caro takes Ana\'s turn');
  t.removePlayer(3);
  assert.equal(t.controller, null, 'nobody left on the team: the machine');
  assert.ok(until(t, () => t.log.some(e => e.type === 'fire' && e.team === 0)), 'and the machine finishes the turn');
});

test('the ground is replayed from the edits: a guest never needs the mask', () => {
  const a = createMatch({ seed: 9, size: 'small' }), b = createMatch({ seed: 9, size: 'small' });
  explode(a, 30, 20, 0); explode(a, 40, 18, 1, 'grenade'); drill(a, 50, 22, 3, -2, 0); explode(a, 31, 19, 1, 'scatter');
  assert.equal(a.edits.length, 4);
  for (const e of wire(a.edits)) applyEdit(b.mask, e);
  assert.ok(sameGround(a, b));
});

test('a guest\'s copy follows the host through a whole match, asking again after a gap', () => {
  const t = table(); t.start();
  let view = null;
  // Long enough for several turns of shots: the machine plays both teams (no inputs).
  t.players.length = 0;
  for (let i = 0; i < 20 * 90; i++) {
    t.update(.05);
    // Every fourth snapshot is lost: the tail of edits still bridges it.
    if (i % 4 === 3) continue;
    const r = mirror(view, wire(t.snapshot()));
    view = r.view; assert.equal(r.gap, false);
  }
  view = mirror(view, wire(t.snapshot())).view;
  assert.ok(t.match.edits.length >= 4, `shots landed (${t.match.edits.length})`);
  assert.ok(sameGround(view, t.match));
  assert.deepEqual(view.capys.map(c => [c.x, c.paint, c.out]), t.match.capys.map(c => [c.x, c.paint, c.out]));
  assert.equal(view.turn.n, t.match.turn.n); assert.equal(view.wind, t.match.wind);
  // A guest that arrives late gets only the tail: a gap, until the host sends every edit.
  const late = mirror(null, wire({ match: matchView(t.match, false) }));
  assert.equal(late.gap, t.match.edits.length > 6);
  const full = mirror(late.view, wire({ match: matchView(t.match, true) }));
  assert.equal(full.gap, false); assert.ok(sameGround(full.view, t.match));
});

test('events reach a client once each, and a new match on the same map starts a new copy', () => {
  const t = table(); t.start();
  const first = wire(t.snapshot());
  assert.equal(freshEvents(first, 0)[0].type, 'turn');
  assert.deepEqual(freshEvents(first, first.events.at(-1).n), []);
  let { view } = mirror(null, first);
  t.act(1, 'fire', { power: .7 });
  until(t, () => t.match.turn.n >= 3);
  view = mirror(view, wire(t.snapshot())).view;
  t.match.phase = 'finished'; t.start();
  const again = mirror(view, wire(t.snapshot())).view;
  assert.notEqual(again, view, 'the rematch is a new copy');
  assert.equal(again.edits.length, 0); assert.equal(again.turn.n, 1);
});

test('a new host carries on from its own copy, with the machine for whoever left', () => {
  const t = table(); t.start();
  t.act(1, 'fire', { power: .7 });
  until(t, () => t.match.turn.team === 1 && t.match.phase === 'aim');
  const snap = wire(t.snapshot()), view = mirror(null, wire({ ...snap, match: matchView(t.match, true) })).view;
  const next = CapisTable.restore(snap, view);
  next.removePlayer(1);
  assert.equal(next.phase, 'play'); assert.equal(next.match, view);
  assert.equal(next.controller, 2, 'Beto keeps his turn');
  next.act(2, 'fire', { power: .7 });
  assert.ok(until(next, () => next.match.turn.team === 0 && next.match.phase === 'aim'));
  assert.equal(next.controller, null, 'Ana left: the machine plays her capis');
  assert.ok(until(next, () => next.log.some(e => e.type === 'fire' && e.team === 0)));
  // Back to the lobby: a new map for the next match.
  const seed = next.seed;
  assert.equal(next.toLobby(), true); assert.equal(next.phase, 'lobby'); assert.notEqual(next.seed, seed);
});
