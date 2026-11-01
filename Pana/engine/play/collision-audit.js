// Collision audit: compares a map's colliders with the solid geometry the
// player actually sees, and flags the ones that stop shots or panas without a
// body to show for it. Pure and renderer-free: collision-debug.js gathers the
// geometry from a Three.js scene, Node tests and scripts/collision-report.js
// read the same result.
//
//   const report = auditColliders(colliders, solids, { map: 'terminal', shotHeight: 1.1 });
//   report.flagged  // [{ id, flags: ['no-mesh' | 'oversized' | 'under-shot' | 'damaged'], fix }]
//
// A collider is `{ id, source, x, z, w, d, h, blocksShots, blocksMovement, health }`
// (centre, full size, top; `health` 0..1, 1 when it cannot break). `solids` is a
// flat list of world-space boxes, six numbers each (minX, minY, minZ, maxX,
// maxY, maxZ): one per visible triangle, so merged and baked meshes still count.

// Below this a triangle lies on the ground (court paint, lines, spawn rings).
export const GROUND = .08;
// Share of the footprint the visible geometry must cover, and of the height it must reach.
export const MIN_COVERAGE = .5, MIN_HEIGHT = .6;

const top = o => o.h ?? o.height ?? Infinity;
const round = v => +v.toFixed(2);

// What the geometry inside collider o looks like: the share of its footprint
// cells something solid stands on, how high it reaches, its bounds, and the
// separate clumps it forms (three drums side by side are three parts).
export function measure(o, solids, cell = .25) {
  const h = top(o), x0 = o.x - o.w / 2, z0 = o.z - o.d / 2, nx = Math.max(1, Math.round(o.w / cell)), nz = Math.max(1, Math.round(o.d / cell));
  const sx = o.w / nx, sz = o.d / nz, height = new Float32Array(nx * nz), bounds = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity], hits = [];
  for (let i = 0; i < solids.length; i += 6) {
    const minY = solids[i + 1], maxY = solids[i + 4];
    if (maxY <= GROUND || minY >= h) continue;
    const ax = Math.max(solids[i], x0), bx = Math.min(solids[i + 3], x0 + o.w), az = Math.max(solids[i + 2], z0), bz = Math.min(solids[i + 5], z0 + o.d);
    if (ax > bx || az > bz) continue;
    // A face lying on a cell edge fills the cells it spans, not the next one.
    const cellOf = (v, n) => Math.max(0, Math.min(n - 1, Math.floor(v + 1e-6))), y = Math.min(maxY, h);
    const i0 = cellOf((ax - x0) / sx, nx), i1 = Math.max(i0, cellOf((bx - x0) / sx - 2e-6, nx)), j0 = cellOf((az - z0) / sz, nz), j1 = Math.max(j0, cellOf((bz - z0) / sz - 2e-6, nz));
    for (let j = j0; j <= j1; j++) for (let k = i0; k <= i1; k++) height[j * nx + k] = Math.max(height[j * nx + k], y);
    const b = [ax, Math.max(minY, 0), az, bx, y, bz];
    for (let a = 0; a < 3; a++) { bounds[a] = Math.min(bounds[a], b[a]); bounds[a + 3] = Math.max(bounds[a + 3], b[a + 3]); }
    hits.push(j0 * nx + i0, b);
  }
  // Clumps: 4-connected filled cells. Each gets the exact box of the triangles in it.
  const part = new Int32Array(nx * nz).fill(-1), parts = [];
  for (let c = 0; c < height.length; c++) {
    if (!height[c] || part[c] >= 0) continue;
    const stack = [c]; part[c] = parts.length; parts.push([Infinity, Infinity, -Infinity, -Infinity, 0]);
    while (stack.length) {
      const n = stack.pop(), i = n % nx, j = (n - i) / nx;
      for (const [a, b] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) { const m = b * nx + a; if (a >= 0 && b >= 0 && a < nx && b < nz && height[m] && part[m] < 0) { part[m] = part[c]; stack.push(m); } }
    }
  }
  for (let k = 0; k < hits.length; k += 2) {
    const box = parts[part[hits[k]]], [ax, , az, bx, y, bz] = hits[k + 1];
    box[0] = Math.min(box[0], ax); box[1] = Math.min(box[1], az); box[2] = Math.max(box[2], bx); box[3] = Math.max(box[3], bz); box[4] = Math.max(box[4], y);
  }
  parts.forEach(([ax, az, bx, bz, y], k) => { parts[k] = { x: round((ax + bx) / 2), z: round((az + bz) / 2), w: round(bx - ax), d: round(bz - az), h: round(y) }; });
  let covered = 0; for (const y of height) if (y) covered++;
  const any = covered > 0;
  return { coverage: covered / height.length, top: any ? bounds[4] : 0, bounds: any ? bounds.map(v => +v.toFixed(3)) : null, parts };
}

// The fix a flagged collider calls for: drop an orphan, fit a box to its mesh
// (one per clump), or let a piece that should not stop shots let them through.
export function proposeFix(c, mesh, flags) {
  if (flags.includes('no-mesh')) return { action: 'remove', reason: 'orphan: nothing visible fills the box' };
  if (flags.includes('damaged')) return c.health <= 0
    ? { action: 'remove', reason: 'destroyed piece still collides' }
    : { action: 'unblock-shots', reason: `at ${Math.round(c.health * 100)}% health it should not stop shots` };
  if (flags.includes('oversized')) {
    if (mesh.parts.length > 1) return { action: 'split', reason: `${mesh.parts.length} separate pieces under one box`, boxes: mesh.parts };
    const [ax, , az, bx, by, bz] = mesh.bounds;
    return { action: 'refit', reason: 'collider larger than its mesh', box: { x: round((ax + bx) / 2), z: round((az + bz) / 2), w: round(bx - ax), d: round(bz - az), h: round(by) } };
  }
  if (flags.includes('under-shot')) return { action: 'unblock-shots', reason: 'its mesh is lower than a shot flies' };
  return null;
}

// Every collider measured and flagged. `shotHeight` is how high level shots
// fly. `allow` lists ids (or sources) that are invisible on purpose, such as
// the court's bounds: reported, never flagged.
export function auditColliders(colliders, solids, { map = '', variant = 0, shotHeight = null, allow = [], cell = .25 } = {}) {
  const items = colliders.map(c => {
    const blocksShots = c.blocksShots ?? (shotHeight === null || top(c) > shotHeight), blocksMovement = c.blocksMovement ?? true, health = c.health ?? 1;
    const mesh = measure(c, solids, cell), flags = [], allowed = allow.includes(c.id) || allow.includes(c.source);
    if ((blocksShots || blocksMovement) && !allowed) {
      if (!mesh.bounds) flags.push('no-mesh');
      else if (mesh.coverage < MIN_COVERAGE || mesh.top < Math.min(top(c), 1e6) * MIN_HEIGHT) {
        // Pieces a few cells apart can touch on the coarse grid: find them on a five times finer one.
        flags.push('oversized'); mesh.parts = measure(c, solids, cell / 5).parts;
      }
      if (blocksShots && mesh.bounds && shotHeight !== null && mesh.top < shotHeight) flags.push('under-shot');
      if (blocksShots && health < 1) flags.push('damaged');
    }
    const item = { id: c.id, source: c.source || '', position: { x: round(c.x), z: round(c.z) }, size: { w: round(c.w), d: round(c.d), h: Number.isFinite(top(c)) ? round(top(c)) : null },
      blocksShots, blocksMovement, health, allowed, mesh: { coverage: round(mesh.coverage), top: round(mesh.top), bounds: mesh.bounds, parts: mesh.parts.length }, flags };
    item.fix = flags.length ? proposeFix({ ...c, health }, mesh, flags) : null;
    return item;
  });
  return { map, variant, colliders: items, flagged: items.filter(c => c.flags.length) };
}
