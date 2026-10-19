// The rueda's sound, made live with WebAudio on each pana's own computer:
// culo e' puya slaps, the long drum's sticks, the charrasca, the caracol, the
// MCP's maracas and the low pujao groove, all scheduled against the song clock
// so the music lands exactly where the local judge expects the beat. The
// station you play is left out of the music: you hear it when you hit it.
// A low Sabor makes the other stations wobble and drop notes.
// The MCP talks through the browser's speech voice when there is one.
import { chart, songFor, secondsPerBeat, songBeats, GROOVE, BEATS_PER_BAR, COUNT_IN } from './songs.js';

const LOOKAHEAD = .3;

export function createTambor(sound) {
  let noise = null, bus = null, fxBus = null, timer = null;
  let song = null, track = null, startAt = 0, clock = () => Date.now(), mine = null, sabor = .75, golpe = null, mode = 'rueda';
  let scheduledTo = -Infinity, anchor = null, songN = 0;

  const ctx = () => sound.ctx;
  function noiseBuffer() {
    if (!noise) {
      const c = ctx(); noise = c.createBuffer(1, c.sampleRate * 1.5, c.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return noise;
  }
  function out(music) {
    const c = ctx();
    if (music) { if (!bus) { bus = c.createGain(); bus.gain.value = .9; bus.connect(sound.musicOut?.() ?? sound.out()); } return bus; }
    if (!fxBus) { fxBus = c.createGain(); fxBus.gain.value = .8; fxBus.connect(sound.out()); }
    return fxBus;
  }
  function env(at, peak, decay, attack = .002) {
    const g = ctx().createGain();
    g.gain.setValueAtTime(.0001, at); g.gain.exponentialRampToValueAtTime(peak, at + attack);
    g.gain.exponentialRampToValueAtTime(.0001, at + attack + decay);
    return g;
  }
  function tone(type, f0, f1, at, decay, vol, dest) {
    const o = ctx().createOscillator(), g = env(at, vol, decay);
    o.type = type; o.frequency.setValueAtTime(f0, at); o.frequency.exponentialRampToValueAtTime(f1, at + decay * .7);
    o.connect(g).connect(dest); o.start(at); o.stop(at + decay + .05);
  }
  function hiss(at, decay, vol, freq, q, dest, kind = 'bandpass') {
    const src = ctx().createBufferSource(), f = ctx().createBiquadFilter(), g = env(at, vol, decay);
    src.buffer = noiseBuffer(); src.playbackRate.value = .8 + Math.random() * .4;
    f.type = kind; f.frequency.value = freq; f.Q.value = q;
    src.connect(f).connect(g).connect(dest); src.start(at, Math.random()); src.stop(at + decay + .05);
  }

  // ---------- voices ----------
  const voices = {
    // culo e' puya: the high prima (lane 0) and the cruzao (lane 1), skin slaps.
    slap(at, lane = 0, vol = 1, dest) {
      const f = lane ? 300 : 410;
      tone('triangle', f * 1.25, f, at, .16, .32 * vol, dest);
      tone('sine', f * .5, f * .42, at, .1, .18 * vol, dest);
      hiss(at, .05, .22 * vol, lane ? 1900 : 2600, 1.4, dest);
    },
    pujao(at, vol = 1, dest) { tone('sine', 150, 82, at, .32, .45 * vol, dest); hiss(at, .03, .08 * vol, 700, 1, dest); },
    cruzao(at, vol = 1, dest) { tone('sine', 210, 120, at, .2, .3 * vol, dest); },
    // The long drum's body struck with sticks: a dry wooden tac.
    palo(at, vol = 1, dest) { hiss(at, .045, .4 * vol, 1500, 5, dest); tone('square', 820, 700, at, .035, .06 * vol, dest); },
    maraca(at, vol = 1, dest) { hiss(at, .055, .1 * vol, 6500, .7, dest, 'highpass'); },
    stick(at, vol = 1, dest) { hiss(at, .03, .5 * vol, 3200, 8, dest); tone('sine', 1800, 1500, at, .04, .12 * vol, dest); },
    clap(at, vol = 1, dest) { for (const d of [0, .011, .023]) hiss(at + d, .07, .3 * vol, 1300, 1.2, dest); },
    // Charrasca: a metal scraper, a rasping hiss that pulses while held.
    charrasca(at, dur, vol = 1, dest) {
      const c = ctx(), src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), depth = c.createGain();
      src.buffer = noiseBuffer(); src.loop = true; f.type = 'bandpass'; f.frequency.value = 4200; f.Q.value = 2.2;
      g.gain.setValueAtTime(.0001, at); g.gain.exponentialRampToValueAtTime(.16 * vol, at + .02);
      g.gain.setValueAtTime(.16 * vol, at + Math.max(.03, dur - .04)); g.gain.exponentialRampToValueAtTime(.0001, at + dur + .05);
      lfo.type = 'sawtooth'; lfo.frequency.value = 22; depth.gain.value = .08 * vol;
      lfo.connect(depth).connect(g.gain);
      src.connect(f).connect(g).connect(dest); src.start(at); lfo.start(at); src.stop(at + dur + .1); lfo.stop(at + dur + .1);
      return { stop(t = ctx().currentTime) { g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(.0001, t, .02); src.stop(t + .15); lfo.stop(t + .15); } };
    },
    // Caracol: the conch horn, a breathy brass note with a slow swell.
    caracol(at, dur, vol = 1, dest) {
      const c = ctx(), g = c.createGain(), f = c.createBiquadFilter(), oscs = [];
      f.type = 'lowpass'; f.frequency.setValueAtTime(500, at); f.frequency.linearRampToValueAtTime(1500, at + .25); f.Q.value = 3;
      g.gain.setValueAtTime(.0001, at); g.gain.exponentialRampToValueAtTime(.2 * vol, at + .12);
      g.gain.setValueAtTime(.2 * vol, at + Math.max(.13, dur - .15)); g.gain.exponentialRampToValueAtTime(.0001, at + dur + .1);
      for (const [type, mult] of [['sawtooth', 1], ['sawtooth', 1.006], ['triangle', 2]]) {
        const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(233 * mult, at);
        o.frequency.linearRampToValueAtTime(220 * mult, at + .12); o.frequency.linearRampToValueAtTime(233 * mult, at + .3);
        o.connect(f); o.start(at); o.stop(at + dur + .2); oscs.push(o);
      }
      f.connect(g).connect(dest);
      return { stop(t = ctx().currentTime) { g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(.0001, t, .04); oscs.forEach(o => o.stop(t + .3)); } };
    },
  };

  function playNote(station, note, at, vol, dest, spb) {
    if (station === 'mano') voices.slap(at, note.lane, vol, dest);
    else if (station === 'palo') voices.palo(at, vol, dest);
    else if (station === 'charrasca') voices.charrasca(at, note.len * spb, vol * .9, dest);
    else if (station === 'caracol') voices.caracol(at, note.len * spb, vol * .8, dest);
  }

  // ---------- the scheduler ----------
  const songTime = () => (clock() - startAt) / 1000;
  function pump() {
    const c = ctx();
    if (!c || !song || c.state !== 'running') return;
    const t = songTime(), spb = secondsPerBeat(song), estimate = c.currentTime - t;
    if (anchor == null || Math.abs(estimate - anchor) > .045) { anchor = estimate; scheduledTo = Math.max(scheduledTo, t / spb); }
    const from = Math.max(scheduledTo, t / spb), to = (t + LOOKAHEAD) / spb, end = songBeats(song);
    scheduledTo = to;
    if (sound.muted || to <= from) return;
    const dest = out(true), at = (beat) => anchor + beat * spb, inRange = (b) => b > from && b <= to;
    // Count-in sticks.
    for (let b = Math.ceil(from); b <= to; b++) if (b >= -COUNT_IN && b < 0 && inRange(b)) voices.stick(at(b), b === -1 ? 1.2 : .8, dest);
    // The groove and the MCP's maracas, from the first beat to the closing hit.
    for (let bar = Math.floor(Math.max(0, from) / BEATS_PER_BAR); bar * BEATS_PER_BAR <= to && bar * BEATS_PER_BAR < end; bar++) {
      const base = bar * BEATS_PER_BAR, closing = base >= end - BEATS_PER_BAR;
      if (closing) { if (inRange(base)) { voices.pujao(at(base), 1.4, dest); voices.slap(at(base), 0, 1.3, dest); voices.slap(at(base) + .02, 1, 1.3, dest); voices.palo(at(base), 1.2, dest); } continue; }
      for (const [b, voice] of GROOVE) if (inRange(base + b)) voices[voice](at(base + b), mode === 'golpe' ? .8 : 1, dest);
      for (let e = 0; e < 8; e++) if (inRange(base + e / 2)) voices.maraca(at(base + e / 2), e % 2 ? .55 : 1, dest);
    }
    // The other stations; the beat wobbles and thins out as Sabor drops.
    const loose = Math.max(0, .62 - sabor);
    if (mode !== 'golpe') for (const station of ['mano', 'palo', 'charrasca', 'caracol']) {
      if (station === mine) continue;
      for (const note of chart(song, station)) {
        if (note.beat > to) break;
        if (!inRange(note.beat) || Math.random() < loose * .55) continue;
        const wobble = (Math.random() * 2 - 1) * loose * .09;
        playNote(station, note, Math.max(c.currentTime, at(note.beat) + wobble), station === 'mano' ? .85 : .75, dest, spb);
      }
    }
    // ¡Golpe!: the MCP plays the pattern on his drum.
    if (golpe?.notes) for (const [off, lane] of golpe.notes) { const b = golpe.start + off; if (inRange(b)) voices.slap(at(b), lane, 1.35, dest); }
  }

  function start() { if (!timer) timer = setInterval(pump, 30); }
  function stop() { clearInterval(timer); timer = null; }

  // ---------- the MCP's voice ----------
  let voice = null;
  function pickVoice() {
    const all = globalThis.speechSynthesis?.getVoices?.() || [];
    voice = ['es-VE', 'es-US', 'es-MX', 'es-419', 'es-CO', 'es-ES'].map(lang => all.find(v => v.lang === lang)).find(Boolean)
      || all.find(v => v.lang?.startsWith('es')) || null;
  }
  globalThis.speechSynthesis?.addEventListener?.('voiceschanged', pickVoice);
  function say(text, { urgent = false, pitch = .85, rate = 1.18 } = {}) {
    const synth = globalThis.speechSynthesis;
    if (!synth || sound.muted || !text || typeof SpeechSynthesisUtterance === 'undefined') return;
    if (!voice) pickVoice();
    if (urgent) synth.cancel();
    else if (synth.pending) return;
    const line = new SpeechSynthesisUtterance(text.replace(/[¡!¿?]/g, ''));
    line.lang = voice?.lang || 'es-VE'; if (voice) line.voice = voice;
    line.rate = rate; line.pitch = pitch; line.volume = Math.min(1, sound.volume ?? 1);
    synth.speak(line);
  }

  return {
    voices,
    // Follow the snapshot: which song, when it started, what I play, the Sabor.
    follow(state, me, clockFn) {
      clock = clockFn;
      const p = state.players.find(x => x.id === me);
      mode = state.options?.mode ?? 'rueda';
      sabor = state.sabor ?? .75; golpe = mode === 'golpe' ? state.golpe : null;
      mine = p?.role === 'drum' ? p.station : null;
      if (!state.song || !['song', 'break'].includes(state.phase)) { song = null; return; }
      if (state.song.n !== songN || state.song.track !== track || state.song.startAt !== startAt) {
        if (state.song.n !== songN || state.song.track !== track) scheduledTo = -Infinity;
        songN = state.song.n; track = state.song.track; startAt = state.song.startAt; anchor = null;
      }
      song = state.phase === 'song' ? songFor(track) : null;
      start();
    },
    // Your own hit, right now: drums, claps and the dance's stomps.
    hit(station, lane = 0) {
      if (!ctx() || sound.muted) return null;
      const at = ctx().currentTime, dest = out(false);
      if (station === 'mano' || station === 'tap') voices.slap(at, lane, 1.1, dest);
      else if (station === 'palo') voices.palo(at, 1.1, dest);
      else if (station === 'charrasca') return voices.charrasca(at, 8, 1, dest);
      else if (station === 'caracol') return voices.caracol(at, 8, 1, dest);
      else if (station === 'clap') voices.clap(at, 1, dest);
      else if (station === 'stomp') voices.pujao(at, .7, dest);
      return null;
    },
    say,
    get songTime() { return song ? songTime() : null; },
    stop() { stop(); song = null; globalThis.speechSynthesis?.cancel?.(); },
  };
}

// How the MCP calls each move out loud.
export const SPOKEN = { cadera: 'Cadera', vuelta: 'Vuelta', panuelo: 'Pañuelo', pegate: 'Pégate', abajo: 'Abajo', golpe: 'Golpe' };
