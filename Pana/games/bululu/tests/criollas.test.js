import test from 'node:test';
import assert from 'node:assert/strict';
import { createCriollasMini } from '../public/minigames/criollas-sim.js';
import { seeded } from '../public/online-rules.js';
test('independent seat controls consume only that player’s balls', () => {
  const g = createCriollasMini([true, true, true, true], seeded(3));
  g.update(.05, [{}, { pull: true }, {}, {}]);
  assert.deepEqual(g.players.map(p => p.left), [2, 2, 2, 2], 'holding charges without throwing');
  g.update(.05, [{}, {}, {}, {}]);
  assert.deepEqual(g.players.map(p => p.left), [2, 1, 2, 2]); assert.equal(g.pitch.balls[1].owner, 1);
  g.update(.05, [{}, { pull: true }, {}, {}]); g.update(.05, [{}, {}, {}, {}]); assert.equal(g.pitch.balls.length, 2, 'cooldown');
});
test('holding longer throws harder, up to the peak, like Billar', () => {
  const strength = seconds => {
    const g = createCriollasMini([true], seeded(5));
    for (let t = 0; t < seconds - 1e-9; t += .05) g.update(.05, [{ pull: true }]);
    g.update(.05, [{}]);
    return g.pitch.balls[1].vz;
  };
  assert.ok(Math.abs(strength(.8)) > Math.abs(strength(.2)));
  assert.ok(Math.abs(strength(1.6)) < Math.abs(strength(.95)), 'past the peak the force falls again');
});
test('all-bot minigame finishes with exactly eight throws and a winner', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const g = createCriollasMini([false, false, false, false], seeded(seed));
    for (let i = 0; i < 760 && !g.over(); i++) g.update(.05, []);
    assert(g.over()); assert.equal(g.pitch.balls.length, 9); assert(g.winners().length); assert(g.clock < 30);
  }
});
test('idle humans time out; deterministic replay stays identical', () => {
  const games = [0, 1].map(() => createCriollasMini([true, false, true, false], seeded(22)));
  for (let i = 0; i < 760; i++) {
    const inputs = [{ x: .1, pull: i >= 10 && i < 18 }, {}, {}, {}];
    games[0].update(.05, inputs); Math.random(); games[1].update(.05, inputs);
  }
  assert(games[0].over()); assert.deepEqual(games[0].pitch, games[1].pitch); assert.deepEqual(games[0].scores(), games[1].scores());
});
