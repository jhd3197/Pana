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
  send(data) { this.sent.push(data); }
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
  assert.deepEqual(room.sent, [{ kind: 'input', input: { x: -1 } }]);
});

test('elapsedClock measures real time between calls', () => {
  let t = 1000;
  const clock = elapsedClock(() => t);
  t += 250; assert.equal(clock(), .25);
  t += 1000; assert.equal(clock(), 1);
});
