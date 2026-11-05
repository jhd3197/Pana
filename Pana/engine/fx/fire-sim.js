// A fire's numbers, renderer-free so they can be tested: how its flames are laid
// out, how it flickers, how long a flare-up lasts, its pool of embers and when it
// crackles. engine/fx/fire.js draws them. Retune a fire here: everything that sets
// its look and feel is in FIRE_TUNING.
import { rng } from '../random.js';

export const FIRE_TUNING = {
  // [frequency in Hz, weight]: slow breathing to quick gutter, added up per fire.
  flicker: [[1.7, .3], [4.3, .3], [9.1, .24], [17.3, .16]],
  light: {
    depth: .32,       // how far the intensity swings around 1
    jitter: .16,      // metres the light wanders sideways, so the shadows dance
    lift: .09,        // metres it wanders up and down
    flare: 1.1,       // extra intensity at a full feed
    calm: .3,         // what the wandering shrinks to for reduced motion
  },
  feed: {
    decay: 1.6,       // how fast a flare-up dies (per second)
    cap: 1.5,         // feeds add up to this
    embers: 14,       // embers thrown by a feed of strength 1
  },
  embers: {
    cap: { alta: 26, media: 14, baja: 5 },
    span: [.7, 1.7],  // seconds an ember lives
    rise: [.9, 1.9],  // metres per second at birth
    drift: .32,       // sideways speed at birth
    turbulence: 2.6,  // sideways push of the rising air
    drag: .55,        // how fast it loses its rise
  },
  crackle: {
    every: [.3, 1.8], // seconds between crackles
    pops: [1, 3],     // embers each one spits out
    flare: .35,       // how much a flare-up shortens the wait
  },
  // How many flame cards per layer; each quad costs its pixels, not its triangles.
  layers: {
    alta: { halo: 1, outer: 4, mid: 3, core: 2 },
    media: { halo: 1, outer: 3, mid: 2, core: 1 },
    baja: { halo: 0, outer: 1, mid: 1, core: 1 },
  },
  // Share of the fire's height and radius per layer.
  shape: {
    outer: { height: 1, width: 1.05, spread: .62 },
    mid: { height: .8, width: .85, spread: .36 },
    core: { height: .6, width: .72, spread: .1 },
    halo: { height: 2.2, width: 5 },
  },
};
export const FIRE_QUALITIES = Object.keys(FIRE_TUNING.layers);
export const LAYER = { outer: 0, mid: 1, core: 2, halo: 3 };
export const fireQuality = level => FIRE_QUALITIES.includes(level) ? level : 'media';

// A fire's flame cards for a quality: flat data, one per instance. Tongues stand in a
// ring around the middle, each with its own phase so no two lick together.
export function flameLayout({ quality = 'media', height = 1, radius = .25, seed = 1 } = {}) {
  const counts = FIRE_TUNING.layers[fireQuality(quality)], { shape } = FIRE_TUNING, R = rng(seed * 7919 + 13), cards = [];
  for (const name of ['halo', 'outer', 'mid', 'core']) for (let i = 0; i < counts[name]; i++) {
    const s = shape[name], a = (i + R()) / Math.max(1, counts[name]) * Math.PI * 2, d = name === 'halo' ? 0 : radius * s.spread * (.55 + R() * .45);
    cards.push({
      layer: LAYER[name], x: Math.cos(a) * d, z: Math.sin(a) * d,
      width: name === 'halo' ? height * s.width * .6 : radius * 2 * s.width * (.85 + R() * .3),
      height: height * s.height * (name === 'halo' ? 1 : .86 + R() * .28),
      phase: R() * Math.PI * 2,
    });
  }
  return cards;
}

// The fire's breathing, 0..1 and the same for the same time and phase on every client.
export function flicker(t, phase = 0) {
  let sum = 0;
  for (let i = 0; i < FIRE_TUNING.flicker.length; i++) { const [f, w] = FIRE_TUNING.flicker[i]; sum += w * Math.sin(t * f * 6.2831 + phase * (1 + i * .73)); }
  return Math.min(1, Math.max(0, .5 + sum * .9));
}

// What a fire does to its light: an intensity multiplier, an offset from where the
// light hangs and how warm it runs (0 deep orange, 1 yellower). `out` is reused.
export function lightState(t, phase, flare = 0, calm = false, out = { intensity: 1, x: 0, y: 0, z: 0, warmth: .5 }) {
  const { depth, jitter, lift, flare: spike, calm: quiet } = FIRE_TUNING.light, k = flicker(t, phase), move = calm ? quiet : 1;
  out.intensity = 1 - depth + k * depth * 2 + Math.min(FIRE_TUNING.feed.cap, flare) * spike;
  out.x = (Math.sin(t * 7.3 + phase) * .6 + Math.sin(t * 13.1 + phase * 2.1) * .4) * jitter * move;
  out.z = (Math.sin(t * 8.9 + phase * 1.4) * .6 + Math.sin(t * 15.7 + phase * .6) * .4) * jitter * move;
  out.y = Math.sin(t * 6.1 + phase * .8) * lift * move;
  out.warmth = Math.min(1, k * .75 + flare * .4);
  return out;
}

// A feed adds to the flare-up, which then dies away.
export const addFeed = (flare, strength = 1) => Math.min(FIRE_TUNING.feed.cap, flare + Math.max(0, strength));
export const stepFeed = (flare, dt) => flare < .002 ? 0 : flare * Math.exp(-FIRE_TUNING.feed.decay * dt);

// Sparks that rise, drift on the turbulence and fade. A fixed pool: spawning when
// it is full does nothing, so a burst can never grow it. `positions` and `lives`
// (1 at birth, 0 dead) are what a Points object reads, no copying.
export function createEmberPool({ cap = 14, seed = 1, radius = .25, height = 1 } = {}) {
  const { span, rise, drift, turbulence, drag } = FIRE_TUNING.embers, R = rng(seed * 104729 + 7), max = Math.max(1, cap);
  const positions = new Float32Array(max * 3), lives = new Float32Array(max), velocity = new Float32Array(max * 3), spans = new Float32Array(max), phases = new Float32Array(max);
  for (let i = 0; i < max; i++) { phases[i] = R() * 6.2831; positions[i * 3 + 1] = -1e4; }
  let limit = max, alive = 0, next = 0, due = 0;
  function spawn(n = 1) {
    let made = 0;
    for (let i = 0; i < limit && made < n; i++) {
      if (lives[i] > 0) continue;
      const a = R() * 6.2831, d = Math.sqrt(R()) * radius * .7, up = rise[0] + R() * (rise[1] - rise[0]), s = i * 3;
      positions[s] = Math.cos(a) * d; positions[s + 1] = height * (.12 + R() * .3); positions[s + 2] = Math.sin(a) * d;
      velocity[s] = (R() - .5) * drift * 2; velocity[s + 1] = up; velocity[s + 2] = (R() - .5) * drift * 2;
      spans[i] = span[0] + R() * (span[1] - span[0]); lives[i] = 1; alive++; made++;
    }
    return made;
  }
  return {
    positions, lives, phases,
    get cap() { return limit; }, get alive() { return alive; },
    // Fewer at a lower quality; what is already flying past the new limit goes out.
    setCap(n) { limit = Math.max(0, Math.min(max, Math.round(n))); for (let i = limit; i < max; i++) if (lives[i] > 0) { lives[i] = 0; positions[i * 3 + 1] = -1e4; alive--; } },
    spawn,
    // `flow`: the steady emission, in embers per second.
    step(dt, t, flow = 0) {
      due += flow * dt; const birth = Math.floor(due); if (birth > 0) { due -= birth; spawn(birth); }
      for (let i = 0; i < limit; i++) {
        if (lives[i] <= 0) continue;
        lives[i] -= dt / spans[i];
        if (lives[i] <= 0) { lives[i] = 0; positions[i * 3 + 1] = -1e4; alive--; continue; }
        const s = i * 3, p = phases[i];
        velocity[s] += Math.sin(t * 3.7 + p + positions[s + 1] * 2.3) * turbulence * dt;
        velocity[s + 2] += Math.cos(t * 3.1 + p * 1.6 + positions[s + 1] * 1.9) * turbulence * dt;
        velocity[s + 1] *= Math.exp(-drag * dt);
        positions[s] += velocity[s] * dt; positions[s + 1] += velocity[s + 1] * dt; positions[s + 2] += velocity[s + 2] * dt;
      }
      next = alive; return next;
    },
  };
}

// When a fire pops: a seeded clock, sooner while it is flaring. step() returns how many
// embers this crackle spits, or 0 when it is quiet.
export function createCrackle({ seed = 1 } = {}) {
  const { every, pops, flare: quicker } = FIRE_TUNING.crackle, R = rng(seed * 31337 + 3);
  const wait = () => every[0] + R() * (every[1] - every[0]);
  let left = wait();
  return {
    step(dt, flare = 0) {
      left -= dt * (1 + flare / Math.max(.05, quicker));
      if (left > 0) return 0;
      left = wait();
      return pops[0] + Math.floor(R() * (pops[1] - pops[0] + 1));
    },
  };
}
