// Ruins: what people left on the tepuyes, built into the ground as masonry.
// Masonry is solid like rock and earth, with three differences a match can use:
//   - it is drawn as what it is (blocks, plaster and brick, planks: `ruin` flags each cell)
//   - it is harder: a blast takes only the inner part of its crater out of it (carveMasonry)
//   - it can fall: a piece cut off from the ground comes down (collapse)
// Pure and deterministic like tepuy-maps.js: the same plan, style and amount
// build the same ruins everywhere.
//
// Styles (`RUIN_STYLES`), each from the region's history:
//   mision  a Capuchin mission of the Guayana: whitewashed walls over brick, an
//           arcade of columns, stone steps down a flank, a bell gable
//   fortin  a colonial fort: walls of stone blocks with merlons, a tower at
//           each end of the map (a shelter, its door on the inland side), a cannon
//   colosal a lost city of giants: the tops paved as stone plazas, stumps of
//           colossal columns, monumental stairs, fallen drums in the valleys and
//           tall towers at the ends (the studio raises the city itself around it)
//   mina    an abandoned mining camp of the Gran Sabana: timber cribbing, rails
//           along the tops, an ore cart and a headframe
// Every piece keeps the routes open: walls and columns are no taller than a
// hop, steps and rails only change what a flank is made of, and towers stand
// on the end shoulders (dead ends).
import { carve, groundBelow, markDirty } from '../../../engine/play/terrain-mask.js';
import { seededStream } from '../../../engine/play/terrain-gen.js';
import { locKey } from '../../../engine/i18n.js';

export const RUIN_STYLES = Object.freeze({
  mision: Object.freeze({ name: locKey('Misión'), blurb: locKey('Muros encalados sobre ladrillo, columnas, escalinatas.') }),
  fortin: Object.freeze({ name: locKey('Fortín'), blurb: locKey('Bloques de piedra, almenas y torres en las puntas.') }),
  mina: Object.freeze({ name: 'Mina', blurb: locKey('Entibado de madera, rieles y vagonetas abandonadas.') }),
  colosal: Object.freeze({ name: 'Ciudad Perdida', blurb: locKey('Plazas de piedra, tocones de columnas gigantes y torres; alrededor, la ciudad colosal.') }),
});
export const RUIN_AMOUNTS = Object.freeze({ pocas: .45, muchas: 1 });
// The tallest any piece on a route stands over its ground (a capi hops ~1.36).
const HOP = 1.15;

export function buildRuins(p, mask, { style = 'mision', amount = 'pocas' } = {}) {
  if (!RUIN_STYLES[style] || !RUIN_AMOUNTS[amount]) return null;
  const { cols, rows, cell } = mask, ruin = new Uint8Array(cols * rows), pieces = [];
  const r = seededStream(`tepuy-ruins:${p.seed}:${p.size}:${p.style}:${style}:${amount}`), between = (a, b) => a + (b - a) * r(), chance = k => r() < k;
  const k = RUIN_AMOUNTS[amount], cave = !!p.cave;
  const ground = (x, from) => groundBelow(mask, x, from);
  const nearSima = x => p.refugios.some(f => f.open !== undefined && Math.abs(x - f.open) < 3);
  // Masonry in a box (every cell set solid and flagged).
  const put = (x0, x1, y0, y1) => {
    for (let c = Math.max(0, Math.floor(Math.min(x0, x1) / cell)); c <= Math.min(cols - 1, Math.floor(Math.max(x0, x1) / cell)); c++)
      for (let rr = Math.max(0, Math.floor(y0 / cell)); rr < Math.min(rows, Math.ceil(y1 / cell)); rr++) { const i = rr * cols + c; mask.solid[i] = 1; ruin[i] = 1; }
  };
  // Air in a box (a window, a door, a room).
  const hole = (x0, x1, y0, y1, hollow = false) => {
    for (let c = Math.max(0, Math.floor(x0 / cell)); c <= Math.min(cols - 1, Math.floor(x1 / cell)); c++)
      for (let rr = Math.max(0, Math.floor(y0 / cell)); rr < Math.min(rows, Math.ceil(y1 / cell)); rr++) { const i = rr * cols + c; mask.solid[i] = 0; if (hollow) mask.hollow[i] = 1; }
  };
  // The existing ground re-made as masonry, a skin `deep` thick (steps, rails).
  const skin = (x0, x1, deep, from) => {
    for (let x = x0; x <= x1; x += cell) { const g = ground(x, from); if (g === null) continue; const c = Math.floor(x / cell);
      for (let rr = Math.max(0, Math.floor((g - deep) / cell)); rr < Math.round(g / cell); rr++) if (mask.solid[rr * cols + c]) ruin[rr * cols + c] = 1; }
  };
  // A wall over uneven ground: each column no taller than a hop over its own ground, the top crumbled.
  const wall = (x, w, h, { window = false, merlons = false } = {}, from) => {
    const step = .3;
    for (let x0 = x - w / 2; x0 < x + w / 2; x0 += step) {
      const g = Math.min(ground(x0, from) ?? 0, ground(x0 + step, from) ?? 0);
      let top = g + h - (chance(.35) ? between(.1, .55) : 0);
      if (merlons) top = g + (Math.round((x0 - x) / step) % 2 ? h : h - .35);
      put(x0, x0 + step - .001, g - .35, Math.min(top, g + HOP));
    }
    if (window) { const g = ground(x, from) ?? 0; hole(x - .18, x + .18, g + .45, g + .8); }
    pieces.push({ kind: 'wall', x, w, y: ground(x, from), h });
  };
  const column = (x, h, from) => {
    const g = ground(x, from); if (g === null) return;
    put(x - .38, x + .38, g - .3, g + .18);                 // plinth
    put(x - .22, x + .22, g, g + Math.min(h, HOP));          // shaft
    pieces.push({ kind: 'column', x, y: g, h });
  };

  if (style === 'colosal') for (const m of p.mesas) {
    const from = m.T + 3;
    // The top paved: a plaza of great blocks (the same ground, made of masonry).
    skin(m.cx - m.tw - .5, m.cx + m.tw + .5, .55, from); pieces.push({ kind: 'plaza', x: m.cx, y: ground(m.cx, from), w: 2 * m.tw });
    // Stumps of colossal columns: wide and low, cover a capi hides behind or hops.
    for (let j = 0, n = 1 + (chance(k) ? 1 : 0); j < n; j++) {
      const x = m.cx + between(-.7, .7) * m.tw, w = between(1.2, 1.7);
      if (nearSima(x) || nearSima(x - w) || nearSima(x + w)) continue;
      const g = ground(x, from); if (g === null) continue;
      put(x - w / 2 - .3, x + w / 2 + .3, g - .45, g + .22); put(x - w / 2, x + w / 2, g, g + between(.7, .98));
      pieces.push({ kind: 'stump', x, y: g, w });
    }
    // Monumental stairs down the flanks.
    if (!cave) for (const side of [-1, 1]) if (chance(.45 + .4 * k)) {
      const x0 = m.cx + side * (m.tw - .3), x1 = m.cx + side * (m.tw + Math.min(6, m.flanks[side < 0 ? 0 : 1].room * .75));
      skin(Math.min(x0, x1), Math.max(x0, x1), .5, m.T + 3); pieces.push({ kind: 'stairs', x: (x0 + x1) / 2, y: m.T, w: Math.abs(x1 - x0) });
    }
  }
  if (style === 'colosal') for (const v of p.valleys) if (v.kind === 'flat') {
    // A fallen drum of a giant column, lying in the valley (low enough to hop).
    const g = ground(v.x, p.height); if (g === null) continue;
    // Only on a flat floor: against a riser it would make the step too tall to hop.
    if ([-2.2, -1.4, 1.4, 2.2].some(o => Math.abs((ground(v.x + o, p.height) ?? -9) - g) > .15)) continue;
    put(v.x - 1.2, v.x + 1.2, g - .25, g + .6); pieces.push({ kind: 'drum', x: v.x, y: g, w: 2.4 });
  }
  // Tops: a piece on some tepuyes (every one when there are many).
  if (style !== 'colosal') for (const m of p.mesas) {
    const n = (chance(k) ? 1 : 0) + (k >= 1 && chance(.45) ? 1 : 0);
    for (let j = 0; j < n; j++) {
      const x = m.cx + between(-.65, .65) * m.tw, from = m.T + 3;
      if (nearSima(x) || nearSima(x - 1.5) || nearSima(x + 1.5)) continue;
      const pick = r();
      if (style === 'mina') {
        if (pick < .5) wall(x, between(1.8, 3), between(.7, 1), {}, from);   // cribbing
        else { skin(x - 3, x + 3, .22, from); pieces.push({ kind: 'rails', x, y: ground(x, from), w: 6 }); }
      } else if (pick < .55) wall(x, between(2.2, 3.8), between(.9, HOP), { window: style === 'mision' && chance(.6), merlons: style === 'fortin' }, from);
      else { const nc = 2 + Math.floor(r() * 2), gap = between(1.1, 1.5); for (let c = 0; c < nc; c++) column(x + (c - (nc - 1) / 2) * gap, between(.5, HOP), from);
        // a fallen drum of a column, lying
        const fx = x + between(-1, 1) * gap * nc / 2, g = ground(fx, from); if (g !== null) { put(fx - .55, fx + .55, g - .1, g + .3); pieces.push({ kind: 'drum', x: fx, y: g }); } }
    }
    // Stone steps (or rails) down one flank: the same steps, made of masonry.
    if (!cave && chance(k * .7)) { const side = chance(.5) ? -1 : 1, x0 = m.cx + side * (m.tw - .5), x1 = m.cx + side * (m.tw + Math.min(5, m.flanks[side < 0 ? 0 : 1].room * .6));
      skin(Math.min(x0, x1), Math.max(x0, x1), style === 'mina' ? .22 : .4, m.T + 3); pieces.push({ kind: style === 'mina' ? 'rails' : 'stairs', x: (x0 + x1) / 2, y: m.T, w: Math.abs(x1 - x0) }); }
  }
  // Towers on the end shoulders (open maps): the outer wall whole, the door on the inland side.
  if (!cave && style !== 'mina' && (style === 'fortin' || style === 'colosal' || k >= 1)) for (const side of [-1, 1]) {
    const m = side < 0 ? p.mesas[0] : p.mesas[p.mesas.length - 1], f = m.flanks[side < 0 ? 0 : 1];
    const x = m.cx + side * (m.tw + f.room + 1.6), g = ground(x, m.T); if (g === null) continue;
    const w = style === 'colosal' ? 3.8 : 3.2, h = style === 'colosal' ? between(6.8, 8.6) : between(4.6, 5.8), t = .55, outer = x + side * (w / 2 - t / 2), inner = x - side * (w / 2 - t / 2);
    put(x - w / 2, x + w / 2, g - 1.5, g + h);
    hole(x - w / 2 + t, x + w / 2 - t, g, g + h - .6, true);                       // the room (its back wall shows)
    hole(inner - t / 2 - .01, inner + t / 2 + .01, g, g + 1.75);    // the door, inland
    // (no window in the outer wall: in a side view a window across a wall's thickness cuts the wall in two)
    for (let x0 = x - w / 2; x0 < x + w / 2; x0 += .4) if (chance(.5)) hole(x0, x0 + .4, g + h - between(.15, .35), g + h);   // broken top (never through the lintel)
    pieces.push({ kind: 'tower', x, y: g, h, side });
  }
  // Nothing is left hanging: a piece the build cut loose is not built at all.
  for (const i of collapse(mask)) ruin[i] = 0;
  return { cells: ruin, pieces, style, amount };
}

// A blast through masonry: the whole crater out of earth and rock, only the
// inner `hard` of it out of masonry. Returns the cells removed.
export function carveMasonry(mask, ruin, cx, cy, radius, hard = .55) {
  const { cols, rows, cell } = mask, keep = [];
  for (let rr = Math.max(0, Math.floor((cy - radius) / cell)); rr <= Math.min(rows - 1, Math.floor((cy + radius) / cell)); rr++)
    for (let c = Math.max(0, Math.floor((cx - radius) / cell)); c <= Math.min(cols - 1, Math.floor((cx + radius) / cell)); c++) {
      const i = rr * cols + c; if (!ruin[i] || !mask.solid[i]) continue;
      if (((c + .5) * cell - cx) ** 2 + ((rr + .5) * cell - cy) ** 2 > (radius * hard) ** 2) keep.push(i);
    }
  const removed = carve(mask, cx, cy, radius);
  for (const i of keep) mask.solid[i] = 1;
  return removed;
}

// Whatever no longer touches the bottom of the map comes down: the cells of
// every such piece (up to `max` cells a piece), removed from the mask and
// returned so a client can show them falling.
export function collapse(mask, max = 4000) {
  const { cols, rows, solid } = mask, n = cols * rows, seen = new Uint8Array(n), queue = new Int32Array(n);
  let head = 0, tail = 0;
  for (let c = 0; c < cols; c++) if (solid[c]) { seen[c] = 1; queue[tail++] = c; }
  const spread = () => { while (head < tail) { const i = queue[head++], c = i % cols;
    for (const j of [c > 0 ? i - 1 : -1, c < cols - 1 ? i + 1 : -1, i >= cols ? i - cols : -1, i + cols < n ? i + cols : -1]) if (j >= 0 && solid[j] && !seen[j]) { seen[j] = 1; queue[tail++] = j; } } };
  spread();
  const fallen = [];
  for (let i = 0; i < n; i++) {
    if (!solid[i] || seen[i]) continue;
    const start = tail; seen[i] = 1; queue[tail++] = i; spread();
    if (tail - start <= max) for (let q = start; q < tail; q++) { solid[queue[q]] = 0; fallen.push(queue[q]); }
  }
  if (fallen.length) { let c0 = cols, r0 = rows, c1 = 0, r1 = 0; for (const i of fallen) { const c = i % cols, rr = (i - c) / cols; c0 = Math.min(c0, c); c1 = Math.max(c1, c); r0 = Math.min(r0, rr); r1 = Math.max(r1, rr); } markDirty(mask, c0, r0, c1, r1); }
  return fallen;
}
