// Collider fixes found by the collision audit (`npm run collision-report -- --fix`
// writes this file). coverFor applies them on top of each layout's rows, so
// the server, bots and minimap all collide with the fitted boxes; scenery that
// draws from the raw layout rows (El Puerto's barrels) keeps its look.
//
// Each key is `map:variant:index` in the raw cover. `from` is the row it was
// measured on: a fix whose row has since moved or changed size is skipped, so
// an edited layout falls back to its own box (and the audit flags it again).
// Actions: remove (an orphan), refit (one box), split (one box per piece),
// unblock-shots (a broken piece panas still bump into but shots fly through).
export const COLLISION_FIXES = {
  'terminal:0:37': { from: { x: -45.1, z: -8, w: 3, d: 2.6, h: 1 }, action: 'split', reason: '3 separate pieces under one box', boxes: [{ x: -44.2, z: -8.6, w: 0.62, d: 0.62, h: 0.9 }, { x: -45.1, z: -8, w: 0.62, d: 0.62, h: 0.9 }, { x: -46, z: -7.4, w: 0.62, d: 0.62, h: 0.9 }] },
  'terminal:0:38': { from: { x: -45.1, z: 8, w: 3, d: 2.6, h: 1 }, action: 'split', reason: '3 separate pieces under one box', boxes: [{ x: -44.2, z: 7.4, w: 0.62, d: 0.62, h: 0.9 }, { x: -45.1, z: 8, w: 0.62, d: 0.62, h: 0.9 }, { x: -46, z: 8.6, w: 0.62, d: 0.62, h: 0.9 }] },
  'terminal:0:40': { from: { x: 45.1, z: -8, w: 3, d: 2.6, h: 1 }, action: 'split', reason: '3 separate pieces under one box', boxes: [{ x: 44.2, z: -8.6, w: 0.62, d: 0.62, h: 0.9 }, { x: 45.1, z: -8, w: 0.62, d: 0.62, h: 0.9 }, { x: 46, z: -7.4, w: 0.62, d: 0.62, h: 0.9 }] },
  'terminal:0:41': { from: { x: 45.1, z: 8, w: 3, d: 2.6, h: 1 }, action: 'split', reason: '3 separate pieces under one box', boxes: [{ x: 44.2, z: 7.4, w: 0.62, d: 0.62, h: 0.9 }, { x: 45.1, z: 8, w: 0.62, d: 0.62, h: 0.9 }, { x: 46, z: 8.6, w: 0.62, d: 0.62, h: 0.9 }] },
};

const same = (o, from) => ['x', 'z', 'w', 'd', 'h'].every(k => Math.abs((k === 'h' ? o.h ?? o.height : o[k]) - from[k]) < .01);

// The cover with every matching fix applied. Each row keeps `ref`, its raw
// `map:variant:index`, so reports name pieces the way this file keys them.
export function applyCollisionFixes(mapId, variant, cover, fixes = COLLISION_FIXES) {
  return cover.flatMap((o, i) => {
    const ref = `${mapId}:${variant}:${i}`, fix = fixes[ref];
    if (!fix || !same(o, fix.from)) return [{ ...o, ref }];
    if (fix.action === 'remove') return [];
    if (fix.action === 'unblock-shots') return [{ ...o, ref, shots: false }];
    const boxes = fix.action === 'split' ? fix.boxes : [fix.box];
    return boxes.map((b, k) => ({ ...o, ...b, height: b.h, ref: boxes.length > 1 ? `${ref}.${k}` : ref }));
  });
}
