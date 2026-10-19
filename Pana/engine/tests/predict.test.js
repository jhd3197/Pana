import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrediction } from '../predict.js';
import { LiveRoom, STEP } from '../live-room.js';

// A body that walks 1 unit per second along x.
const walk = (body, input, dt) => { body.x += input.x * dt; };
const state = (x) => ({ players: [{ id: 2, x }] });
const body = (s, id) => s.players.find(p => p.id === id);

test('a prediction runs ahead on its own inputs and replays what the host has not seen', () => {
  const p = createPrediction({ body, step: walk, slice: STEP });
  p.input(1, { x: 1 }, .05);
  assert.equal(p.body, null, 'nothing to predict before the first snapshot');
  p.snapshot(state(0), 2, undefined);
  for (let seq = 1; seq <= 4; seq++) p.input(seq, { x: 1 }, .05);
  assert.ok(Math.abs(p.body.x - .2) < 1e-9, 'four ticks of input, no waiting for the host');
  // The host has applied inputs 1 and 2 and puts the body at 0.1: 3 and 4 replay on top.
  p.snapshot(state(.1), 2, 2);
  assert.ok(Math.abs(p.body.x - .2) < 1e-9);
  // The host disagrees (a wall): its body wins, the unacknowledged input still replays.
  p.snapshot(state(0), 2, 3);
  assert.ok(Math.abs(p.body.x - .05) < 1e-9);
  assert.notEqual(p.body, state(0).players[0], 'the prediction is a copy, never the snapshot itself');
  p.snapshot({ players: [] }, 2, 4);
  assert.equal(p.body, null, 'gone from the game: nothing to draw');
});

class Walkers extends LiveRoom {
  constructor() {
    super({ game: 'test', protocol: 'test-v1', code: 'x', name: 'Ana', avatar: {} }, { predict: { body, step: walk } });
    this.sent = [];
  }
  cleanInput(raw) { return { x: Number(raw?.x) || 0 }; }
  takeOver(previous) { super.takeOver(previous); this.game = { players: [{ id: 2, x: 0 }], update: () => {}, snapshot: () => state(0) }; }
  send(data, dest) { this.sent.push({ ...data, dest }); }
}

test('a predicting guest numbers every input and the host echoes the last one', () => {
  const guest = new Walkers();
  guest.id = 2; guest.hostId = 1; guest.connected = true; guest.link = {};
  guest.receive(1, { kind: 'snapshot', state: state(0) });
  guest.tick(.05, { x: 1 }); guest.tick(.05, { x: 1 });
  assert.deepEqual(guest.sent.map(m => [m.kind, m.seq, m.dest]), [['input', 1, 'host'], ['input', 2, 'host']], 'unchanged input still goes out: the host must number every tick');
  assert.ok(Math.abs(guest.predicted.x - .1) < 1e-9);

  const host = new Walkers();
  host.practice();
  host.receive(2, { kind: 'input', input: { x: 1 }, seq: 7 });
  host.publish();
  assert.deepEqual(host.sent.at(-1).acks, { 2: 7 });
  assert.equal(host.predicted, null, 'the host draws its own simulation');

  guest.receive(1, { kind: 'snapshot', state: state(.05), acks: { 2: 1 } });
  assert.ok(Math.abs(guest.predicted.x - .1) < 1e-9, 'input 2 replays on the host body');
});
