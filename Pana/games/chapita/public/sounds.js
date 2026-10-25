// The jugadas' tiny synth, from the Studio workbench: no files, every sound
// built from an oscillator or a burst of filtered noise on the engine's own
// audio graph, so the volume slider and mute apply.
import { sound } from '/engine/fx.js';

function tone({ f0 = 400, f1 = 800, dur = .15, type = 'sine', vol = .2, delay = 0 }) {
  const c = sound.ctx; if (!c || sound.muted) return;
  const t = c.currentTime + delay, slot = sound.admit(1, t, t + dur); if (!slot) return;
  const o = c.createOscillator(), g = c.createGain(); slot.gs.push(g);
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .012); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(sound.out()); o.start(t); o.stop(t + dur + .03);
}
function noise({ dur = .08, vol = .25, freq = 1800, q = 1, delay = 0 }) {
  const c = sound.ctx; if (!c || sound.muted) return;
  const t = c.currentTime + delay, slot = sound.admit(1, t, t + dur); if (!slot) return;
  const length = Math.ceil(c.sampleRate * dur), buffer = c.createBuffer(1, length, c.sampleRate), d = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
  const s = c.createBufferSource(); s.buffer = buffer;
  const band = c.createBiquadFilter(); band.type = 'bandpass'; band.frequency.value = freq; band.Q.value = q;
  const g = c.createGain(); g.gain.value = vol; slot.gs.push(g);
  s.connect(band).connect(g).connect(sound.out()); s.start(t);
}

export const SFX = {
  throw: () => noise({ dur: .25, vol: .18, freq: 1100, q: .7 }),
  swoosh: () => noise({ dur: .22, vol: .3, freq: 700, q: .6 }),
  hit: () => { noise({ dur: .06, vol: .7, freq: 2600, q: 1.2 }); tone({ f0: 900, f1: 300, dur: .12, type: 'square', vol: .08 }); },
  home: () => { SFX.hit(); [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ f0: f, f1: f * 1.01, dur: .22, type: 'triangle', vol: .12, delay: .15 + i * .08 })); },
  crack: () => { noise({ dur: .12, vol: .7, freq: 1500, q: 2 }); noise({ dur: .08, vol: .4, freq: 3500, q: 3, delay: .04 }); },
  crash: () => { for (let i = 0; i < 8; i++) noise({ dur: .08, vol: .35, freq: 3000 + i * 600, q: 4, delay: i * .035 }); tone({ f0: 2400, f1: 1800, dur: .3, type: 'triangle', vol: .05 }); },
  toing: () => { tone({ f0: 300, f1: 900, dur: .25, vol: .3 }); tone({ f0: 900, f1: 400, dur: .3, vol: .15, delay: .2 }); },
  land: () => noise({ dur: .1, vol: .4, freq: 350 }),
  strike: () => { tone({ f0: 1600, f1: 1500, dur: .18, type: 'square', vol: .05 }); tone({ f0: 1600, f1: 1500, dur: .25, type: 'square', vol: .05, delay: .22 }); },
  pop: () => tone({ f0: 620, f1: 1250, dur: .08, type: 'square', vol: .05 }),
  tada: () => [523, 659, 784, 1047].forEach((f, i) => tone({ f0: f, f1: f * 1.01, dur: .24, type: 'triangle', vol: .13, delay: i * .09 })),
  sad: () => [392, 330, 247].forEach((f, i) => tone({ f0: f, f1: f * .96, dur: .26, type: 'triangle', vol: .1, delay: i * .15 })),
  fire: () => noise({ dur: .5, vol: .3, freq: 500, q: .5 }),
  honk: () => { tone({ f0: 420, f1: 410, dur: .22, type: 'square', vol: .07 }); tone({ f0: 420, f1: 410, dur: .3, type: 'square', vol: .07, delay: .28 }); },
  bark: () => { for (const d of [0, .22]) { noise({ dur: .07, vol: .4, freq: 700, q: 1.5, delay: d }); tone({ f0: 520, f1: 280, dur: .1, type: 'sawtooth', vol: .06, delay: d }); } },
  ping: () => { tone({ f0: 1300, f1: 1750, dur: .09, type: 'square', vol: .06 }); tone({ f0: 2600, f1: 2600, dur: .08, vol: .08, delay: .05 }); },
  whirr: () => { tone({ f0: 85, f1: 120, dur: .7, type: 'sawtooth', vol: .07 }); noise({ dur: .7, vol: .12, freq: 200, q: .5 }); },
  cricket: () => { for (let i = 0; i < 8; i++) tone({ f0: 4300, f1: 4200, dur: .03, vol: .05, delay: i * .06 + (i > 3 ? .25 : 0) }); },
  clink: () => tone({ f0: 2400, f1: 2100, dur: .12, type: 'triangle', vol: .12 }),
  plop: () => { noise({ dur: .08, vol: .5, freq: 900, q: 1 }); tone({ f0: 700, f1: 160, dur: .14, vol: .25 }); },
  boing: () => tone({ f0: 140, f1: 880, dur: .38, vol: .22 }),
  yell: () => { for (let i = 0; i < 4; i++) tone({ f0: 420 + i * 30, f1: 300, dur: .14, type: 'sawtooth', vol: .05, delay: i * .13 }); },
  melody: () => [659, 784, 880, 784, 659, 587, 659].forEach((f, i) => tone({ f0: f, f1: f, dur: .16, type: 'triangle', vol: .09, delay: i * .17 })),
};
export const playSfx = (name) => { try { SFX[name]?.(); } catch { /* audio not ready */ } };
