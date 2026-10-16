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

// ---------- tasks ----------
import { TASKS, TASKS_EACH, taskById } from '../public/rules.js';
import { stationById } from '../public/layout.js';

// Put `p` at a station, start its task there and wait the least time.
function work(g, p, station, { wait = true } = {}) {
  const s = stationById(station); Object.assign(p, { x: s.x, z: s.z + 1.2 });
  const started = g.act(p.seat, 'task', { station });
  if (wait) g.update(10);
  return started && g.act(p.seat, 'done', { station });
}
// Give `p` exactly these tasks.
const give = (p, ...ids) => { p.tasks = ids.map(id => ({ id, step: 0 })); };

test('everyone gets a task list, mummies too (to pretend)', () => {
  const g = night(6, 4);
  for (const p of g.players.values()) {
    assert.equal(p.tasks.length, TASKS_EACH);
    assert.equal(new Set(p.tasks.map(t => t.id)).size, TASKS_EACH, 'no chore twice');
  }
  assert.equal(g.bar().total, TASKS_EACH * 5, 'only the five panas fill the bar');
});

test('a task counts once, at its station, after its least time', () => {
  const g = night(5, 4), p = panas(g)[0];
  give(p, 'agua', 'radio');
  const s = stationById('agua');
  Object.assign(p, { x: 0, z: 4 });
  assert.equal(g.act(p.seat, 'task', { station: 'agua' }), false, 'too far from the poza');
  Object.assign(p, { x: s.x, z: s.z + 1.2 });
  assert.equal(g.act(p.seat, 'task', { station: 'malacate' }), false, 'not a station on the list');
  assert.equal(g.act(p.seat, 'task', { station: 'agua' }), true);
  assert.equal(g.act(p.seat, 'done', { station: 'agua' }), false, 'too fast');
  g.update(taskById('agua').seconds * g.timers.task);
  const before = g.bar().done;
  assert.equal(g.act(p.seat, 'done', { station: 'agua' }), true);
  assert.equal(g.bar().done, before + 1);
  assert.equal(g.act(p.seat, 'done', { station: 'agua' }), false, 'no second time');
  assert.equal(work(g, p, 'agua'), false, 'a finished chore stays finished');
  assert.equal(g.bar().done, before + 1);
});

test('working holds you in place; cancelling lets you go', () => {
  const g = night(5, 4), p = panas(g)[0];
  give(p, 'radio');
  const s = stationById('radio'); Object.assign(p, { x: s.x, z: s.z - 1.2 });
  g.act(p.seat, 'task', { station: 'radio' });
  g.update(0.5, new Map([[p.seat, { x: -1, z: 0 }]]));
  assert.equal(p.x, s.x);
  g.act(p.seat, 'cancel');
  g.update(0.5, new Map([[p.seat, { x: -1, z: 0 }]]));
  assert.ok(p.x < s.x);
});

test('momiitas still add progress; mummies never do', () => {
  const g = night(6, 9), [p] = panas(g), [m] = mummies(g);
  give(p, 'arepas'); give(m, 'arepas');
  const before = g.bar().done;
  assert.equal(work(g, m, 'arepas'), true, 'the mummy can fake it');
  assert.equal(g.bar().done, before, 'faking adds nothing');
  assert.ok(g.view(m.seat).events.some(e => e.kind === 'task' && e.fake));
  p.alive = false;
  assert.equal(work(g, p, 'arepas'), true, 'a momiita keeps working');
  assert.equal(g.bar().done, before + 1);
});

test('provisiones takes two stations, in order', () => {
  const g = night(5, 3), p = panas(g)[0];
  give(p, 'provisiones');
  assert.equal(work(g, p, 'prov-cocina'), false, 'the kitchen comes second');
  assert.equal(work(g, p, 'prov-muelle'), true);
  assert.equal(g.bar().done, 0, 'half a task is not a task');
  assert.equal(work(g, p, 'prov-cocina'), true);
  assert.equal(p.tasks[0].step, 2);
});

test('only someone who can see the winch sees it turn', () => {
  const g = night(5, 3), [doer, near, far] = panas(g);
  give(doer, 'malacate');
  const s = stationById('malacate');
  Object.assign(near, { x: s.x + 3, z: s.z + 3 }); Object.assign(far, { x: 0, z: 4 });
  const since = g.eventId;
  assert.equal(work(g, doer, 'malacate'), true);
  assert.ok(g.view(near.seat, since).events.some(e => e.kind === 'visual'), 'a pana nearby sees it');
  assert.ok(!g.view(far.seat, since).events.some(e => e.kind === 'visual'), 'the fogata does not');
  assert.ok(g.view(near.seat).world.winch > 0);
  assert.equal(g.view(far.seat).world.winch, undefined);
});

test('a full dawn bar wins for the panas', () => {
  const g = night(4, 6);
  for (const p of panas(g)) give(p, 'agua');
  for (const p of panas(g)) work(g, p, 'agua');
  assert.deepEqual(g.ending, { winner: 'panas', reason: 'tasks' });
});

test('every chore has a station on the map', () => {
  for (const t of TASKS) for (const s of t.stations) assert.ok(stationById(s), `${t.id} → ${s}`);
});
