// A pickup you feel: a flash and a star burst where it was taken, and the combo stamped
// over the counter at the moments a chain is worth calling out. Carries on from what
// engine/fx.js already does (flyToCounter, popCounter): call them for the flight and bump.
//
//   const feel = createPickupFeel(THREE, scene);      // feel.tick(dt) every frame
//   feel.pick(worldPos, { streak, target: counterEl });
import { createScreenFx, createWorldFx, preloadFx } from './pixelfx-bridge.js';

const GOLD = ['#2a1405', '#5c3008', '#9a5a0e', '#d48e18', '#f5b92c', '#ffde5e', '#fff4bc', '#ffffff'];

// A row of coins is five: call out the chain as it gets going, then at each full row.
export const comboWorthShowing = (streak) => streak === 3 || (streak > 0 && streak % 5 === 0);

export function createPickupFeel(THREE, scene, { palette = GOLD, label = 'COMBO', pixel = .02, bursts = 5 } = {}) {
  const world = createWorldFx(THREE, scene, { max: bursts, pixel }), hud = createScreenFx({ max: 1 });
  preloadFx('collect-burst', 'combo-counter').catch(console.warn);
  return {
    pick(position, { streak = 0, target = null } = {}) {
      world.play('collect-burst', position, { palette });
      if (!target || !comboWorthShowing(streak)) return;
      const box = target.getBoundingClientRect();
      if (!box.width) return;
      // Over the counter, kept on screen; a new call replaces the last.
      hud.clear();
      const scale = innerWidth < 600 ? 1 : 2;
      const x = Math.max(104 * scale, box.left + box.width / 2);
      hud.play('combo-counter', x, Math.max(50 * scale, box.top - 34 * scale), { scale, palette, count: streak, label });
    },
    tick(dt) { world.tick(dt); hud.tick(dt); },
    dispose() { world.dispose(); hud.clear(); },
  };
}
