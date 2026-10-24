import test from 'node:test';
import assert from 'node:assert/strict';
import { combatPose, mirrorPose } from '../public/combat-motion.js';
import { ATTACK_TIMING } from '../public/attack-timing.js';

test('every authored style holds contact and joins windup without a pose jump', () => {
  for (const style of ['recto', 'gancho', 'upper']) for (const hand of [0, 1]) {
    const options = { style, hand };
    assert.deepEqual(combatPose('wind', .43, options), combatPose('trompon', 0, options));
    for (const act of ['jab', 'trompon']) {
      const { impact, release, total } = ATTACK_TIMING[act];
      assert.deepEqual(combatPose(act, impact, options), combatPose(act, release, options));
      const end = combatPose(act, total, options);
      for (const [key, value] of Object.entries(end)) assert.ok(Number.isFinite(value), key);
      assert.ok(Math.abs(end['armL.s'] - 1) < 1e-9);
      assert.ok(Math.abs(end['armR.s'] - 1) < 1e-9);
      for (let at = 0; at <= total; at += .005) {
        const pose = combatPose(act, at, options);
        assert.ok(pose.squash > -.2 && pose.squash < .3);
        assert.ok(pose['armL.s'] >= 1 && pose['armL.s'] <= 1.21);
        assert.ok(pose['armR.s'] >= 1 && pose['armR.s'] <= 1.21);
      }
    }
  }
});

test('mirroring preserves pose channels and reverses handedness', () => {
  const right = combatPose('jab', .1, { style: 'recto', hand: 1 });
  const left = combatPose('jab', .1, { style: 'recto', hand: 0 });
  assert.deepEqual(mirrorPose(right), left);
  assert.deepEqual(mirrorPose(left), right);
  assert.ok(right['armR.s'] > right['armL.s']);
  assert.ok(left['armL.s'] > left['armR.s']);
});

test('unsupported states leave crowd, props and knockdowns to their own poses', () => {
  for (const act of ['crowd', 'down', 'rise', 'throw', 'grab']) assert.equal(combatPose(act, .2), null);
});
