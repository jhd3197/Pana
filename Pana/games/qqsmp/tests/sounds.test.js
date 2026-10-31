import test from 'node:test';
import assert from 'node:assert/strict';
import { QUIZ_CUES, quizSoundEvent } from '../public/sounds.js';

test('quiz audio only announces an outcome after the reveal settles', () => {
  const state = { round: 1, index: 0, phase: 'question', timeLeft: 30, players: [{ outcome: { right: true } }] };
  assert.equal(quizSoundEvent(state, 0).cue, 'question');
  state.phase = 'reveal'; state.reveal = { done: false };
  assert.equal(quizSoundEvent(state, 0).cue, 'suspense');
  state.reveal.done = true;
  assert.equal(quizSoundEvent(state, 0).cue, 'correct');
  assert.equal(quizSoundEvent(state, -1).cue, 'reveal');
  state.players[0].outcome.right = false;
  assert.equal(quizSoundEvent(state, 0).cue, 'wrong');
});

test('clock snapshots share a cue key until the displayed second changes', () => {
  const state = { round: 1, index: 0, phase: 'question', timeLeft: 4.9 };
  const first = quizSoundEvent(state, 0);
  assert.equal(first.cue, 'tick');
  state.timeLeft = 4.1; assert.deepEqual(quizSoundEvent(state, 0), first);
  state.timeLeft = 3.9; assert.notEqual(quizSoundEvent(state, 0).key, first.key);
  state.round = 2; assert.notEqual(quizSoundEvent(state, 0).key, first.key);
});

test('all show cues are short enough to leave room for the spoken question', () => {
  for (const [cue, score] of Object.entries(QUIZ_CUES)) {
    assert.ok(score.length && score.length <= 16, cue);
    for (const n of score) {
      assert.ok([n.pitch, n.at, n.duration, n.gain].every(Number.isFinite));
      assert.ok(n.at >= 0 && n.duration >= .05 && n.at + n.duration < 1.7, cue);
      assert.ok(n.gain > 0 && n.gain <= .14, cue);
    }
  }
});
