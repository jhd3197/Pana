// The map of milestone one: a riverbank in the Llanos. Grassy banks drop into
// the river at both ends, two caños cut dips into the savanna and a médano
// (a sandy ridge) rises in the middle. Pure and seeded: the same ground on
// every load, in Node tests and for the bot.
import { createMask, fillHeights, carve } from '../../../engine/play/terrain-mask.js';
import { fbm2, smoothstep, lerp } from '../../../engine/random.js';

export const LLANOS = Object.freeze({ id: 'llanos', name: 'Orilla del llano', seed: 2026, width: 80, height: 40, cell: .1, water: 4.2 }); // i18n-ignore: a place name

// Where the capis of each team start, across the map from each other.
export const SPAWNS = Object.freeze([[10, 17, 24], [56, 63, 70]]);

// Ground height at x: rolling savanna, the médano, the caños, then the banks.
export function llanosHeight(x, { seed, width, water } = LLANOS) {
  const roll = fbm2(x * .055 + seed * .013, seed * .071, { octaves: 4 });
  let h = 11 + (roll - .5) * 8;
  h += 5 * Math.exp(-(((x - width / 2) / 5.5) ** 2));
  h -= 4.2 * Math.exp(-(((x - width * .35) / 2.6) ** 2)) + 4.2 * Math.exp(-(((x - width * .65) / 2.6) ** 2));
  h = Math.max(h, water + 2);
  const bank = smoothstep((x - 2) / 7) * smoothstep((width - 2 - x) / 7);
  return lerp(water - 2.5, h, bank);
}

// The playable ground for `map`: heights, plus a small cave under the médano
// so a shot can open a tunnel.
export function buildMap(map = LLANOS) {
  const mask = createMask(map);
  fillHeights(mask, x => llanosHeight(x, map));
  carve(mask, map.width / 2, llanosHeight(map.width / 2, map) - 4.5, 1.4);
  return mask;
}
