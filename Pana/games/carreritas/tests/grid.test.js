// Field size and the twelve-car grid: bots fill the empty slots up to the
// host's field, and anything up to eight cars keeps its old grid and names.
import test from 'node:test';
import assert from 'node:assert/strict';
import CarreritasRoom from '../server/room.js';
import {
  GP_PROTOCOL, MAX_RACERS, MIN_GRID, GP_GRID, RIVALS, MORE_RIVALS, fieldSize, cleanField, gridSlot, rivalName, packPose,
} from '../public/online-rules.js';
import { createCupSession, finalizeStage, beginStage, markRacing, markStarted, POINTS } from '../public/cup-rules.js';
import { cleanSetup } from '../public/cup-profile.js';

function room(options = {}) {
  const r = new CarreritasRoom();
  r.roomName = 'carreritas';
  r.roomId = `grid-${Math.random().toString(36).slice(2, 8)}`;
  const handlers = new Map(), broadcasts = [];
  r.onMessage = (type, cb) => handlers.set(type, cb);
  r.setMetadata = async () => {};
  r.allowReconnection = async () => {};
  r.broadcast = (type, msg, opts) => broadcasts.push({ type, msg, opts });
  r.clock = { setInterval: () => {} };
  r.onCreate(options);
  const join = (id, opts = {}) => {
    const client = { sessionId: id, send: () => {} };
    r.onJoin(client, { protocol: GP_PROTOCOL, name: id, ...opts });
    return client;
  };
  return { room: r, broadcasts, join, send: (client, type, msg) => handlers.get(type)?.(client, msg) };
}

const racers = (r) => [...r.state.racers.entries()].map(([id, x]) => ({ id, ...x.toJSON() }));
const pose = (lap = 1) => packPose({ x: 1, y: 0, z: 2, h: 0, pitch: 0, roll: 0, vf: 10, steer: 0, spin: 0, boost: 0,
  onGround: true, dizzy: 0, inventory: [], done: false, lap, prog: 10, lost: 0, coins: 0 });

test('grid slots: the first eight stay where they were, twelve are all distinct', () => {
  const eight = [[3.5, 0], [-3.5, 0], [3.5, 1], [-3.5, 1], [3.5, 2], [-3.5, 2], [3.5, 3], [-3.5, 3]];
  assert.deepEqual([...Array(8).keys()].map(i => { const s = gridSlot(i); return [s.lane, s.row]; }), eight);
  const all = [...Array(MAX_RACERS).keys()].map(gridSlot);
  assert.equal(new Set(all.map(s => `${s.lane}:${s.row}`)).size, MAX_RACERS);
  assert.equal(Math.max(...all.map(s => s.row)), MAX_RACERS / 2 - 1);
});

test('field size: mode defaults unchanged, the full grid is twelve, humans are never cut', () => {
  assert.equal(MAX_RACERS, 12);
  assert.equal(fieldSize({ humans: 1 }), MIN_GRID);
  assert.equal(fieldSize({ humans: 1, cup: true }), GP_GRID);
  assert.equal(fieldSize({ humans: 5 }), 5);
  assert.equal(fieldSize({ humans: 1, field: 12 }), 12);
  assert.equal(fieldSize({ humans: 2, cup: true, field: 12 }), 12);
  assert.equal(fieldSize({ humans: 3, bots: false, field: 12 }), 3);
  assert.equal(fieldSize({ humans: 12, cup: true }), 12);
  assert.equal(fieldSize({ humans: 1, field: 9 }), MIN_GRID, 'unknown field sizes fall back to the default');
  assert.equal(cleanField('12'), 0);
  assert.equal(cleanSetup({ field: 12 }).field, 12);
  assert.equal(cleanSetup({ field: 7 }).field, 0);
  assert.equal(cleanSetup({}).field, 0);
});

test('rival names: the first eight are the seeded list, the extra four are new and distinct', () => {
  const names = [...RIVALS].reverse();
  assert.deepEqual([...Array(8).keys()].map(i => rivalName(names, i)), names);
  const eleven = [...Array(MAX_RACERS - 1).keys()].map(i => rivalName(names, i));
  assert.equal(new Set(eleven).size, 11);
  assert.deepEqual(eleven.slice(8), MORE_RIVALS.slice(0, 3));
  assert.ok(MORE_RIVALS.every(n => !RIVALS.includes(n)));
});

test('a quick race keeps four cars by default and fills twelve on the full grid', () => {
  const plain = room(), first = plain.join('host-1');
  plain.send(first, 'start');
  assert.equal(plain.room.state.racers.size, MIN_GRID);
  const { room: r, join, send } = room();
  const host = join('host-1', { car: 0 });
  const guest = join('guest-2', { car: 1 });
  send(guest, 'field', { size: 12 });
  assert.equal(r.state.field, 0, 'only the host picks the field');
  send(host, 'field', { size: 99 });
  assert.equal(r.state.field, 0);
  send(host, 'field', { size: 12 });
  assert.equal(r.state.field, 12);
  send(host, 'start');
  const list = racers(r);
  assert.equal(list.length, 12);
  assert.equal(list.filter(x => x.kind === 'bot').length, 10);
  assert.deepEqual(list.map(x => x.slot).sort((a, b) => a - b), [...Array(12).keys()]);
  assert.equal(new Set(list.filter(x => x.kind === 'bot').map(x => x.name)).size, 10);
  assert.ok(list.filter(x => x.kind === 'bot').every(x => x.owner === 'host-1'));
  // Bots off: only the panas race, whatever the field.
  const solo = room(), a = solo.join('host-1');
  solo.join('guest-2');
  solo.send(a, 'field', { size: 12 });
  solo.send(a, 'bots', { on: false });
  solo.send(a, 'start');
  assert.equal(solo.room.state.racers.size, 2);
});

test('the host relays twelve poses in one message', () => {
  const { room: r, join, send, broadcasts } = room();
  const host = join('host-1');
  join('guest-2');
  send(host, 'field', { size: 12 });
  send(host, 'start');
  for (const p of r.state.players.values()) p.loaded = true;
  r.tick();
  const mine = racers(r).filter(x => x.owner === 'host-1').map(x => x.id);
  assert.equal(mine.length, 11);
  send(host, 'p', { raceId: r.state.raceId, list: mine.map(id => [id, Date.now(), ...pose()]) });
  const relayed = broadcasts.filter(b => b.type === 'p').at(-1);
  assert.equal(relayed.msg.length, 11);
});

test('a twelve-car aguacero wave fits the fx limit', () => {
  const { room: r, join, send, broadcasts } = room();
  const host = join('host-1');
  send(host, 'field', { size: 12 });
  send(host, 'start');
  for (const p of r.state.players.values()) p.loaded = true;
  r.tick();
  const wave = racers(r).filter(x => x.id !== 'host-1').map((x, i) => ({ id: x.id, delay: Math.round((0.75 + i * 0.15) * 100) / 100, time: 7.5 }));
  send(host, 'fx', { raceId: r.state.raceId, id: 'host-1', k: 'cloud', d: { id: 'host-1:99', at: 1730000000000.25, wave } });
  assert.equal(broadcasts.filter(b => b.type === 'fx').at(-1)?.msg.d.wave.length, 11);
});

test('a Grand Prix keeps eight entrants by default and twelve on the full grid', () => {
  const plain = room({ mode: 'pana' }), first = plain.join('host-1');
  plain.send(first, 'start');
  assert.equal(plain.room.cupSession.entrants.length, GP_GRID);
  const { room: r, join, send } = room({ mode: 'pana' });
  const host = join('host-1');
  send(host, 'field', { size: 12 });
  send(host, 'start');
  const { entrants, grids } = r.cupSession;
  assert.equal(entrants.length, 12);
  assert.equal(new Set(entrants.map(e => e.name)).size, 12);
  assert.equal(grids[0].length, 12);
  assert.deepEqual(racers(r).map(x => x.slot).sort((a, b) => a - b), [...Array(12).keys()]);
});

test('a twelve-car cup scores places nine to twelve with no points', () => {
  const entrants = [...Array(12).keys()].map(i => ({ id: `e${i}`, kind: i ? 'bot' : 'human' }));
  const session = createCupSession({ cupId: 'pana', seed: 'twelve', entrants });
  assert.throws(() => createCupSession({ cupId: 'pana', seed: 'x', entrants: [...entrants, { id: 'e12' }] }));
  beginStage(session);
  markRacing(session, 0, session.attempts[0]);
  for (const e of entrants) markStarted(session, e.id, 0, session.attempts[0]);
  finalizeStage(session, { stageIndex: 0, attempt: session.attempts[0],
    results: entrants.map((e, i) => ({ id: e.id, classification: 'finished', started: true, time: 60 + i, progress: 0 })) });
  const points = session.ledger.filter(rec => rec.stage === 0).sort((a, b) => a.place - b.place).map(rec => rec.points);
  assert.deepEqual(points, [...POINTS, 0, 0, 0, 0]);
});
