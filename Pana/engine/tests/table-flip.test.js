// The table flip is a picture: it must end exactly where it began, never write
// a real transform, and only ever pass through the cosmetic channel.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tiltAt, launchPiece, pieceOffset, createTableFlip } from '../fx/table-flip.js';
import { canFlip, createFlipGate, FLIP_COOLDOWN, FLIP_SECONDS, FLIP_SLAM } from '../play/flip-rules.js';
import { createFlipControl } from '../play/flip-control.js';
import { rng } from '../random.js';

test('the tilt starts flat, goes over and ends flat', () => {
  assert.equal(tiltAt(0), 0);
  assert.equal(tiltAt(.8), 1);
  assert.equal(tiltAt(FLIP_SECONDS), 0);
  assert.ok(tiltAt(FLIP_SECONDS - .05) < .03);
});

test('every thrown piece stays above the floor and comes home to exactly nothing', () => {
  const random = rng(7), y = 1.48, floor = .08;
  for (let i = 0; i < 50; i++) {
    const flight = launchPiece(random, i);
    for (const value of Object.values(pieceOffset(flight, 0, y, floor))) assert.equal(Math.abs(value), 0);
    for (let t = 0; t < FLIP_SLAM; t += .05) assert.ok(y + pieceOffset(flight, t, y, floor).y >= floor - 1e-9, `above the floor at ${t}`);
    const middle = pieceOffset(flight, 1, y, floor);
    assert.ok(Math.hypot(middle.x, middle.z) > .5 && middle.angle !== 0, 'it really flew');
    const home = pieceOffset(flight, FLIP_SLAM, y, floor);
    for (const value of Object.values(home)) assert.equal(Math.abs(value), 0);
  }
});

// Just enough of Three.js, recording who writes what.
class Vector3 {
  x = 0; y = 0; z = 0;
  set(x, y, z) { Object.assign(this, { x, y, z }); return this; }
  copy(v) { return this.set(v.x, v.y, v.z); }
  sub(v) { return this.set(this.x - v.x, this.y - v.y, this.z - v.z); }
  add(v) { return this.set(this.x + v.x, this.y + v.y, this.z + v.z); }
  applyAxisAngle() { return this; }
  fromArray(a) { return this.set(a[0], a[1], a[2]); }
}
class Quaternion {
  x = 0; y = 0; z = 0; w = 1;
  setFromAxisAngle() { return this; }
  multiply() { return this; }
  copy() { return this; }
}
const THREE = { Vector3, Quaternion };
const object3d = () => {
  const object = { position: Object.freeze(new Vector3()), quaternion: Object.freeze(new Quaternion()), scale: Object.freeze(new Vector3()), matrixAutoUpdate: true, matrixWorldNeedsUpdate: false, composed: 0, refreshed: 0,
    matrix: { compose() { object.composed++; } }, updateWorldMatrix() { object.refreshed++; } };
  return object;
};

test('a flip poses matrices for one render and never writes a real transform', () => {
  let time = 0; const table = object3d(), piece = object3d(), still = object3d(); still.matrixAutoUpdate = false;
  const flip = createTableFlip(THREE, { table: () => [table], pieces: () => [piece, still], clock: () => time, reduced: () => false });
  let renders = 0, autoDuringRender;
  const render = () => { renders++; autoDuringRender = piece.matrixAutoUpdate; };
  flip.draw(.016, render);
  assert.equal(table.composed, 0, 'no flip, no posing');
  assert.equal(flip.start(0, 42), true);
  assert.equal(flip.start(0, 43), false, 'one at a time');
  time = 500; flip.draw(.016, render);
  // The frozen vectors above would have thrown on a write.
  assert.equal(autoDuringRender, false);
  assert.equal(piece.matrixAutoUpdate, true, 'given back after the render');
  assert.equal(table.matrixAutoUpdate, true);
  assert.equal(piece.refreshed, 1, 'picking sees the real spot again');
  assert.equal(still.composed, 0, 'a static object stays out');
  assert.equal(still.matrixAutoUpdate, false);
  time = FLIP_SECONDS * 1000; const composed = piece.composed;
  flip.draw(.016, render);
  assert.equal(flip.active, false);
  assert.equal(piece.composed, composed, 'the last frame is the real scene');
  assert.equal(renders, 3);
});

test('a render that throws still gives the objects back', () => {
  const table = object3d(), flip = createTableFlip(THREE, { table: () => [table], pieces: () => [], clock: () => 100, reduced: () => false });
  flip.start(0, 1);
  assert.throws(() => flip.draw(.016, () => { throw new Error('lost context'); }));
  assert.equal(table.matrixAutoUpdate, true);
});

const playing = () => ({ phase: 'playing', turn: 1, revision: 9, players: [{ id: 3, name: 'Ana' }, { id: 5, name: 'Beto' }, { id: null, name: 'Bot' }] });

test('only the seat whose turn it is may flip', () => {
  const state = playing();
  assert.equal(canFlip(state, 5), true);
  assert.equal(canFlip(state, 3), false);
  assert.equal(canFlip(state, null), false);
  assert.equal(canFlip({ ...state, turn: 2 }, null), false, 'a bot never does');
  assert.equal(canFlip({ ...state, phase: 'lobby' }, 5), false);
});

test('the cooldown holds per sender', () => {
  let time = 0; const gate = createFlipGate(5, () => time);
  assert.equal(gate.allow('a'), true);
  assert.equal(gate.allow('a'), false);
  assert.equal(gate.allow('b'), true);
  time = 5000; assert.equal(gate.ready('a'), true);
});

function control(id = 5) {
  const state = playing(), played = [], said = [], sent = [], button = { disabled: false };
  const room = { id, state, get seat() { return state.players.findIndex(p => p.id === id); }, emote: data => sent.push(data), action() { throw new Error('a flip is never a game action'); } };
  let time = 0;
  const flip = createFlipControl({ button, room, canUse: () => canFlip(state, id), play: (seat, seed) => played.push({ seat, seed }), say: (seat, text) => said.push({ seat, text }), now: () => time, later: () => 0, random: () => .5 });
  return { flip, room, state, played, said, sent, button, advance: ms => { time += ms; } };
}

test('your flip plays here and goes out as an emote, without touching the state', () => {
  const { flip, state, played, sent, button, advance } = control(), before = JSON.stringify(state);
  assert.equal(button.disabled, false);
  assert.equal(flip.trigger(), true);
  assert.deepEqual(played, [{ seat: 1, seed: 2 ** 31 }]);
  assert.deepEqual(sent, [{ name: 'flip', seed: 2 ** 31 }]);
  assert.equal(JSON.stringify(state), before);
  assert.equal(button.disabled, true, 'cooling down');
  assert.equal(flip.trigger(), false);
  advance(FLIP_COOLDOWN * 1000); flip.sync();
  assert.equal(button.disabled, false);
  assert.equal(flip.trigger(), true);
});

test('out of turn the button stays off and the key does nothing', () => {
  const { flip, played, sent, button } = control(3);
  assert.equal(button.disabled, true);
  assert.equal(flip.trigger(), false);
  assert.deepEqual([played, sent], [[], []]);
});

test('another pana\'s flip plays once, only on their turn, and changes nothing', () => {
  const { room, state, played, said, advance } = control(3), before = JSON.stringify(state);
  assert.equal(room.onEmote(3, { name: 'flip', seed: 1 }), false, 'not their turn');
  assert.equal(room.onEmote(5, { name: 'other', seed: 1 }), false);
  assert.equal(room.onEmote(5, { name: 'flip', seed: 8 }), true);
  assert.deepEqual(played, [{ seat: 1, seed: 8 }]);
  assert.equal(said[0].seat, 1);
  assert.equal(room.onEmote(5, { name: 'flip', seed: 9 }), false, 'too soon');
  advance((FLIP_COOLDOWN - 1) * 1000);
  assert.equal(room.onEmote(5, { name: 'flip', seed: 9 }), true);
  assert.equal(JSON.stringify(state), before);
});
