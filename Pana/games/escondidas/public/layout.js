// Shared map data; relative path also works in Node rule tests.
export * from '../../../engine/worlds/plaza-layout.js';
import * as plaza from '../../../engine/worlds/plaza-layout.js';
import { arenaInfo, arenaLayout, createHuntLayout } from '../../../engine/worlds/arena-layouts.js';
import { propDefinition } from '../../../engine/models/props/plaza-definitions.js';
const rounds = new Map();
const plazaSolids = [...plaza.BLOCKERS.filter(b => !b.prop), ...plaza.LAMPS.map(([x, z]) => ({ x, z, r: .6, height: 4 }))];
export const nextLayoutSeed = seed => (Math.imul(seed >>> 0, 1664525) + 1013904223) >>> 0 || 1;

// Escondidas plays every map 1.5× larger with twice the props to hide among.
// The plaza scales as a whole (its stalls, fountain and lamps grow with the
// rendered model); shared arenas spread their cover like Pepazo.
export const SPREAD = 1.5;
const grow = b => b.r ? { ...b, x: b.x * SPREAD, z: b.z * SPREAD, r: b.r * SPREAD } : { ...b, x: b.x * SPREAD, z: b.z * SPREAD, w: b.w * SPREAD, d: b.d * SPREAD };
export const spreadCover = cover => cover.map(o => ({ ...o, x: o.x * SPREAD, z: o.z * SPREAD, w: o.w * 1.15, d: o.d * 1.15 }));
const doubled = props => [...props, ...props.map((p, i) => ({ ...p, id: `prop-${props.length + i}` }))];
const bases = new Map();
export function mapData(id) {
  id = arenaInfo(id).id;
  if (!bases.has(id)) {
    const data = id === 'plaza' ? { bounds: plaza.BOUNDS, cover: [], staticBlockers: plazaSolids.map(grow), props: plaza.MAP_PROPS } : arenaLayout(id);
    bases.set(id, { bounds: { x: data.bounds.x * SPREAD, z: data.bounds.z * SPREAD }, cover: id === 'plaza' ? [] : spreadCover(data.cover),
      ...(data.staticBlockers ? { staticBlockers: data.staticBlockers } : {}), props: doubled(data.props) });
  }
  return bases.get(id);
}

// Stateless seeded placement: clients derive exactly the host's props from a
// small snapshot. Wide gaps protect both disguise movement and the nav grid.
export function roundProps(id, seed) {
  const data = mapData(id), solids = data.staticBlockers || data.cover;
  let value = seed >>> 0;
  const random = () => { value = (value + 0x6d2b79f5) >>> 0; let n = value; n = Math.imul(n ^ n >>> 15, n | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
  const types = data.props.map(p => p.type);
  for (let i = types.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [types[i], types[j]] = [types[j], types[i]]; }
  const props = [];
  // Place large props first so a crowded layout never strands a bench.
  const order = types.map((type, i) => ({ type, i, r: propDefinition(type).radius })).sort((a, b) => b.r - a.r);
  for (const { type, i, r } of order) {
    let placed = false;
    for (let attempt = 0; attempt < 4000; attempt++) {
      const x = Math.round((random() * 2 - 1) * (data.bounds.x - r - 1.8) * 10) / 10;
      const z = Math.round((random() * 2 - 1) * (data.bounds.z - r - 1.8) * 10) / 10;
      // Leave the arrival lane (where hiders start) and the counting spot free.
      if ((z > 10.5 - r && z < 15.5 + r && x > -8 - r && x < 19 + r) || Math.hypot(x, z + 10) < r + 2.6) continue;
      if (solids.some(b => b.r ? Math.hypot(x - b.x, z - b.z) < b.r + r + 1.8
        : Math.hypot(Math.max(0, Math.abs(x - b.x) - b.w / 2), Math.max(0, Math.abs(z - b.z) - b.d / 2)) < r + 1.8)) continue;
      if (props.some(p => Math.hypot(x - p.x, z - p.z) < r + propDefinition(p.type).radius + 1.8)) continue;
      props.push({ id: `prop-${i}`, type, x, z, h: Math.floor(random() * 4) * Math.PI / 2 }); placed = true; break;
    }
    if (!placed) throw new Error(`No safe prop placement for ${id}/${seed}/${type}`);
  }
  return props.sort((a, b) => Number(a.id.slice(5)) - Number(b.id.slice(5)));
}

export function huntLayout(id = 'plaza', seed = 1) {
  id = arenaInfo(id).id; seed = seed >>> 0 || 1;
  const key = `${id}:${seed}`;
  if (!rounds.has(key)) {
    rounds.set(key, createHuntLayout(id, { ...mapData(id), props: roundProps(id, seed) }));
    if (rounds.size > 8) rounds.delete(rounds.keys().next().value);
  }
  return rounds.get(key);
}
