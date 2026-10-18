import test from 'node:test';
import assert from 'node:assert/strict';
import { throwPower, cleanPower, createToss, FULL_SHAKE_MS, FULL_FLICK } from '../dice-throw.js';
import { rollOffGroups, namesList } from '../roll-off.js';

test('a tap throws softly; a long shake or a hard flick throws at full power', () => {
  assert.equal(throwPower(0, 0), .2);
  assert.equal(throwPower(FULL_SHAKE_MS, 0), 1);
  assert.equal(throwPower(0, FULL_FLICK), 1);
  assert.equal(throwPower(60000, 50), 1, 'never above full power');
  assert.ok(throwPower(FULL_SHAKE_MS / 2) > .2 && throwPower(FULL_SHAKE_MS / 2) < 1);
  assert.equal(cleanPower('mucho'), .5); assert.equal(cleanPower(7), 1); assert.equal(cleanPower(-1), 0);
});

test('a toss starts in the hand, lands on its spot and stops turning there', () => {
  const from = [0, 2, 0], to = [1.5, 1, -1];
  for (const power of [0, .5, 1]) {
    const toss = createToss({ from, to, power, seed: 7 });
    const start = toss.at(0), end = toss.at(toss.duration);
    start.position.forEach((v, i) => assert.ok(Math.abs(v - from[i]) < 1e-9, `starts at from (power ${power})`));
    end.position.forEach((v, i) => assert.ok(Math.abs(v - to[i]) < 1e-9, `ends at to (power ${power})`));
    assert.ok(Math.abs(end.turn) < 1e-9, 'the die rests on the rolled face');
    assert.ok(start.turn > 0 && end.done);
    for (let t = 0; t <= toss.duration; t += .01) assert.ok(toss.at(t).position[1] >= to[1] - 1e-9, 'never sinks into the table');
  }
});

test('harder throws fly higher, bounce more and tumble longer; seeds replay exactly', () => {
  const soft = createToss({ from: [0, 1, 0], to: [1, 1, 0], power: 0, seed: 3 });
  const hard = createToss({ from: [0, 1, 0], to: [1, 1, 0], power: 1, seed: 3 });
  const top = toss => Math.max(...Array.from({ length: 200 }, (_, i) => toss.at(i / 200 * toss.duration).position[1]));
  assert.ok(top(hard) > top(soft));
  assert.ok(hard.impacts.length > soft.impacts.length);
  assert.ok(hard.at(0).turn > soft.at(0).turn);
  assert.deepEqual(createToss({ from: [0, 1, 0], to: [1, 1, 0], power: .4, seed: 9 }).at(.2), createToss({ from: [0, 1, 0], to: [1, 1, 0], power: .4, seed: 9 }).at(.2));
});

test('the roll-off groups ties, highest first', () => {
  assert.deepEqual(rollOffGroups([{ id: 0, value: 4 }, { id: 1, value: 6 }, { id: 2, value: 4 }, { id: 3, value: 1 }]), [[1], [0, 2], [3]]);
  assert.deepEqual(rollOffGroups([{ id: 'a', value: 5 }, { id: 'b', value: 5 }]), [['a', 'b']]);
  assert.equal(namesList(['Rojo']), 'Rojo');
  assert.equal(namesList(['Rojo', 'Verde', 'Azul']), 'Rojo, Verde y Azul');
});
