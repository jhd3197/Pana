// Reliquia's sounds, synthesized on the shared context (engine/fx.js): no files.
import { sound } from '/engine/fx.js';

export const sfx = {
  coin() { sound.tone(1320, 0, .06, 'square', .05); sound.tone(1760, .05, .09, 'square', .045); },
  gem() { sound.tone(1568, 0, .08, 'sine', .07); sound.tone(2093, .06, .12, 'sine', .06); },
  grab() { sound.tone(180, 0, .09, 'triangle', .09); },
  swing() { sound.sweep(520, 180, .12, 'triangle', .06); },
  hit() { sound.bonk(.35); },
  shot() { sound.sweep(900, 300, .1, 'sine', .08); },
  splat() { sound.splat(); },
  chest() { sound.chestOpen('gold'); },
  bank(big) { sound.chestOpen(big ? 'gold' : 'purple'); sound.tone(784, .1, .12, 'square', .04); sound.tone(1046, .2, .2, 'square', .04); },
  throw() { sound.whoosh(); },
  bonk() { sound.bonk(1); sound.boing(); },
  tip() { sound.explode(.35); },
  lost() { sound.sweep(600, 60, .9, 'sine', .1); },
  curse() { sound.sweep(220, 70, 1.1, 'sawtooth', .07); sound.tone(98, .2, .8, 'triangle', .08); },
  seal() { sound.explode(.5); sound.tone(330, .2, .5, 'sine', .07); sound.tone(494, .45, .6, 'sine', .07); },
  stairs() { sound.sweep(300, 140, .4, 'triangle', .07); },
  trap() { sound.clickDown(); sound.sweep(1800, 900, .2, 'square', .03); },
  hurt() { sound.tone(160, 0, .12, 'sawtooth', .06); },
  down() { sound.sweep(400, 90, .7, 'triangle', .1); },
  revive() { sound.tone(440, 0, .14, 'sine', .08); sound.tone(660, .12, .2, 'sine', .07); },
  awaken() { sound.tone(82, 0, .7, 'sawtooth', .05); },
  boss() { sound.tone(65, 0, 1.2, 'sawtooth', .09); sound.tone(98, .3, 1, 'triangle', .07); },
  pounce() { sound.explode(.8); },
  collapse() { sound.thunder(.9); sound.explode(1); },
  greed() { sound.tone(110, 0, .9, 'sawtooth', .06); sound.tone(104, .05, .9, 'sawtooth', .05); },
  // Guácharos scattering: a quick rising chatter.
  flap() { for (let i = 0; i < 4; i++) sound.tone(1600 + i * 180, i * .05, .05, 'square', .03); },
  // The idol's laugh: a falling run of yelps.
  laugh() { for (let i = 0; i < 6; i++) sound.tone(620 - i * 40 + (i % 2) * 120, i * .11, .09, 'square', .06); },
  // A pana's shout: a two-note chirp, pitched by seat, louder up close.
  bark(seat = 0, near = 1) { const base = 260 + (seat % 8) * 28; sound.tone(base, 0, .09, 'triangle', .07 * near); sound.tone(base * 1.33, .09, .12, 'triangle', .06 * near); },
  win() { for (const [i, f] of [523, 659, 784, 1046].entries()) sound.tone(f, i * .12, .25, 'square', .05); },
  wipe() { for (const [i, f] of [392, 330, 262, 196].entries()) sound.tone(f, i * .18, .3, 'triangle', .07); },
};
