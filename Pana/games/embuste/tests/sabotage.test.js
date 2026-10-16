import test from 'node:test';
import assert from 'node:assert/strict';
import { Night, VISION, TRAPS, guardianLooks } from '../public/rules.js';
import { FIXES, BELL, walkable } from '../public/layout.js';

function night(n = 5, seed = 7, options = {}) {
  const g = new Night(options);
  for (let i = 1; i <= n; i++) g.addPlayer(i, { name: `P${i}`, avatar: {} });
  g.start(seed);
  g.update(g.timers.reveal + 0.01);
  g.sabCooldown = 0;
  return g;
}
const mummies = g => [...g.players.values()].filter(p => p.role === 'momia');
const panas = g => [...g.players.values()].filter(p => p.role === 'pana');
const at = (p, x, z) => Object.assign(p, { x, z });
const holding = (...ps) => new Map(ps.map(p => [p.seat, { x: 0, z: 0, hold: true }]));
// Hold E for `seconds` with these panas.
function hold(g, seconds, ...ps) { for (let t = 0; t < seconds; t += 0.1) g.update(0.1, holding(...ps)); }

test('only mummies sabotage, one at a time, on a shared cooldown, never in a meeting', () => {
  const g = night(7, 3), [m, m2] = mummies(g), [p] = panas(g);
  assert.equal(g.act(p.seat, 'sabotage', { kind: 'apagar' }), false);
  assert.equal(g.act(m.seat, 'sabotage', { kind: 'nada' }), false);
  assert.equal(g.act(m.seat, 'sabotage', { kind: 'apagar' }), true);
  assert.equal(g.act(m2.seat, 'sabotage', { kind: 'radio' }), false, 'the cooldown is shared');
  g.sabCooldown = 0;
  assert.equal(g.act(m2.seat, 'sabotage', { kind: 'radio' }), false, 'one alarm at a time');
  at(p, BELL.x, BELL.z + 1.2);
  assert.equal(g.act(p.seat, 'bell'), false, 'no bell during an alarm');
  g.clearSabotage(); g.sabCooldown = 0;
  g.act(p.seat, 'bell');
  assert.equal(g.phase, 'meeting');
  assert.equal(g.act(m.seat, 'sabotage', { kind: 'apagar' }), false, 'no sabotage in a meeting');
});

test('apagar la reliquia: panas nearly blind until two of them relight it', () => {
  const g = night(6, 5), [m] = mummies(g), [a, b] = panas(g);
  g.act(m.seat, 'sabotage', { kind: 'apagar' });
  assert.equal(g.vision(a), VISION.dark);
  assert.ok(g.vision(m) > VISION.dark, 'mummies see fine');
  assert.ok(g.view(a.seat).world.lightsOut);
  const relic = FIXES.apagar[0];
  at(a, relic.x + 1.2, relic.z); at(b, relic.x - 1.2, relic.z);
  hold(g, g.timers.fixPair * 2, a);
  assert.ok(g.sabotage, 'one pana is not enough');
  hold(g, g.timers.fixPair + 0.2, a, b);
  assert.equal(g.sabotage, null);
  assert.equal(g.vision(a) > VISION.dark, true);
});

test('cortar el puente: nobody crosses until someone fixes an end', () => {
  const g = night(5, 5), [m] = mummies(g), [p] = panas(g);
  g.act(m.seat, 'sabotage', { kind: 'puente' });
  assert.equal(walkable(-17, 0, g.terrain()), false);
  at(p, -12, 0);
  for (let i = 0; i < 20; i++) g.update(0.1, new Map([[p.seat, { x: -1, z: 0 }]]));
  assert.ok(p.x > -15, `stopped at the gap (${p.x.toFixed(1)})`);
  const end = FIXES.puente[0]; at(p, end.x, end.z + 0.5);
  hold(g, g.timers.fix + 0.2, p);
  assert.equal(g.bridgeCut, false);
});

test('interferir la radio: no meetings and no task list until the antenna is fixed', () => {
  const g = night(5, 5), [m] = mummies(g), [p, q] = panas(g);
  at(p, 20, -28); at(q, 21.5, -28); m.cooldown = 0; at(m, 20.5, -27); g.act(m.seat, 'wrap');
  g.act(m.seat, 'sabotage', { kind: 'radio' });
  const victim = [p, q].find(x => !x.alive), finder = [p, q].find(x => x.alive);
  at(finder, victim.x + 1, victim.z);
  assert.equal(g.act(finder.seat, 'report'), false, 'the radio is down');
  assert.ok(g.view(finder.seat).world.jammed);
  const antenna = FIXES.radio[0]; at(finder, antenna.x, antenna.z + 0.5);
  hold(g, g.timers.fix + 0.2, finder);
  assert.equal(g.jammed, false);
});

test('crecida del río: two panas at the two levers at once, or the mummies win', () => {
  const g = night(6, 5), [m] = mummies(g), [a, b] = panas(g);
  g.act(m.seat, 'sabotage', { kind: 'crecida' });
  assert.ok(g.view(a.seat).sabotage.t > 0, 'everyone sees the countdown');
  const [l1, l2] = FIXES.crecida;
  at(a, l1.x, l1.z); at(b, l1.x + 0.5, l1.z);
  hold(g, g.timers.fixPair * 2, a, b);
  assert.ok(g.sabotage, 'both at one lever does nothing');
  at(b, l2.x, l2.z);
  hold(g, g.timers.fixPair + 0.2, a, b);
  assert.equal(g.sabotage, null, 'fixed');
  g.sabCooldown = 0;
  g.act(m.seat, 'sabotage', { kind: 'crecida' });
  g.update(g.timers.crecida + 0.1);
  assert.deepEqual(g.ending, { winner: 'momias', reason: 'flood' });
});

test('¡un, dos, tres, momia!: moving while the guardian looks freezes you; it ends by itself', () => {
  const g = night(6, 5), [m] = mummies(g), [a, b] = panas(g);
  at(a, 0, 6); at(b, 3, 6); at(m, -3, 6);
  g.act(m.seat, 'sabotage', { kind: 'momia' });
  assert.ok(g.view(m.seat).sabotage.next > 0, 'the saboteur knows when it turns');
  assert.equal(g.view(a.seat).sabotage.next, undefined, 'panas do not');
  const walk = new Map([[a.seat, { x: 1, z: 0 }], [m.seat, { x: 1, z: 0 }]]);
  while (!g.sabotage.looking) g.update(0.05, walk);
  for (let i = 0; i < 4; i++) g.update(0.05, walk);
  assert.ok(a.frozen > 0, 'the walker is frozen');
  assert.ok(!b.frozen, 'standing still is safe');
  assert.ok(!m.frozen, 'the mummies are not caught');
  const x = a.x; g.update(0.5, walk);
  assert.equal(a.x, x, 'frozen means frozen');
  g.update(g.timers.momia);
  assert.equal(g.sabotage, null);
  assert.ok(guardianLooks(4.5) && !guardianLooks(1));
});

test('trampa de bejuco: invisible to panas, one-shot, holds the first pana', () => {
  const g = night(6, 5), [m] = mummies(g), [a, b] = panas(g);
  at(m, 24, -28); at(a, 24, -24); at(b, 30, -28);
  assert.equal(g.act(m.seat, 'sabotage', { kind: 'bejuco' }), true);
  assert.equal(g.sabotage, null, 'a trap is not an alarm');
  assert.equal(g.view(m.seat).traps.length, 1);
  assert.equal(g.view(a.seat).traps.length, 0, 'panas never see traps');
  for (let i = 0; i < 20 && !a.stuck; i++) g.update(0.1, new Map([[a.seat, { x: 0, z: -1 }]]));
  assert.ok(a.stuck > 0, 'snared');
  assert.equal(g.traps.length, 0, 'gone after one catch');
  for (let i = 0; i < TRAPS; i++) { g.sabCooldown = 0; at(m, 20 + i * 3, -28); assert.equal(g.act(m.seat, 'sabotage', { kind: 'bejuco' }), true); }
  g.sabCooldown = 0;
  assert.equal(g.act(m.seat, 'sabotage', { kind: 'bejuco' }), false, `at most ${TRAPS} traps`);
});

test('a meeting clears every alarm', () => {
  const g = night(5, 5), [m] = mummies(g), [p] = panas(g);
  g.act(m.seat, 'sabotage', { kind: 'puente' });
  g.startMeeting(p, null);
  assert.equal(g.sabotage, null);
  assert.equal(g.bridgeCut, false);
});
