import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, explode, center, healthOf, HEALTH } from '../public/rules.js';
import { matchView, mirror } from '../public/online.js';
import { tagHealth, stackTags } from '../public/tags.js';

test('health is what paint a capi has left: full, hit, painted out, in the river', () => {
  const m = createMatch({ seed: 7 }), c = m.capys.find(k => k.team === 1);
  assert.equal(healthOf(c), HEALTH);
  const o = center(c); explode(m, o.x - 1, o.y, 0);
  assert.ok(c.paint > 0 && healthOf(c) === HEALTH - c.paint, `hit: ${healthOf(c)} = ${HEALTH} - ${c.paint}`);
  c.paint = 90; explode(m, c.x, c.y + .7, 0);
  assert.equal(c.out, 'paint'); assert.equal(healthOf(c), 0);
  assert.equal(healthOf({ paint: 20, out: 'water' }), 0, 'in the river: nothing left');
});

test('a guest reads the host\'s health from each snapshot, not its own old copy', () => {
  const host = createMatch({ seed: 9 });
  let { view } = mirror(null, { match: matchView(host) });
  const id = host.capys[0].id, mine = () => view.capys.find(c => c.id === id);
  assert.equal(healthOf(mine()), HEALTH);
  host.capys[0].paint = 35;
  ({ view } = mirror(view, { match: matchView(host) }));
  assert.equal(healthOf(mine()), 65);
  host.capys[0].paint = 100; host.capys[0].out = 'paint';
  ({ view } = mirror(view, { match: matchView(host) }));
  assert.equal(healthOf(mine()), 0);
});

test('the tag shows the number and turns yellow, then red', () => {
  assert.deepEqual(tagHealth(100), { text: '100', band: 'ok' });
  assert.deepEqual(tagHealth(61), { text: '61', band: 'ok' });
  assert.deepEqual(tagHealth(60), { text: '60', band: 'low' });
  assert.deepEqual(tagHealth(12.4), { text: '12', band: 'bad' });
  assert.deepEqual(tagHealth(-5), { text: '0', band: 'bad' });
});

test('tags that would cover each other stack up; apart ones stay put', () => {
  const ys = stackTags([{ id: 'a', x: 100, y: 200, w: 60, h: 20 }, { id: 'b', x: 120, y: 195, w: 60, h: 20 }, { id: 'c', x: 400, y: 200, w: 60, h: 20 }]);
  assert.equal(ys.get('a'), 200, 'the lowest stays');
  assert.equal(ys.get('c'), 200, 'far apart: untouched');
  assert.ok(ys.get('b') <= 200 - 20 - 2, `pushed above a: ${ys.get('b')}`);
  // Three in a pile: each above the last.
  const pile = stackTags(['x', 'y', 'z'].map((id, i) => ({ id, x: 50, y: 100 - i, w: 40, h: 18 })));
  const sorted = [...pile.values()].sort((a, b) => b - a);
  for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i - 1] - sorted[i] >= 20, 'no two overlap');
});
