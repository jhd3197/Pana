// Pepazo's `bots` room option: how many bots a round seats, online and in practice.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Arena, botCount, SEATS } from '../public/rules.js';
import { FIELDS, DEFAULT_OPTIONS, validOptions } from '../public/options.js';
import PaintRoom from '../server/room.js';
import { createTestRoom } from '../../../server/tests/harness.js';

const make = i => ({ name: `Bot ${i}`, avatar: {} });
const bots = g => g.players.filter(p => p.bot);
const lobby = (options, humans = 1) => { const g = new Arena('plaza', 'normal', options); for (let id = 1; id <= humans; id++) g.add(id, { name: `P${id}`, avatar: {} }); return g; };
// The live server caps a room at game.json `players` (colyseus.js); the harness does not.
class EightSeats extends PaintRoom { maxClients = SEATS; }

test('the bots option defaults to Auto and only accepts its listed choices', () => {
  const field = FIELDS.find(f => f.id === 'bots');
  assert.equal(field.advanced, true); assert.equal(DEFAULT_OPTIONS.bots, 'auto');
  for (const bad of ['many', '3', 4, -1, 8, 2.5, null, true]) assert.equal(validOptions({ bots: bad }), false, `rejects ${JSON.stringify(bad)}`);
  for (const good of ['auto', 0, 1, 7]) assert.equal(validOptions({ bots: good }), true);
  assert.equal(new Arena().configure({ bots: 'nine' }), false);
});

test('Auto keeps the classic rule and a number is capped by the free seats', () => {
  assert.equal(botCount('auto', 1), 3); assert.equal(botCount('auto', 2), 0); assert.equal(botCount(undefined, 1), 3);
  assert.equal(botCount(0, 1), 0); assert.equal(botCount(5, 2), 5); assert.equal(botCount(7, 3), 5); assert.equal(botCount(7, 8), 0);
  for (let humans = 1; humans <= SEATS; humans++) for (const [n] of FIELDS.find(f => f.id === 'bots').choices) assert.ok(humans + botCount(n, humans) <= SEATS);
});

test('seatBots honours the count, re-seats instead of piling up, and keeps teams even', () => {
  const solo = lobby({}); assert.equal(solo.seatBots(make), 3); assert.equal(bots(solo).length, 3);
  assert.equal(solo.seatBots(make), 3, 'a second call replaces the bots'); assert.equal(bots(solo).length, 3);
  const none = lobby({ bots: 0 }); assert.equal(none.seatBots(make), 0); assert.ok(none.start()); assert.equal(none.players.length, 1);
  const friends = lobby({}, 2); assert.equal(friends.seatBots(make), 0);
  const full = lobby({ bots: 7 }, 3); full.seatBots(make); assert.equal(full.players.length, SEATS);
  assert.equal(new Set(full.players.map(p => p.seat)).size, SEATS);
  // Both people on team 0 (seats 0 and 2): two bots both join team 1.
  const teams = lobby({ mode: 'teams', bots: 2 }, 2); assert.ok(teams.moveSeat(2, 1, 2, 1));
  teams.seatBots(make); assert.deepEqual(bots(teams).map(p => p.team), [1, 1]); assert.ok(teams.start());
  const flag = lobby({ mode: 'ctf', bots: 3 }); flag.seatBots(make);
  const count = t => flag.players.filter(p => p.team === t).length; assert.equal(count(0), 2); assert.equal(count(1), 2);
  assert.ok(flag.start()); assert.equal(flag.seatBots(make), 0, 'no re-seating mid-round');
});

test('the room seats bots from the option at start; a joining pana still displaces one', () => {
  const t = createTestRoom(EightSeats, { code: 'pepazo-bots' }), ana = t.join('ana');
  t.send(ana.client, 'start'); assert.equal(t.room.game.phase, 'playing'); assert.equal(bots(t.room.game).length, 3, 'Auto: three for a pana alone');
  t.room.game.phase = 'finished'; t.send(ana.client, 'lobby'); assert.equal(bots(t.room.game).length, 0, 'online lobbies drop their bots');
  t.send(ana.client, 'configure', { options: { bots: 0 } }); t.send(ana.client, 'start'); assert.equal(bots(t.room.game).length, 0);
  t.room.game.phase = 'finished'; t.send(ana.client, 'lobby');
  const beto = t.join('beto'); t.send(beto.client, 'configure', { options: { bots: 7 } }); assert.equal(t.room.game.options.bots, 0, 'guests cannot change it');
  t.send(ana.client, 'configure', { options: { bots: 7 } }); t.send(ana.client, 'start');
  assert.equal(t.room.game.players.length, SEATS); assert.equal(bots(t.room.game).length, 6);
  t.join('cora'); const people = t.room.game.players.filter(p => p.connected);
  assert.equal(people.length, SEATS, 'a full round never overflows'); assert.equal(bots(t.room.game).length, 5);
  t.room.onDispose?.();
});

test('a one-sided team start is refused without bots, and one bot fills the empty side', () => {
  const t = createTestRoom(EightSeats, { code: 'pepazo-teams' }), ana = t.join('ana'), beto = t.join('beto');
  t.send(ana.client, 'configure', { options: { mode: 'teams' } }); t.send(ana.client, 'move-seat', { from: 1, to: 2 });
  t.send(ana.client, 'start'); assert.equal(t.room.game.phase, 'lobby'); assert.equal(bots(t.room.game).length, 0);
  t.send(ana.client, 'configure', { options: { bots: 1 } }); t.send(ana.client, 'start');
  assert.equal(t.room.game.phase, 'playing'); assert.deepEqual(bots(t.room.game).map(p => p.team), [1]);
  assert.ok(beto); t.room.onDispose?.();
});
