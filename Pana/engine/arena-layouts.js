// Shared, renderer-free map definitions. Server and browser read the same cover.
import { propDefinition } from './models/props/plaza-definitions.js';

export const ARENAS = [
  { id: 'plaza', name: 'Plaza Pana', description: 'La plaza de siempre, entre puestos y panas.' },
  { id: 'puerto', name: 'Puerto Coco', description: 'Carga del muelle, callejones y brisa del mar.' },
  { id: 'hato', name: 'Hato del Sol', description: 'Pacas de heno, corrales y un molino llanero.' },
  { id: 'ruinas', name: 'Ruinas del Mango', description: 'Muros de piedra y caminos entre la selva.' },
];
export const validArena = id => ARENAS.some(map => map.id === id);
export const arenaInfo = id => ARENAS.find(map => map.id === id) || ARENAS[0];
// Landmark patios are table settings, not collision arenas for action games.
export const TABLE_ARENAS = [...ARENAS,
  {id:'guipuzcoana',name:'Casa Guipuzcoana',description:'La mesa en el patio, entre galerías de madera y brisa del puerto.'},
  {id:'san-carlos',name:'Fuerte San Carlos',description:'Una partida en el castillo, con el Caribe al pie de la montaña.'},
];
export const validTableArena = id => TABLE_ARENAS.some(map=>map.id===id);
// Pepazo's own maps: the shared arenas plus the container yard, which has no
// hunt or table layout, so it never joins `ARENAS`.
export const PAINT_ARENAS = [...ARENAS,
  { id: 'muelle', name: 'Muelle de La Guaira', description: 'Contenedores apilados, la grúa del puerto y la calle colonial frente al mar.' },
];
export const validPaintArena = id => PAINT_ARENAS.some(map => map.id === id);
export const paintArenaInfo = id => PAINT_ARENAS.find(map => map.id === id) || PAINT_ARENAS[0];
// Court games (Bolas Criollas) also play beside the stadium straight.
export const COURT_ARENAS = [...ARENAS,
  { id: 'estadio', name: 'Estadio Pana', description: 'Frente a la tribuna, donde pasa la carrera de Derrape.' },
];
export const validCourtArena = id => COURT_ARENAS.some(map => map.id === id);
export const courtArenaInfo = id => COURT_ARENAS.find(map => map.id === id) || COURT_ARENAS[0];
export const tableArenaInfo = id => TABLE_ARENAS.find(map=>map.id===id)||TABLE_ARENAS[0];
export const ARENA_SPAWNS = [{ x: -15, z: -15 }, { x: 15, z: 15 }, { x: 15, z: -15 }, { x: -15, z: 15 }, { x: 0, z: -16 }, { x: 0, z: 16 }, { x: -16, z: 0 }, { x: 16, z: 0 }];
const cover = rows => rows.map(([x, z, w, d, h]) => ({ x, z, w, d, h, height: h }));
const props = rows => rows.map(([type, x, z, h = 0], i) => ({ id: `prop-${i}`, type, x, z, h }));
const layouts = {
  puerto: {
    bounds: { x: 18, z: 18 },
    // Offset cargo lanes leave two cross-court routes and all eight spawn exits.
    cover: cover([[-8, -7, 5, 2.4, 2.5], [7, -9, 3, 5, 2.7], [-9, 6, 3, 5, 2.7], [8, 7, 5, 2.4, 2.5], [-2, 0, 3, 3, 2.1], [4, 1, 2.4, 3, 1.8]]),
    props: props([['barrel', -12, -7], ['crate', -6, -11], ['cooler', 5, -13], ['planter', 11, -8], ['bench', -10, 11], ['barrel', -13, 7], ['crate', 7, 11], ['cooler', 12, 7], ['planter', -6, 2], ['bench', 8, -3], ['barrel', -4, 9], ['crate', 3, 9], ['cooler', -11, -2], ['planter', 11, 2], ['barrel', -3, -6], ['crate', 2, -7], ['cooler', -7, 14], ['planter', 7, 15], ['bench', -12, -12], ['barrel', 12, 12]]),
  },
  hato: {
    bounds: { x: 18, z: 18 },
    // A windmill-side lane and staggered hay stacks around an open crossroads.
    cover: cover([[-8, -8, 5.4, 2.2, 2.2], [8, 8, 5.4, 2.2, 2.2], [8, -7, 2.2, 6, 2.2], [-8, 7, 2.2, 6, 2.2], [-2, -2, 3, 2.2, 1.7], [2, 3, 3, 2.2, 1.7], [-3, 12, 4, 2.2, 1.7], [3, -12, 4, 2.2, 1.7]]),
    props: props([['barrel', -12, -8], ['crate', -6, -12], ['cooler', 12, -7], ['planter', 8, -12], ['bench', -12, 4], ['barrel', -6, 4], ['crate', 11, 9], ['cooler', 6, 12], ['planter', -12, 9], ['bench', 12, -2], ['barrel', -4, 5], ['crate', 4, -3], ['cooler', -4, -5], ['planter', 6, 3], ['barrel', -11, -3], ['crate', -8, 12], ['cooler', 2, 9], ['planter', -3, -10], ['bench', 1, -7], ['barrel', 12, 13]]),
  },
  ruinas: {
    bounds: { x: 18, z: 18 },
    // Broken, asymmetric walls form chambers with broad exits, never dead ends.
    cover: cover([[-7, -7, 7, 1.8, 3], [-10, -3, 1.8, 4, 2.6], [7, 7, 7, 1.8, 3], [10, 3, 1.8, 4, 2.6], [7, -7, 1.8, 6, 2.7], [-7, 7, 1.8, 6, 2.7], [-1, 1, 3, 3, 2.3], [-2, -12, 3, 1.8, 1.7], [2, 12, 3, 1.8, 1.7]]),
    props: props([['planter', -12, -7], ['crate', -6, -10], ['barrel', 10, -8], ['cooler', 3, -7], ['bench', -11, 7], ['planter', 6, 11], ['barrel', 12, 7], ['crate', -3, 6], ['cooler', -6, 12], ['bench', 11, -3], ['planter', -5, -2], ['barrel', 5, 2], ['crate', -12, 2], ['cooler', 0, 7], ['planter', 2, -3], ['barrel', -7, -14], ['crate', 6, -13], ['cooler', 12, 12], ['bench', -12, 12], ['planter', 13, -12]]),
  },
};
export const arenaLayout = id => Object.hasOwn(layouts, id) ? layouts[id] : null;

// A table's complete footprint (including its standing/seated panas) stays clear.
export function outsideTable(o, radius = 10) {
  const dx = Math.max(0, Math.abs(o.x) - (o.w ? o.w / 2 : o.r || 0));
  const dz = Math.max(0, Math.abs(o.z) - (o.d ? o.d / 2 : o.r || 0));
  return Math.hypot(dx, dz) > radius;
}

// Each instance closes over its own map: selecting a map in one room must never
// change another room's collision or navigation. Construct the grid lazily.
export function createHuntLayout(id, data = arenaLayout(id)) {
  if (!data) throw new Error(`Unknown shared arena: ${id}`);
  const blockers = [...(data.staticBlockers || data.cover), ...data.props.map(p => ({ x: p.x, z: p.z, r: propDefinition(p.type).radius, height: propDefinition(p.type).height, prop: p.id }))];
  function blocked(x, z, radius = .5) {
    return Math.abs(x) > data.bounds.x - radius || Math.abs(z) > data.bounds.z - radius || blockers.some(b => b.r
      ? Math.hypot(x - b.x, z - b.z) < b.r + radius
      : Math.abs(x - b.x) < b.w / 2 + radius && Math.abs(z - b.z) < b.d / 2 + radius);
  }
  function move(p, dx, dz, radius = .5) {
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .2));
    for (let i = 0; i < steps; i++) {
      if (!blocked(p.x + dx / steps, p.z, radius)) p.x += dx / steps;
      if (!blocked(p.x, p.z + dz / steps, radius)) p.z += dz / steps;
    }
  }
  function safeSpot(x, z, radius = .6) {
    if (!blocked(x, z, radius)) return { x, z };
    for (let r = .4; r < 50; r += .4) for (let i = 0; i < 24; i++) {
      const p = { x: x + Math.cos(i * Math.PI / 12) * r, z: z + Math.sin(i * Math.PI / 12) * r };
      if (!blocked(p.x, p.z, radius)) return p;
    }
    throw new Error(`No free spawn in ${id}`);
  }
  function clearSight(a, b) {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / .2);
    for (let i = 1; i < n; i++) {
      const x = a.x + (b.x - a.x) * i / n, z = a.z + (b.z - a.z) * i / n;
      if (blockers.some(o => o.height >= 1.2 && (o.r ? Math.hypot(x - o.x, z - o.z) < o.r * .85 : Math.abs(x - o.x) < o.w / 2 && Math.abs(z - o.z) < o.d / 2))) return false;
    }
    return true;
  }
  let nodes, links;
  function walkable(a, b, radius = .6) {
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / .2));
    for (let i = 0; i <= n; i++) if (blocked(a.x + (b.x - a.x) * i / n, a.z + (b.z - a.z) * i / n, radius)) return false;
    return true;
  }
  function route(from, to) {
    if (!nodes) {
      nodes = [];
      for (let z = 1 - data.bounds.z; z < data.bounds.z; z++) for (let x = 1 - data.bounds.x; x < data.bounds.x; x++) if (!blocked(x, z, .65)) nodes.push({ x, z });
      const at = new Map(nodes.map((p, i) => [`${p.x},${p.z}`, i]));
      links = nodes.map(p => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([x, z]) => at.get(`${p.x + x},${p.z + z}`)).filter(i => i !== undefined && walkable(p, nodes[i])));
    }
    const nearest = p => {
      let best = -1, distance = Infinity;
      nodes.forEach((n, i) => { const d = Math.hypot(n.x - p.x, n.z - p.z); if (d < distance && walkable(p, n, .5)) { best = i; distance = d; } });
      return best;
    };
    const start = nearest(from), end = nearest(to);
    if (start < 0 || end < 0) return [];
    const queue = [start], previous = new Map([[start, -1]]);
    for (let i = 0; i < queue.length && !previous.has(end); i++) for (const next of links[queue[i]]) if (!previous.has(next)) { previous.set(next, queue[i]); queue.push(next); }
    if (!previous.has(end)) return [];
    const path = [];
    for (let i = end; i !== -1; i = previous.get(i)) path.unshift(nodes[i]);
    return path;
  }
  return { ...data, blockers, blocked, move, safeSpot, clearSight, route };
}
