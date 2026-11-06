import test from 'node:test';
import assert from 'node:assert/strict';
import CarreritasRoom from '../server/room.js';
import { CAR_DEFINITIONS } from '../public/car-definitions.js';
import { GP_PROTOCOL } from '../public/online-rules.js';
import { cupSkill } from '../public/cup-rules.js';
import { difficultyById } from '../public/modes.js';

function createRoom() {
  const room = new CarreritasRoom();
  room.roomName = 'carreritas'; room.roomId = `test-${Math.random().toString(36).slice(2, 8)}`;
  const handlers = new Map();
  room.onMessage = (type, cb) => handlers.set(type, cb);
  room.setMetadata = async () => {}; room.allowReconnection = async () => {}; room.broadcast = () => {};
  room.clock = { setInterval: () => {} };
  room.onCreate({});
  room.state.bots = true; room.state.field = 12;
  return {
    room,
    send: (client, type, msg) => handlers.get(type)?.(client, msg),
    join(sessionId, opts = {}) { const client = { sessionId, send() {} }; room.onJoin(client, { protocol: GP_PROTOCOL, name: sessionId, ...opts }); return client; },
  };
}
const bots = (room) => [...room.state.racers.values()].filter(r => r.kind === 'bot');
const FRIENDS = ['Valentina', 'Mateo', 'Sofi'];

test('the fastest rivals of a race wear the host friends, and only those', () => {
  const { room, join } = createRoom();
  join('host', { name: 'Ana', friendNames: FRIENDS });
  join('guest', { name: 'Beto', friendNames: ['Intruso', 'Otro'] });
  room.startRace();
  const all = bots(room), named = all.filter(r => FRIENDS.includes(r.name));
  assert.ok(all.length > 3);
  assert.equal(named.length, 3);
  assert.ok(!all.some(r => ['Intruso', 'Otro'].includes(r.name)), 'a guest list is never used');
  const top = (r) => CAR_DEFINITIONS[r.car].tune.top, slowestNamed = Math.min(...named.map(top));
  assert.ok(all.filter(r => !named.includes(r)).every(r => top(r) <= slowestNamed));
  assert.equal(new Set(all.map(r => r.name)).size, all.length, 'no two rivals share a name');
});

test('a race without a friend list keeps its rivals, and a hostile list is cut down', () => {
  const plain = createRoom();
  plain.join('host', { name: 'Ana' }); plain.room.startRace();
  assert.ok(!bots(plain.room).some(r => FRIENDS.includes(r.name)));
  assert.deepEqual(plain.room.hostFriendNames(), []);

  const { room, join } = createRoom();
  join('host', { name: 'Ana', friendNames: ['<b>Largo</b>' + 'x'.repeat(5000), 'B', 'C', 'D', 'E', 'F'] });
  assert.equal(room.hostFriendNames().length, 3);
  assert.ok(room.hostFriendNames().every(n => n.length <= 16 && !n.includes('<')));
});

test('a friend who is racing is not also a rival', () => {
  const { room, join } = createRoom();
  join('host', { name: 'Ana', friendNames: FRIENDS });
  join('guest', { name: 'Mateo' });
  room.startRace();
  assert.equal(bots(room).filter(r => r.name === 'Mateo').length, 0);
});

test('when the host leaves, the next host list applies to the next race', () => {
  const { room, join } = createRoom();
  const host = join('host', { name: 'Ana', friendNames: FRIENDS });
  join('guest', { name: 'Beto', friendNames: ['Propio'] });
  room.onLeave(host);
  assert.deepEqual(room.hostFriendNames(), ['Propio']);
});

test('a Grand Prix names its most skilled bots', () => {
  const { room, send, join } = createRoom();
  const host = join('host', { name: 'Ana', friendNames: FRIENDS });
  send(host, 'mode', { mode: 'pana' });
  room.startRace();
  const entrants = room.cupSession.entrants.filter(e => e.kind === 'bot');
  const named = entrants.filter(e => FRIENDS.includes(e.name));
  assert.equal(named.length, 3);
  const skill = e => cupSkill(e, difficultyById(room.state.difficulty)), low = Math.min(...named.map(skill));
  assert.ok(entrants.filter(e => !named.includes(e)).every(e => skill(e) <= low));
});
