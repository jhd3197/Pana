// Game music. Recorded songs (engine/music-tracks.js, made offline with
// scripts/music) stream as looping mp3s: the intro plays once, then the loop
// repeats seamlessly. Any name without a recording falls back to the live
// WebAudio synth below: Venezuelan-flavoured grooves (joropo on the plains,
// gaita in the plaza, calipso on the islands, tambor on the Amazonas) built
// from a bass line, a plucked cuatro/arpa arpeggio and maracas.
// setTempo() speeds it up for a final lap or a sprint; muffle() dulls it in a
// cave or a spin-out; sting() plays a one-shot jingle over a ducked loop.
// Everything goes through sound.musicOut(), so the music slider and mute apply.

import { SONGS } from './music-tracks.js';

// Semitones above the key for scale degrees 1..7 (major) — chords are degrees.
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];

export const STYLES = {
  joropo: { bpm: 168, beats: 3, key: 50, scale: MAJOR, chords: [1, 4, 5, 5], arp: [0, 2, 4, 2, 4, 7], lead: 'triangle', bass: [0, null, 4] },
  gaita: { bpm: 112, beats: 4, key: 52, scale: MINOR, chords: [1, 4, 7, 3], arp: [0, 4, 2, 4, 0, 4, 2, 7], lead: 'square', bass: [0, null, 4, 0] },
  calipso: { bpm: 124, beats: 4, key: 55, scale: MAJOR, chords: [1, 4, 5, 1], arp: [0, 2, 4, 7, 4, 2, 0, 4], lead: 'triangle', bass: [0, 4, null, 4] },
  tambor: { bpm: 132, beats: 4, key: 48, scale: MINOR, chords: [1, 6, 7, 1], arp: [0, 3, 4, 7, 4, 3, 0, 2], lead: 'sawtooth', bass: [0, 0, null, 4] },
  andina: { bpm: 104, beats: 3, key: 53, scale: MINOR, chords: [1, 3, 7, 1], arp: [0, 2, 4, 7, 4, 2], lead: 'sine', bass: [0, null, 4] },
  estadio: { bpm: 140, beats: 4, key: 53, scale: MAJOR, chords: [1, 6, 4, 5], arp: [0, 4, 7, 4, 0, 4, 7, 9], lead: 'square', bass: [0, null, 0, 4] },
  // Curiara: tambor drive with a gaita turn, paced for paddling.
  amazonas: { bpm: 126, beats: 4, key: 50, scale: MINOR, chords: [1, 4, 6, 5], arp: [0, 2, 4, 7, 4, 2, 0, 4], lead: 'triangle', bass: [0, 0, null, 4] },
};

export { SONGS };

const midi = (n) => 440 * 2 ** ((n - 69) / 12);

// Note number for scale degree `deg` (1-based chord root) plus `step` scale steps.
export function noteFor(style, deg, step) {
  const s = style.scale, i = deg - 1 + step;
  return style.key + s[((i % 7) + 7) % 7] + 12 * Math.floor(i / 7);
}

// A recording's playback rate for a tempo: pitch rises with speed, so it bends
// gently (1.14 → ~1.07) instead of turning chipmunk.
export const rateFor = (tempo) => Math.sqrt(tempo);

// Decoded songs, newest last; a few stay in memory so restarts are instant.
const decoded = new Map();
const KEEP = 4;
function load(ctx, name) {
  if (decoded.has(name)) {
    const hit = decoded.get(name); decoded.delete(name); decoded.set(name, hit);
    return hit;
  }
  const job = fetch(SONGS[name].src)
    .then(r => { if (!r.ok) throw new Error(`${r.status} ${SONGS[name].src}`); return r.arrayBuffer(); })
    .then(data => ctx.decodeAudioData(data));
  job.catch(() => decoded.delete(name));
  decoded.set(name, job);
  while (decoded.size > KEEP) decoded.delete(decoded.keys().next().value);
  return job;
}

export function createMusic(sound) {
  // Synth state.
  let style = null, next = 0, beat = 0, noise = null;
  // Recording state: `song` is the name, `source` the node playing it.
  let song = null, source = null, buffer = null, startedAt = 0, offset = 0, generation = 0;
  let timer = null, tempo = 1, gain = null, filter = null, duck = null, muffled = false;

  function voice(type, freq, at, dur, vol) {
    const ctx = sound.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(filter);
    o.start(at); o.stop(at + dur + 0.02);
  }

  function shaker(at, vol) {
    const ctx = sound.ctx;
    if (!noise) {
      noise = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noise; f.type = 'highpass'; f.frequency.value = 5000;
    g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
    src.connect(f).connect(g).connect(filter);
    src.start(at); src.stop(at + 0.08);
  }

  // Schedules one beat: bass on its pattern, two arp plucks, maracas.
  function playBeat(at, spb) {
    const bar = Math.floor(beat / style.beats), inBar = beat % style.beats;
    const deg = style.chords[bar % style.chords.length];
    const b = style.bass[inBar % style.bass.length];
    if (b != null) voice('sine', midi(noteFor(style, deg, b) - 24), at, spb * 0.9, 0.22);
    for (let h = 0; h < 2; h++) {
      const step = style.arp[(inBar * 2 + h) % style.arp.length];
      voice(style.lead, midi(noteFor(style, deg, step)), at + h * spb / 2, spb * 0.45, style.lead === 'sine' ? 0.09 : 0.05);
    }
    shaker(at, inBar === 0 ? 0.09 : 0.05);
    shaker(at + spb / 2, 0.035);
    beat++;
  }

  function pump() {
    if (!sound.ctx) return;
    // Mute is a plain flag games flip, so follow it here.
    gain.gain.setTargetAtTime(sound.muted ? 0 : 1, sound.ctx.currentTime, 0.05);
    if (!style) return;
    const spb = 60 / (style.bpm * tempo);
    while (next < sound.ctx.currentTime + 0.25) {
      if (!sound.muted) playBeat(next, spb);
      else beat++;
      next += spb;
    }
  }

  // Seconds into the recording right now, folded into its loop.
  function position() {
    if (!buffer) return offset;
    let t = offset + (sound.ctx.currentTime - startedAt) * rateFor(tempo);
    const loop = SONGS[song].loop;
    if (loop && t >= loop[1]) t = loop[0] + (t - loop[0]) % (loop[1] - loop[0]);
    return SONGS[song].loop ? t : Math.min(t, buffer.duration);
  }

  function startSource(at) {
    const ctx = sound.ctx, info = SONGS[song];
    source = ctx.createBufferSource();
    source.buffer = buffer;
    if (info.loop) { source.loop = true; source.loopStart = info.loop[0]; source.loopEnd = info.loop[1]; }
    source.playbackRate.value = rateFor(tempo);
    source.connect(filter);
    startedAt = ctx.currentTime; offset = at;
    source.start(ctx.currentTime, at);
  }

  function stopSource() {
    if (!source) return;
    try { source.stop(); } catch { /* never started */ }
    source.disconnect(); source = null;
  }

  function chain() {
    const ctx = sound.ctx;
    gain = ctx.createGain();
    duck = ctx.createGain();
    filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = muffled ? 700 : 20000; filter.Q.value = 0.5;
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(sound.muted ? 0 : 1, ctx.currentTime, 0.15);
    filter.connect(duck).connect(gain).connect(sound.musicOut?.() ?? sound.out());
  }

  function teardown(fade = 0.05) {
    stopSource();
    if (timer) clearInterval(timer);
    timer = null; style = null; song = null; buffer = null;
    if (gain) {
      const g = gain, f = filter;
      g.gain.setTargetAtTime(0, sound.ctx.currentTime, fade);
      setTimeout(() => { g.disconnect(); f.disconnect(); }, fade * 8000);
      gain = filter = duck = null;
    }
  }

  return {
    // Starts (or switches to) a recorded song, or else a synth groove, by name.
    // `fallback` names the synth style when the song has no recording;
    // `fallback: false` stays silent instead.
    play(name, { fallback } = {}) {
      if (!sound.ctx || (fallback === false && !SONGS[name])) return;
      this.stop();
      chain();
      tempo = 1;
      timer = setInterval(pump, 50);
      if (SONGS[name]) {
        song = name; offset = 0;
        const mine = ++generation;
        load(sound.ctx, name).then(buf => {
          if (mine !== generation) return;
          buffer = buf;
          if (timer) startSource(0); // paused while loading: resume() starts it
        }).catch(() => {
          // A missing file must never leave a race silent.
          if (mine !== generation) return;
          song = null;
          if (fallback === false) return;
          style = STYLES[fallback] ?? STYLES.estadio;
          next = sound.ctx.currentTime + 0.1; beat = 0;
        });
        return;
      }
      style = STYLES[fallback ?? name] ?? STYLES[name] ?? STYLES.estadio;
      next = sound.ctx.currentTime + 0.1; beat = 0;
      pump();
    },
    // Fetches and decodes a song ahead of play() so a race starts on the beat.
    preload(name) { if (sound.ctx && SONGS[name]) load(sound.ctx, name).catch(() => {}); },
    // 1 normally; a final lap or a sprint speeds it up, a slow-mo slows it.
    setTempo(t) {
      if (t === tempo) return;
      if (source) { offset = position(); startedAt = sound.ctx.currentTime; }
      tempo = t;
      source?.playbackRate.setTargetAtTime(rateFor(t), sound.ctx.currentTime, 0.4);
    },
    // Underwater, in a cave or spinning out: roll the highs off.
    muffle(on) {
      if (muffled === !!on) return;
      muffled = !!on;
      filter?.frequency.setTargetAtTime(muffled ? 700 : 20000, sound.ctx.currentTime, 0.12);
    },
    // A one-shot jingle (a song without a loop) over the music, which dips under it.
    sting(name) {
      if (!sound.ctx || sound.muted || !SONGS[name]) return;
      const ctx = sound.ctx;
      load(ctx, name).then(buf => {
        const src = ctx.createBufferSource(), g = ctx.createGain();
        src.buffer = buf; g.gain.value = 1;
        src.connect(g).connect(sound.musicOut?.() ?? sound.out());
        src.start();
        if (duck) {
          const now = ctx.currentTime;
          duck.gain.cancelScheduledValues(now);
          duck.gain.setTargetAtTime(0.25, now, 0.08);
          duck.gain.setTargetAtTime(1, now + buf.duration - 0.3, 0.5);
        }
      }).catch(() => {});
    },
    get playing() { return !!timer; },
    get tempo() { return tempo; },
    get song() { return song; },
    get position() { return position(); },
    pause() {
      if (!timer) return;
      clearInterval(timer); timer = null;
      if (source) { offset = position(); stopSource(); }
    },
    resume() {
      if (timer || !sound.ctx || !(style || song)) return;
      timer = setInterval(pump, 50);
      if (song && buffer) startSource(offset);
      else if (style) next = sound.ctx.currentTime + 0.05;
    },
    stop(fade) { generation++; teardown(fade); },
  };
}
