// Derrape's milestone toasts: drift distance per race, long single drifts and
// purple releases. The numbers are gameplay tuning and live here;
// engine/feats.js owns the toast and the anti-spam cooldown. game.js loads
// this module with the first race, so the garage's first load stays small.
import { createFeats } from '/engine/feats.js';

export const LONG_DRIFT_M = 100;   // one drift this long, without releasing

export function createDriftFeats(el, opts) {
  const feat = createFeats(el, opts);
  // Per-race drift distance: 500 m, then a shout per full kilometre.
  const distance = feat.meter(
    [{ at: 500, text: '¡500 metros derrapados!' }],
    { every: 1000, text: (m) => m === 1000 ? '¡1 kilómetro derrapado!' : `¡${m / 1000} kilómetros derrapados!` });
  let current = 0;    // metres in the drift happening right now
  let level = 0;      // spark level of that drift, as of its last step
  let boost = 0;      // c.boost on that last step: a paid turbo marks a clean release
  let nextLong = LONG_DRIFT_M;
  return {
    // One physics step of the local player's car; game.js calls it after stepCar.
    step(c, dt) {
      if (c.drift) {
        const d = Math.max(0, c.vf) * dt;
        distance.add(d);
        current += d;
        level = c.driftLvl || 0;
        boost = c.boost;
        if (current >= nextLong) {
          feat('derrapon', `¡Derrapón! ¡${nextLong} m sin soltar!`);
          nextLong += LONG_DRIFT_M;
        }
      } else {
        // A purple drift that ends paying its turbo was released, not crashed.
        if (current > 0 && level >= 3 && c.boost > boost) feat('purpura', '¡Suelta púrpura! ¡Tremendo derrape!');
        current = 0; level = 0; nextLong = LONG_DRIFT_M;
      }
    },
    reset() { distance.reset(); current = 0; level = 0; nextLong = LONG_DRIFT_M; },
    get current() { return current; },
    get total() { return distance.total; },
  };
}
