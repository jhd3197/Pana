// The shared sound-effect library: footsteps by surface, jump and land, shots,
// impacts and splats, getting hit, reload, the empty click, UI ticks, the
// countdown. Synthesised on the shared WebAudio context (engine/fx.js `sound`),
// no files, every voice inside the engine's voice budget. A game calls these
// by meaning and never builds a click out of oscillators again:
//
//   import { sfx } from '/engine/sfx.js';
//   sfx.step('concrete', { sprint: true });       // one footfall
//   sfx.shot('pistol', { volume: .6 });           // quieter with distance
//
// Vehicles (motor, tyres, boost, crash) live in engine/vehicle-audio.js and are
// built on the two primitives exported here, `burst` and `pitch`.
import { sound } from './fx.js';

const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);
const jit = (amount = .06) => 1 + rnd(-amount, amount);
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

// ---------- primitives ----------
let noiseData = null;
function noiseBuffer() {
  const { ctx } = sound;
  if (!noiseData || noiseData.sampleRate !== ctx.sampleRate) {
    noiseData = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseData.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseData;
}
export const sharedNoise = () => noiseBuffer();

// A filtered noise burst whose filter glides f0 -> f1 while its level decays:
// the body of a shot, a footfall's scuff, a splat. type: bandpass | lowpass | highpass.
export function burst({ dur = .1, f0 = 1000, f1 = f0, q = 1, vol = .1, delay = 0, attack = .003, type = 'bandpass', priority = 1 } = {}) {
  const { ctx } = sound;
  if (!ctx || sound.muted || vol < .004) return;
  const t = ctx.currentTime + delay, v = sound.admit(priority, t, t + dur);
  if (!v) return;
  const src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
  src.buffer = noiseBuffer(); src.loop = true;
  filter.type = type; filter.Q.value = q; filter.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) filter.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  gain.gain.setValueAtTime(.0001, t); gain.gain.linearRampToValueAtTime(vol, t + attack); gain.gain.exponentialRampToValueAtTime(.0008, t + dur);
  src.connect(filter).connect(gain).connect(sound.out()); v.gs.push(gain);
  src.start(t, Math.random() * 1.5); src.stop(t + dur + .02);
}

// A pitched thump or blip whose frequency falls (or rises) f0 -> f1 and decays.
export function pitch({ dur = .1, f0 = 200, f1 = f0, vol = .1, delay = 0, type = 'sine', attack = .003, priority = 1 } = {}) {
  const { ctx } = sound;
  if (!ctx || sound.muted || vol < .004) return;
  const t = ctx.currentTime + delay, v = sound.admit(priority, t, t + dur);
  if (!v) return;
  const o = ctx.createOscillator(), gain = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  gain.gain.setValueAtTime(.0001, t); gain.gain.linearRampToValueAtTime(vol, t + attack); gain.gain.exponentialRampToValueAtTime(.0008, t + dur);
  o.connect(gain).connect(sound.out()); v.gs.push(gain);
  o.start(t); o.stop(t + dur + .02);
}

// ---------- footsteps ----------
// Surface -> recipe. Each returns the layers of one footfall at volume v.
export const SURFACES = ['concrete', 'stone', 'tile', 'wood', 'metal', 'dirt', 'grass', 'sand', 'water'];
const FOOT = {
  concrete: v => { burst({ dur: .05, f0: 1900, f1: 900, q: 1.2, vol: .1 * v, priority: 0 }); pitch({ dur: .08, f0: 125, f1: 58, vol: .1 * v, priority: 0 }); burst({ dur: .025, f0: 5000, type: 'highpass', vol: .03 * v, priority: 0 }); },
  stone: v => { burst({ dur: .05, f0: 2400, f1: 1300, q: 1.5, vol: .09 * v, priority: 0 }); pitch({ dur: .07, f0: 165, f1: 85, vol: .08 * v, priority: 0 }); burst({ dur: .02, f0: 6000, type: 'highpass', vol: .03 * v, priority: 0 }); },
  tile: v => { pitch({ dur: .035, f0: 950, f1: 520, vol: .05 * v, type: 'triangle', priority: 0 }); burst({ dur: .035, f0: 3600, q: 2, vol: .08 * v, priority: 0 }); pitch({ dur: .07, f0: 140, f1: 70, vol: .07 * v, priority: 0 }); },
  wood: v => { pitch({ dur: .08, f0: 210, f1: 105, vol: .11 * v, type: 'triangle', priority: 0 }); burst({ dur: .06, f0: 700, f1: 420, q: 2.2, vol: .07 * v, priority: 0 }); burst({ dur: .02, f0: 2600, q: 1.5, vol: .03 * v, priority: 0 }); },
  metal: v => { pitch({ dur: .13, f0: 530, f1: 470, vol: .045 * v, type: 'triangle', priority: 0 }); pitch({ dur: .1, f0: 1340, f1: 1290, vol: .025 * v, priority: 0 }); burst({ dur: .04, f0: 3000, q: 4, vol: .05 * v, priority: 0 }); pitch({ dur: .08, f0: 115, f1: 60, vol: .09 * v, priority: 0 }); },
  dirt: v => { burst({ dur: .09, f0: 900, f1: 380, q: .7, vol: .09 * v, type: 'lowpass', priority: 0 }); pitch({ dur: .07, f0: 105, f1: 62, vol: .07 * v, priority: 0 }); burst({ dur: .04, f0: 2600, q: .8, vol: .025 * v, priority: 0 }); },
  grass: v => { burst({ dur: .11, f0: 3600, f1: 2100, q: .6, vol: .05 * v, priority: 0 }); burst({ dur: .09, f0: 520, q: .7, vol: .05 * v, type: 'lowpass', priority: 0 }); },
  sand: v => { burst({ dur: .13, f0: 3200, f1: 1500, q: .5, vol: .045 * v, type: 'highpass', priority: 0 }); burst({ dur: .09, f0: 700, q: .6, vol: .045 * v, type: 'lowpass', priority: 0 }); },
  water: v => { burst({ dur: .16, f0: 900, f1: 2200, q: 1.8, vol: .07 * v, priority: 0 }); pitch({ dur: .1, f0: 300, f1: 140, vol: .05 * v, priority: 0 }); burst({ dur: .05, f0: 5200, type: 'highpass', vol: .03 * v, priority: 0 }); },
};

// ---------- shots ----------
const SHOTS = {
  // An air-gun "pfft": crack, body, thump, a hiss of gas and a little room.
  pistol: v => {
    const j = jit(.05);
    burst({ dur: .035, f0: 3800 * j, f1: 2200, type: 'highpass', q: .7, vol: .2 * v, priority: 2 });
    burst({ dur: .09, f0: 1400 * j, f1: 700, q: .9, vol: .24 * v, priority: 2 });
    pitch({ dur: .11, f0: 240 * j, f1: 65, vol: .22 * v, priority: 2 });
    burst({ dur: .14, f0: 6500, q: .6, vol: .05 * v, delay: .02, priority: 1 });
    burst({ dur: .25, f0: 900, q: .8, vol: .03 * v, delay: .06, priority: 0 });
  },
  // A heavy boom, then the pump racking.
  scatter: v => {
    const j = jit(.04);
    burst({ dur: .05, f0: 3000, type: 'highpass', vol: .22 * v, priority: 2 });
    burst({ dur: .18, f0: 800 * j, f1: 300, q: .7, vol: .32 * v, priority: 2 });
    pitch({ dur: .26, f0: 160 * j, f1: 38, type: 'triangle', vol: .3 * v, priority: 2 });
    burst({ dur: .2, f0: 5200, q: .6, vol: .05 * v, delay: .02, priority: 1 });
    if (v > .5) { burst({ dur: .05, f0: 1700, q: 3, vol: .09 * v, delay: .24, priority: 1 }); pitch({ dur: .05, f0: 220, f1: 120, vol: .1 * v, delay: .25, priority: 1 }); burst({ dur: .05, f0: 2300, q: 3, vol: .09 * v, delay: .36, priority: 1 }); }
  },
  // A quick, light "pap" that can repeat without smearing.
  rapid: v => {
    const j = jit(.08);
    burst({ dur: .02, f0: 4400 * j, type: 'highpass', vol: .15 * v, priority: 2 });
    burst({ dur: .05, f0: 2400 * j, f1: 1200, q: 1, vol: .17 * v, priority: 2 });
    pitch({ dur: .06, f0: 320 * j, f1: 110, vol: .12 * v, priority: 2 });
  },
  // A launcher: a deep whump, a rush, a rising whistle.
  rocket: v => {
    burst({ dur: .04, f0: 2500, type: 'highpass', vol: .18 * v, priority: 2 });
    pitch({ dur: .42, f0: 130, f1: 32, type: 'triangle', vol: .3 * v, priority: 2 });
    burst({ dur: .5, f0: 900, f1: 200, q: .6, vol: .3 * v, type: 'lowpass', priority: 2 });
    pitch({ dur: .45, f0: 1100, f1: 300, vol: .05 * v, delay: .03, priority: 1 });
  },
  // Soft thwip for slingshots, darts and toys.
  pellet: v => { burst({ dur: .06, f0: 2200, f1: 900, q: 1.4, vol: .14 * v, priority: 2 }); pitch({ dur: .07, f0: 520, f1: 190, vol: .08 * v, priority: 2 }); },
  // A bright zap for energy toys.
  zap: v => { pitch({ dur: .14, f0: 1600, f1: 260, type: 'sawtooth', vol: .09 * v, priority: 2 }); burst({ dur: .05, f0: 4200, type: 'highpass', vol: .1 * v, priority: 2 }); },
};
const WEAPON_ALIAS = { chispa: 'pistol', trueno: 'scatter', gemelas: 'rapid', coheton: 'rocket', shotgun: 'scatter', smg: 'rapid', launcher: 'rocket' };

// ---------- reloads: a sequence laid out over `dur` seconds ----------
const click = (delay, v = 1, f = 1700) => { pitch({ dur: .02, f0: f, f1: f * .55, type: 'square', vol: .045 * v, delay, priority: 1 }); burst({ dur: .02, f0: 3400, q: 1.5, vol: .06 * v, delay, priority: 1 }); };
const RELOAD = {
  // Tap the hopper, pellets rattle in, the lid latches.
  hopper(dur, v) {
    pitch({ dur: .05, f0: 300, f1: 200, vol: .1 * v, priority: 1 }); burst({ dur: .04, f0: 1800, q: 2, vol: .08 * v, priority: 1 });
    for (let i = 0; i < 6; i++) burst({ dur: .022, f0: rnd(3000, 5200), q: 4, vol: rnd(.03, .06) * v, delay: dur * .14 + i * .034 + rnd(0, .012), priority: 1 });
    click(dur * .58, v, 1500); pitch({ dur: .06, f0: 170, f1: 90, vol: .09 * v, delay: dur * .58, priority: 1 });
    click(dur * .86, v, 2100);
  },
  // Rack the slide back, thumb shells in, slam it forward.
  pump(dur, v) {
    burst({ dur: .1, f0: 1500, f1: 800, q: 3, vol: .08 * v, priority: 1 }); click(.02, v, 1300);
    for (const at of [.3, .46, .6]) { click(dur * at, v, 1000 + at * 500); pitch({ dur: .03, f0: 380, f1: 230, vol: .05 * v, delay: dur * at, priority: 1 }); }
    pitch({ dur: .07, f0: 210, f1: 85, vol: .15 * v, delay: dur * .82, priority: 1 }); burst({ dur: .08, f0: 1200, f1: 600, q: 2.5, vol: .1 * v, delay: dur * .82, priority: 1 }); click(dur * .88, v, 1900);
  },
  // A big tube: a clunk, a heavy slide, a latch.
  tube(dur, v) {
    pitch({ dur: .14, f0: 150, f1: 62, vol: .17 * v, priority: 1 }); burst({ dur: .3, f0: 500, f1: 1400, q: 1.2, vol: .06 * v, type: 'lowpass', delay: dur * .25, priority: 1 });
    pitch({ dur: .12, f0: 120, f1: 55, vol: .18 * v, delay: dur * .7, priority: 1 }); click(dur * .78, v, 1200); click(dur * .9, v, 1900);
  },
  // Drop the mag, slap a new one in.
  magazine(dur, v) {
    click(0, v, 1400); burst({ dur: .08, f0: 900, f1: 500, q: 2, vol: .07 * v, delay: .03, priority: 1 });
    pitch({ dur: .06, f0: 260, f1: 120, vol: .13 * v, delay: dur * .55, priority: 1 }); burst({ dur: .05, f0: 2200, q: 2, vol: .09 * v, delay: dur * .55, priority: 1 }); click(dur * .8, v, 1800);
  },
};
const RELOAD_FOR = { pistol: 'hopper', rapid: 'hopper', scatter: 'pump', rocket: 'tube' };

// ---------- the library ----------
export const sfx = {
  // One footfall. foot (0/1) alternates the pitch; sprint hits harder and quicker.
  step(surface = 'concrete', { sprint = false, volume = 1, foot = 0 } = {}) {
    if (!sound.ctx || sound.muted) return;
    const make = FOOT[surface] || FOOT.concrete, drift = (foot ? .93 : 1.04) * jit(.05);
    // Pitch variation by foot is carried by scaling the level a hair: the recipes fix their own frequencies.
    make(clamp(volume * (sprint ? 1.3 : 1) * drift, 0, 2));
  },
  jump(surface = 'concrete', { volume = 1 } = {}) {
    burst({ dur: .09, f0: 1100, f1: 2300, q: .9, vol: .05 * volume, priority: 0 });
    pitch({ dur: .09, f0: 220, f1: 360, type: 'triangle', vol: .045 * volume, priority: 0 });
    sfx.step(surface, { volume: .65 * volume });
  },
  // power 0..1: how hard (a short hop to a long fall).
  land(surface = 'concrete', { power = .6, volume = 1 } = {}) {
    const p = clamp(power, .15, 1) * volume;
    pitch({ dur: .15, f0: 145, f1: 45, vol: .2 * p, priority: 1 });
    burst({ dur: .09, f0: 430, q: .8, vol: .12 * p, priority: 1 });
    sfx.step(surface, { volume: 1.5 * p });
  },
  shot(kind = 'pistol', { volume = 1 } = {}) {
    if (!sound.ctx || sound.muted) return;
    (SHOTS[WEAPON_ALIAS[kind] || kind] || SHOTS.pistol)(clamp(volume, 0, 1.5));
  },
  // Paint, dust or a hard wall: what a ball or a bullet does when it lands.
  impact(surface = 'paint', { volume = 1 } = {}) {
    const v = clamp(volume, 0, 1.5);
    if (surface === 'paint') {
      burst({ dur: .1, f0: 1400, f1: 500, q: .8, vol: .16 * v, priority: 1 }); pitch({ dur: .08, f0: 380, f1: 120, vol: .08 * v, priority: 1 });
      for (let i = 0; i < 3; i++) burst({ dur: .04, f0: rnd(1800, 2600), q: 2, vol: rnd(.025, .045) * v, delay: .05 + i * .045 + rnd(0, .02), priority: 0 });
    } else if (surface === 'wood') { pitch({ dur: .08, f0: 260, f1: 120, type: 'triangle', vol: .12 * v, priority: 1 }); burst({ dur: .05, f0: 900, q: 2, vol: .09 * v, priority: 1 }); }
    else if (surface === 'metal') { pitch({ dur: .2, f0: 780 * jit(.1), f1: 700, type: 'triangle', vol: .06 * v, priority: 1 }); burst({ dur: .04, f0: 3400, q: 4, vol: .1 * v, priority: 1 }); pitch({ dur: .09, f0: 130, f1: 70, vol: .1 * v, priority: 1 }); }
    else { burst({ dur: .06, f0: 420, q: 1, vol: .14 * v, priority: 1 }); pitch({ dur: .1, f0: 150, f1: 70, vol: .12 * v, priority: 1 }); burst({ dur: .03, f0: 3200, q: 1, vol: .04 * v, delay: .02, priority: 0 }); }
  },
  splat(volume = 1) { sfx.impact('paint', { volume }); },
  // The tick that confirms you hit someone.
  hitConfirm() { pitch({ dur: .04, f0: 1400, type: 'square', vol: .09, priority: 3 }); pitch({ dur: .06, f0: 2100, type: 'square', vol: .08, delay: .04, priority: 3 }); pitch({ dur: .08, f0: 260, f1: 110, vol: .14, priority: 3 }); burst({ dur: .04, f0: 3200, q: 1, vol: .1, priority: 3 }); },
  // You were hit: a wet thump and a short ring.
  hurt({ volume = 1 } = {}) {
    burst({ dur: .22, f0: 520, f1: 220, q: .6, vol: .34 * volume, priority: 3 });
    pitch({ dur: .24, f0: 220, f1: 70, vol: .2 * volume, priority: 3 });
    burst({ dur: .05, f0: 2800, q: 1, vol: .1 * volume, priority: 3 }); pitch({ dur: .3, f0: 880, f1: 840, vol: .018 * volume, delay: .03, priority: 2 });
  },
  // dur: seconds the reload takes, so the clicks land on its beats.
  reload(kind = 'pistol', dur = 1.3, { volume = 1 } = {}) {
    if (!sound.ctx || sound.muted) return;
    (RELOAD[RELOAD_FOR[WEAPON_ALIAS[kind] || kind] || kind] || RELOAD.hopper)(Math.max(.5, dur), volume);
  },
  // Ready again: the final snap.
  reloaded() { click(0, 1.2, 1600); pitch({ dur: .05, f0: 520, type: 'square', vol: .05, delay: .03, priority: 2 }); pitch({ dur: .09, f0: 780, type: 'square', vol: .05, delay: .09, priority: 2 }); },
  // Trigger pulled on nothing.
  dry() { click(0, 1.4, 2000); pitch({ dur: .03, f0: 140, f1: 90, vol: .06, priority: 1 }); },
  // Switching weapons.
  swap() { burst({ dur: .07, f0: 700, f1: 1500, q: 2, vol: .06, priority: 1 }); click(.05, 1, 1500); },
  // A swish: a throw, a swing, a dash.
  swish(volume = 1) { burst({ dur: .2, f0: 500, f1: 2400, q: 1, vol: .1 * volume, priority: 1 }); },
  // UI: a hover tick, a confirm, a back.
  tick(n = 0) { pitch({ dur: .03, f0: 1200 + (n % 12) * 60, type: 'triangle', vol: .05, priority: 1 }); },
  confirm() { pitch({ dur: .06, f0: 660, type: 'triangle', vol: .06, priority: 2 }); pitch({ dur: .1, f0: 990, type: 'triangle', vol: .06, delay: .05, priority: 2 }); },
  back() { pitch({ dur: .06, f0: 520, f1: 380, type: 'triangle', vol: .05, priority: 2 }); },
  // The 3-2-1 beeps and the brighter GO.
  count(n = 1) { pitch({ dur: .14, f0: 660 + (3 - clamp(n, 1, 3)) * 0, type: 'square', vol: .08, priority: 3 }); pitch({ dur: .14, f0: 330, type: 'sine', vol: .08, priority: 3 }); },
  go() { pitch({ dur: .16, f0: 880, type: 'square', vol: .085, priority: 3 }); pitch({ dur: .34, f0: 1320, type: 'square', vol: .085, delay: .1, priority: 3 }); pitch({ dur: .4, f0: 440, type: 'triangle', vol: .09, delay: .1, priority: 3 }); },
};
