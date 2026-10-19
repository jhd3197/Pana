// Deterministic randomness, noise and small math, with no Three.js import, so
// pure rules.js files, Node tests and models all share one copy. New code
// imports from here instead of writing its own rng, hash or clamp.
//
// The functions match what engine/models/core/primitives.js and
// engine/worlds/island-terrain.js already used, so moving to them changes nothing on
// screen. Some older rules.js files keep their own rng: their seeded tests and
// bot balance depend on its exact sequence.

// mulberry32: seed → () => [0, 1). Same seed, same scenery on every load.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The same stream for state that travels in snapshots: keep { seed } in the
// game state and call draw(state) → [0, 1); it advances state.seed, so a host
// that restores the snapshot continues the same sequence.
export function draw(state) {
  const value = rng(state.seed)();
  state.seed = (state.seed + 0x6d2b79f5) >>> 0;
  return value;
}

// A seed from a string (FNV-1a), e.g. rng(seedOf('plaza:benches')).
export function seedOf(text) {
  let h = 2166136261;
  for (const ch of String(text)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

export const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
// Any item of a list; pass a seeded rng() where the result must replay.
export const pick = (list, random = Math.random) => list[Math.floor(random() * list.length)];

// 2D value noise: a hash of the lattice point, smoothly blended. 0..1.
export function hash2(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
export function valueNoise2(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// Octaves of value noise, normalised to about 0..1.
export function fbm2(x, z, { octaves = 4, lacunarity = 2.03, gain = .5 } = {}) {
  let sum = 0, amp = .5, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise2(x * freq, z * freq); norm += amp;
    freq *= lacunarity; amp *= gain;
  }
  return sum / norm;
}
