// Parallax occlusion mapping in plain numbers, so it can be tested without a GPU:
// who gets it, how many layers a view angle pays for, and the seeded height fields
// and the normals derived from them. engine/fx/pom.js puts them in a shader.
// Same seed, same bytes: nothing here reads the clock or Math.random.

// The surfaces. `tile` is what one repeat of the map covers, in metres; `depth` is how
// far the deepest groove goes behind the real surface. Retune everything here.
export const POM_SURFACES = {
  // One map per ruin block (BoxGeometry 1.12 x .52, UV 0..1 on each face).
  brick: { seed: 11, generate: 'brick', tile: [1.12, .522], projection: 'uv', depth: .05, steps: [6, 18], refine: 3, fade: [5, 12], cavity: .75, normalScale: 1 },
  // Baked low-poly rock has no UVs: heights are projected from the world, per facet.
  rock: { seed: 23, generate: 'rock', tile: [2.6, 2.6], projection: 'world', depth: .15, steps: [6, 22], refine: 3, fade: [6, 15], cavity: .7, normalScale: .7 },
};
export const POM_MAP_SIZE = 256;
// Below this the view is so grazing that a layer's stride would skip whole grooves.
export const POM_MIN_COS = .14;
// The steepest slope a normal may show: a chip's sheer edge would glint as a white scratch.
const MAX_SLOPE = 1.3;

// `?pom=0` and `?pom=1` beat everything; otherwise the top detail, on a desktop.
export const pomFlag = (search = '') => { const v = new URLSearchParams(search).get('pom'); return v === '0' || v === '1' ? v : null; };
export function pomGate({ detail, touch = false, flag = null } = {}) {
  if (flag === '0') return false;
  if (flag === '1') return true;
  return detail === 'alta' && !touch;
}

const clamp01 = v => Math.min(1, Math.max(0, v));
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

// Layers for a view angle: the most at a grazing look, the fewest head-on. The shader
// runs this same line.
export const pomSteps = (cosView, [min, max]) => Math.floor(mix(max, min, clamp01(cosView)) + .5);
// How much of the effect is left at a distance: 1 near, 0 from `fade[1]` on. Also the shader's.
export const pomFade = (distance, [near, far]) => 1 - smooth(near, far, distance);

// The march itself, on a height function: how deep (0..1) a ray entering at (u, v) meets
// the surface, going `du`, `dv` per unit of depth. The shader is this loop on a texture.
export function pomHit(height, u, v, du, dv, steps, refine = 0) {
  const layer = 1 / steps, at = d => 1 - height(u - du * d, v - dv * d);
  let a = 0, depth = 0, h = at(0), ha = h, taps = 1;
  for (let i = 0; i < steps && depth < h; i++) { a = depth; ha = h; depth += layer; h = at(depth); taps++; }
  let b = depth, fa = ha - a, fb = h - b;
  if (fa <= 0) return { depth: a, taps };
  for (let i = 0; i < refine; i++) {
    const c = mix(a, b, fa / (fa - fb)), fc = at(c) - c; taps++;
    if (fc > 0) { a = c; fa = fc; } else { b = c; fb = fc; }
  }
  return { depth: fa === fb ? a : mix(a, b, fa / (fa - fb)), taps };
}

// ---------- Tiling noise ----------
// Integer lattices that wrap at (fu, fv), so any sum of them tiles on the unit square.
const hash = (x, y, seed) => {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2246822519) | 0;
  h = Math.imul(h ^ h >>> 13, 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
const wrap = (i, n) => ((i % n) + n) % n;
const fade5 = t => t * t * t * (t * (t * 6 - 15) + 10);
function noise(u, v, fu, fv, seed) {
  const x = u * fu, y = v * fv, ix = Math.floor(x), iy = Math.floor(y), tx = fade5(x - ix), ty = fade5(y - iy);
  const x0 = wrap(ix, fu), x1 = wrap(ix + 1, fu), y0 = wrap(iy, fv), y1 = wrap(iy + 1, fv);
  return mix(mix(hash(x0, y0, seed), hash(x1, y0, seed), tx), mix(hash(x0, y1, seed), hash(x1, y1, seed), tx), ty);
}
function fbm(u, v, fu, fv, seed, octaves = 4) {
  let sum = 0, amp = .5, total = 0;
  for (let i = 0; i < octaves; i++) { sum += amp * noise(u, v, fu << i, fv << i, seed + i * 17); total += amp; amp *= .5; }
  return sum / total;
}

// ---------- Height fields: 1 is the real surface, 0 the deepest groove ----------
// Courses of bricks in running bond: irregular edges, chipped corners, each brick
// standing a little proud or sunk and a little tilted, gritty mortar in the grooves.
export function brickHeights(size = POM_MAP_SIZE, seed = POM_SURFACES.brick.seed) {
  const out = new Float32Array(size * size), [W, H] = POM_SURFACES.brick.tile, rows = 2, cols = 2;
  const cellW = W / cols, cellH = H / rows, round = .022, mortar = .007, bevel = .012;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const wu = u + (noise(u, v, 8, 4, seed + 1) - .5) * .022, wv = v + (noise(u, v, 8, 4, seed + 2) - .5) * .05;
    const fr = wv * rows, row = Math.floor(fr), r = wrap(row, rows);
    const fc = (wu + (r % 2 ? .5 / cols : 0) + (hash(r, 7, seed) - .5) * .05) * cols, col = wrap(Math.floor(fc), cols);
    const eu = fc - Math.floor(fc), ev = fr - row;
    const dx = Math.min(eu, 1 - eu) * cellW, dy = Math.min(ev, 1 - ev) * cellH;
    const qx = Math.max(round - dx, 0), qy = Math.max(round - dy, 0);
    let d = qx > 0 && qy > 0 ? round - Math.hypot(qx, qy) : Math.min(dx, dy);
    d -= fbm(u, v, 24, 12, seed + 3, 3) * .011;                      // ragged edges
    d -= smooth(.7, .84, noise(u, v, 22, 11, seed + 4)) * .02;       // chips out of them
    const t = smooth(mortar, mortar + bevel, d);
    const top = .64 + hash(r, col, seed + 5) * .3;
    const tilt = (hash(r, col, seed + 6) - .5) * .12 * (eu - .5) + (hash(r, col, seed + 7) - .5) * .12 * (ev - .5);
    const grain = (fbm(u, v, 24, 12, seed + 8, 4) - .5) * .22;
    const pits = smooth(.68, .8, noise(u, v, 48, 24, seed + 9)) * .12;
    const face = top + tilt + grain - pits;
    const grout = .08 + (noise(u, v, 64, 32, seed + 10) - .5) * .1;
    out[y * size + x] = clamp01(mix(grout, face, t));
  }
  return out;
}

// One layer of broken stone: each cell of a jittered grid is a flat, tilted chip, so the
// creases between chips are straight and sharp. Fractures read as rock; smooth noise
// reads as clay or wrinkles.
function chips(u, v, cells, seed) {
  const cx = u * cells, cy = v * cells, ix = Math.floor(cx), iy = Math.floor(cy);
  let near = 9, a = 0, b = 0, pick = 0, tx = 0, ty = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const p = wrap(ix + i, cells), q = wrap(iy + j, cells), dx = ix + i + hash(p, q, seed) - cx, dy = iy + j + hash(p, q, seed + 1) - cy, d = dx * dx + dy * dy;
    if (d < near) { near = d; a = dx; b = dy; pick = hash(p, q, seed + 2); tx = hash(p, q, seed + 3) - .5; ty = hash(p, q, seed + 4) - .5; }
  }
  return pick + (a * tx + b * ty) * 1.5;
}
// Broken rock: big slow forms, two sizes of flat chips over them, a few deep cracks that
// die out instead of closing into cells, and fine grit.
export function rockHeights(size = POM_MAP_SIZE, seed = POM_SURFACES.rock.seed) {
  const out = new Float32Array(size * size), cells = 3;
  let low = Infinity, high = -Infinity;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const wu = u + (fbm(u, v, 4, 4, seed + 1, 3) - .5) * .1, wv = v + (fbm(u, v, 4, 4, seed + 2, 3) - .5) * .1;
    const cx = wu * cells + (fbm(u, v, 16, 16, seed + 9, 2) - .5) * .16, cy = wv * cells + (fbm(u, v, 16, 16, seed + 10, 2) - .5) * .16, ix = Math.floor(cx), iy = Math.floor(cy);
    let f1 = 9, f2 = 9;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const a = wrap(ix + i, cells), b = wrap(iy + j, cells);
      const d = Math.hypot(ix + i + hash(a, b, seed + 3) - cx, iy + j + hash(a, b, seed + 4) - cy);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
    const open = smooth(.5, .64, noise(u, v, 4, 4, seed + 5));
    const crack = 1 - (1 - smooth(.0, .035, f2 - f1)) * open;
    const forms = fbm(wu, wv, 3, 3, seed + 6, 3);
    const h = (forms * .95 + chips(wu, wv, 8, seed + 20) * .36 + chips(wu, wv, 21, seed + 30) * .05 + (fbm(u, v, 48, 48, seed + 8, 2) - .5) * .05) * (.28 + .72 * crack);
    out[y * size + x] = h; if (h < low) low = h; if (h > high) high = h;
  }
  for (let i = 0; i < out.length; i++) out[i] = clamp01((out[i] - low) / (high - low));
  return out;
}

export const surfaceHeights = (kind, size = POM_MAP_SIZE) => (POM_SURFACES[kind].generate === 'brick' ? brickHeights : rockHeights)(size, POM_SURFACES[kind].seed);

// RGBA bytes: the normal of the carved surface in RGB (a normal map, OpenGL handed: +G
// is +v) and the height in A. One texture for both, so the march and the shading agree.
// Slopes are in real metres, then stretched by the tile's aspect: three's derivative
// tangent frame scales both axes by the longer one, and this undoes that.
export function reliefPixels(heights, size, { tile: [W, H], depth, strength = 1 }) {
  const out = new Uint8Array(size * size * 4), long = Math.max(W, H);
  const sx = depth * size / (2 * W) * long / W * strength, sy = depth * size / (2 * H) * long / H * strength;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const left = heights[y * size + wrap(x - 1, size)], right = heights[y * size + wrap(x + 1, size)];
    const down = heights[wrap(y - 1, size) * size + x], up = heights[wrap(y + 1, size) * size + x];
    const nx = Math.max(-MAX_SLOPE, Math.min(MAX_SLOPE, (left - right) * sx)), ny = Math.max(-MAX_SLOPE, Math.min(MAX_SLOPE, (down - up) * sy)), len = Math.hypot(nx, ny, 1), i = (y * size + x) * 4;
    out[i] = Math.round((nx / len * .5 + .5) * 255); out[i + 1] = Math.round((ny / len * .5 + .5) * 255); out[i + 2] = Math.round((1 / len * .5 + .5) * 255);
    out[i + 3] = Math.round(heights[y * size + x] * 255);
  }
  return out;
}
