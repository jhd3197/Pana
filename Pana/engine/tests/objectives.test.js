import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlag, stepFlags, dropCarried, createZone, stepZone, decideWinner, reachedLimit, flagTieBreaks, takeFlag } from '../play/objectives.js';

const actor = (id, team, x, z, alive = true) => ({ id, team, x, z, alive });

test('flags: rival lifts, own team cannot lift its flag at the stand, carrier scores only with its own flag home', () => {
  const flags = [createFlag(0, { x: -10, z: 0 }), createFlag(1, { x: 10, z: 0 })];
  assert.deepEqual(stepFlags(flags, [actor(1, 0, -10, 0)], .05), []);
  assert.equal(flags[0].state, 'home');
  const e = stepFlags(flags, [actor(1, 0, 10, 0)], .05);
  assert.equal(e[0].type, 'pickup'); assert.equal(flags[1].carrier, 1); assert.equal(flags[1].taken, 1);
  // Own flag away: no capture at the stand.
  takeFlag(flags[0], actor(2, 1, -10, 0));
  assert.deepEqual(stepFlags(flags, [actor(1, 0, -10, 0), actor(2, 1, 5, 0)], .05).filter(e => e.type === 'capture'), []);
  assert.equal(flags[1].state, 'carried');
});

test('zones: a lone team turns the zone, two teams contest it, a rival owner is neutralised first', () => {
  const zone = createZone('a', { x: 0, z: 0, radius: 3, captureTime: 1 });
  let events = [];
  for (let i = 0; i < 25; i++) events.push(...stepZone(zone, [actor(1, 0, 0, 0)], .05));
  assert.equal(zone.owner, 0); assert.deepEqual(events.map(e => e.type), ['captured']);
  stepZone(zone, [actor(1, 0, 0, 0), actor(2, 1, 1, 0)], .5); assert.equal(zone.contested, true); assert.equal(zone.owner, 0);
  events = []; for (let i = 0; i < 60; i++) events.push(...stepZone(zone, [actor(2, 1, 0, 0)], .05));
  assert.deepEqual(events.map(e => e.type), ['neutral', 'captured']); assert.equal(zone.owner, 1);
});

test('match end: score limit, winner by score, tie-breaks, draw', () => {
  assert.equal(reachedLimit([2, 3], 3), 1); assert.equal(reachedLimit([2, 2], 3), null);
  assert.equal(decideWinner([2, 1]), 0); assert.equal(decideWinner([1, 1], [[1, 0]]), 0);
  assert.equal(decideWinner([1, 1], [[1, 1], [-2, -1]]), 1); assert.equal(decideWinner([1, 1], [[1, 1], [0, 0]]), null);
  const flags = [createFlag(0, { x: 0, z: 0 }), createFlag(1, { x: 5, z: 0 })];
  dropCarried(flags, actor(9, 1, 0, 0));
  assert.deepEqual(flagTieBreaks(flags), [[1, 1], [-0, -0]]);
});
