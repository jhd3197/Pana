import test from 'node:test';
import assert from 'node:assert/strict';
import { Night, DISGUISE_CHARGES } from '../public/rules.js';
import { ventById, hideById, VENTS } from '../public/layout.js';

function night(n = 5, seed = 7, options = {}) {
  const g = new Night(options);
  for (let i = 1; i <= n; i++) g.addPlayer(i, { name: `P${i}`, avatar: {} });
  g.start(seed);
  g.update(g.timers.reveal + 0.01);
  return g;
}
const mummies = g => [...g.players.values()].filter(p => p.role === 'momia');
const panas = g => [...g.players.values()].filter(p => p.role === 'pana');
const at = (p, x, z) => Object.assign(p, { x, z });
const next = (spot, dz = 1) => ({ x: spot.x, z: spot.z + dz });

test('only mummies use the logs, and a pana nearby sees the log shake', () => {
  const g = night(6, 4), [m] = mummies(g), [p, watcher, far] = panas(g);
  const log = ventById('tronco-cascada'), other = ventById(log.link);
  at(p, log.x + 0.5, log.z); at(m, log.x + 0.6, log.z + 0.5); at(watcher, log.x + 4, log.z + 2); at(far, 0, 5);
  assert.equal(g.act(p.seat, 'vent'), false, 'a pana cannot');
  const since = g.eventId;
  assert.equal(g.act(m.seat, 'vent'), true);
  assert.ok(g.view(watcher.seat, since).events.some(e => e.kind === 'shake' && e.spot === log.id), 'the watcher sees the shake');
  assert.ok(!g.view(far.seat, since).events.some(e => e.kind === 'shake'), 'the fogata does not');
  assert.ok(!g.view(watcher.seat).players.some(q => q.seat === m.seat), 'a mummy in a log is out of sight');
  g.update(1, new Map([[m.seat, { x: 1, z: 0 }]]));
  assert.deepEqual([m.x, m.z], [log.x, log.z], 'nobody walks inside a log');
  assert.equal(g.act(m.seat, 'vent', { move: true }), true);
  assert.deepEqual([m.x, m.z], [other.x, other.z], 'across the map');
  assert.equal(g.act(m.seat, 'vent'), true);
  assert.equal(m.hidden, null);
});

test('no wrapping from inside a log', () => {
  const g = night(5, 4), [m] = mummies(g), [p] = panas(g);
  const log = VENTS[0]; at(m, log.x, log.z); m.cooldown = 0;
  g.act(m.seat, 'vent'); at(p, log.x + 1, log.z);
  assert.equal(g.act(m.seat, 'wrap'), false);
});

test('disguises: a few charges, a prop to everyone else, broken by walking', () => {
  const g = night(7, 9), [m, partner] = mummies(g), [p] = panas(g);
  at(m, 20, -28); at(partner, 22, -27); at(p, 23, -29);
  assert.equal(g.act(p.seat, 'disguise', { prop: 'barrel' }), false, 'panas have no disguises');
  assert.equal(g.act(m.seat, 'disguise', { prop: 'piano' }), false, 'only the camp props');
  assert.equal(g.act(m.seat, 'disguise', { prop: 'barrel' }), true);
  assert.equal(m.disguises, DISGUISE_CHARGES - 1);
  const seen = g.view(p.seat).players.find(q => q.prop === 'barrel');
  assert.ok(seen && seen.seat === null && seen.key, 'the pana sees a barrel, with no name');
  assert.ok(!JSON.stringify(g.view(p.seat).players).includes(`"seat":${m.seat},`), 'the mummy is nowhere in the pana view');
  assert.equal(g.view(partner.seat).players.find(q => q.prop).seat, m.seat, 'the partner knows the barrel');
  assert.equal(g.act(m.seat, 'wrap'), false, 'a barrel cannot wrap');
  g.update(0.1, new Map([[m.seat, { x: 1, z: 0 }]]));
  assert.equal(m.disguise, null, 'walking breaks it');
  g.act(m.seat, 'disguise', { prop: 'crate' }); g.update(g.timers.disguise + 0.1);
  assert.equal(m.disguise, null, 'and it wears off');
  g.act(m.seat, 'disguise', { prop: 'cooler' });
  assert.equal(g.act(m.seat, 'disguise', { prop: 'cooler' }), true, 'pressing again drops it');
  assert.equal(m.disguises, 0);
  assert.equal(g.act(m.seat, 'disguise', { prop: 'barrel' }), false, 'out of charges');
});

test('hidden panas cannot be wrapped, cannot work, and get kicked out', () => {
  const g = night(5, 2), [m] = mummies(g), [p, q] = panas(g);
  const cava = hideById('cava');
  at(p, cava.x, cava.z - 1.3); at(m, cava.x - 1, cava.z - 1.5); m.cooldown = 0;
  assert.equal(g.act(p.seat, 'hide'), true);
  assert.equal(g.act(m.seat, 'wrap'), false, 'safe in the cava');
  assert.equal(g.act(p.seat, 'task', { station: 'arepas' }), false, 'no chores from inside');
  at(q, cava.x + 1, cava.z - 1.3);
  assert.equal(g.act(q.seat, 'hide'), false, 'one pana per spot');
  g.update(g.timers.hide + 0.1);
  assert.equal(p.hidden, null, 'kicked out after a while');
  assert.ok(g.view(p.seat).events.some(e => e.kind === 'kicked'));
  assert.equal(g.act(p.seat, 'hide'), false, 'and has to wait to hide again');
  g.update(g.timers.hideCooldown);
  assert.equal(g.act(p.seat, 'hide'), true);
  assert.equal(g.act(p.seat, 'hide'), true, 'pressing again comes out');
  assert.equal(p.hidden, null);
});

test('a wrap leaves sandy footprints for a few seconds', () => {
  const g = night(5, 2), [m] = mummies(g), [p, q] = panas(g);
  at(m, 20, -28); at(p, 21.5, -28); m.cooldown = 0; at(q, 24, -24);
  g.act(m.seat, 'wrap');
  for (let i = 0; i < 20; i++) g.update(0.1, new Map([[m.seat, { x: 0, z: 1 }]]));
  const prints = g.view(q.seat).footprints;
  assert.ok(prints.length >= 3, `footprints left (${prints.length})`);
  assert.ok(prints.every(f => !('seat' in f) && !('by' in f)), 'footprints carry no name');
  const before = g.footprints.length;
  g.update(g.timers.tracks, new Map([[m.seat, { x: 0, z: 1 }]]));
  for (let i = 0; i < 10; i++) g.update(0.1, new Map([[m.seat, { x: 0, z: 1 }]]));
  assert.ok(g.footprints.length <= before + 2, 'the trail stops');
  g.update(g.timers.footprints + 1);
  assert.equal(g.footprints.length, 0, 'and fades');
});

test('a meeting pulls everyone out of hiding', () => {
  const g = night(5, 2), [m] = mummies(g), [p, q] = panas(g);
  const cava = hideById('cava'); at(p, cava.x, cava.z - 1.3); g.act(p.seat, 'hide');
  at(m, VENTS[0].x, VENTS[0].z); g.act(m.seat, 'vent');
  at(q, 5, 5.2); g.act(q.seat, 'bell');
  assert.equal(g.phase, 'meeting');
  assert.ok([p, m].every(x => x.hidden === null));
});
