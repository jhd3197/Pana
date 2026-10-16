// Game music, synthesized live with WebAudio (no files): Venezuelan-flavoured
// grooves (joropo on the plains, gaita in the plaza, calipso on the islands,
// tambor on the Amazonas) built from a bass line, a plucked cuatro/arpa
// arpeggio and maracas. setTempo() speeds it up for a final lap or a sprint.
// It shares the game's master volume and mute (engine/fx.js `sound`).
// Derrape and Curiara play it; each game picks its own style names.

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

const midi = (n) => 440 * 2 ** ((n - 69) / 12);

// Note number for scale degree `deg` (1-based chord root) plus `step` scale steps.
export function noteFor(style, deg, step) {
  const s = style.scale, i = deg - 1 + step;
  return style.key + s[((i % 7) + 7) % 7] + 12 * Math.floor(i / 7);
}

export function createMusic(sound) {
  let style = null, timer = null, next = 0, beat = 0, tempo = 1, gain = null, noise = null;

  function voice(type, freq, at, dur, vol) {
    const ctx = sound.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(gain);
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
    src.connect(f).connect(g).connect(gain);
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
    if (!sound.ctx || !style) return;
    const spb = 60 / (style.bpm * tempo);
    while (next < sound.ctx.currentTime + 0.25) {
      if (!sound.muted) playBeat(next, spb);
      else beat++;
      next += spb;
    }
  }

  return {
    // Starts (or switches to) a groove by style name.
    play(name) {
      if (!sound.ctx) return;
      this.stop();
      style = STYLES[name] ?? STYLES.estadio;
      gain = sound.ctx.createGain();
      gain.gain.value = 0.55;
      gain.connect(sound.out());
      next = sound.ctx.currentTime + 0.1; beat = 0; tempo = 1;
      timer = setInterval(pump, 50);
      pump();
    },
    // 1 normally; a final lap or a sprint speeds it up.
    setTempo(t) { tempo = t; },
    get playing() { return !!timer; },
    get tempo() { return tempo; },
    pause() { if (timer) { clearInterval(timer); timer = null; } },
    resume() { if (style && !timer && sound.ctx) { next = sound.ctx.currentTime + 0.05; timer = setInterval(pump, 50); } },
    stop() {
      if (timer) clearInterval(timer);
      timer = null; style = null;
      if (gain) { const g = gain; g.gain.setTargetAtTime(0, sound.ctx.currentTime, 0.05); setTimeout(() => g.disconnect(), 400); gain = null; }
    },
  };
}
