import test from 'node:test';
import assert from 'node:assert/strict';
import { smallestTeam, teamCounts, openSeat, isTeammate } from '../play/team-balance.js';
import { Arena } from '../../games/pintura/public/rules.js';
import { DominoGame } from '../../games/domino/public/rules.js';
import { CaidaGame } from '../../games/caida/public/rules.js';
import { ChapitaGame } from '../../games/chapita/public/rules.js';
import { CapisTable } from '../../games/capis/public/online.js';

test('smallestTeam picks the fewest and keeps the preferred team on a tie', () => {
  assert.equal(smallestTeam([2, 1]), 1);
  assert.equal(smallestTeam([1, 1]), 0);
  assert.equal(smallestTeam([1, 1], 1), 1);
  assert.equal(smallestTeam([2, 2, 1, 1], 3), 3);
  assert.equal(smallestTeam([2, 1], 0), 1, 'a preference that is not the smallest is ignored');
  assert.equal(smallestTeam([Infinity, 3]), 1, 'a full team is skipped');
  assert.equal(smallestTeam([]), null);
});

test('teamCounts counts panas, not bots or empty seats', () => {
  const seats = [{ id: 1 }, { id: null }, { id: 2 }, { id: 9, bot: true }];
  assert.deepEqual(teamCounts(seats, s => s % 2), [2, 0]);
});

test('openSeat sends a newcomer to the smaller team, else the first free seat', () => {
  const pana = id => ({ id }), free = { id: null };
  // Two panas both on team A (seats 0 and 2): the newcomer goes to B even though seat 1 comes later.
  assert.equal(openSeat([pana(1), free, pana(2), free], { teamOf: s => s % 2 }), 1);
  // One pana sits at seat 2 (team A): seat 0 is free but A is bigger, so seat 1.
  assert.equal(openSeat([free, free, pana(1), free], { teamOf: s => s % 2 }), 1);
  // Tie: the old rule, the first free seat.
  assert.equal(openSeat([pana(1), pana(2), free, free], { teamOf: s => s % 2 }), 2);
  // The smaller team is full: the other team's free seat.
  assert.equal(openSeat([pana(1), pana(2), pana(3), free], { teamOf: s => s < 2 ? 0 : 1 }), 3);
  // No teams: first free seat. No seat: -1.
  assert.equal(openSeat([pana(1), free, free], {}), 1);
  assert.equal(openSeat([pana(1)], { teamOf: s => s % 2 }), -1);
});

test('Pepazo: a newcomer in a team round joins the smaller team', () => {
  const g = new Arena(); g.configure({ mode: 'teams' });
  g.add(1, { name: 'Ana' });
  assert.equal(g.moveSeat(1, 0, 2, null), true, 'Ana moves to seat 2, still team 0');
  // Seat 0 is the first free seat, but it is on Ana's team.
  g.add(2, { name: 'Luis' });
  assert.equal(g.players.find(p => p.id === 2).team, 1, 'Luis balances the teams');
  g.add(3, { name: 'Eva' }); g.add(4, { name: 'Leo' });
  assert.deepEqual([0, 1].map(t => g.players.filter(p => p.team === t).length), [2, 2]);
  const ffa = new Arena(); ffa.add(1, { name: 'Ana' }); ffa.add(2, { name: 'Luis' });
  assert.deepEqual(ffa.players.map(p => p.seat), [0, 1], 'free for all keeps seat order');
});

for (const [Game, configure] of [[DominoGame, g => g.configure({ mode: 'teams' })], [CaidaGame, g => g.configure({ mode: 'teams' })]]) {
  test(`${Game.name}: a newcomer sits with the smaller pair`, () => {
    const g = new Game(7); configure(g);
    g.addPlayer(1, 'Ana');
    assert.equal(g.reseat(0, 2), true, 'Ana moves to seat 2, still team A');
    // Seat 0 is the first free seat, but it is on Ana's team.
    g.addPlayer(2, 'Luis');
    assert.equal(g.players.findIndex(p => p.id === 2), 1, 'Luis joins the other pair');
    g.addPlayer(3, 'Eva');
    assert.equal(g.players.findIndex(p => p.id === 3), 0, 'a tie keeps the first free seat');
  });
}

test('Chapita: panas take a seat from the lobby panels, the host arranges anyone', () => {
  const g = new ChapitaGame(3);
  g.addPlayer(1, 'Ana'); g.addPlayer(2, 'Luis');
  assert.deepEqual([g.players[0].id, g.players[1].id], [1, 2]);
  let seq = 0;
  const act = (id, from, to) => g.accept(id, { action: 'seat', from, to, seq: ++seq, revision: g.revision }, 1);
  assert.equal(act(2, 0, 3), false, 'a guest cannot move the host');
  assert.equal(act(2, 1, 2), true, 'Luis takes a bot seat on the other team');
  assert.equal(g.players[2].id, 2); assert.equal(g.players[1].id, null);
  assert.equal(g.players[2].team, 0, 'teams stay with the seat');
  g.addPlayer(3, 'Eva');
  assert.equal(g.players.findIndex(p => p.id === 3) % 2, 1, 'the newcomer balances the teams');
  assert.equal(act(1, 2, 5), true, 'the host arranges Luis');
  assert.equal(g.players[5].id, 2);
});

test('Capis: panas fill the teams evenly', () => {
  const t = new CapisTable();
  for (const id of ['a', 'b', 'c']) t.addPlayer(id, id, {});
  assert.deepEqual(t.players.map(p => p.team), [0, 1, 0]);
});

test('teammate markers: own side only, never yourself, never without teams', () => {
  const me = { id: 1, team: 0 };
  assert.equal(isTeammate(me, { id: 3, team: 0 }, true), true);
  assert.equal(isTeammate(me, { id: 2, team: 1 }, true), false);
  assert.equal(isTeammate(me, me, true), false);
  assert.equal(isTeammate(me, { id: 3, team: 0 }, false), false, 'todos contra todos shows none');
  assert.equal(isTeammate(null, { id: 3, team: 0 }, true), false);
});
