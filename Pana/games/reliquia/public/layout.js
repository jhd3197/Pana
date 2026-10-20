// Collision and navigation for a generated run, renderer-free. The static
// footprint (rooms, corridors, stairs, pits) is rasterised once per seed into
// a 0.25 m bitmap per floor; what changes during a run (closed seals, fake
// walls, collapsed tunnels) comes from the state at query time.
import { generateRun, floorOf, inRect, SPACING, CAGE } from './deck.js';
import { ITEMS } from './items.js';

const RES = 4, layouts = new Map();
export const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function layoutFor(seed = 1, depth = 1) {
  const key = `${seed}:${depth}`;
  if (layouts.has(key)) return layouts.get(key);
  const run = generateRun(seed, { depth }), floors = run.floors;
  const grids = [];
  for (let f = 0; f <= floors; f++) {
    const rects = [...run.rooms, ...run.corridors, ...run.stubs].filter(r => r.floor === f).map(r => r.rect);
    const x0 = Math.floor(Math.min(...rects.map(r => r[0]))) - 2, z0 = Math.floor(Math.min(...rects.map(r => r[1]))) - 2;
    const x1 = Math.ceil(Math.max(...rects.map(r => r[2]))) + 2, z1 = Math.ceil(Math.max(...rects.map(r => r[3]))) + 2;
    const w = (x1 - x0) * RES, h = (z1 - z0) * RES, bits = new Uint8Array(w * h);
    const pits = run.pits.filter(p => p.floor === f), bridges = run.bridges.filter(b => b.floor === f);
    // Fill each rect's cells (centres strictly inside), then cut the pits.
    const fill = (r, value, test = () => true) => {
      const i0 = Math.max(0, Math.ceil((r[0] - x0) * RES - .5)), i1 = Math.min(w - 1, Math.floor((r[2] - x0) * RES - .5));
      const j0 = Math.max(0, Math.ceil((r[1] - z0) * RES - .5)), j1 = Math.min(h - 1, Math.floor((r[3] - z0) * RES - .5));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (test(x0 + (i + .5) / RES, z0 + (j + .5) / RES)) bits[j * w + i] = value;
    };
    for (const r of rects) fill(r, 1);
    for (const p of pits) fill(p.rect, 2, (x, z) => !inRect(x, z, p.island) && !bridges.some(b => inRect(x, z, b.rect)));
    grids.push({ x0, z0, w, h, bits, obstacles: run.obstacles.filter(o => o.floor === f) });
  }
  const cell = (x, z) => {
    const g = grids[Math.min(floors, floorOf(x))]; if (!g) return 0;
    const i = Math.floor((x - g.x0) * RES), j = Math.floor((z - g.z0) * RES);
    return i < 0 || j < 0 || i >= g.w || j >= g.h ? 0 : g.bits[j * g.w + i];
  };
  // Blockers that open or close during the run.
  function blocked(x, z, state, radius) {
    // The empty shaft is a hole: a stop is solid only while the cage waits there.
    for (const stop of run.lifts) if (stop.floor === floorOf(x) && !(state.lift && !state.lift.moving && state.lift.floor === stop.floor) && Math.abs(x - stop.x) < CAGE + radius && Math.abs(z - stop.z) < CAGE + radius) return true;
    for (const wall of run.hidden) if (!state.revealed?.[wall.id] && inRect(x, z, wall.rect, radius)) return true;
    for (const id of Object.keys(state.rubble || {})) { const c = run.corridors.find(c => c.id === id); if (c && inRect(x, z, c.rect, radius)) return true; }
    return false;
  }
  function walkable(x, z, state = {}, radius = .45) {
    if (!Number.isFinite(x) || !Number.isFinite(z) || cell(x, z) !== 1) return false;
    for (let i = 0; i < 8; i++) if (cell(x + Math.cos(i * Math.PI / 4) * radius, z + Math.sin(i * Math.PI / 4) * radius) !== 1) return false;
    if (blocked(x, z, state, radius)) return false;
    const g = grids[floorOf(x)];
    return !g?.obstacles.some(o => (x - o.x) ** 2 + (z - o.z) ** 2 < (o.r + radius) ** 2);
  }
  // Over a pit (for thrown loot that misses the bridge).
  const overPit = (x, z) => cell(x, z) === 2;
  function lineClear(a, b, state = {}, radius = .3) {
    if (floorOf(a.x) !== floorOf(b.x)) return false;
    const n = Math.ceil(distance(a, b) / .4);
    for (let i = 0; i <= n; i++) { const t = n ? i / n : 0; if (!walkable(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, state, radius)) return false; }
    return true;
  }
  function moveBody(body, dx, dz, state, radius = .45) {
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .2));
    let moved = false;
    for (let i = 0; i < n; i++) {
      if (walkable(body.x + dx / n, body.z, state, radius)) { body.x += dx / n; moved = true; }
      if (walkable(body.x, body.z + dz / n, state, radius)) { body.z += dz / n; moved = true; }
    }
    return moved;
  }
  function groundAt(x, z) {
    for (const s of run.stubs) if (s.floor === floorOf(x) && inRect(x, z, s.rect)) {
      const t = Math.max(0, Math.min(1, (z - s.a) / (s.b - s.a)));
      return s.from + (s.to - s.from) * t;
    }
    // The rope bridge sags like the shared model (deck .75 m lower mid-span).
    for (const b of run.bridges) if (b.floor === floorOf(x) && inRect(x, z, b.rect)) {
      const mid = (b.rect[1] + b.rect[3]) / 2, half = (b.rect[3] - b.rect[1]) / 2;
      return -.75 * (1 - ((z - mid) / half) ** 2);
    }
    return overPit(x, z) ? -6 : 0;
  }
  function regionAt(p) {
    const f = floorOf(p.x);
    return run.rooms.find(r => r.floor === f && inRect(p.x, p.z, r.rect)) || null;
  }
  // Breadth-first search on a 1 m grid, then string-pulled to the few
  // waypoints that keep a clear line. Returns [] when there is no way.
  function findPath(from, to, state = {}, radius = .5) {
    if (floorOf(from.x) !== floorOf(to.x)) return [];
    if (lineClear(from, to, state, radius)) return [{ x: to.x, z: to.z }];
    const key = (i, j) => `${i},${j}`, ok = (i, j) => walkable(i + .5, j + .5, state, radius);
    const snap = p => { const i = Math.floor(p.x), j = Math.floor(p.z); for (const [di, dj] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) if (ok(i + di, j + dj)) return [i + di, j + dj]; return null; };
    const start = snap(from), goal = snap(to); if (!start || !goal) return [];
    const previous = new Map([[key(...start), null]]), queue = [start];
    let found = false;
    for (let q = 0; q < queue.length && q < 6000; q++) {
      const [i, j] = queue[q];
      if (i === goal[0] && j === goal[1]) { found = true; break; }
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = key(i + di, j + dj); if (previous.has(k) || !ok(i + di, j + dj)) continue;
        previous.set(k, key(i, j)); queue.push([i + di, j + dj]);
      }
    }
    if (!found) return [];
    const cells = [];
    for (let k = key(...goal); k; k = previous.get(k)) { const [i, j] = k.split(',').map(Number); cells.unshift({ x: i + .5, z: j + .5 }); }
    cells.push({ x: to.x, z: to.z });
    const path = []; let here = from;
    for (let i = 0; i < cells.length;) {
      let far = i;
      for (let k = Math.min(cells.length - 1, i + 12); k > i; k--) if (lineClear(here, cells[k], state, radius)) { far = k; break; }
      path.push(cells[far]); here = cells[far]; i = far + 1;
    }
    return path;
  }
  // A pearl the deck rolled against a pit edge or a wall would be unreachable.
  run.loot = run.loot.filter(l => ITEMS[l.kind]?.size === 'big' || l.y || walkable(l.x, l.z, { open: {}, revealed: Object.fromEntries(run.hidden.map(h => [h.id, true])) }, .3));
  const layout = { run, walkable, lineClear, moveBody, groundAt, regionAt, findPath, overPit, floorOf, SPACING };
  layouts.set(key, layout);
  return layout;
}
