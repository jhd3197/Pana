import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptsChoice, cleanInput, inputFor, random, seeded, withRandom } from '../public/online-rules.js';

test('only the acting seat can answer the current prompt once', () => {
  const prompt = { id: 7, seat: 2, options: [{}, {}] };
  assert.equal(acceptsChoice(prompt, 2, { prompt: 7, choice: 1 }), true);
  for (const [seat, message] of [[1, { prompt: 7, choice: 0 }], [2, { prompt: 6, choice: 0 }], [2, { prompt: 7, choice: 2 }], [2, { prompt: 7, choice: -1 }]])
    assert.equal(acceptsChoice(prompt, seat, message), false);
  assert.equal(acceptsChoice(null, 2, { prompt: 7, choice: 1 }), false);
});

test('inputs stay separate per player and invalid axes cannot poison physics', () => {
  const inputs = [cleanInput({ x: -9, jump: true }), cleanInput({ x: 1, aim: { x: Infinity, y: NaN } })];
  assert.equal(inputFor(inputs, 0).x, -1);
  assert.equal(inputFor(inputs, 1).x, 1);
  assert.equal(inputFor(inputs, 1).jump, false);
  assert.deepEqual(inputFor(inputs, 1).aim, { x: 0, y: 0 });
  assert.equal(inputFor(inputs, 3).x, 0);
  assert.equal(inputFor(inputs[0], 0).jump, true, 'solo input is backward compatible');
});

test('minigame randomness is repeatable and isolated from renderer randomness', () => {
  const a = seeded(52), b = seeded(52);
  for (let i = 0; i < 100; i++) {
    const expected = withRandom(a, () => [random(), random()]);
    Math.random(); Math.random();
    assert.deepEqual(withRandom(b, () => [random(), random()]), expected);
  }
});
