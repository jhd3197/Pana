// Every collider of a Pepazo court, named for the collision debug view and the
// headless report (scripts/collision-report.js). Renderer-free: the cover comes
// from coverFor, the same rows the server collides with.
import { coverFor, boundsFor, SHOT_HEIGHT } from './rules.js';

// How high a level shot flies (where the scene draws the ball).
export const SHOT_FLIGHT = SHOT_HEIGHT;

// Invisible on purpose, so never flagged: the court's edge (a netting fence or
// a curb, which bullets and panas stop at by `outside` in rules.js, not by a box).
// Add an id (`map:variant:index`) or a source here only for a blocker that is
// meant to be unseen, with a comment saying why.
export const COLLISION_ALLOW = ['court-bounds'];

export function collidersFor(mapId, variant = 0) {
  const cover = coverFor(mapId, variant).map((o, i) => {
    const h = o.h ?? o.height ?? Infinity;
    return { id: o.ref || `${mapId}:${variant}:${i}`, source: o.kind || 'cover', x: o.x, z: o.z, w: o.w, d: o.d, h, blocksShots: o.shots !== false && h > SHOT_HEIGHT, blocksMovement: true, health: o.health ?? 1 };
  });
  const { x, z } = boundsFor(mapId), wall = (id, cx, cz, w, d) => ({ id: `${mapId}:${variant}:${id}`, source: 'court-bounds', x: cx, z: cz, w, d, h: Infinity, blocksShots: true, blocksMovement: true, health: 1 });
  return [...cover, wall('north', 0, -z - .5, x * 2 + 2, 1), wall('south', 0, z + .5, x * 2 + 2, 1), wall('west', -x - .5, 0, 1, z * 2), wall('east', x + .5, 0, 1, z * 2)];
}
