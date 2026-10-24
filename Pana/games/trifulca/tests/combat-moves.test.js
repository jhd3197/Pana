import test from 'node:test';
import assert from 'node:assert/strict';
import { newBody, arenaOf, control, stepBodies, T, presses, scorecard } from '../public/fight-rules.js';
import { combatPose } from '../public/combat-motion.js';
import { cleanInput, Trifulca } from '../public/rules.js';

const moves = [['kick', 'k'], ['sweep', 's'], ['toss', 'v']];
function fight(distance = 1) {
  const arena = arenaOf('toldo'), a = newBody(1, 'red', arena), b = newBody(2, 'blue', arena), events = [];
  Object.assign(a, { x: -distance / 2, z: 0, h: Math.PI / 2 });
  Object.assign(b, { x: distance / 2, z: 0, h: -Math.PI / 2 });
  const emit = e => events.push(e);
  return { a, b, events, emit, step: () => stepBodies([a, b], arena, .05, new Map(), emit) };
}
for (const [move, key] of moves) {
  test(`${move}: costs stamina, waits for contact and deals one authoritative hit`, () => {
    const { a, b, events, emit, step } = fight();
    control(a, {}, { [key]: 1 }, emit);
    assert.equal(a.act, move); assert.equal(a.aguante, 100 - T[move].cost);
    while (a.at + .05 < T[move].active[0]) { step(); assert.equal(b.mareo, 0); }
    step(); assert.equal(b.mareo, T[move].mareo);
    assert.equal(b.act, move === 'kick' ? 'stun' : 'tumble');
    for (let i = 0; i < 30; i++) step();
    assert.equal(events.filter(e => e.type === 'hit' && e.move === move).length, 1);
    assert.equal(b.act, 'idle'); assert.equal(b.caidas, 0);
    assert.equal(scorecard(a), 2);
  });
  test(`${move}: respects guard, dodge, range and recovery`, () => {
    const blocked = fight(); blocked.b.act = 'block';
    control(blocked.a, {}, { [key]: 1 }, blocked.emit);
    for (let i = 0; i <= Math.ceil(T[move].active[0] / .05); i++) blocked.step();
    assert.equal(blocked.b.mareo, move === 'toss' ? T.toss.mareo : T.chip[move]);
    const miss = fight(3); control(miss.a, {}, { [key]: 1 }, miss.emit);
    for (let i = 0; i < 30; i++) miss.step();
    assert.equal(miss.b.mareo, 0);
    const dodged = fight(); control(dodged.a, {}, { [key]: 1 }, dodged.emit);
    dodged.a.at = T[move].active[0] - .05; dodged.b.act = 'dodge'; dodged.b.at = .1;
    dodged.step(); assert.equal(dodged.b.mareo, 0); assert.equal(dodged.a.act, 'open');
    assert.ok(dodged.b.contra > 0);
    control(dodged.a, {}, { [key]: 1 }, dodged.emit); assert.equal(dodged.a.act, 'open');
    const tired = fight(); tired.a.aguante = T[move].cost - 1;
    control(tired.a, {}, { [key]: 1 }, tired.emit); assert.equal(tired.a.act, 'idle');
    tired.a.aguante = 100; tired.a.prop = 1;
    control(tired.a, {}, { [key]: 1 }, tired.emit); assert.equal(tired.a.act, 'idle');
  });
  test(`${move}: dizzy opponents still follow the existing knockdown count`, () => {
    const { a, b, emit, step } = fight(); b.act = 'dizzy'; b.mareo = 100;
    control(a, {}, { [key]: 1 }, emit); a.at = T[move].active[0] - .05;
    step();
    assert.equal(b.caidas, 1); assert.equal(b.act, 'down'); assert.ok(b.down);
  });
  test(`${move}: authored pose holds contact and every channel stays finite`, () => {
    const spec = T[move];
    assert.deepEqual(combatPose(move, spec.active[0]), combatPose(move, spec.active[1]));
    for (let t = 0; t <= spec.total; t += .01) {
      const pose = combatPose(move, t);
      assert.ok(Object.values(pose).every(Number.isFinite));
      assert.ok(pose.squash > -.2 && pose.squash < .4);
    }
  });
}
test('new press counters wrap, sanitize and survive host restoration', () => {
  const previous = { k: 255, s: 255, v: 255 };
  const next = cleanInput({ k: 256, s: 256, v: 256 });
  assert.deepEqual(moves.map(([, key]) => presses({ ...previous }, next)[key]), [1, 1, 1]);
  const game = new Trifulca(4); game.addPlayer(1, 'Ana'); game.addPlayer(2, 'Beto'); game.start(false);
  game.bodies[0].act = 'sweep'; game.bodies[0].at = .35;
  game.bodies[1].act = 'tumble'; game.bodies[1].tumbleKind = 'toss'; game.bodies[1].stun = .9;
  const restored = Trifulca.restore(game.snapshot(), new Map([[1, {}], [2, {}]]));
  assert.deepEqual(restored.bodies, game.bodies);
});
