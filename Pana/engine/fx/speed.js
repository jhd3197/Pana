// Speed you can feel from the driver's seat, for anything fast: a field of view that
// opens with speed, a camera that falls back under acceleration and catches up with a
// small shake, how strong the edge lines and the wind should be. No Three.js, no DOM:
// a game reads the numbers and applies them. It only ever draws: never feed these back
// into physics. Its shake is its own noise, so a seeded race's dice stay untouched.
//
//   const feel = createSpeedFeel();
//   const { fov, pull, shakeX, shakeY, lines, wind } = feel.update(dt, speed, top, boosting);
import { clamp01, damp } from './feel.js';

const MAX_PULL = 2.4, PULL_PER_ACCEL = .09, LAG_RATE = 5, CATCH_RATE = 2.6, SHAKE_PER_CATCH = 5, SHAKE_DECAY = 1.1, MAX_SHAKE = .12;
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

export const fovFor = (ratio, min = 50, max = 75) => min + (max - min) * clamp01(ratio);
export const linesFor = (ratio) => smooth(.55, 1, ratio) * .95;
export const windFor = (ratio) => clamp01(ratio) ** 1.5;

export function createSpeedFeel({ min = 50, max = 75 } = {}) {
  let last = null, accel = 0, pull = 0, shake = 0, time = 0;
  return {
    update(dt, speed, top, boosting = false) {
      const v = Math.abs(speed), ratio = clamp01(v / Math.max(1, top)), step = Math.max(dt, 1e-3);
      accel = damp(accel, last === null ? 0 : Math.max(0, (v - last) / step), 6, dt);
      last = v; time += dt;
      const want = Math.min(MAX_PULL, accel * PULL_PER_ACCEL);
      if (want < pull) {
        // The camera is catching the car up: that release is what shakes.
        const before = pull;
        pull = damp(pull, want, CATCH_RATE, dt);
        shake = Math.min(MAX_SHAKE, shake + (before - pull) * SHAKE_PER_CATCH * dt / step * .1);
      } else pull = damp(pull, want, LAG_RATE, dt);
      shake = Math.max(0, shake - SHAKE_DECAY * dt * shake - .004 * dt);
      return {
        ratio, pull, shake,
        fov: fovFor(boosting ? Math.max(ratio, .96) : ratio, min, max),
        shakeX: shake * (Math.sin(time * 61) + Math.sin(time * 97)) * .5,
        shakeY: shake * (Math.sin(time * 73) + Math.sin(time * 113)) * .5,
        lines: linesFor(boosting ? Math.max(ratio, .9) : ratio),
        wind: windFor(ratio),
      };
    },
    reset() { last = null; accel = pull = shake = 0; },
  };
}
