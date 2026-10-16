import test from 'node:test';
import assert from 'node:assert/strict';
import { Night, dealRoles, checkWin, mummyCount, seeded } from '../public/rules.js';

// A night with n players (seats 1..n), past the reveal, roles dealt by `seed`.
export function night(n = 5, seed = 7, options = {}) {
  const g = new Night(options);
  for (let i = 1; i <= n; i++) g.addPlayer(i, { name: `P${i}`, avatar: {} });
  g.start(seed);
  g.update(g.timers.reveal + 0.01);
  return g;
}
const roles = g => [...g.players.values()];
const mummies = g => roles(g).filter(p => p.role === 'momia');
const panas = g => roles(g).filter(p => p.role === 'pana');

test('one mummy for 4–6 panas, two for 7–8', () => {
  for (const [n, k] of [[4, 1], [5, 1], [6, 1], [7, 2], [8, 2]]) {
    assert.equal(mummyCount(n), k);
    for (let seed = 1; seed < 30; seed++) {
      const dealt = dealRoles([...Array(n).keys()], seeded(seed));
      assert.equal([...dealt.values()].filter(r => r === 'momia').length, k, `${n} players, seed ${seed}`);
    }
  }
});

test('every seat can end up the mummy', () => {
  const seen = new Set();
  for (let seed = 1; seed < 200; seed++) for (const [s, r] of dealRoles([1, 2, 3, 4, 5], seeded(seed))) if (r === 'momia') seen.add(s);
  assert.deepEqual([...seen].sort(), [1, 2, 3, 4, 5]);
});

test('mummies know each other; nobody else learns any role', () => {
  const g = night(8, 3);
  const [a, b] = mummies(g);
  const va = g.view(a.seat);
  assert.equal(va.me.role, 'momia');
  assert.deepEqual(va.partners, [b.seat]);
  assert.equal(va.roster.find(r => r.seat === b.seat).role, 'momia');
  assert.ok(va.roster.filter(r => r.seat !== a.seat && r.seat !== b.seat).every(r => r.role === null), 'a mummy does not see pana roles');
  for (const p of panas(g)) {
    const v = g.view(p.seat);
    assert.equal(v.me.role, 'pana');
    assert.deepEqual(v.partners, []);
    assert.ok(v.roster.filter(r => r.seat !== p.seat).every(r => r.role === null), `${p.name} sees no other role`);
    assert.ok(!JSON.stringify(v).includes('momia'), `${p.name}'s view never says momia`);
  }
});

test('the reveal comes first, then the night', () => {
  const g = new Night();
  for (let i = 1; i <= 4; i++) g.addPlayer(i, { name: `P${i}` });
  g.start(1);
  assert.equal(g.phase, 'reveal');
  g.update(1, new Map([[1, { x: 1, z: 0 }]]));
  assert.equal(g.players.get(1).moving, false, 'nobody moves during the reveal');
  g.update(g.timers.reveal);
  assert.equal(g.phase, 'playing');
  assert.ok(g.view(1).events.some(e => e.kind === 'night'));
});

test('win checks', () => {
  const P = (role, alive = true) => ({ role, alive });
  assert.equal(checkWin([P('momia'), P('pana'), P('pana'), P('pana')]), null);
  assert.deepEqual(checkWin([P('momia', false), P('pana'), P('pana')]), { winner: 'panas', reason: 'votes' });
  assert.deepEqual(checkWin([P('momia'), P('pana'), P('pana', false), P('pana', false)]), { winner: 'momias', reason: 'numbers' });
  assert.deepEqual(checkWin([P('momia'), P('momia'), P('pana'), P('pana')]), { winner: 'momias', reason: 'numbers' });
  assert.deepEqual(checkWin([P('momia'), P('pana'), P('pana'), P('pana')], { done: 10, total: 10 }), { winner: 'panas', reason: 'tasks' });
  assert.equal(checkWin([P('momia'), P('pana'), P('pana'), P('pana')], { done: 0, total: 0 }), null, 'an empty bar wins nothing');
});

test('a mummy who leaves counts as voted out', () => {
  const g = night(4, 11);
  g.removePlayer(mummies(g)[0].seat);
  assert.equal(g.phase, 'ended');
  assert.deepEqual(g.ending, { winner: 'panas', reason: 'votes' });
});

test('panas leaving can hand the night to the mummy', () => {
  const g = night(4, 11);
  const [x, y] = panas(g);
  g.removePlayer(x.seat);
  assert.equal(g.phase, 'playing');
  g.removePlayer(y.seat);
  assert.deepEqual(g.ending, { winner: 'momias', reason: 'numbers' });
});

test('late joiners spectate until the next round', () => {
  const g = night(4, 2);
  const late = g.addPlayer(9, { name: 'Tarde' });
  assert.equal(late.spectator, true);
  assert.equal(g.view(9).me.ghost, true);
  g.end('panas', 'votes'); g.start(5);
  assert.equal(g.players.get(9).spectator, false);
});

test('walls stop the living, not the ghosts', () => {
  const g = night(4, 2);
  const p = g.players.get(1); Object.assign(p, { x: 0, z: -8 });
  for (let i = 0; i < 40; i++) g.update(0.05, new Map([[1, { x: 0, z: -1 }]]));
  assert.ok(p.z > -10, `stopped at the north edge of the fogata (${p.z.toFixed(2)})`);
  p.alive = false;
  for (let i = 0; i < 20; i++) g.update(0.05, new Map([[1, { x: 0, z: -1 }]]));
  assert.ok(p.z < -12, 'a ghost floats through');
});
