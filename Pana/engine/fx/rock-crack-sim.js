// A rock being broken, in plain numbers so it can be tested: how a hold's progress
// maps to cracks and hits, where the cracks run, the pooled debris and the shake.
// engine/fx/rock-crack.js draws them. Presentation only: nothing here touches a game's
// state, and all of it follows a progress the game already shares. Tune in CRACK_TUNING.
import { rng } from '../random.js';

export const CRACK_TUNING = {
  hits: 9,               // pulses over a whole clearing: a chip, a tok, a jolt
  stages: [.36, .72],    // where it gives way a little more: a crunch and a harder jolt
  cracks: { count: 14, segments: 13, branches: 6, width: .036, stagger: .42 },
  reveal: { power: .78 },   // how fast the cracks run: early hits show the most
  glow: { low: .22, high: 1, pulse: .9, pulseDecay: 7 },
  shake: { offset: .035, turn: .016, decay: 9, hit: .55, stage: 1, speed: 47 },
  chips: { cap: { alta: 40, media: 26, baja: 12 }, perHit: { alta: 6, media: 5, baja: 3 }, speed: [1.2, 3.4], size: [.05, .12], life: [.5, 1.1] },
  sparks: { cap: { alta: 24, media: 16, baja: 6 }, perHit: { alta: 6, media: 4, baja: 2 }, speed: [1.5, 4.5], size: [.03, .05], life: [.14, .36] },
  chunks: { count: { alta: 14, media: 10, baja: 6 }, speed: [2.6, 6], size: [.2, .46], life: [1, 1.6] },
  gravity: 9.8, bounce: .34, friction: .62, shrink: .3,
};
export const CRACK_QUALITIES = Object.keys(CRACK_TUNING.chips.cap);
export const crackQuality = level => CRACK_QUALITIES.includes(level) ? level : 'media';
const clamp01 = v => Math.min(1, Math.max(0, v));

// How far along their length the cracks have run, 0..1, for a hold's progress.
export const crackReveal = p => Math.pow(clamp01(p), CRACK_TUNING.reveal.power);
// How bright they burn: never quite dark once started, brighter as it goes, a kick per hit.
export const crackGlow = (p, pulse = 0) => {
  const { low, high, pulse: kick } = CRACK_TUNING.glow, q = clamp01(p);
  return q <= 0 && pulse <= 0 ? 0 : low + (high - low) * q + pulse * kick;
};
export const stepPulse = (pulse, dt) => pulse < .002 ? 0 : pulse * Math.exp(-CRACK_TUNING.glow.pulseDecay * dt);

// Hit thresholds a progress step went past: 1 hit at 1/hits, the last just before the end.
export function hitsCrossed(from, to, hits = CRACK_TUNING.hits) {
  if (!(to > from)) return 0;
  const count = q => Math.min(hits - 1, Math.floor(clamp01(q) * hits + 1e-9));
  return count(to) - count(from);
}
export const stagesCrossed = (from, to, stages = CRACK_TUNING.stages) => to > from ? stages.filter(s => from < s && to >= s).length : 0;

// Where the cracks run, as directions out of the rock's middle: walks around it, each
// with its own place in the reveal (`at`, 0..1 per point). Some fork off another.
// Directions are unit-ish and the same for the same seed on every client. `faces`:
// azimuths the rock is seen from (a heap in a tunnel only shows two ends); cracks gather
// there instead of all the way round.
export function crackPaths({ faces = null, seed = 1, count = CRACK_TUNING.cracks.count, segments = CRACK_TUNING.cracks.segments, branches = CRACK_TUNING.cracks.branches, stagger = CRACK_TUNING.cracks.stagger } = {}) {
  const R = rng(seed * 6151 + 11), paths = [];
  const walk = (azimuth, rise, from, to, steps, wander = .17) => {
    const points = [];
    let a = azimuth, e = rise, drift = (R() < .5 ? -1 : 1) * (.05 + R() * .07), climb = (R() < .5 ? -1 : 1) * (.03 + R() * .08);
    for (let k = 0; k <= steps; k++) {
      points.push({ x: Math.cos(e) * Math.cos(a), y: Math.sin(e), z: Math.cos(e) * Math.sin(a), at: from + (to - from) * (k / steps) });
      a += drift + (R() - .5) * wander; e = Math.max(-.85, Math.min(1.25, e + climb + (R() - .5) * wander));
    }
    return { points, a, e };
  };
  for (let i = 0; i < count; i++) {
    const start = (i / count) * stagger, end = Math.min(1, start + 1 - stagger + R() * .15);
    const azimuth = faces?.length ? faces[i % faces.length] + (R() - .5) * 1.1 : i / count * Math.PI * 2 + R() * .5;
    paths.push({ ...walk(azimuth, -.55 + R() * 1.05, start, end, segments), start, end });
  }
  for (let i = 0; i < branches; i++) {
    const parent = paths[Math.floor(R() * count)], p = parent.points[2 + Math.floor(R() * (segments - 4))];
    const from = p.at, to = Math.min(1, from + .25 + R() * .2);
    paths.push({ ...walk(Math.atan2(p.z, p.x) + (R() - .5) * .6, Math.asin(Math.max(-1, Math.min(1, p.y))), from, to, Math.ceil(segments / 2), .2), start: from, end: to, branch: true });
  }
  return paths.map(({ points, start, end, branch }) => ({ points, start, end, branch: !!branch }));
}
// The share of the cracks' length showing at a reveal: 0 before they start, 1 when all have run.
export function revealedShare(paths, reveal) {
  let seen = 0, all = 0;
  for (const { points } of paths) for (let k = 1; k < points.length; k++) { all++; if (points[k].at <= reveal) seen++; }
  return all ? seen / all : 0;
}

// A fixed pool of flying bits: chips, sparks and chunks all use one. Spawning into a
// full pool drops what does not fit, so a burst can never grow it.
export function createDebris({ cap = 24, seed = 1, ground = 0, gravity = CRACK_TUNING.gravity, bounces = true } = {}) {
  const max = Math.max(1, cap), R = rng(seed * 2729 + 5);
  const x = new Float32Array(max), y = new Float32Array(max), z = new Float32Array(max), vx = new Float32Array(max), vy = new Float32Array(max), vz = new Float32Array(max);
  const life = new Float32Array(max), span = new Float32Array(max), size = new Float32Array(max), spin = new Float32Array(max);
  let limit = max, alive = 0;
  const range = ([a, b]) => a + R() * (b - a);
  return {
    x, y, z, life, span, size, spin, max,
    get alive() { return alive; }, get cap() { return limit; },
    setCap(n) { limit = Math.max(0, Math.min(max, Math.round(n))); for (let i = limit; i < max; i++) if (life[i] > 0) { life[i] = 0; alive--; } },
    // Thrown from a point, out along a normal with some spread.
    spawn(px, py, pz, nx, ny, nz, n, { speed, size: sizes, life: lives, spread = .75, up = .5 }) {
      let made = 0;
      for (let i = 0; i < limit && made < n; i++) {
        if (life[i] > 0) continue;
        const v = range(speed);
        x[i] = px; y[i] = py; z[i] = pz;
        vx[i] = (nx + (R() - .5) * spread * 2) * v; vy[i] = (ny + up + (R() - .25) * spread) * v; vz[i] = (nz + (R() - .5) * spread * 2) * v;
        span[i] = life[i] = range(lives); size[i] = range(sizes); spin[i] = R() * 6.2831;
        alive++; made++;
      }
      return made;
    },
    step(dt) {
      for (let i = 0; i < limit; i++) {
        if (life[i] <= 0) continue;
        life[i] -= dt;
        if (life[i] <= 0) { life[i] = 0; alive--; continue; }
        vy[i] -= gravity * dt;
        x[i] += vx[i] * dt; y[i] += vy[i] * dt; z[i] += vz[i] * dt; spin[i] += (Math.abs(vx[i]) + Math.abs(vz[i])) * dt * 2;
        if (bounces && y[i] < ground + size[i] * .5 && vy[i] < 0) { y[i] = ground + size[i] * .5; vy[i] *= -CRACK_TUNING.bounce; vx[i] *= CRACK_TUNING.friction; vz[i] *= CRACK_TUNING.friction; }
      }
      return alive;
    },
    // How big a piece is drawn: full size, then it shrinks away over the end of its life.
    drawnSize(i) { const k = life[i] / (span[i] || 1); return size[i] * Math.min(1, k / CRACK_TUNING.shrink); },
  };
}

// The rock's shake: a kick that decays. `motion` 0 keeps it still (reduced motion).
export function createShake({ motion = 1 } = {}) {
  const { offset, turn, decay, speed } = CRACK_TUNING.shake;
  let energy = 0, clock = 0, scale = motion;
  const out = { x: 0, y: 0, z: 0, rx: 0, rz: 0 };
  return {
    out,
    get energy() { return energy; },
    set motion(v) { scale = v; },
    kick(strength = 1) { energy = Math.min(1.2, energy + strength); },
    step(dt) {
      clock += dt; energy = energy < .002 ? 0 : energy * Math.exp(-decay * dt);
      const k = energy * scale;
      out.x = Math.sin(clock * speed) * offset * k; out.y = Math.abs(Math.sin(clock * speed * .7)) * offset * .4 * k; out.z = Math.cos(clock * speed * 1.3) * offset * k;
      out.rx = Math.sin(clock * speed * .9) * turn * k; out.rz = Math.cos(clock * speed * 1.1) * turn * k;
      return out;
    },
  };
}
