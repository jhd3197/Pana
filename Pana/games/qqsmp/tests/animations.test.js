import test from 'node:test';
import assert from 'node:assert/strict';
import { animationVariant, quizAnimation } from '../public/animation-events.js';
import { VARIANTS } from '../public/animation-catalog.js';

const state = () => ({ round: 1, index: 1, final: false, phase: 'question', timeLeft: 25,
  options: { mode: 'panas' }, players: Array.from({ length: 6 }, (_, seat) => ({ seat, id: [1, 4].includes(seat) ? seat : null, locked: false, copy: null })),
});

test('every core take rotates without consecutive repeats and agrees across clients', () => {
  for (const [action, variants] of Object.entries(VARIANTS)) {
    const s = state(), takes = new Set();
    for (let index = 0; index < variants.length; index++) {
      s.index = index;
      const take = animationVariant(s, 4, action);takes.add(take);
      assert.equal(take, animationVariant(JSON.parse(JSON.stringify(s)), 4, action));
    }
    assert.equal(takes.size, variants.length);
    const final = { ...s, total: 8, index: 8, round: 1 }, rematch = { ...s, total: 8, index: 0, round: 2 };
    assert.notEqual(animationVariant(final, 4, action), animationVariant(rematch, 4, action));
  }
});

test('open questions never use private answers or outcomes and skip empty seats', () => {
  const s = state();
  for (const p of s.players) for (const key of ['answer', 'outcome']) Object.defineProperty(p, key, { get() { throw new Error(`private ${key}`); } });
  for (let age = 0; age < 30; age++) assert.ok([1, 4].includes(quizAnimation(s, age).seat));
  s.players[1].locked = true;
  assert.equal(quizAnimation(s, 8).seat, 4);
  s.players[4].locked = true;
  assert.equal(quizAnimation(s, 8), null);
});

test('settled results show all active players inside the existing result window', () => {
  const s = state();s.phase = 'reveal';s.reveal = { done: true, order: [1, 4] };
  s.players[1].outcome = { right: true };s.players[4].outcome = { right: false };
  const first = quizAnimation(s, 0), second = quizAnimation(s, 2.5);
  assert.equal(first.action, 'right');assert.equal(first.seat, 1);
  assert.equal(second.action, 'wrong');assert.equal(second.seat, 4);
  assert.ok(first.age / first.duration >= .48, 'skip fictional suspense after settlement');
  s.reveal.done = false;
  assert.equal(quizAnimation(s, 0).action, 'suspense');
});
