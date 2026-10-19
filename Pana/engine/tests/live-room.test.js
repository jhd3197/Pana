import test from 'node:test';
import assert from 'node:assert/strict';
import { LiveRoom, axis, elapsedClock, STEP } from '../live-room.js';

class WalkRoom extends LiveRoom {
  constructor() {
    super({ game: 'test', protocol: 'test-v1', code: 'x', name: 'Ana', avatar: {} });
    this.steps = []; this.handled = []; this.sent = [];
  }
  cleanInput(raw) { return { x: axis(raw?.x) }; }
  takeOver(previous) {
    super.takeOver(previous);
    this.game = { update: (dt, inputs) => this.steps.push([dt, [...inputs.keys()]]), snapshot: () => ({ players: [] }) };
  }
  handle(id, data) { this.handled.push([id, data.seq]); }
  send(data, dest) { this.sent.push(dest == null ? data : { ...data, dest }); }
}

test('axis clamps sticks and treats junk as released', () => {
  assert.deepEqual([axis(3), axis(-2), axis(.5), axis('1'), axis(NaN), axis()], [1, -1, .5, 0, 0, 0]);
});

test('the host steps in fixed slices, catching up at most one second', () => {
  const room = new WalkRoom();
  room.practice();
  room.tick(.12, { x: 1 });
  assert.deepEqual(room.steps.map(s => +s[0].toFixed(3)), [STEP, STEP, .02]);
  room.steps = [];
  room.tick(30, {});
  assert.equal(room.steps.length, Math.round(1 / STEP));
  room.steps = [];
  room.tick(.5, {}, true);
  assert.equal(room.steps.length, 0, 'paused');
});

test('stale guest inputs expire and repeated actions are dropped', () => {
  const room = new WalkRoom();
  room.practice();
  room.receive(2, { kind: 'input', input: { x: 9 } });
  assert.deepEqual(room.inputs.get(2).x, 1);
  room.inputs.get(2).at -= 10_000;
  room.tick(STEP, {});
  assert.equal(room.inputs.has(2), false);
  for (const seq of [1, 1, 2, 'x', 0]) room.receive(2, { kind: 'action', seq });
  assert.deepEqual(room.handled, [[2, 1], [2, 2]]);
});

test('guests send their cleaned input instead of stepping', () => {
  const room = new WalkRoom();
  room.id = 2; room.hostId = 1; room.connected = true; room.link = {};
  room.tick(.05, { x: -5 });
  assert.deepEqual(room.sent, [{ kind: 'input', input: { x: -1 }, dest: 'host' }]);
});

test('a guest sends input when it changes, plus a heartbeat, and again to a new host', () => {
  const room = new WalkRoom();
  room.id = 2; room.hostId = 1; room.connected = true; room.link = {};
  room.tick(.05, { x: 1 }); room.tick(.05, { x: 1 }); room.tick(.05, { x: 1 });
  assert.equal(room.sent.length, 1, 'an unchanged stick is not resent every tick');
  room.tick(.05, { x: 0 });
  assert.equal(room.sent.length, 2, 'a change goes out at once');
  room.sentAt -= 1000;
  room.tick(.05, { x: 0 });
  assert.equal(room.sent.length, 3, 'the heartbeat keeps the host from expiring it');
  room.elect(3);
  room.tick(.05, { x: 0 });
  assert.equal(room.sent.length, 4, 'a new host hears it right away');
  assert.ok(room.sent.every(m => m.dest === 'host'));
});

test('elapsedClock measures real time between calls', () => {
  let t = 1000;
  const clock = elapsedClock(() => t);
  t += 250; assert.equal(clock(), .25);
  t += 1000; assert.equal(clock(), 1);
});
