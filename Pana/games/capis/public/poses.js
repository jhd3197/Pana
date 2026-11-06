// Which pose each capi shows and where its bazooka points, from the match
// alone (pure, no Three.js, tested): scene.js turns these into arm, leg and
// body angles. The barrel's tip is the muzzle rules.js fires from, so the
// shell leaves the barrel you see.
import { alive } from './rules.js';

export const WALKING = .3;         // units/s along the ground: slower than this the capi stands
export const CARRY_PITCH = -.3;    // a capi off turn carries La Bazuca low, pointing a little down
export const CARRY_DROP = .28;     // ...and this much lower than the shoulder

// Only the capi whose turn it is raises La Bazuca and follows the aim.
export const aiming = (m, c) => m.phase === 'aim' && m.turn?.capy === c.id && alive(c);

// 'sink' | 'splat' | 'cheer' | 'sulk' | 'rise' | 'fall' | 'walk' | 'idle'.
// `speed` is how fast the capi moved this frame (units/s).
export function bodyPose(m, c, speed = 0) {
  if (c.out === 'water') return 'sink';
  if (c.out === 'paint') return 'splat';
  if (m.phase === 'finished') return m.winner === c.team ? 'cheer' : 'sulk';
  if (!c.grounded) return c.vy > 0 ? 'rise' : 'fall';
  return Math.abs(speed) > WALKING ? 'walk' : 'idle';
}

// Where the barrel points (radians above level, towards `facing`) and how far
// below the shoulder pivot it sits.
export function barrelPose(m, c) {
  return aiming(m, c) ? { pitch: c.aim, drop: 0 } : { pitch: CARRY_PITCH, drop: CARRY_DROP };
}
