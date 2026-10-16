// Rendering and simulation share the same authored walkable footprint.
export const ROOMS = [
  { id: 'camp', name: 'Campamento', x: 0, z: 15, w: 22, d: 22, color: 0x967754 },
  { id: 'mine', name: 'La mina vieja', x: 0, z: -8, w: 12, d: 28, color: 0x77654e },
  { id: 'gallery', name: 'Galería de los ecos', x: 0, z: -32, w: 26, d: 24, color: 0x777359 },
  { id: 'bridge', name: 'El paso del abismo', x: 23, z: -32, w: 26, d: 8, color: 0x85704d },
  { id: 'winches', name: 'Las dos ruedas', x: 40, z: -32, w: 22, d: 26, color: 0x768174 },
  { id: 'gate', name: 'Umbral de jade', x: 40, z: -49, w: 10, d: 12, color: 0x768174 },
  { id: 'crypt', name: 'El patio dormido', x: 40, z: -66, w: 30, d: 26, color: 0x778372 },
  { id: 'hall', name: 'Camino del guardián', x: 40, z: -85, w: 10, d: 16, color: 0x7d8065 },
  { id: 'sanctum', name: 'La cámara del sol', x: 40, z: -105, w: 34, d: 28, color: 0x918368 },
  { id: 'shortcut', name: 'El túnel de regreso', x: 17, z: -65, w: 24, d: 6, color: 0x686a53 },
  { id: 'return', name: 'La salida oculta', x: 4, z: -53, w: 6, d: 28, color: 0x686a53 },
];
export const CAMP = { x: 0, z: 17 };
export const GATE = { x: 40, z: -48, w: 10, d: 1.4 };
export const SHORTCUT = { x: 26, z: -65, w: 1.3, d: 6 };
export const WINCHES = [{ id: 'west', x: 33, z: -38 }, { id: 'east', x: 47, z: -38 }];
export const ALTAR = { x: 40, z: -110 };
export const SUPPLIES = [{ id: 0, x: -7, z: -28 }, { id: 1, x: 48, z: -60 }, { id: 2, x: 29, z: -100 }];
export const OBSTACLES = [
  ...WINCHES.map(p => ({ ...p, r: 0.65, furniture: true })),
  ...SUPPLIES.map(p => ({ ...p, r: 0.5, furniture: true })),
  { ...ALTAR, r: 1.6, furniture: true },
  { x: -8, z: 17, r: 1.6 }, { x: 7, z: 10, r: 1.5 },
  { x: -8, z: -36, r: 1.2 }, { x: 8, z: -28, r: 1.2 },
  ...[-1, 1].flatMap(s => [-61, -73].map(z => ({ x: 40 + s * 10, z, r: 1.3 }))),
  ...[-1, 1].flatMap(s => [-99, -112].map(z => ({ x: 40 + s * 12, z, r: 1.5 }))),
];
export const SPAWNS = [
  { x: -3, z: -17 }, { x: 8, z: -40 }, { x: -9, z: -27 },
  { x: 48, z: -23 }, { x: 32, z: -40 }, { x: 48, z: -73 },
  { x: 29, z: -72 }, { x: 50, z: -113 }, { x: 28, z: -108 },
  { x: 4, z: -57 }, { x: 15, z: -65 },
];
export const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const inRect = (x, z, b, pad = 0) => Math.abs(x - b.x) < b.w / 2 + pad && Math.abs(z - b.z) < b.d / 2 + pad;
export function floorAt(x, z) { return ROOMS.some(r => inRect(x, z, r, 0.001)); }
export function walkable(x, z, state = {}, radius = 0.48) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  for (let i = 0; i < 8; i++) if (!floorAt(x + Math.cos(i * Math.PI / 4) * radius, z + Math.sin(i * Math.PI / 4) * radius)) return false;
  if (!state.gateOpen && inRect(x, z, GATE, radius)) return false;
  if (!state.relicTaken && inRect(x, z, SHORTCUT, radius)) return false;
  return !OBSTACLES.some(o => Math.hypot(x - o.x, z - o.z) < o.r + radius);
}
export function lineClear(a, b, state = {}, radius = 0.3) {
  const n = Math.ceil(distance(a, b) / 0.5);
  for (let i = 0; i <= n; i++) { const t = n ? i / n : 0; if (!walkable(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, state, radius)) return false; }
  return true;
}
export function moveBody(body, dx, dz, state, radius = 0.48) {
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.25));
  for (let i = 0; i < n; i++) {
    if (walkable(body.x + dx / n, body.z, state, radius)) body.x += dx / n;
    if (walkable(body.x, body.z + dz / n, state, radius)) body.z += dz / n;
  }
}
export function regionAt(p) { return ROOMS.find(r => inRect(p.x, p.z, r)) || ROOMS[0]; }

// Small fixed grid, rebuilt only logically when gates change; no renderer dependency.
const nodes = new Map();
for (let x = -12; x <= 56; x += 2) for (let z = -118; z <= 26; z += 2) if (floorAt(x, z)) nodes.set(`${x},${z}`, { x, z });
function nearest(p, state) {
  let best = null, d = Infinity;
  for (const [key, n] of nodes) { const nd = distance(p, n); if (nd < d && walkable(n.x, n.z, state, 0.5) && lineClear(p, n, state, 0.45)) { best = key; d = nd; } }
  return best;
}
export function findPath(from, to, state) {
  if (lineClear(from, to, state, 0.5)) return [{ x: to.x, z: to.z }];
  const start = nearest(from, state), end = nearest(to, state); if (!start || !end) return [];
  const open = [start], visited = new Set([start]), previous = new Map();
  for (let i = 0; i < open.length; i++) {
    const key = open[i]; if (key === end) break;
    const n = nodes.get(key);
    for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) {
      const k = `${n.x + dx},${n.z + dz}`;
      if (visited.has(k) || !nodes.has(k)) continue;
      const next = nodes.get(k); if (!lineClear(n, next, state, 0.5)) continue;
      visited.add(k); previous.set(k, key); open.push(k);
    }
  }
  if (!visited.has(end)) return [];
  const path = [{ x: to.x, z: to.z }];
  for (let k = end; k && k !== start; k = previous.get(k)) path.unshift(nodes.get(k));
  return path;
}
