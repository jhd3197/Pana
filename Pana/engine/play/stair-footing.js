// Opt-in footing for authored stair runs, in world-space x intervals. The
// projectile/body radius stays unchanged: only contact with a stair uses the
// narrow foot profile so a shoulder does not bounce off the next riser.
import { circleHits, solidAt, groundBelow } from './terrain-mask.js';

export const STAIR_RISE = 1.05;
export const onStairs = (runs, x) => !!runs?.some(([a, b]) => x >= a - .25 && x <= b + .25);

export function stairBodyHits(mask, x, y, radius, runs) {
  if (!onStairs(runs, x)) return circleHits(mask, x, y, radius);
  const { cell, cols, rows, solid } = mask;
  for (let r = Math.max(0, Math.floor((y - radius) / cell)); r <= Math.min(rows - 1, Math.floor((y + radius) / cell)); r++) {
    for (let c = Math.max(0, Math.floor((x - .1) / cell)); c <= Math.min(cols - 1, Math.floor((x + .1) / cell)); c++) {
      if (solid[r * cols + c] && (((c + .5) * cell - x) / .1) ** 2 + (((r + .5) * cell - y) / radius) ** 2 <= 1) return true;
    }
  }
  return false;
}

// Follow a tread only with a floor within one riser and standing headroom.
// A tall wall, a ceiling or a gap still blocks/falls; this never carves terrain.
export function stairFloor(mask, x, feet, runs) {
  if (!onStairs(runs, x)) return null;
  const floor = groundBelow(mask, x, feet + STAIR_RISE, STAIR_RISE * 2);
  if (floor === null) return null;
  for (let j = 1; j <= 17; j++) if (solidAt(mask, x, floor + j * .1)) return null;
  return floor;
}
