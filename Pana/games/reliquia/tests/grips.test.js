import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS } from '../public/items.js';
import { GRIP_KINDS, gripFor } from '../public/grips.js';

test('every tool has its own grip, closed round its handle', () => {
  for (const [kind, info] of Object.entries(ITEMS)) if (info.tool) {
    assert.ok(GRIP_KINDS.includes(kind), kind);
    assert.equal(gripFor({ kind }).shape, 'fist', kind);
  }
});

test('empty hands rest open, loot sits on the palm', () => {
  assert.equal(gripFor(null).shape, 'open');
  for (const [kind, info] of Object.entries(ITEMS)) if (!info.tool && info.size !== 'big') assert.equal(gripFor({ kind }).shape, 'cup', kind);
  assert.equal(gripFor({ kind: 'coins', pile: ['coins'] }).shape, 'cup');
});

test('every row is a whole pose with finite numbers', () => {
  for (const kind of [...Object.keys(ITEMS), 'nothing']) {
    const { rest, table, scale, at, turn } = gripFor({ kind });
    for (const pose of [rest, table.rest, table.cocked, table.through]) { assert.equal(pose.length, 6, kind); assert.ok(pose.every(Number.isFinite), kind); }
    assert.ok(scale > 0, kind); assert.equal(at.length, 3); assert.equal(turn.length, 3);
  }
});

test('a blow is over before the rules let you swing again', () => {
  // p.cooldown in rules.js: .45 s for a melee blow, .5 s for the machete, .16 s for the marker.
  const length = kind => { const { windup, recovery } = gripFor({ kind }).blow; return windup + recovery; };
  assert.ok(length('machete') <= .5); assert.ok(length('idol') <= .45); assert.ok(length('marcadora') <= .16);
});
