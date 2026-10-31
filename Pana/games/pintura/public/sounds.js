import { sound } from '/engine/fx.js';

// Pepazo's sounds, synthesized like the rest of Pana: an air-gun "pfft", a
// crisp hit tick, a wet splat when you're hit and a chime for a knockout.
const noise = (duration, freq, q, vol, delay = 0) => sound.noise(duration, { freq, q, vol, delay });

export const sfx = {
  // Your marker, or another pana's quieter with distance (volume 0–1).
  shot(volume = 1, weapon = 'pistol') {
    if (weapon === 'rocket') {
      noise(.25, 350, .5, .3 * volume);
      sound.sweep(130, 38, .3, 'triangle', .18 * volume);
      return;
    }
    const heavy = weapon === 'scatter' ? 1.5 : 1;
    noise(.07 * heavy, weapon === 'rapid' ? 2200 : 1600, .9, .26 * volume);
    noise(.022, 4200, .8, .2 * volume);   // the crack of the air gun
    sound.sweep(200 / heavy, 60, .09 * heavy, 'sine', .2 * volume);
  },
  // Pulling the trigger while reloading, and the marker ready again.
  dry() { sound.tone(170, 0, .05, 'square', .06); },
  reloaded() { sound.tone(520, 0, .05, 'square', .07); sound.tone(780, .07, .08, 'square', .07); },
  impact(volume = 1) { noise(.06, 900, 1.2, .14 * volume); },
  hitTick() { sound.tone(1400, 0, .04, 'square', .11); sound.tone(2100, .04, .06, 'square', .1); sound.sweep(260, 110, .08, 'sine', .14); noise(.04, 3200, 1, .1); },
  knockout(long = false, streak = 1) {
    noise(.2, 650, .7, .26);
    const lift = 1 + Math.min(4, streak - 1) * .12;
    [660, 880, 1320].forEach((f, i) => sound.tone(f * lift, .05 + i * .07, .11, 'triangle', .08));
    if (long) { sound.tone(1760 * lift, .3, .22, 'sine', .07); sound.tone(2640 * lift, .38, .2, 'sine', .04); }
  },
  hurt() { noise(.18, 480, .6, .32); sound.sweep(320, 90, .22, 'sine', .14); },
  // The 3-2-1 ticks, then a brighter rising call for ¡YA!
  count() { sound.tone(660, 0, .12, 'square', .07); },
  go() { sound.tone(880, 0, .14, 'square', .08); sound.tone(1320, .1, .32, 'square', .08); },
  out() { noise(.3, 380, .5, .3); sound.sweep(520, 100, .7, 'triangle', .12); },
};
