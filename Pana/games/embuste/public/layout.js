// ¡Embuste! map: El Campamento y el Templo. Renderer-free so the server room,
// the rules, the bots and the scene all share the same walkable footprint.
//
//           [TEMPLO]──túnel──[MINA]
//              │                │
//         [CASCADA]        [DEPÓSITO]
//              │                │
//    [CRUCE]──puente──[FOGATA]──┴──[CARPA RADIO]
//                         │
//                    [COCINA]──[MUELLE]
//
// Metres, +x east, +z south (north is -z). Zones are rectangles that overlap
// where two of them join.

export const ZONES = [
  { id: 'fogata', name: 'La fogata', x: 0, z: 0, w: 20, d: 20, lit: true },
  { id: 'puente', name: 'El puente colgante', x: -17, z: 0, w: 15, d: 6, path: true },
  { id: 'cruce', name: 'El cruce', x: -30, z: 0, w: 12, d: 12 },
  { id: 'sendero-cascada', name: 'Sendero de la cascada', x: -30, z: -14.5, w: 6, d: 17, path: true },
  { id: 'cascada', name: 'La cascada', x: -30, z: -30, w: 18, d: 14 },
  { id: 'escalinata', name: 'La escalinata', x: -30, z: -42, w: 6, d: 10, path: true },
  { id: 'templo', name: 'El templo', x: -30, z: -56, w: 22, d: 18 },
  { id: 'tunel', name: 'El túnel', x: -2, z: -58, w: 34, d: 5, path: true },
  { id: 'mina', name: 'La mina', x: 24, z: -56, w: 18, d: 18 },
  { id: 'rieles', name: 'Los rieles', x: 24, z: -41, w: 6, d: 12, path: true },
  { id: 'deposito', name: 'El depósito', x: 24, z: -28, w: 16, d: 14 },
  { id: 'sendero-este', name: 'Sendero del depósito', x: 24, z: -12, w: 6, d: 18, path: true },
  { id: 'camino-radio', name: 'Camino de la radio', x: 19, z: 0, w: 18, d: 6, path: true },
  { id: 'radio', name: 'La carpa de la radio', x: 36, z: 0, w: 16, d: 14 },
  { id: 'sendero-cocina', name: 'Sendero de la cocina', x: 0, z: 14, w: 6, d: 8, path: true },
  { id: 'cocina', name: 'La cocina', x: 0, z: 24, w: 18, d: 12 },
  { id: 'sendero-muelle', name: 'Sendero del muelle', x: 14, z: 24, w: 10, d: 5, path: true },
  { id: 'muelle', name: 'El muelle', x: 26, z: 25, w: 14, d: 12 },
];
export const BOUNDS = { minX: -42, maxX: 45, minZ: -66, maxZ: 32 };

export const FIRE = { x: 0, z: 0 };
export const RELIC = { x: 0, z: -6 };
export const BELL = { x: 5, z: 4 };
// The rope bridge's deck: cut, nobody alive can cross it.
export const BRIDGE = { x: -17, z: 0, w: 6, d: 6 };

// Task stations: the object you work at. You use it from within REACH.
export const REACH = 2;
export const STATIONS = [
  { id: 'malacate', name: 'El malacate', x: 24, z: -62.5, zone: 'mina' },
  { id: 'faroles', name: 'Los faroles', x: -33.5, z: -4.5, zone: 'cruce' },
  { id: 'reliquia', name: 'Mesa de la reliquia', x: 19.5, z: -31, zone: 'deposito' },
  { id: 'tabla', name: 'Tabla del puente', x: -25.5, z: 4, zone: 'cruce' },
  { id: 'agua', name: 'La poza', x: -25, z: -33.5, zone: 'cascada' },
  { id: 'arepas', name: 'El budare', x: -5, z: 27.5, zone: 'cocina' },
  { id: 'radio', name: 'La radio', x: 40, z: 4.5, zone: 'radio' },
  { id: 'jeroglificos', name: 'Muro de jeroglíficos', x: -30, z: -63.5, zone: 'templo' },
  { id: 'prov-muelle', name: 'La curiara', x: 30, z: 29, zone: 'muelle' },
  { id: 'prov-cocina', name: 'La despensa', x: 6, z: 20.5, zone: 'cocina' },
];

// Where sabotage gets fixed.
export const FIXES = {
  apagar: [{ x: RELIC.x, z: RELIC.z, r: 2.6 }],
  puente: [{ x: -8.5, z: 0, r: 2 }, { x: -25.5, z: -0.5, r: 2 }],
  radio: [{ x: 34, z: -5, r: 2 }],
  crecida: [{ x: 21, z: 30, r: 2 }, { x: 32, z: 20.5, r: 2 }],
};

// Mummy shortcuts: hollow logs and temple tunnels, in linked pairs.
export const VENTS = [
  { id: 'tronco-cascada', name: 'Tronco de la cascada', x: -37.5, z: -26, link: 'tronco-cocina', kind: 'log' },
  { id: 'tronco-cocina', name: 'Tronco de la cocina', x: -7.5, z: 28.5, link: 'tronco-cascada', kind: 'log' },
  { id: 'boca-templo', name: 'Boca del templo', x: -39, z: -60, link: 'boca-mina', kind: 'tunnel' },
  { id: 'boca-mina', name: 'Boca de la mina', x: 31.5, z: -60, link: 'boca-templo', kind: 'tunnel' },
  { id: 'tronco-deposito', name: 'Tronco del depósito', x: 30.5, z: -23, link: 'tronco-radio', kind: 'log' },
  { id: 'tronco-radio', name: 'Tronco de la radio', x: 42.5, z: -5.5, link: 'tronco-deposito', kind: 'log' },
  { id: 'tronco-cruce', name: 'Tronco del cruce', x: -35, z: 4.5, link: 'tronco-muelle', kind: 'log' },
  { id: 'tronco-muelle', name: 'Tronco del muelle', x: 20.5, z: 22, link: 'tronco-cruce', kind: 'log' },
];

// Pana hiding spots.
export const HIDES = [
  { id: 'carpa', name: 'La carpa de dormir', x: -7.5, z: 7.5, prop: 'tent' },
  { id: 'cava', name: 'La cava', x: 7, z: 28.5, prop: 'cooler' },
  { id: 'cascada', name: 'Detrás de la cascada', x: -34, z: -35.5, prop: 'falls' },
  { id: 'cajas', name: 'Las cajas', x: 30, z: -33.5, prop: 'crate' },
  { id: 'barril', name: 'El barril', x: 42.5, z: 6, prop: 'barrel' },
];

export const OBSTACLES = [
  { ...FIRE, r: 1.5 }, { ...RELIC, r: 0.9 }, { ...BELL, r: 0.45 },
  ...STATIONS.map(s => ({ x: s.x, z: s.z, r: 0.55 })),
  ...HIDES.filter(h => h.prop !== 'falls').map(h => ({ x: h.x, z: h.z, r: 0.75 })),
  { x: 6.5, z: -6.5, r: 1.5 }, { x: -6.5, z: -6.5, r: 1.5 },          // camp tents
  { x: -36, z: -54, r: 1.3 }, { x: -24, z: -54, r: 1.3 },             // temple columns
  { x: -39, z: -49, r: 0.9 }, { x: -21, z: -49, r: 0.9 },             // totems
  { x: 18, z: -50, r: 1 }, { x: 29, z: -52, r: 1 },                   // mine carts
  { x: -2, z: 22, r: 1.4 },                                           // kitchen table
];

// Meeting seats around the fire.
export const SEATS = Array.from({ length: 8 }, (_, i) => {
  const a = i / 8 * Math.PI * 2 + Math.PI / 8;
  return { x: Math.sin(a) * 4.2, z: Math.cos(a) * 4.2, h: a + Math.PI };
});

export const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const inRect = (x, z, b, pad = 0) => Math.abs(x - b.x) < b.w / 2 + pad && Math.abs(z - b.z) < b.d / 2 + pad;
export const floorAt = (x, z) => ZONES.some(r => inRect(x, z, r, 0.001));
export const zoneAt = p => ZONES.find(r => !r.path && inRect(p.x, p.z, r)) || ZONES.find(r => inRect(p.x, p.z, r)) || ZONES[0];
export const zoneById = id => ZONES.find(z => z.id === id);
export const inBounds = (x, z) => x > BOUNDS.minX && x < BOUNDS.maxX && z > BOUNDS.minZ && z < BOUNDS.maxZ;

// state: { bridgeCut } — the cut bridge blocks its deck.
export function walkable(x, z, state = {}, radius = 0.45) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  for (let i = 0; i < 8; i++) if (!floorAt(x + Math.cos(i * Math.PI / 4) * radius, z + Math.sin(i * Math.PI / 4) * radius)) return false;
  if (state.bridgeCut && inRect(x, z, BRIDGE, radius)) return false;
  return !OBSTACLES.some(o => Math.hypot(x - o.x, z - o.z) < o.r + radius);
}
export function lineClear(a, b, state = {}, radius = 0.3) {
  const n = Math.ceil(distance(a, b) / 0.5);
  for (let i = 0; i <= n; i++) { const t = n ? i / n : 0; if (!walkable(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, state, radius)) return false; }
  return true;
}
// Line of sight: walls (the edge of the floor) block it; furniture does not.
export function sightClear(a, b) {
  const n = Math.ceil(distance(a, b) / 0.6);
  for (let i = 1; i < n; i++) { const t = i / n; if (!floorAt(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false; }
  return true;
}
export function moveBody(body, dx, dz, state, radius = 0.45) {
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.2));
  for (let i = 0; i < n; i++) {
    if (walkable(body.x + dx / n, body.z, state, radius)) body.x += dx / n;
    if (walkable(body.x, body.z + dz / n, state, radius)) body.z += dz / n;
  }
}
export const stationById = id => STATIONS.find(s => s.id === id);
export const ventById = id => VENTS.find(v => v.id === id);
export const hideById = id => HIDES.find(h => h.id === id);
export const near = (p, spot, r = REACH) => distance(p, spot) <= r;

// Navigation: a 1 m grid, one per bridge state, built on first use.
const STEP = 1, graphs = new Map();
const key = (x, z) => `${x},${z}`;
function graph(state = {}) {
  const k = state.bridgeCut ? 'cut' : 'open';
  if (graphs.has(k)) return graphs.get(k);
  const nodes = new Map();
  for (let x = Math.ceil(BOUNDS.minX); x <= BOUNDS.maxX; x += STEP) for (let z = Math.ceil(BOUNDS.minZ); z <= BOUNDS.maxZ; z += STEP) {
    if (walkable(x, z, state, 0.5)) nodes.set(key(x, z), { x, z });
  }
  graphs.set(k, nodes); return nodes;
}
function nearestNode(p, state) {
  const nodes = graph(state), cx = Math.round(p.x), cz = Math.round(p.z);
  for (let r = 0; r < 6; r++) {
    let best = null, d = Infinity;
    for (let x = cx - r; x <= cx + r; x++) for (let z = cz - r; z <= cz + r; z++) {
      const n = nodes.get(key(x, z)); if (!n) continue;
      const nd = distance(p, n); if (nd < d && lineClear(p, n, state, 0.3)) { best = n; d = nd; }
    }
    if (best) return best;
  }
  return null;
}
// Shortest grid route, then pulled straight wherever the line is clear.
export function findPath(from, to, state = {}) {
  if (lineClear(from, to, state, 0.45)) return [{ x: to.x, z: to.z }];
  const nodes = graph(state), start = nearestNode(from, state), end = nearestNode(to, state);
  if (!start || !end) return [];
  const startKey = key(start.x, start.z), endKey = key(end.x, end.z);
  const previous = new Map([[startKey, null]]), open = [startKey];
  for (let i = 0; i < open.length && !previous.has(endKey); i++) {
    const n = nodes.get(open[i]);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const k = key(n.x + dx, n.z + dz);
      if (previous.has(k) || !nodes.has(k)) continue;
      if (dx && dz && (!nodes.has(key(n.x + dx, n.z)) || !nodes.has(key(n.x, n.z + dz)))) continue;
      previous.set(k, open[i]); open.push(k);
    }
  }
  if (!previous.has(endKey)) return [];
  const raw = [];
  for (let k = endKey; k; k = previous.get(k)) raw.unshift(nodes.get(k));
  raw.push({ x: to.x, z: to.z });
  const path = []; let at = from;
  for (let i = 0; i < raw.length;) {
    let j = raw.length - 1;
    while (j > i && !lineClear(at, raw[j], state, 0.45)) j--;
    path.push(raw[j]); at = raw[j]; i = j + 1;
  }
  return path;
}
export const pathLength = (from, path) => path.reduce((sum, p, i) => sum + distance(i ? path[i - 1] : from, p), 0);
