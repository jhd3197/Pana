import test from 'node:test';
import assert from 'node:assert/strict';
import { Night, tally, PHRASES, WRAP_RANGE } from '../public/rules.js';
import { BELL } from '../public/layout.js';

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
// Run the clock forward until test() holds.
function until(g, test, max = 200) { for (let i = 0; i < max && !test(); i++) g.update(0.5); }
const ringBell = (g, p) => { at(p, BELL.x, BELL.z + 1.2); return g.act(p.seat, 'bell'); };

test('vote tally: most votes goes; ties and skips send nobody', () => {
  const V = (...pairs) => new Map(pairs);
  assert.equal(tally(V([1, 3], [2, 3], [3, 4])).ejected, 3);
  assert.deepEqual([tally(V([1, 3], [2, 4])).ejected, tally(V([1, 3], [2, 4])).tie], [null, true]);
  const skipped = tally(V([1, 'skip'], [2, 'skip'], [3, 4]));
  assert.deepEqual([skipped.ejected, skipped.skipped], [null, true]);
  assert.equal(tally(V([1, 'skip'], [2, 4])).ejected, null, 'skip tied with a name');
  assert.equal(tally(new Map()).ejected, null, 'nobody voted');
});

test('only a mummy wraps, in range, off cooldown, never another mummy', () => {
  const g = night(8, 21), [m, m2] = mummies(g), [p, q] = panas(g);
  at(m, -30, -28); at(m2, -30, -27); at(p, 20, 20); at(q, 0, 5);
  assert.equal(g.act(p.seat, 'wrap'), false, 'a pana cannot wrap');
  m.cooldown = 0;
  assert.equal(g.act(m.seat, 'wrap'), false, 'nobody in range (the partner does not count)');
  at(p, -30 + WRAP_RANGE + 0.5, -28);
  assert.equal(g.act(m.seat, 'wrap'), false, 'too far');
  at(p, -30 + WRAP_RANGE - 0.3, -28);
  m.cooldown = 3;
  assert.equal(g.act(m.seat, 'wrap'), false, 'cooling down');
  m.cooldown = 0;
  assert.equal(g.act(m.seat, 'wrap'), true);
  assert.equal(p.alive, false);
  assert.deepEqual(g.statues.map(s => s.seat), [p.seat]);
  assert.equal(m.cooldown, g.timers.wrap);
  assert.ok(g.view(p.seat).me.ghost, 'the victim is a momiita now');
});

test('the first wrap waits for the night to settle', () => {
  const g = night(5, 21), [m] = mummies(g), [p] = panas(g);
  at(m, 20, -28); at(p, 21, -28);
  assert.ok(m.cooldown > 0);
  assert.equal(g.act(m.seat, 'wrap'), false);
  g.update(g.timers.firstWrap);
  assert.equal(g.act(m.seat, 'wrap'), true);
});

test('who learns about a wrap: the victim, the mummies and witnesses', () => {
  const g = night(7, 5), [m, m2] = mummies(g), [p, witness, away] = panas(g);
  at(m, 20, -28); at(p, 21.5, -28); at(witness, 24, -26); at(away, 0, 5); at(m2, 0, 6);
  m.cooldown = 0;
  const since = g.eventId;
  g.act(m.seat, 'wrap');
  const told = seat => g.view(seat, since).events.find(e => e.kind === 'wrap');
  assert.equal(told(p.seat).by, m.seat);
  assert.equal(told(m2.seat).by, m.seat, 'the partner knows');
  assert.equal(told(witness.seat).by, m.seat, 'someone who saw it knows');
  assert.equal(told(away.seat), undefined, 'the fogata hears nothing');
  assert.equal(g.view(away.seat).statues.length, 0, 'and sees no statue');
  assert.equal(g.view(witness.seat).statues.length, 1);
});

test('reporting a statue calls a meeting at the fogata', () => {
  const g = night(6, 5), [m] = mummies(g), [p, finder, other] = panas(g);
  at(m, 20, -28); at(p, 21.5, -28); m.cooldown = 0; g.act(m.seat, 'wrap');
  at(finder, 0, 5);
  assert.equal(g.act(finder.seat, 'report'), false, 'no statue in reach');
  at(finder, 25, -28);
  assert.equal(g.act(p.seat, 'report'), false, 'a momiita cannot report');
  assert.equal(g.act(finder.seat, 'report'), true);
  assert.equal(g.phase, 'meeting');
  assert.deepEqual([g.meeting.by, g.meeting.body], [finder.seat, p.seat]);
  for (const q of g.active()) assert.ok(Math.hypot(q.x, q.z) < 5, `${q.name} pulled to the fire`);
  assert.ok(g.view(other.seat).roster.find(r => r.seat === p.seat).out, 'everyone now knows who is out');
});

test('the bell: one emergency each, only at the fogata, not right after a meeting', () => {
  const g = night(5, 8), [p, q] = panas(g);
  at(p, 10, 10);
  assert.equal(g.act(p.seat, 'bell'), false, 'too far from the bell');
  assert.equal(ringBell(g, p), true);
  until(g, () => g.phase === 'playing');
  assert.equal(ringBell(g, q), false, 'cooling down after the meeting');
  g.update(g.timers.bell);
  assert.equal(ringBell(g, p), false, 'p used theirs');
  assert.equal(ringBell(g, q), true);
});

test('a meeting: talk, vote, the curiara, then the night goes on', () => {
  const g = night(6, 12, { reveal: true }), [m] = mummies(g), ps = panas(g);
  ringBell(g, ps[0]);
  assert.equal(g.act(ps[1].seat, 'vote', { target: m.seat }), false, 'no voting while they talk');
  assert.equal(g.act(ps[1].seat, 'chat', { phrase: 0 }), true);
  assert.equal(g.act(ps[1].seat, 'chat', { phrase: 1 }), false, 'one line a second');
  until(g, () => g.meeting.stage === 'vote');
  assert.equal(g.act(ps[0].seat, 'vote', { target: 99 }), false, 'no such pana');
  for (const p of ps.slice(0, 4)) assert.equal(g.act(p.seat, 'vote', { target: m.seat }), true);
  assert.equal(g.act(ps[0].seat, 'vote', { target: 'skip' }), false, 'one vote each');
  g.act(ps[4].seat, 'vote', { target: 'skip' });
  assert.equal(g.meeting.stage, 'vote');
  g.act(m.seat, 'vote', { target: ps[0].seat });
  g.update(0.1);
  assert.equal(g.meeting.stage, 'eject', 'everyone voted: no waiting for the clock');
  const v = g.view(ps[1].seat);
  assert.equal(v.meeting.result.ejected, m.seat);
  assert.equal(v.meeting.result.role, 'momia', 'the room shows what they were');
  until(g, () => g.phase !== 'meeting');
  assert.deepEqual(g.ending, { winner: 'panas', reason: 'votes' });
});

test('without the reveal option, nobody learns what the ejected pana was', () => {
  const g = night(6, 12, { reveal: false }), ps = panas(g);
  ringBell(g, ps[0]);
  until(g, () => g.meeting.stage === 'vote');
  for (const p of g.active()) g.act(p.seat, 'vote', { target: p === ps[4] ? ps[0].seat : ps[4].seat });
  g.update(0.1);
  const v = g.view(ps[0].seat);
  assert.equal(v.meeting.result.ejected, ps[4].seat);
  assert.equal(v.meeting.result.role, null);
  assert.equal(v.roster.find(r => r.seat === ps[4].seat).role, null);
  until(g, () => g.phase !== 'meeting');
  assert.equal(g.phase, 'playing', 'a pana went down the river; the night goes on');
  assert.equal(g.statues.length, 0);
});

test('ghosts cannot vote or talk; free text only when the room allows it', () => {
  const g = night(6, 3, { chat: false }), ps = panas(g);
  ps[3].alive = false;
  ringBell(g, ps[0]);
  assert.equal(g.act(ps[3].seat, 'chat', { phrase: 2 }), false);
  assert.equal(g.act(ps[0].seat, 'chat', { text: 'fue Lapa' }), false, 'free text is off');
  assert.equal(g.act(ps[0].seat, 'chat', { phrase: PHRASES.length - 1 }), true);
  until(g, () => g.meeting.stage === 'vote');
  assert.equal(g.act(ps[3].seat, 'vote', { target: 'skip' }), false);
  assert.equal(g.act(ps[0].seat, 'vote', { target: ps[3].seat }), false, 'nor be voted');
  g.options.chat = true;
  g.update(2);
  assert.equal(g.act(ps[1].seat, 'chat', { text: '  fue   <Lapa>\n' }), true);
  assert.equal(g.meeting.chat.at(-1).text, 'fue Lapa');
});

test('a wrap that leaves mummies level with panas ends the night', () => {
  const g = night(4, 30), [m] = mummies(g), [a, b] = panas(g);
  b.alive = false;
  at(m, 20, -28); at(a, 21.5, -28); m.cooldown = 0;
  g.act(m.seat, 'wrap');
  assert.deepEqual(g.ending, { winner: 'momias', reason: 'numbers' });
});
