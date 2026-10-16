// HostRoom's bookkeeping, driven by plain room-state snapshots (no server, no SDK).
import test from 'node:test';
import assert from 'node:assert/strict';
import { HostRoom } from '../net.js';

class Probe extends HostRoom {
  constructor() {
    super({ game: 'probe', protocol: 'probe-v1', code: 'abc', name: 'Juan', avatar: {} });
    this.log = [];
    this.sent = [];
  }
  entered(alone) { this.log.push(['entered', alone]); }
  takeOver(previous) { this.log.push(['takeOver', previous]); }
  memberJoined(m, already) { this.log.push(['joined', m.id, already]); }
  memberLeft(id) { this.log.push(['left', id]); }
  memberHello(id, m) { this.log.push(['hello', id, m.coat]); }
  receive(id, data) { this.log.push(['receive', id, data.kind]); }
}

const player = (id, seat, connected = true) => ({ id, seat, name: `P${seat}`, avatar: '{}', connected });
function linked(room, myId = 'a') {
  room.link = { id: myId, send: (type, data) => room.sent.push([type, data]), leave() {} };
  return room;
}

test('first state: enter, learn the host, greet everyone', () => {
  const room = linked(new Probe());
  room.sync({ host: 'b', players: [player('a', 2), player('b', 1)] });
  assert.equal(room.id, 2);
  assert.equal(room.hostId, 1);
  assert.equal(room.isHost, false);
  assert.deepEqual(room.log, [['entered', false], ['joined', 1, true]]);
  assert.equal(room.sent.at(-1)[1].kind, 'hello');
});

test('alone in a fresh room: you host and take over once', () => {
  const room = linked(new Probe());
  room.sync({ host: 'a', players: [player('a', 1)] });
  room.sync({ host: 'a', players: [player('a', 1)] });
  assert.deepEqual(room.log, [['entered', true], ['takeOver', null]]);
  assert.ok(room.isHost);
});

test('host drops: the room picks you and you take over from the old host', () => {
  const room = linked(new Probe());
  room.sync({ host: 'b', players: [player('a', 2), player('b', 1)] });
  room.log.length = 0;
  room.sync({ host: 'a', players: [player('a', 2), player('b', 1, false)] });
  assert.deepEqual(room.log, [['left', 1], ['takeOver', 1]]);
  assert.equal(room.members.size, 1);
});

test('a late arrival joins without "already", and their hello carries extras', () => {
  const room = linked(new Probe());
  room.sync({ host: 'a', players: [player('a', 1)] });
  room.log.length = 0;
  room.sync({ host: 'a', players: [player('a', 1), player('c', 3)] });
  assert.deepEqual(room.log, [['joined', 3, false]]);
  room.hello_(3, { game: 'probe-v1', kind: 'hello', avatar: {}, coat: 'bayo' });
  assert.deepEqual(room.log.at(-1), ['hello', 3, 'bayo']);
  assert.equal(room.members.get(3).coat, 'bayo');
});

test('send wraps the protocol, and nothing goes out offline', () => {
  const room = linked(new Probe());
  room.send({ kind: 'input', x: 1 });
  assert.deepEqual(room.sent.at(-1), ['relay', { game: 'probe-v1', kind: 'input', x: 1 }]);
  room.practice('local');
  const before = room.sent.length;
  room.send({ kind: 'input' });
  assert.equal(room.sent.length, before);
});

test('practice: seat 1, host, alone', () => {
  const room = new Probe();
  room.practice('Juego local');
  assert.equal(room.id, 1);
  assert.ok(room.isHost && room.offline && room.connected);
  assert.deepEqual([...room.members.keys()], [1]);
  assert.deepEqual(room.log, [['takeOver', null]]);
});
