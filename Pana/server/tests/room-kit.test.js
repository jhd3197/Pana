import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ServerError } from '@colyseus/core';
import { PanaRoom, roomState, ROOM_FULL, InputBuffer, fillBots, memberAvatar, BOT_SEAT, leadToken, MAX_MEMBERS } from '../src/room-kit.js';
import { cappedRoom, createLimiter, clientAddress } from '../src/colyseus.js';
import RelayRoom, { GUEST_BYTES } from '../src/relay-room.js';
import { serveStatic, MIME } from '../src/static.js';
import { createTestRoom } from './harness.js';

const games = path.resolve(import.meta.dirname, '..', '..', 'games');

class PlainRoom extends PanaRoom { state = new (roomState({}, undefined, 'PlainState'))(); }

test('seats are never reused, a reconnect keeps its own', () => {
  const t = createTestRoom(PlainRoom, { code: 'seats-1' });
  const a = t.join('a'), b = t.join('b');
  assert.equal(t.room.state.players.get('a').seat, 1);
  t.leave(b.client);
  t.join('c');
  assert.equal(t.room.state.players.get('c').seat, 3);
  t.drop(a.client); t.reconnect(a.client);
  assert.equal(t.room.state.players.get('a').seat, 1);
  t.room.onDispose();
});

test('the first arrival hosts, the lead takes over while the room is new, a drop hands off', () => {
  const t = createTestRoom(PlainRoom, { code: 'host-1' });
  const guest = t.join('guest'), lead = t.join('lead', { lead: true });
  assert.equal(t.room.state.host, 'lead');
  t.drop(lead.client);
  assert.equal(t.room.state.host, 'guest');
  t.room.createdAt -= 60_000;
  t.join('late', { lead: true });
  assert.equal(t.room.state.host, 'guest', 'a lead arriving late joins like anyone');
  assert.ok(guest);
  t.room.onDispose();
});

test('every room event leaves one log line: create, join, drop, reconnect, host, leave, dispose', () => {
  const lines = [], log = console.log;
  console.log = (...args) => lines.push(args.join(' '));
  try {
    const t = createTestRoom(PlainRoom, { code: 'log-1' });
    const a = t.join('a', { name: 'Ana', lead: true }), b = t.join('b', { name: 'Bruno Díaz' });
    t.drop(a.client); t.reconnect(a.client); t.leave(b.client);
    t.room.onDispose();
  } finally { console.log = log; }
  const events = lines.filter(l => l.startsWith('[room] test:log-1')).map(l => l.split(' ')[2]);
  assert.deepEqual(events, ['create', 'host', 'join', 'join', 'drop', 'host', 'reconnect', 'leave', 'host', 'dispose']);
  assert.ok(lines.some(l => /join seat=1 name=Ana lead=1 host=1 members=1\/1/.test(l)), lines.join(String.fromCharCode(10)));
  assert.ok(lines.some(l => l.includes('name="Bruno Díaz"')), 'names with spaces stay one field');
  assert.ok(lines.some(l => /host from=1 to=2/.test(l)));
});

test('a second room under the same code is refused until the first is gone', () => {
  const first = createTestRoom(PlainRoom, { code: 'dup-1' });
  assert.throws(() => createTestRoom(PlainRoom, { code: 'dup-1' }), e => e instanceof ServerError && e.code === ROOM_FULL);
  first.room.onDispose();
  createTestRoom(PlainRoom, { code: 'dup-1' }).room.onDispose();
});

test('a room that fails while creating releases its code and handler errors are contained', () => {
  const errors = [], log = console.error;
  console.error = (...args) => errors.push(args.join(' '));
  try {
    const t = createTestRoom(PlainRoom, { code: 'broken-1' });
    t.room.onUncaughtException(new Error('wrapped', { cause: new TypeError('boom') }), 'onCreate');
    createTestRoom(PlainRoom, { code: 'broken-1' }).room.onDispose();
    t.room.onUncaughtException(new Error('wrapped', { cause: new ServerError(ROOM_FULL, 'full') }), 'onCreate');
    assert.equal(errors.length, 1, 'expected ServerErrors are not logged');
    assert.match(errors[0], /test:broken-1\] onCreate failed/);
  } finally { console.error = log; }
});

test('game.json players is the room cap', () => {
  assert.equal(new (cappedRoom(RelayRoom, 4))().maxClients, 4);
  assert.equal(new (cappedRoom(RelayRoom, 20))().maxClients, MAX_MEMBERS);
  assert.equal(new (cappedRoom(RelayRoom, 8))().maxClients, 8);
  assert.equal(new (cappedRoom(RelayRoom, undefined))().maxClients, MAX_MEMBERS);
});

test('room helpers: input expiry, bot seats, safe avatars', () => {
  const inputs = new InputBuffer(100);
  inputs.set(1, { x: 1 }); inputs.set(null, { x: 2 });
  assert.deepEqual([...inputs.fresh()], [[1, { x: 1 }]]);
  assert.equal(inputs.fresh(Date.now() + 500).size, 0);
  const bots = [];
  fillBots(3, (seat, info) => bots.push([seat, info.name, info.bot]));
  assert.deepEqual(bots.map(b => b[0]), [BOT_SEAT, BOT_SEAT + 1, BOT_SEAT + 2]);
  assert.ok(bots.every(b => b[2] === true && typeof b[1] === 'string'));
  assert.deepEqual(memberAvatar({ avatar: '{not json' }), {});
});

// Colyseus stacks handlers: registering a type twice answers every message twice.
test('no room registers a message type twice', async () => {
  const rooms = [['relay', RelayRoom]];
  for (const id of fs.readdirSync(games)) {
    const file = path.join(games, id, 'server', 'room.js');
    if (fs.existsSync(file)) rooms.push([id, (await import(pathToFileURL(file).href)).default]);
  }
  const problems = [];
  for (const [id, RoomClass] of rooms) {
    const t = createTestRoom(RoomClass, { code: `dupes-${id}` }, { name: id });
    const seen = new Set();
    for (const type of t.registered) if (seen.has(type)) problems.push(`${id}: '${type}'`); else seen.add(type);
    t.room.onDispose();
  }
  assert.deepEqual(problems, []);
});

test('the relay sends host-bound messages to the host and seat-bound ones to that seat', () => {
  const t = createTestRoom(RelayRoom, { code: 'relay-dest' });
  const host = t.join('h'), a = t.join('a'), b = t.join('b');
  const got = (who) => who.sent.filter(m => m.type === 'relay').map(m => m.payload.v.kind);
  t.send(a.client, 'relay', { kind: 'input', dest: 'host' });
  t.send(host.client, 'relay', { kind: 'notice', dest: 3 });
  t.send(b.client, 'relay', { kind: 'action', dest: 1 });
  t.send(host.client, 'relay', { kind: 'snapshot' });
  t.send(a.client, 'relay', { kind: 'lost', dest: 99 });
  assert.deepEqual(got(host), ['input', 'action']);
  assert.deepEqual(got(a), []);
  assert.deepEqual(got(b), ['notice']);
  assert.deepEqual(t.broadcasts.map(m => [m.msg.id, m.msg.v.kind]), [[1, 'snapshot']]);
  // The host left: 'host' now means whoever the room picked next.
  t.leave(host.client);
  t.send(b.client, 'relay', { kind: 'input', dest: 'host' });
  assert.deepEqual(got(a), ['input']);
  t.room.onDispose();
});

test('static files never leave their folder', async () => {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TEMP || '/tmp'), 'pana-static-'));
  const base = path.join(root, 'web');
  fs.mkdirSync(base); fs.mkdirSync(path.join(root, 'web2'));
  fs.writeFileSync(path.join(root, 'web2', 'secret.txt'), 'no');
  const status = (rel) => new Promise(resolve => {
    const res = { writeHead(code) { resolve(code); return { end() {} }; }, req: { headers: {} } };
    serveStatic(res, base, rel);
  });
  assert.equal(await status('../web2/secret.txt'), 403);
  assert.equal(await status('missing.txt'), 404);
  fs.rmSync(root, { recursive: true, force: true });
});

// An unknown type goes out as application/octet-stream, which some phones refuse to draw.
test('every file Pana serves has a content type', () => {
  const app = path.resolve(import.meta.dirname, '..', '..');
  const missing = new Set();
  const walk = (dir, served) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', 'tests', 'qa', 'vendor'].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, served || entry.name === 'public');
      else if (served && !['.md', ''].includes(path.extname(entry.name)) && !MIME[path.extname(entry.name).toLowerCase()]) missing.add(path.relative(app, full));
    }
  };
  walk(path.join(app, 'web'), true);
  walk(path.join(app, 'engine'), true);
  walk(games, false);
  assert.deepEqual([...missing], []);
});

test('matchmaking is limited per address; local requests and proxies are handled', () => {
  const allow = createLimiter({ burst: 3, perMinute: 6 });
  assert.deepEqual([1, 2, 3, 4].map(() => allow('1.2.3.4', 0)), [true, true, true, false]);
  assert.equal(allow('5.6.7.8', 0), true, 'another address has its own bucket');
  assert.equal(allow('1.2.3.4', 10_000), true, 'one more every ten seconds at six a minute');
  const req = (peer, headers = {}) => ({ socket: { remoteAddress: peer }, headers });
  assert.equal(clientAddress(req('127.0.0.1'), ''), null, 'this machine is not limited');
  assert.equal(clientAddress(req('203.0.113.9'), ''), '203.0.113.9');
  assert.equal(clientAddress(req('127.0.0.1', { 'cf-connecting-ip': '198.51.100.2' }), 'CF-Connecting-IP'), '198.51.100.2');
  assert.equal(clientAddress(req('127.0.0.1', { 'x-forwarded-for': '10.0.0.1, 198.51.100.3' }), 'X-Forwarded-For'), '198.51.100.3');
});

test("the relay drops a guest's oversized message but carries the host's", () => {
  const t = createTestRoom(RelayRoom, { code: 'relay-cap' });
  const host = t.join('host'), guest = t.join('guest');
  const big = { kind: 'snapshot', blob: 'x'.repeat(GUEST_BYTES) };
  t.send(guest.client, 'relay', big);
  t.send(guest.client, 'relay', { kind: 'hello' });
  t.send(host.client, 'relay', big);
  assert.deepEqual(t.broadcasts.map(b => [b.msg.id, b.msg.v.kind]), [[2, 'hello'], [1, 'snapshot']]);
  t.room.onDispose();
});

test("with PANA_LEAD_SECRET only the gateway's token makes a lead", () => {
  process.env.PANA_LEAD_SECRET = 'test-secret';
  try {
    const t = createTestRoom(PlainRoom, { code: 'lead-token' }, { name: 'domino' });
    t.join('guest'); t.join('faker', { lead: '1' });
    assert.equal(t.room.state.host, 'guest', 'lead=1 alone is ignored');
    t.join('mayor', { lead: leadToken('test-secret', 'domino', 'lead-token') });
    assert.equal(t.room.state.host, 'mayor');
    t.room.onDispose();
  } finally { delete process.env.PANA_LEAD_SECRET; }
});
