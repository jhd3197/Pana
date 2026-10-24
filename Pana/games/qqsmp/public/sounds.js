import { rng } from '../../../engine/random.js';

// Original short scores: MIDI pitch, onset, duration, instrument and gain.
const note = (pitch, at, duration, instrument = 'brass', gain = .065) => ({ pitch, at, duration, instrument, gain });
const roll = (length = .48) => Array.from({ length: 7 }, (_, i) => note(0, i * length / 7, .09, 'snare', .025 + i * .006));
export const QUIZ_CUES = {
  question: [note(38, 0, .45, 'bass', .12), note(62, .05, .16), note(69, .21, .28, 'bell', .065)],
  lock: [note(50, 0, .18, 'bass', .09), note(74, .03, .13, 'bell', .04)],
  tick: [note(38, 0, .14, 'bass', .085), note(81, .02, .06, 'bell', .02)],
  suspense: [...roll(.65), note(38, 0, .8, 'bass', .1), note(57, .1, .75, 'brass', .045), note(58, .15, .7, 'brass', .035)],
  reveal: [...roll(.28), note(38, .28, .65, 'bass', .14), note(62, .28, .65), note(69, .28, .65)],
  correct: [...roll(.25), note(38, .25, .8, 'bass', .13), note(62, .25, .2), note(66, .42, .2), note(69, .59, .55), note(74, .59, .65, 'bell', .06)],
  wrong: [note(39, 0, .65, 'bass', .13), note(63, 0, .22), note(62, .19, .22), note(57, .38, .65), note(51, .38, .65, 'brass', .045)],
  final: [...roll(.55), note(38, 0, .85, 'bass', .12), note(62, .55, .6), note(65, .55, .6), note(69, .55, .7, 'bell', .05)],
  victory: [...roll(.32), note(38, .32, 1, 'bass', .13), note(62, .32, .18), note(66, .48, .18), note(69, .64, .18), note(74, .8, .65), note(78, .8, .75, 'bell', .055)],
};

// Snapshot identity, not render frequency, decides when a cue plays.
export function quizSoundEvent(state, seat) {
  const prefix = `${state.round}:${state.index}`;
  if (state.phase === 'question') {
    const left = Math.ceil(state.timeLeft);
    return left > 0 && left <= 5 ? { key: `${prefix}:tick:${left}`, cue: 'tick' } : { key: `${prefix}:question`, cue: 'question' };
  }
  if (state.phase === 'reveal') return state.reveal?.done
    ? { key: `${prefix}:result`, cue: state.players[seat]?.outcome ? state.players[seat].outcome.right ? 'correct' : 'wrong' : 'reveal' }
    : { key: `${prefix}:suspense`, cue: 'suspense' };
  return { key: `${prefix}:${state.phase}`, cue: { pause: 'suspense', bet: 'final', finished: 'victory' }[state.phase] };
}

// Reuses the shared AudioContext, master volume and voice admission. No files.
export function createQuizSounds(sound, { audible = () => true } = {}) {
  let active = null, noise = null, noiseContext = null, lastKey = '', speaking = false, disposed = false;
  function stop() {
    if (!active) return;
    const { ctx, bus, voice, sources } = active, now = ctx.currentTime;
    bus.gain.cancelScheduledValues(now); bus.gain.setTargetAtTime(0, now, .012);
    for (const source of sources) { try { source.stop(now + .04); } catch { /* Already ended. */ } }
    voice.until = now + .04; active = null;
  }
  function play(cue) {
    stop();
    const score = QUIZ_CUES[cue], ctx = sound.ctx;
    if (disposed || !score || !ctx || sound.muted || sound.volume <= 0 || !audible()) return;
    const start = ctx.currentTime + .008, end = Math.max(...score.map(n => n.at + n.duration));
    const voice = sound.admit(3, start, start + end + .05);
    if (!voice) return;
    const bus = ctx.createGain(); bus.gain.value = speaking ? .25 : .85;
    bus.connect(sound.out()); voice.gs.push(bus);
    const track = active = { ctx, bus, voice, sources: [], remaining: 0 };
    for (const n of score) {
      const t = start + n.at, gain = ctx.createGain(), filter = ctx.createBiquadFilter();
      const hz = 440 * 2 ** ((n.pitch - 69) / 12);
      filter.type = n.instrument === 'snare' ? 'bandpass' : 'lowpass';
      filter.frequency.value = n.instrument === 'snare' ? 1700 : n.instrument === 'brass' ? 1400 : 6500;
      filter.Q.value = .7;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(n.gain, t + .008);
      gain.gain.exponentialRampToValueAtTime(.0001, t + n.duration);
      filter.connect(gain).connect(bus);
      let source;
      if (n.instrument === 'snare') {
        if (noiseContext !== ctx) {
          noiseContext = ctx; noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .15), ctx.sampleRate);
          const random = rng(1847), data = noise.getChannelData(0);
          for (let i = 0; i < data.length; i++) data[i] = random() * 2 - 1;
        }
        source = ctx.createBufferSource(); source.buffer = noise;
      } else {
        source = ctx.createOscillator();
        source.type = n.instrument === 'brass' ? 'sawtooth' : 'sine';
        source.frequency.setValueAtTime(n.instrument === 'bass' ? hz * 1.8 : hz, t);
        if (n.instrument === 'bass') source.frequency.exponentialRampToValueAtTime(hz, t + .09);
      }
      source.connect(filter); track.sources.push(source); track.remaining++;
      source.onended = () => {
        source.disconnect(); filter.disconnect(); gain.disconnect();
        if (--track.remaining === 0) { bus.disconnect(); if (active === track) active = null; }
      };
      source.start(t); source.stop(t + n.duration + .02);
    }
  }
  return {
    play, stop,
    speaking(value) {
      speaking = value;
      if (active) active.bus.gain.setTargetAtTime(value ? .25 : .85, active.ctx.currentTime, .025);
    },
    update(state, seat, paused = false) {
      const event = quizSoundEvent(state, seat), changed = event.key !== lastKey;
      lastKey = event.key;
      if (paused || !audible() || sound.muted || sound.volume <= 0) { stop(); return; }
      if (changed) play(event.cue);
    },
    dispose() { disposed = true; stop(); noise = null; noiseContext = null; },
  };
}
