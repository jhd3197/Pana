// Short sampled sound effects (small MP3s a game ships in its public/audio/)
// on the shared audio graph of engine/fx.js, so the volume slider, mute and the
// voice budget apply to them like to every synthesised sound. Clips load on
// first use (or on preload), decode once and are cached; a clip that fails to
// load is silence, never an error. Sets of variants are picked at random
// without repeating the last one, each play slightly re-pitched.
//
//   import { sound } from '/engine/fx.js';
//   const bank = createSampleBank(sound, new URL('./audio/', import.meta.url), {
//     step: ['step_wood_1', 'step_wood_2', 'step_wood_3'], drip: ['drip_1', 'drip_2'], wind: ['wind_loop'] });
//   bank.preload('step', 'drip');                    // fetch now, play later
//   bank.play('step', { gain: .2, jitter: .06 });     // one take, re-pitched a little
//   bank.play('drip', { at: { x, z }, listener: { x, z, yaw }, range: 20 });  // placed in stereo
//   const wind = bank.bed('wind');                    // a looping bed
//   wind.set(.05, 2);                                 // fade to .05 over ~2 s (0 fades out and stops)
//
// `listener.yaw` is a heading that faces (sin yaw, cos yaw), as the
// first-person look uses. The pure helpers (pickVariant, distanceGain, panFor)
// carry no audio and are unit-tested.

// An index in [0, count) other than `last`, so a set never plays the same take twice running.
export function pickVariant(count, last = -1, random = Math.random) {
  if (!(count > 1)) return 0;
  if (!(last >= 0 && last < count)) return Math.min(count - 1, Math.floor(random() * count));
  const i = Math.min(count - 2, Math.floor(random() * (count - 1)));
  return i >= last ? i + 1 : i;
}

// Loudness by distance: full within `near`, silent past `range`, curved between.
export function distanceGain(d, { near = 1, range = 20, curve = 1.4 } = {}) {
  if (!(d > near)) return 1;
  if (d >= range) return 0;
  return ((range - d) / (range - near)) ** curve;
}

// Stereo pan (-1 left … 1 right) of a point seen by a listener facing `yaw`.
export function panFor(listener, x, z, width = .85) {
  const dx = x - listener.x, dz = z - listener.z, d = Math.hypot(dx, dz);
  if (d < 1e-3) return 0;
  const yaw = listener.yaw || 0, right = (dx * -Math.cos(yaw) + dz * Math.sin(yaw)) / d;
  return Math.max(-1, Math.min(1, right * width));
}

export function createSampleBank(audio, base, sets = {}, { maxVoices = 6 } = {}) {
  const buffers = new Map(), loading = new Map(), last = new Map();
  let voices = 0;
  const urlOf = name => new URL(`${name}.mp3`, base);
  function fetchOne(name) {
    if (loading.has(name) || !audio.ctx) return;
    loading.set(name, (async () => {
      try {
        const response = await fetch(urlOf(name));
        if (!response.ok) return;
        buffers.set(name, await audio.ctx.decodeAudioData(await response.arrayBuffer()));
      } catch { /* silence: a missing clip never stops the game */ }
    })());
  }
  // Fetch every clip of these sets (all sets with none given). Needs an unlocked context.
  function preload(...names) {
    if (!audio.ctx) return false;
    for (const set of names.length ? names : Object.keys(sets)) for (const name of sets[set] || []) fetchOne(name);
    return true;
  }
  // The decoded takes of a set, without allocating: a count, then by index.
  function ready(set) { let n = 0; for (const name of sets[set] || []) if (buffers.has(name)) n++; return n; }
  function take(set, index) { for (const name of sets[set] || []) if (buffers.has(name) && index-- === 0) return buffers.get(name); return null; }

  // One take of `set`. gain 0…1; rate the playback rate (pitch and speed); jitter
  // the random spread around it; detune in cents; delay in seconds; at + listener
  // place it (quieter with distance, panned), or pan sets the side directly.
  // priority ranks it in the shared voice budget. Returns false if nothing played.
  function play(set, { gain = .5, rate = 1, jitter = .05, detune = 0, delay = 0, pan = null, at = null, listener = null, near = 1, range = 20, curve = 1.4, priority = 1 } = {}) {
    const ctx = audio.ctx;
    if (!ctx || audio.muted || !sets[set]) return false;
    const n = ready(set);
    if (n < sets[set].length) preload(set);
    if (!n || voices >= maxVoices) return false;
    let level = gain;
    if (at && listener) { level *= distanceGain(Math.hypot(at.x - listener.x, at.z - listener.z), { near, range, curve }); if (pan == null) pan = panFor(listener, at.x, at.z); }
    if (level < .003) return false;
    const i = pickVariant(n, last.get(set) ?? -1); last.set(set, i);
    const buffer = take(set, i), speed = Math.max(.25, rate * (1 + (Math.random() * 2 - 1) * jitter));
    const t = ctx.currentTime + delay, slot = audio.admit ? audio.admit(priority, t, t + buffer.duration / speed) : { gs: [] };
    if (!slot) return false;
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = buffer; src.playbackRate.value = speed; if (detune && src.detune) src.detune.value = detune;
    g.gain.value = Math.min(1, level); slot.gs.push(g);
    let tail = src.connect(g);
    if (pan) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); tail = tail.connect(p); }
    tail.connect(audio.out());
    voices++; src.onended = () => { voices--; g.disconnect(); };
    src.start(t);
    return true;
  }

  // A looping bed on the first take of `set`: set(level, seconds) glides to the
  // level; at 0 it fades out and the source stops. Silent while muted.
  function bed(set) {
    let src = null, g = null, level = 0;
    function stop(fade) {
      if (!src) return;
      const now = audio.ctx.currentTime;
      g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(g.gain.value, now); g.gain.linearRampToValueAtTime(0, now + fade);
      const old = src, oldGain = g; old.onended = () => oldGain.disconnect(); old.stop(now + fade + .05);
      src = g = null; level = 0;
    }
    return {
      set(target, fade = 1.5) {
        const ctx = audio.ctx;
        if (!ctx) return;
        if (audio.muted) target = 0;
        if (target <= 0) { stop(Math.min(fade, .6)); return; }
        if (!src) {
          if (!ready(set)) { preload(set); return; }
          src = ctx.createBufferSource(); g = ctx.createGain();
          src.buffer = take(set, 0); src.loop = true; g.gain.value = 0;
          src.connect(g).connect(audio.out()); src.start(); level = 0;
        }
        if (Math.abs(target - level) < .002) return;
        level = target; g.gain.setTargetAtTime(target, ctx.currentTime, Math.max(.05, fade / 3));
      },
      get playing() { return !!src; },
    };
  }
  return { play, bed, preload, ready, get voices() { return voices; } };
}
