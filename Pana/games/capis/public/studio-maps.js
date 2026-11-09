// Authored studio presets admitted to multiplayer after movement/cover checks.
import { generateTepuyMap, tepuyFigure } from './tepuy-maps.js';
import { seededStream } from '../../../engine/play/terrain-gen.js';
import { standable, hiddenFrom, ffaGraph, WATER } from './map-rules.js';

export const STUDIO_PRESETS = Object.freeze(['corona', 'canon', 'morochos']);
export function studioFigure(seed) {
  return STUDIO_PRESETS.map(tepuyFigure).find(f => f.seed === seed)
    || tepuyFigure(STUDIO_PRESETS[Math.floor(seededStream(`capis-studio:${seed}`)() * STUDIO_PRESETS.length)]);
}
export function studioCandidates(seed) {
  const out = STUDIO_PRESETS.map(id => tepuyFigure(id).seed), r = seededStream(`capis-setup:${seed}`);
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
export function generateStudioMap(seed) {
  const figure = studioFigure(seed), built = generateTepuyMap(figure.seed, 'large', figure.style, figure.shape);
  const { map, mask } = built;
  Object.assign(map, { seed, authoredSeed: figure.seed, figure: figure.id, name: figure.name, ambient: figure.ambient, studio: true, attempt: 0 });
  // Only the flanks' steep step runs are stairs; cap risers, terraces and
  // bare slopes keep the ordinary climb limit (a hop).
  mask.stairs = map.plan.mesas.flatMap(m => [
    ...m.flanks[0].stairs.map(([a, b]) => [m.cx - m.tw - b, m.cx - m.tw - a]),
    ...m.flanks[1].stairs.map(([a, b]) => [m.cx + m.tw + a, m.cx + m.tw + b])]).sort((a, b) => a[0] - b[0]);
  map.ffaSpawns = studioSpawns(map, mask);
  return built;
}

// Dynamic programming keeps the original spacing/cover safeguards. No changes
// to the authored mask, no fallback generator, and no crowding failed spawns.
export function studioSpawns(map, mask) {
  // Only ground 5 or more above the water that the strict graph links both
  // ways to the land's middle (the same filter as map-rules shelterSpawns).
  const cand = [], count = 6, margin = 8, ideal = (map.width - margin * 2) / count, graph = ffaGraph(mask);
  let hub = -1;
  for (let d = 0; d < 40 && hub < 0; d += .5) for (const x of [map.width / 2 + d, map.width / 2 - d]) { const y = standable(mask, x); if (y !== null && hub < 0) hub = graph.near(x, y, .6); }
  if (hub < 0) throw new Error(`No middle floor on studio preset ${map.figure}`);
  const fromHub = graph.reach(hub), toHub = graph.reachedBy(hub);
  for (let x = margin; x <= map.width - margin; x += .5) {
    const y = standable(mask, x); if (y === null || y < WATER + 5) continue;
    const node = graph.near(x, y, .6); if (node < 0 || !fromHub[node] || !toHub[node]) continue;
    cand.push({ x, y });
  }
  const n = cand.length, best = Array.from({ length: count }, () => new Float64Array(n).fill(-Infinity));
  const from = Array.from({ length: count }, () => new Int32Array(n).fill(-1));
  for (let j = 0; j < n; j++) if (cand[j].x <= margin + ideal) best[0][j] = 0;
  for (let k = 1; k < count; k++) for (let j = 0; j < n; j++) for (let i = j - 1; i >= 0; i--) {
    const gap = cand[j].x - cand[i].x;
    if (gap < 20) continue;
    if (gap > 56) break;
    const score = best[k - 1][i] + (hiddenFrom(mask, cand[i].x, cand[i].y, cand[j].x, cand[j].y) ? 10 : 0) - Math.abs(gap - ideal) * .05;
    if (score > best[k][j]) { best[k][j] = score; from[k][j] = i; }
  }
  let end = -1;
  for (let j = 0; j < n; j++) if (cand[j].x >= map.width - margin - ideal && best[count - 1][j] > (end < 0 ? -Infinity : best[count - 1][end])) end = j;
  if (end < 0) throw new Error(`No spaced starts for studio preset ${map.figure}`);
  const xs = [];
  for (let k = count - 1, j = end; k >= 0; j = from[k][j], k--) xs.unshift(cand[j].x);
  const ys = xs.map(x => standable(mask, x));
  if (xs.slice(1).filter((x, i) => hiddenFrom(mask, xs[i], ys[i], x, ys[i + 1])).length < 4) throw new Error(`Insufficient cover for studio preset ${map.figure}`);
  return xs;
}
