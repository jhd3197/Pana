// The shared vehicle sound: a motor driven by RPM and load (with a gearbox, so
// the revs climb, drop at each shift and fall on the overrun), a tyre loop
// that squeals on tarmac and crunches on dirt, and the one-shots: skid chirp,
// boost, crash. Synthesised on engine/fx.js `sound`, no files.
//
//   import { createMotor, createTyres, vehicleSfx } from '/engine/vehicle-audio.js';
//   const motor = createMotor(sound, { profile: 'sport', topSpeed: 42 });
//   motor.update(dt, { speed, boost: car.boost > 0 });     // every frame
//   motor.stop();                                          // on teardown
//
// Profiles: compact, sport, muscle, truck, beetle, bus, boat (see PROFILES).
import { burst, pitch, sharedNoise } from './sfx.js';
import { PROFILES, stepRevs } from './vehicle-revs.js';
export { PROFILES, stepRevs };

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);

function curve(k) { const c = new Float32Array(1024); for (let i = 0; i < c.length; i++) { const x = i / 512 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); } return c; }

export function createMotor(sound, { profile = 'compact', topSpeed = 40, level = 1 } = {}) {
  const ctx = sound.ctx;
  if (!ctx) return { update() {}, stop() {}, setProfile() {}, state: null };
  const P0 = PROFILES[profile] || PROFILES.compact;
  let P = P0;
  const state = { gear: 1, rpm: P.idle, rpmN: 0, load: 0, cut: 0, shifted: 0 };
  const out = ctx.createGain(); out.gain.value = 0;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4;
  out.connect(comp).connect(sound.out());

  const osc = (type, g = 0) => { const o = ctx.createOscillator(); o.type = type; const gn = ctx.createGain(); gn.gain.value = g; o.connect(gn); o.start(); return [o, gn]; };
  const [saw, sawG] = osc('sawtooth'), shaper = ctx.createWaveShaper(), lp = ctx.createBiquadFilter();
  shaper.curve = curve(P.grit); lp.type = 'lowpass'; lp.Q.value = 1.2;
  sawG.disconnect(); sawG.connect(shaper).connect(lp).connect(out);
  const [sq, sqG] = osc('square'), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = .9;
  sqG.disconnect(); sqG.connect(bp).connect(out);
  const [sub, subG] = osc('sine'); subG.connect(out);
  const [tw, twG] = osc('sine'); twG.connect(out);
  const noise = (type, freq, q) => { const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = sharedNoise(); s.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = 0; s.connect(f).connect(g).connect(out); s.start(0, rnd(0, 1.5)); return [s, f, g]; };
  const [nIn, nInF, nInG] = noise('bandpass', 800, .8), [nRu, nRuF, nRuG] = noise('lowpass', 180, .7);
  // The wobble of an uneven idle: a slow LFO on the pitch of the firing layers.
  const lfo = ctx.createOscillator(), lfoG = ctx.createGain(); lfo.frequency.value = 7; lfo.connect(lfoG); lfoG.connect(saw.detune); lfoG.connect(sq.detune); lfo.start();

  let last = 0, lastThr = 0, boostWas = false, alive = true;
  const nodes = [saw, sq, sub, tw, nIn, nRu, lfo];
  return {
    state,
    setProfile(name) { P = PROFILES[name] || P; shaper.curve = curve(P.grit); },
    // speed in game units; throttle 0..1 (estimated from acceleration when omitted); boost: bool or 0..1.
    update(dt, { speed = 0, throttle, boost = false, active = true } = {}) {
      if (!alive) return;
      const t = ctx.currentTime;
      if (!active || sound.muted) { out.gain.setTargetAtTime(0, t, .08); return; }
      dt = clamp(dt, .001, .1);
      const sp = Math.abs(speed);
      const thr = clamp(throttle ?? ((sp - last) / dt / 7 + (sp > 1 ? .2 : 0)), 0, 1);
      last = sp;
      stepRevs(state, dt, { speed, throttle: thr, topSpeed, profile: P });
      const { rpmN, load } = state, rpm = state.rpm;
      const f = Math.max(18, rpm / 60 * (P.cyl / 2) * P.pitch);
      const set = (p, v, tc = .035) => p.setTargetAtTime(v, t, tc);
      set(saw.frequency, f); set(sq.frequency, f * 2.005); set(sub.frequency, f * .5);
      set(lp.frequency, 260 + rpmN * 1500 + load * 1000);
      set(bp.frequency, 700 + rpmN * 1700);
      set(sawG.gain, .5 * (.3 + .7 * load));
      set(sqG.gain, P.rasp * .35 * load * (.3 + .7 * rpmN));
      set(subG.gain, P.body * .42 * (.85 - .3 * rpmN));
      set(nInF.frequency, 500 + rpmN * 2400); set(nInG.gain, P.intake * .12 * (.12 + load * rpmN));
      set(nRuF.frequency, 140 + rpmN * 260); set(nRuG.gain, P.rumble * .22 * (.45 + .3 * load));
      set(lfoG.gain, P.lope * 28 * (1 - rpmN) * (1 - rpmN)); set(lfo.frequency, 5 + rpmN * 9);
      const b = P.turbo ? clamp(+boost || 0) : 0;
      set(tw.frequency, 1700 + rpmN * 3200, .08); set(twG.gain, b * .04 + P.turbo * load * rpmN * .012, .12);
      set(out.gain, .16 * level, .05);
      // Overrun crackle when the throttle is lifted at high revs; a blow-off when the boost ends.
      if (P.pops && lastThr > .6 && thr < .15 && rpmN > .55) for (let i = 0; i < 2 + P.pops * 3; i++) burst({ dur: .035, f0: rnd(1200, 2600), q: 2.5, vol: rnd(.05, .11) * P.pops, delay: .03 + i * rnd(.05, .11), priority: 1 });
      if (P.turbo && boostWas && !b) { burst({ dur: .35, f0: 5200, f1: 2800, q: .9, vol: .12, priority: 1 }); pitch({ dur: .3, f0: 2600, f1: 900, vol: .03, priority: 1 }); }
      if (state.shifted) { state.shifted = 0; burst({ dur: .05, f0: 1600, q: 1.5, vol: .05, priority: 1 }); }
      lastThr = thr; boostWas = b > 0;
    },
    stop() { if (!alive) return; alive = false; const t = ctx.currentTime; out.gain.setTargetAtTime(0, t, .05); setTimeout(() => { for (const n of nodes) try { n.stop(); } catch { /* already stopped */ } out.disconnect(); }, 400); },
  };
}

// The tyre loop: a high squeal and a low scrub on tarmac, a gravel crunch on dirt.
export function createTyres(sound, { level = 1 } = {}) {
  const ctx = sound.ctx;
  if (!ctx) return { update() {}, stop() {} };
  const out = ctx.createGain(); out.gain.value = 0; out.connect(sound.out());
  const loop = (type, freq, q) => { const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = sharedNoise(); s.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = 0; s.connect(f).connect(g).connect(out); s.start(0, rnd(0, 1.5)); return [s, f, g]; };
  const [a, aF, aG] = loop('bandpass', 1500, 6), [b, bF, bG] = loop('bandpass', 2900, 8), [sc, scF, scG] = loop('lowpass', 700, .8), [gr, grF, grG] = loop('highpass', 3500, .5);
  let alive = true;
  return {
    // slip 0..1, level 0..3 (the drift charge), surface: road | dirt | grass | sand.
    update({ slip = 0, speed = 0, charge = 0, surface = 'road' } = {}) {
      if (!alive) return;
      const t = ctx.currentTime, s = sound.muted ? 0 : clamp(slip), loose = surface === 'road' ? 0 : 1;
      const set = (p, v, tc = .04) => p.setTargetAtTime(v, t, tc);
      const wob = 1 + rnd(-.035, .035);
      set(aF.frequency, (1150 + speed * 18 + charge * 260) * wob); set(bF.frequency, (2300 + speed * 30 + charge * 340) * (2 - wob));
      set(aG.gain, s * (.07 + charge * .018) * (loose ? .2 : 1)); set(bG.gain, s * .05 * (loose ? .15 : 1));
      set(scG.gain, s * (.07 + loose * .08)); set(scF.frequency, 500 + speed * 12);
      set(grG.gain, s * loose * .06); set(grF.frequency, 3200 + speed * 10);
      set(out.gain, s > .02 ? level : 0, .05);
    },
    stop() { if (!alive) return; alive = false; out.gain.setTargetAtTime(0, ctx.currentTime, .04); setTimeout(() => { for (const n of [a, b, sc, gr]) try { n.stop(); } catch { /* already stopped */ } out.disconnect(); }, 300); },
  };
}

// One-shots. power: roughly the old bonk() argument (0.4 a bump, 1 a hit, 1.5+ a smash).
export const vehicleSfx = {
  skid(power = 1) { const p = clamp(power, .2, 1.4); burst({ dur: .24, f0: 1950, f1: 1300, q: 5, vol: .22 * p, priority: 2 }); burst({ dur: .22, f0: 3600, f1: 2600, q: 3, vol: .1 * p, priority: 2 }); burst({ dur: .26, f0: 650, q: .7, type: 'lowpass', vol: .16 * p, priority: 1 }); },
  boost(power = 1) {
    const p = clamp(power, .3, 1.4);
    pitch({ dur: .22, f0: 170, f1: 48, vol: .22 * p, priority: 3 }); burst({ dur: .05, f0: 3000, type: 'highpass', vol: .12 * p, priority: 3 });
    burst({ dur: .65, f0: 500, f1: 3400, q: 1.1, vol: .17 * p, priority: 3 }); pitch({ dur: .6, f0: 320, f1: 1150, type: 'sawtooth', vol: .05 * p, priority: 2 });
    burst({ dur: .4, f0: 6000, f1: 3000, q: .8, vol: .08 * p, delay: .08, priority: 1 });
  },
  crash(power = 1, kind = 'wall') {
    const p = clamp(power, .15, 1.8);
    if (kind === 'bump' || p < .5) { pitch({ dur: .14, f0: 130, f1: 55, vol: .18 * p, priority: 2 }); burst({ dur: .07, f0: 600, q: .8, vol: .13 * p, priority: 2 }); return; }
    pitch({ dur: .36, f0: 115, f1: 36, vol: .3 * p, priority: 3 });
    burst({ dur: .3, f0: 950, f1: 280, q: .7, vol: .3 * p, priority: 3 });
    burst({ dur: .04, f0: 3500, type: 'highpass', vol: .15 * p, priority: 3 });
    if (kind === 'prop') { pitch({ dur: .09, f0: 280, f1: 130, type: 'triangle', vol: .12 * p, delay: .02, priority: 2 }); burst({ dur: .16, f0: 700, q: 1.2, vol: .12 * p, delay: .03, priority: 2 }); return; }
    pitch({ dur: .3, f0: 430, f1: 405, type: 'square', vol: .045 * p, priority: 2 }); pitch({ dur: .26, f0: 617, f1: 590, type: 'square', vol: .035 * p, delay: .01, priority: 2 });
    burst({ dur: .4, f0: 1800, f1: 600, q: 1.5, vol: .1 * p, delay: .05, priority: 2 });
    if (p > .8) for (let i = 0; i < 4; i++) burst({ dur: .03, f0: rnd(6000, 9000), type: 'highpass', vol: rnd(.03, .06) * p, delay: .06 + i * rnd(.04, .08), priority: 0 });
  },
};
