// Plain map data is shared by rendering, collision, AI and rule tests.
import { propDefinition } from '/engine/models/props/plaza-definitions.js';

export const BOUNDS = { x: 22, z: 19 };
export const STALLS = [
  { x: -11, z: -4, h: 0, seed: 1 },
  { x: 11, z: 3, h: Math.PI, seed: 2 },
  { x: 12, z: -11, h: 0, seed: 3 },
];
export const TREES = [[-18, -12], [18, 12], [-18, 11], [18, -15], [-6, -16], [7, 16]];
export const LAMPS = [[-19, -7], [19, 7], [-5, 7], [5, -7], [-20, 15], [20, -16]];
const placements = [
  ['barrel', -8, 10], ['crate', -10, 11.8], ['cooler', -6.2, 11.4], ['planter', -12.5, 11], ['bench', -15, 7, 1.57],
  ['barrel', 8, 10], ['barrel', 9.7, 10.5], ['crate', 12, 10], ['cooler', 14, 11], ['planter', 15.5, 8],
  ['crate', -15, -3], ['barrel', -14.8, -5.2], ['cooler', -8, -2], ['planter', -8, -6.2], ['bench', -15, -10],
  ['barrel', 8, 1.4], ['crate', 14.5, 2], ['crate', 14.6, 4.3], ['planter', 8, 5.5], ['cooler', 11, 6],
  ['barrel', 8, -11], ['cooler', 15.3, -10], ['crate', 14.5, -14], ['planter', 8.5, -14.3], ['bench', 17, -5, -1.57],
  ['planter', -4.2, -10.8], ['planter', 4.2, -10.8], ['crate', -10.5, -14], ['barrel', -12.5, -14.5],
  ['bench', 0, 10], ['planter', -2.6, 10], ['planter', 2.6, 10],
  ['barrel', -19, 0], ['crate', -18.5, 2.2], ['planter', 19.5, 0],
  ['cooler', -13, 15.5], ['barrel', 12, 15.5], ['crate', 14, 16], ['planter', -19, 16],
  ['bench', -11, -17], ['bench', 2, -16],
];
export const MAP_PROPS = placements.map(([type, x, z, h = 0], i) => ({ id: `prop-${i}`, type, x, z, h }));
export const BLOCKERS = [
  { x: 0, z: 0, r: 3.2, height: 3.8 },
  ...STALLS.map(s => ({ x: s.x, z: s.z, w: 4.8, d: 2.5, height: 3.5 })),
  ...TREES.map(([x, z]) => ({ x, z, r: 0.65, height: 8 })),
  ...MAP_PROPS.map(p => ({ x: p.x, z: p.z, r: propDefinition(p.type).radius, height: propDefinition(p.type).height, prop: p.id })),
];

export function blocked(x, z, radius = 0.5) {
  if (Math.abs(x) > BOUNDS.x - radius || Math.abs(z) > BOUNDS.z - radius) return true;
  return BLOCKERS.some(b => b.r
    ? Math.hypot(x - b.x, z - b.z) < b.r + radius
    : Math.abs(x - b.x) < b.w / 2 + radius && Math.abs(z - b.z) < b.d / 2 + radius);
}

export function move(p, dx, dz, radius = 0.5) {
  // Substeps prevent tunneling after an inactive tab or a large test step.
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.2));
  for (let i = 0; i < n; i++) {
    if (!blocked(p.x + dx / n, p.z, radius)) p.x += dx / n;
    if (!blocked(p.x, p.z + dz / n, radius)) p.z += dz / n;
  }
}

export function clearSight(a, b) {
  const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(d / 0.3);
  for (let i = 1; i < n; i++) {
    const x = a.x + (b.x - a.x) * i / n, z = a.z + (b.z - a.z) * i / n;
    if (BLOCKERS.some(o => o.height >= 1.2 && (o.r
      ? Math.hypot(x - o.x, z - o.z) < o.r * 0.85
      : Math.abs(x - o.x) < o.w / 2 && Math.abs(z - o.z) < o.d / 2))) return false;
  }
  return true;
}

export function safeSpot(x, z, radius = 0.6) {
  if (!blocked(x, z, radius)) return { x, z };
  for (let r = 0.5; r < 45; r += 0.5) for (let i = 0; i < 16; i++) {
    const a = i * Math.PI / 8, p = { x: x + Math.cos(a) * r, z: z + Math.sin(a) * r };
    if (!blocked(p.x, p.z, radius)) return p;
  }
  return { x: 0, z: 14 };
}

// A small navigation grid lets seekers go around stalls and the fountain.
const nodes = [];
for (let z = -18; z <= 18; z += 2) for (let x = -20; x <= 20; x += 2) {
  if (!blocked(x, z, 0.65)) nodes.push({ x, z });
}
const links = nodes.map(a => nodes.map((b, i) => Math.hypot(a.x - b.x, a.z - b.z) < 2.1 && a !== b ? i : -1).filter(i => i >= 0));
export function route(from, to) {
  const nearest = p => nodes.reduce((best, n, i) => Math.hypot(n.x - p.x, n.z - p.z) < Math.hypot(nodes[best].x - p.x, nodes[best].z - p.z) ? i : best, 0);
  const start = nearest(from), end = nearest(to), queue = [start], prev = new Map([[start, -1]]);
  for (let at = 0; at < queue.length && !prev.has(end); at++) {
    for (const next of links[queue[at]]) if (!prev.has(next)) { prev.set(next, queue[at]); queue.push(next); }
  }
  if (!prev.has(end)) return [];
  const path = [];
  for (let i = end; i !== -1; i = prev.get(i)) path.unshift(nodes[i]);
  return path;
}
