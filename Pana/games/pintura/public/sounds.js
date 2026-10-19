import { sound } from '/engine/fx.js';

// Pepazo's sounds, synthesized like the rest of Pana: an air-gun "pfft", a
// crisp hit tick, a wet splat when you're hit and a chime for a knockout.
let noiseBuffer = null;
function noise(duration, frequency, q, volume, start = 0) {
  if (!sound.ctx || sound.muted || volume < .005) return;
  const ctx = sound.ctx, t = ctx.currentTime + start;
  if (!noiseBuffer) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * .5, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
  source.buffer = noiseBuffer; filter.type = 'bandpass'; filter.frequency.value = frequency; filter.Q.value = q;
  gain.gain.setValueAtTime(volume, t); gain.gain.exponentialRampToValueAtTime(.001, t + duration);
  source.connect(filter).connect(gain).connect(sound.out()); source.start(t); source.stop(t + duration + .02);
}

export const sfx = {
  // Your marker, or another pana's quieter with distance (volume 0–1).
  shot(volume = 1, weapon = 'pistol') {
    const heavy = weapon === 'scatter' ? 1.5 : 1;
    noise(.07 * heavy, weapon === 'rapid' ? 2200 : 1600, .9, .22 * volume);
    sound.sweep(200 / heavy, 60, .09 * heavy, 'sine', .16 * volume);
  },
  impact(volume = 1) { noise(.06, 900, 1.2, .14 * volume); },
  hitTick() { sound.tone(1400, 0, .035, 'square', .05); sound.tone(2100, .035, .045, 'square', .045); },
  knockout(long = false, streak = 1) {
    noise(.2, 650, .7, .26);
    const lift = 1 + Math.min(4, streak - 1) * .12;
    [660, 880, 1320].forEach((f, i) => sound.tone(f * lift, .05 + i * .07, .11, 'triangle', .08));
    if (long) { sound.tone(1760 * lift, .3, .22, 'sine', .07); sound.tone(2640 * lift, .38, .2, 'sine', .04); }
  },
  hurt() { noise(.18, 480, .6, .32); sound.sweep(320, 90, .22, 'sine', .14); },
  out() { noise(.3, 380, .5, .3); sound.sweep(520, 100, .7, 'triangle', .12); },
};
