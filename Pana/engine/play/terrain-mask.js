// Destructible side-view ground: a grid of solid/air cells with a paint layer,
// for games seen from the side (Capis a Pintazos). Pure (no DOM, no Three.js),
// so rules, bots and Node tests share the same ground.
//
//   const mask = createMask({ width: 80, height: 40, cell: .1 });   // world units
//   fillHeights(mask, x => 12 + Math.sin(x));                        // ground below a line
//   carve(mask, x, y, 3.5); splash(mask, x, y, 4.5, team);           // crater, then paint
//   groundBelow(mask, x, y, 2);                                      // floor height or null
//   paintRGBA(mask, pixels, palette, takeDirty(mask));               // texture bytes
//
// Row 0 is the bottom (y = 0), so the bytes upload as a texture without a flip.
// `stain` is 0..255 paint per cell and `tint` the palette index of that paint.

export function createMask({ width, height, cell = .1 }) {
  const cols = Math.round(width / cell), rows = Math.round(height / cell), n = cols * rows;
  return { cols, rows, cell, width: cols * cell, height: rows * cell,
    solid: new Uint8Array(n), stain: new Uint8Array(n), tint: new Uint8Array(n), dirty: null, revision: 0 };
}

const col = (m, x) => Math.floor(x / m.cell), row = (m, y) => Math.floor(y / m.cell);
const inside = (m, c, r) => c >= 0 && r >= 0 && c < m.cols && r < m.rows;

// Cells changed since the last takeDirty(), as an inclusive column/row box.
export function markDirty(m, c0, r0, c1, r1) {
  c0 = Math.max(0, c0); r0 = Math.max(0, r0); c1 = Math.min(m.cols - 1, c1); r1 = Math.min(m.rows - 1, r1);
  if (c0 > c1 || r0 > r1) return;
  const d = m.dirty;
  m.dirty = d ? { c0: Math.min(d.c0, c0), r0: Math.min(d.r0, r0), c1: Math.max(d.c1, c1), r1: Math.max(d.r1, r1) } : { c0, r0, c1, r1 };
  m.revision++;
}
export function takeDirty(m) { const d = m.dirty; m.dirty = null; return d; }

// Solid below heightAt(x) in every column (world units).
export function fillHeights(m, heightAt) {
  for (let c = 0; c < m.cols; c++) {
    const top = heightAt((c + .5) * m.cell);
    for (let r = 0; r < m.rows; r++) m.solid[r * m.cols + c] = (r + .5) * m.cell <= top ? 1 : 0;
  }
  markDirty(m, 0, 0, m.cols - 1, m.rows - 1);
}

// Sets every cell inside the disc to `value` (1 adds ground, 0 removes it).
function disc(m, cx, cy, radius, visit) {
  const r2 = (radius / m.cell) ** 2, c0 = col(m, cx - radius), c1 = col(m, cx + radius), r0 = row(m, cy - radius), r1 = row(m, cy + radius);
  const ccx = cx / m.cell - .5, ccy = cy / m.cell - .5;
  for (let r = Math.max(0, r0); r <= Math.min(m.rows - 1, r1); r++) for (let c = Math.max(0, c0); c <= Math.min(m.cols - 1, c1); c++) {
    const d2 = (c - ccx) ** 2 + (r - ccy) ** 2;
    if (d2 <= r2) visit(r * m.cols + c, Math.sqrt(d2 / r2));
  }
  markDirty(m, c0, r0, c1, r1);
}

export function solidAt(m, x, y) {
  const c = col(m, x), r = row(m, y);
  return inside(m, c, r) && m.solid[r * m.cols + c] === 1;
}

// A round crater: every cell within `radius` becomes air. Returns the cells removed.
export function carve(m, cx, cy, radius) {
  let removed = 0;
  disc(m, cx, cy, radius, i => { if (m.solid[i]) { removed++; m.solid[i] = 0; m.stain[i] = 0; } });
  return removed;
}

// Adds ground (a bridge, a mound). Returns the cells added.
export function fill(m, cx, cy, radius) {
  let added = 0;
  disc(m, cx, cy, radius, i => { if (!m.solid[i]) { added++; m.solid[i] = 1; } });
  return added;
}

// Paint on the ground within `radius`: full at the centre, fading to the rim.
// A stronger coat takes over the colour; a weaker one leaves it.
export function splash(m, cx, cy, radius, tint = 0, strength = 255) {
  let painted = 0;
  disc(m, cx, cy, radius, (i, k) => {
    if (!m.solid[i]) return;
    const amount = Math.round(strength * Math.min(1, 1.25 * (1 - k * k)));
    if (amount > m.stain[i]) { m.stain[i] = amount; m.tint[i] = tint; painted++; }
  });
  return painted;
}

// The most paint (0..1) on solid cells within `radius` of (x, y).
export function stainAt(m, x, y, radius = .3) {
  let most = 0;
  const c0 = col(m, x - radius), c1 = col(m, x + radius), r0 = row(m, y - radius), r1 = row(m, y + radius);
  for (let r = Math.max(0, r0); r <= Math.min(m.rows - 1, r1); r++) for (let c = Math.max(0, c0); c <= Math.min(m.cols - 1, c1); c++) {
    const i = r * m.cols + c; if (m.solid[i] && m.stain[i] > most) most = m.stain[i];
  }
  return most / 255;
}

// The top of the first ground at or below `fromY` in column x, searching at
// most `depth` down: where a foot would rest. null when there is none.
export function groundBelow(m, x, fromY, depth = m.height) {
  const c = col(m, x); if (c < 0 || c >= m.cols) return null;
  const top = Math.min(m.rows - 1, row(m, fromY)), bottom = Math.max(0, row(m, fromY - depth));
  if (top < 0) return null;
  for (let r = top; r >= bottom; r--) if (m.solid[r * m.cols + c]) return Math.min(fromY, (r + 1) * m.cell);
  return null;
}

// The highest ground in column x (the surface seen from the sky), or null.
export const surfaceY = (m, x) => groundBelow(m, x, m.height);

// Rise over run of the ground around x, read at the surfaces under `fromY`.
export function slopeAt(m, x, fromY, span = .4, depth = 2) {
  const a = groundBelow(m, x - span, fromY + span, depth + span), b = groundBelow(m, x + span, fromY + span, depth + span);
  if (a === null || b === null) return 0;
  return (b - a) / (2 * span);
}

// Does a disc touch any solid cell?
export function circleHits(m, x, y, radius) {
  let hit = false;
  const r2 = (radius / m.cell) ** 2, c0 = col(m, x - radius), c1 = col(m, x + radius), r0 = row(m, y - radius), r1 = row(m, y + radius);
  const cx = x / m.cell - .5, cy = y / m.cell - .5;
  for (let r = Math.max(0, r0); r <= Math.min(m.rows - 1, r1) && !hit; r++) for (let c = Math.max(0, c0); c <= Math.min(m.cols - 1, c1); c++) {
    if (m.solid[r * m.cols + c] && (c - cx) ** 2 + (r - cy) ** 2 <= r2) { hit = true; break; }
  }
  return hit;
}

// Which way is "out of the ground" at (x, y): the unit sum of the directions
// from solid cells in the disc towards its centre. Straight up when unsure.
export function surfaceNormal(m, x, y, radius = .6) {
  let nx = 0, ny = 0;
  const c0 = col(m, x - radius), c1 = col(m, x + radius), r0 = row(m, y - radius), r1 = row(m, y + radius), r2 = radius * radius;
  for (let r = Math.max(0, r0); r <= Math.min(m.rows - 1, r1); r++) for (let c = Math.max(0, c0); c <= Math.min(m.cols - 1, c1); c++) {
    if (!m.solid[r * m.cols + c]) continue;
    const dx = (c + .5) * m.cell - x, dy = (r + .5) * m.cell - y;
    if (dx * dx + dy * dy <= r2) { nx -= dx; ny -= dy; }
  }
  const l = Math.hypot(nx, ny);
  return l < 1e-6 ? { x: 0, y: 1 } : { x: nx / l, y: ny / l };
}

// Paint running down from a blast: below the stained band of `count` columns
// across the crater, a streak that soaks down through the earth `length`
// world units at most, tapering, with a drop at its end; and `spots` blobs
// thrown onto the ground just past `radius`. Seeded by `seed`, so the same
// blast drips the same way in a test, for the bot and on screen. Returns the
// cells painted.
export function drips(m, cx, cy, radius, tint = 0, { seed = 1, count = 9, length = 2.4, spots = 6, strength = 230 } = {}) {
  let s = (seed >>> 0) || 1, painted = 0;
  const rand = () => { s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909); s >>>= 0; return (s & 0xffffff) / 0x1000000; };
  const put = (c, r, amount) => {
    if (!inside(m, c, r)) return;
    const i = r * m.cols + c;
    if (m.solid[i] && amount > m.stain[i]) { m.stain[i] = amount; m.tint[i] = tint; painted++; }
  };
  const c0 = col(m, cx - radius), c1 = col(m, cx + radius), top = row(m, cy + radius), bottom = row(m, cy - radius - length);
  for (let k = 0; k < count; k++) {
    const c = Math.round(c0 + (c1 - c0) * (k + .2 + rand() * .6) / count);
    // The lowest stained cell of this column under the blast: the streak starts there.
    let start = -1;
    for (let r = Math.min(m.rows - 1, top); r >= Math.max(0, row(m, cy - radius)); r--) { const i = r * m.cols + c; if (inside(m, c, r) && m.solid[i] && m.stain[i] > 60 && m.tint[i] === tint) start = r; }
    if (start < 0) continue;
    const cells = Math.round(length / m.cell * (.35 + rand() * .65)), wide = rand() < .4 ? 3 : 2;
    let r = start;
    for (let j = 0; j < cells && r > bottom; j++, r--) {
      const amount = Math.round(strength * (1 - .55 * j / cells));
      for (let w = 0; w < wide; w++) put(c + w, r, amount);
    }
    // The drop at the end of the run.
    for (let dr = -3; dr <= 1; dr++) for (let dc = -1; dc <= wide; dc++) if (dr * dr + (dc - (wide - 1) / 2) ** 2 <= 4.2) put(c + dc, r + dr, Math.round(strength * .6));
    markDirty(m, c - 2, r - 3, c + 3, start);
  }
  for (let k = 0; k < spots; k++) {
    const side = k % 2 ? 1 : -1, x = cx + side * (radius * (1 + rand() * .7)), y = groundBelow(m, x, cy + radius, radius * 2 + 2);
    if (y === null) continue;
    const blob = (.18 + rand() * .3) / m.cell, bc = col(m, x), br = row(m, y - .05);
    for (let dr = -Math.ceil(blob); dr <= Math.ceil(blob); dr++) for (let dc = -Math.ceil(blob * 1.6); dc <= Math.ceil(blob * 1.6); dc++) {
      if ((dc / 1.6) ** 2 + dr * dr <= blob * blob) put(bc + dc, br + dr, Math.round(strength * .8));
    }
    markDirty(m, bc - Math.ceil(blob * 2), br - Math.ceil(blob), bc + Math.ceil(blob * 2), br + Math.ceil(blob));
  }
  return painted;
}

const hash = (a, b) => ((Math.imul(a, 73856093) ^ Math.imul(b, 19349663)) >>> 0);

// Writes RGBA bytes for the columns in `rect` (all when null). Air is
// transparent; ground is `earth` darkening to `deep` with depth, a band of
// `grass` on every top surface, speckle, and paint blended over it from
// `tints` (the index in mask.tint). Optional, all in world units:
//   grassAt(x, y)  false where a top surface is bare (a fresh crater floor): topsoil instead of grass
//   sand, sandBelow  top surfaces under this height are sand (a beach), wet and darker by the water
//   rock, rockAt(x, y)  0..1 how much of the earth there is rock, drawn in strata
//   roots          thin dark roots hanging from the grass into the topsoil
//   fringe         grass blades up to this many cells tall drawn into the air above grass
//   shade          0..1 how much darker earth gets under an overhang and beside a wall
//   deepFrom       earth darkens with height below this y (over deepAt cells), not with depth
//                  under the local top, so the earth under a cave or a tower matches its neighbours
export function paintRGBA(m, rgba, { earth, deep, grass, topsoil = deep, tints = [], grassDepth = 5, deepAt = 140,
  grassAt = null, sand = null, sandBelow = -Infinity, wet = null, rock = null, rockAt = null, roots = null, fringe = 0, shade = 0, deepFrom = null } = {}, rect = null) {
  const c0 = rect ? rect.c0 : 0, c1 = rect ? rect.c1 : m.cols - 1, cell = m.cell, wetBelow = sandBelow - 1.6;
  for (let c = c0; c <= c1; c++) {
    const band = grassDepth - 1 + ((c * 2654435761) >>> 29) % 3, x = (c + .5) * cell;
    const rootLength = roots && hash(c, 7) % 23 === 0 ? 4 + hash(c, 11) % 9 : 0;
    let depth = 0, cover = null, exposed = true;
    for (let r = m.rows - 1; r >= 0; r--) {
      const i = r * m.cols + c, o = i * 4;
      if (!m.solid[i]) {
        depth = 0; rgba[o + 3] = 0;
        continue;
      }
      if (depth === 0) {
        const y = (r + 1) * cell;
        cover = y < sandBelow && sand ? (y < wetBelow && wet ? wet : sand) : grassAt && !grassAt(x, y) ? topsoil : grass;
        exposed = cover === grass;
        // Grass blades poking up into the air above a grassy top (drawn only: the cells stay air).
        if (fringe && exposed) {
          const tall = hash(c, r) % (fringe + 2);
          for (let k = 1; k <= tall && r + k < m.rows && !m.solid[(r + k) * m.cols + c]; k++) {
            const a = ((r + k) * m.cols + c) * 4, tip = .92 - k * .08;
            rgba[a] = grass[0] * tip; rgba[a + 1] = grass[1] * tip; rgba[a + 2] = grass[2] * tip; rgba[a + 3] = 255;
          }
        }
      }
      const k = deepFrom === null ? Math.min(1, depth / deepAt) : Math.min(1, Math.max(0, deepFrom / cell - r) / deepAt), grain = 1 + (hash(c, r) >>> 24 & 31) / 255 - .06;
      const sandy = cover === sand || cover === wet;
      let red, green, blue;
      if (depth < band) { [red, green, blue] = cover; if (cover === grass) { const tip = 1.12 - depth * .05; red *= tip; green *= tip; blue *= tip; } }
      else if (depth < band + 3) { [red, green, blue] = sandy ? sand : topsoil; }
      else {
        red = earth[0] + (deep[0] - earth[0]) * k; green = earth[1] + (deep[1] - earth[1]) * k; blue = earth[2] + (deep[2] - earth[2]) * k;
        if (sandy) { const s = Math.max(0, 1 - (depth - band) / 14) * .8; red += (sand[0] - red) * s; green += (sand[1] - green) * s; blue += (sand[2] - blue) * s; }
        if (rock && rockAt) {
          const amount = rockAt(x, (r + .5) * cell);
          if (amount > 0) {
            // Strata: lighter and darker bands that wander a little along x.
            const stripe = .84 + .14 * (((r + (hash(c >> 3, 5) & 3)) >> 2) % 3), a = Math.min(1, amount);
            red += (rock[0] * stripe - red) * a; green += (rock[1] * stripe - green) * a; blue += (rock[2] * stripe - blue) * a;
          }
        }
      }
      // A root hanging from the grass into the topsoil.
      if (rootLength && exposed && depth >= band && depth < band + rootLength && (hash(c, depth >> 2) & 3)) { red = roots[0]; green = roots[1]; blue = roots[2]; }
      if (shade && depth >= band) {
        // Darker under an overhang (air a little below) and beside a wall (air to a side).
        let dark = 0;
        for (let d = 1; d <= 4 && !dark; d++) {
          if (r - d >= 0 && !m.solid[i - d * m.cols]) dark = 1.1 - d * .22;
          else if ((c - d >= 0 && !m.solid[i - d]) || (c + d < m.cols && !m.solid[i + d])) dark = .7 - d * .15;
        }
        if (dark > 0) { const d = 1 - shade * Math.min(1, dark); red *= d; green *= d; blue *= d; }
      }
      red *= grain; green *= grain; blue *= grain;
      const s = m.stain[i] / 255 * .9, tint = tints[m.tint[i]];
      if (s > 0 && tint) { red += (tint[0] - red) * s; green += (tint[1] - green) * s; blue += (tint[2] - blue) * s; }
      rgba[o] = Math.min(255, red); rgba[o + 1] = Math.min(255, green); rgba[o + 2] = Math.min(255, blue); rgba[o + 3] = 255;
      depth++;
    }
  }
}

// The ground as fields for a shader (engine/play/terrain-material.js), written
// into two RGBA byte arrays the size of the mask for the columns in `rect`
// (all when null), padded by the blur reach. Bilinear sampling then gives a
// smooth silhouette and smooth bands instead of per-cell blocks:
//   field  R  vertical signed distance to the surface in quarter cells: 128 + 4 × (depth
//             below the top of the ground; negative in the air, height over the ground
//             below), smoothed along x over neighbours within `smooth` columns whose
//             distance is close (no stair steps on gentle slopes, cliffs stay sharp)
//          G  coverage: the solid cells blurred [1 6 15 20 15 6 1] (the edge sits at 0.5)
//          B  rockAt(x, y) 0..1 (every cell, so rock fades smoothly at the edge)
//          A  bare: 255 when grassAt says the top surface over (or under) the cell has no grass
//   paint  R  stain, blurred [1 2 1] so drops and streaks have round ends   G  tint / (tints − 1)
//          B  wide coverage (a box blur of `wide` cells): soft occlusion near air
//          A  cells of solid ground down to the first air below (an overhang's underside)
// `extra` (a Uint8Array like solid) counts as ground too: a back wall's hollows.
export function fieldRGBA(m, field, paint, { rockAt = null, grassAt = null, tints = 2, wide = 5, smooth = 5, extra = null } = {}, rect = null) {
  const { cols, rows, cell } = m, pad = Math.max(wide, smooth) + 4;
  const c0 = rect ? Math.max(0, rect.c0 - pad) : 0, c1 = rect ? Math.min(cols - 1, rect.c1 + pad) : cols - 1;
  const at = (c, r) => { c = c < 0 ? 0 : c >= cols ? cols - 1 : c; r = r < 0 ? 0 : r >= rows ? rows - 1 : r; const i = r * cols + c; return m.solid[i] || (extra && extra[i]) ? 1 : 0; };
  const tintScale = 255 / Math.max(1, tints - 1);
  // Raw signed distances (cells) for the columns plus the smoothing reach on both sides.
  const s0 = Math.max(0, c0 - smooth), s1 = Math.min(cols - 1, c1 + smooth), sw = s1 - s0 + 1, sd = new Float32Array(sw * rows);
  for (let c = s0; c <= s1; c++) {
    let depth = 0, ground = -1;
    for (let r = rows - 1; r >= 0; r--) { if (!at(c, r)) { depth = 0; continue; } sd[r * sw + c - s0] = Math.min(31.5, depth + .5); depth++; }
    for (let r = 0; r < rows; r++) { if (at(c, r)) ground = r; else sd[r * sw + c - s0] = ground < 0 ? -32 : -Math.min(32, r - ground - .5); }
  }
  for (let c = c0; c <= c1; c++) {
    const x = (c + .5) * cell;
    // Down from the sky: depth under the top of each run of ground, and whether that top is bare.
    let depth = 0, bare = 0;
    for (let r = rows - 1; r >= 0; r--) {
      const i = r * cols + c, o = i * 4;
      if (!at(c, r)) { depth = 0; continue; }
      if (depth === 0) bare = grassAt && !grassAt(x, (r + 1) * cell) ? 255 : 0;
      field[o + 3] = bare;
      depth++;
    }
    // Up from the bottom: height over the ground below (air) and ground left down to air (solid).
    let ground = -1, air = -1, under = 0;
    for (let r = 0; r < rows; r++) {
      const i = r * cols + c, o = i * 4;
      if (at(c, r)) {
        ground = r; under = field[o + 3];
        paint[o + 3] = air < 0 ? 255 : Math.min(255, r - air - 1);
      } else {
        air = r;
        field[o + 3] = ground < 0 ? 0 : under;
        paint[o + 3] = 0;
      }
      field[o + 2] = rockAt ? Math.round(255 * Math.min(1, Math.max(0, rockAt(x, (r + .5) * cell)))) : 0;
      paint[o] = m.stain[i]; paint[o + 1] = Math.round(m.tint[i] * tintScale);
      // The distance, averaged along x with the neighbours on the same surface.
      const here = sd[r * sw + c - s0];
      let sum = 0, weight = 0;
      for (let d = -smooth; d <= smooth; d++) {
        const cc = c + d; if (cc < s0 || cc > s1) continue;
        const v = sd[r * sw + cc - s0]; if (Math.abs(v - here) > 6 || (v > 0) !== (here > 0) && Math.abs(v - here) > 2) continue;
        const w = smooth + 1 - Math.abs(d); sum += v * w; weight += w;
      }
      field[o] = Math.round(Math.max(0, Math.min(255, 128 + 4 * sum / weight)));
    }
  }
  // Coverage: a small separable blur (the silhouette) and a wide box blur (occlusion).
  const span = c1 - c0 + 1, k5 = [1, 6, 15, 20, 15, 6, 1], h5 = new Float32Array(span * rows), hw = new Float32Array(span * rows), hs = new Float32Array(span * rows);
  const stainAt = (c, r) => (c < 0 || c >= cols ? 0 : m.stain[(r < 0 ? 0 : r >= rows ? rows - 1 : r) * cols + c]);
  for (let r = 0; r < rows; r++) for (let j = 0; j < span; j++) {
    const c = c0 + j;
    let s = 0; for (let d = -3; d <= 3; d++) s += k5[d + 3] * at(c + d, r);
    let w = 0; for (let d = -wide; d <= wide; d++) w += at(c + d, r);
    h5[r * span + j] = s / 64; hw[r * span + j] = w / (2 * wide + 1);
    hs[r * span + j] = (stainAt(c - 1, r) + 2 * stainAt(c, r) + stainAt(c + 1, r)) / 4;
  }
  const rowOf = r => (r < 0 ? 0 : r >= rows ? rows - 1 : r) * span;
  for (let j = 0; j < span; j++) {
    for (let r = 0; r < rows; r++) {
      let s = 0; for (let d = -3; d <= 3; d++) s += k5[d + 3] * h5[rowOf(r + d) + j];
      let w = 0; for (let d = -wide; d <= wide; d++) w += hw[rowOf(r + d) + j];
      const o = (r * cols + c0 + j) * 4;
      field[o + 1] = Math.round(s / 64 * 255); paint[o + 2] = Math.round(w / (2 * wide + 1) * 255);
      paint[o] = Math.round((hs[rowOf(r - 1) + j] + 2 * hs[rowOf(r) + j] + hs[rowOf(r + 1) + j]) / 4);
    }
  }
}

// The outline of the ground: marching squares over the coverage in `field`
// (G, from fieldRGBA) at 0.5, between cell centres, in world units. Each
// segment comes with the outward normal at both ends (down the coverage's
// gradient), so an extruded wall shades smoothly. Returns
// { segments: Float32Array [x0, y0, x1, y1, ...], normals: Float32Array [nx0, ny0, nx1, ny1, ...], count }.
export function coverageContour(m, field, level = 127.5) {
  const { cols, rows, cell } = m, g = (c, r) => field[(r * cols + c) * 4 + 1];
  const seg = [], nor = [];
  const grad = (c, r) => {
    const cl = Math.max(0, c - 1), cr = Math.min(cols - 1, c + 1), rd = Math.max(0, r - 1), ru = Math.min(rows - 1, r + 1);
    return [(g(cr, r) - g(cl, r)) / (cr - cl), (g(c, ru) - g(c, rd)) / (ru - rd)];
  };
  // The crossing on the edge between two grid points, and its normal.
  const cross = (ca, ra, cb, rb) => {
    const a = g(ca, ra), b = g(cb, rb), t = (level - a) / (b - a);
    const ga = grad(ca, ra), gb = grad(cb, rb);
    let nx = -(ga[0] + (gb[0] - ga[0]) * t), ny = -(ga[1] + (gb[1] - ga[1]) * t);
    const l = Math.hypot(nx, ny) || 1;
    return [(ca + (cb - ca) * t + .5) * cell, (ra + (rb - ra) * t + .5) * cell, nx / l, ny / l];
  };
  const push = (p, q) => { seg.push(p[0], p[1], q[0], q[1]); nor.push(p[2], p[3], q[2], q[3]); };
  for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) {
    const a = g(c, r) > level, b = g(c + 1, r) > level, d = g(c + 1, r + 1) > level, e = g(c, r + 1) > level;
    const code = (a ? 1 : 0) | (b ? 2 : 0) | (d ? 4 : 0) | (e ? 8 : 0);
    if (code === 0 || code === 15) continue;
    // Edges: bottom (a-b), right (b-d), top (e-d), left (a-e).
    const bottom = () => cross(c, r, c + 1, r), right = () => cross(c + 1, r, c + 1, r + 1);
    const top = () => cross(c, r + 1, c + 1, r + 1), left = () => cross(c, r, c, r + 1);
    switch (code) {
      case 1: case 14: push(left(), bottom()); break;
      case 2: case 13: push(bottom(), right()); break;
      case 3: case 12: push(left(), right()); break;
      case 4: case 11: push(right(), top()); break;
      case 6: case 9: push(bottom(), top()); break;
      case 7: case 8: push(left(), top()); break;
      case 5: case 10: {
        // A saddle: the centre's average decides which corners connect.
        const centre = (g(c, r) + g(c + 1, r) + g(c + 1, r + 1) + g(c, r + 1)) / 4 > level;
        if ((code === 5) === centre) { push(left(), top()); push(bottom(), right()); } else { push(left(), bottom()); push(right(), top()); }
        break;
      }
    }
  }
  return { segments: new Float32Array(seg), normals: new Float32Array(nor), count: seg.length / 4 };
}
