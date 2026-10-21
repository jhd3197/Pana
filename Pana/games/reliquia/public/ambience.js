// Reliquia's soundscape, synthesized on the shared context (engine/fx.js): no
// files. Underground every sound runs through a cave reverb and an echo;
// a low rumble and drone fill the silence (thicker as la codicia rises),
// drips, creaks, pebbles and distant moans come and go, footsteps follow
// every pana, and creatures announce themselves in stereo by where they are.
import { sound } from '/engine/fx.js';
import { floorOf } from './deck.js';

export function createAmbience() {
  let graph = null, stepAt = 0, eventIn = 2, cricketIn = 1;
  const steps = new Map(), voices = new Map();

  // Lazily, once audio is unlocked: a split after the game's output into a
  // dry path and a wet cave (convolver + feedback delay).
  function build() {
    const ctx = sound.ctx, master = sound.out();
    const input = ctx.createGain(), wet = ctx.createGain(), verb = ctx.createConvolver(), delay = ctx.createDelay(1), feedback = ctx.createGain(), echo = ctx.createGain();
    const length = ctx.sampleRate * 2.6, impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = impulse.getChannelData(c); for (let i = 0; i < length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3.2); }
    verb.buffer = impulse; delay.delayTime.value = .34; feedback.gain.value = .32; echo.gain.value = .25; wet.gain.value = 0;
    input.connect(master); input.connect(wet); wet.connect(verb).connect(master); wet.connect(delay); delay.connect(feedback).connect(delay); delay.connect(echo).connect(master);
    // Every sound made on this page goes through the cave from now on.
    sound.out = () => input;
    // The bed: brown noise through a low filter, and two detuned drones.
    const noise = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate), n = noise.getChannelData(0);
    let last = 0; for (let i = 0; i < n.length; i++) { last = (last + .02 * (Math.random() * 2 - 1)) / 1.02; n[i] = last * 3.5; }
    const rumble = ctx.createBufferSource(), low = ctx.createBiquadFilter(), bed = ctx.createGain();
    rumble.buffer = noise; rumble.loop = true; low.type = 'lowpass'; low.frequency.value = 280; bed.gain.value = 0;
    rumble.connect(low).connect(bed).connect(input); rumble.start();
    const drone = ctx.createGain(); drone.gain.value = 0; drone.connect(input);
    for (const f of [55, 82.4, 55.6]) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = f; g.gain.value = .33; o.connect(g).connect(drone); o.start(); }
    graph = { ctx, input, wet, bed, drone, noise };
  }

  // A short sound placed in stereo, quieter with distance.
  function voice(make, { pan = 0, gain = 1 } = {}) {
    if (!graph || sound.muted || gain < .02) return;
    const { ctx, input } = graph, panner = ctx.createStereoPanner(), g = ctx.createGain();
    panner.pan.value = Math.max(-1, Math.min(1, pan)); g.gain.value = gain;
    g.connect(panner).connect(input); make(ctx, g, ctx.currentTime);
  }
  const noiseBurst = (ctx, out, t, { dur = .12, freq = 500, q = 1, type = 'lowpass', vol = .3, sweep = 0 } = {}) => {
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = graph.noise; f.type = type; f.frequency.setValueAtTime(freq, t); if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur); f.Q.value = q;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .008); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    src.connect(f).connect(g).connect(out); src.start(t, Math.random() * 3); src.stop(t + dur + .05);
  };
  const osc = (ctx, out, t, { type = 'sine', from = 400, to = from, dur = .2, vol = .2, vibrato = 0 } = {}) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    if (vibrato) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = vibrato; lg.gain.value = from * .04; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur + .05); }
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(.06, dur / 4)); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + .05);
  };
  const SOUNDS = {
    step: (ctx, out, t, deep) => { noiseBurst(ctx, out, t, { dur: .09, freq: deep ? 420 : 900, vol: .5 }); noiseBurst(ctx, out, t + .01, { dur: .03, freq: 2600, type: 'bandpass', q: 2, vol: .12 }); },
    drip: (ctx, out, t) => osc(ctx, out, t, { from: 1800 + Math.random() * 900, to: 600, dur: .12, vol: .14 }),
    creak: (ctx, out, t) => { osc(ctx, out, t, { type: 'sawtooth', from: 90 + Math.random() * 40, to: 140, dur: .9, vol: .05, vibrato: 18 }); },
    pebbles: (ctx, out, t) => { for (let i = 0; i < 6; i++) noiseBurst(ctx, out, t + i * (.05 + Math.random() * .08), { dur: .05, freq: 1400 + Math.random() * 1200, type: 'bandpass', q: 4, vol: .15 }); },
    moan: (ctx, out, t) => osc(ctx, out, t, { type: 'sawtooth', from: 110 + Math.random() * 30, to: 75, dur: 2.2, vol: .045, vibrato: 5 }),
    whisper: (ctx, out, t) => noiseBurst(ctx, out, t, { dur: 1.4, freq: 1800 + Math.random() * 800, type: 'bandpass', q: 9, vol: .06, sweep: .5 }),
    bird: (ctx, out, t) => { for (let i = 0; i < 3; i++) osc(ctx, out, t + i * .11, { from: 2400 + Math.random() * 700, to: 3300, dur: .08, vol: .05 }); },
    cicada: (ctx, out, t) => noiseBurst(ctx, out, t, { dur: 1.2, freq: 5200, type: 'bandpass', q: 14, vol: .03 }),
    groan: (ctx, out, t) => osc(ctx, out, t, { type: 'sawtooth', from: 130 + Math.random() * 40, to: 90, dur: 1.1, vol: .09, vibrato: 7 }),
    skitter: (ctx, out, t) => { for (let i = 0; i < 8; i++) noiseBurst(ctx, out, t + i * .035, { dur: .02, freq: 3800, type: 'bandpass', q: 6, vol: .1 }); },
    hiss: (ctx, out, t) => noiseBurst(ctx, out, t, { dur: .8, freq: 5000, type: 'highpass', vol: .12 }),
    screech: (ctx, out, t) => osc(ctx, out, t, { type: 'square', from: 2600, to: 1500, dur: .14, vol: .05 }),
    growl: (ctx, out, t) => osc(ctx, out, t, { type: 'sawtooth', from: 70, to: 55, dur: 1.2, vol: .14, vibrato: 22 }),
    roar: (ctx, out, t) => { osc(ctx, out, t, { type: 'sawtooth', from: 160, to: 60, dur: 1, vol: .2, vibrato: 30 }); noiseBurst(ctx, out, t, { dur: .8, freq: 900, vol: .2, sweep: .3 }); },
    heartbeat: (ctx, out, t) => { osc(ctx, out, t, { from: 60, to: 40, dur: .16, vol: .25 }); osc(ctx, out, t + .22, { from: 55, to: 38, dur: .18, vol: .2 }); },
  };
  // Pan and loudness of a point seen from a pana looking along `heading`.
  function place(me, heading, x, z, range = 18) {
    const dx = x - me.x, dz = z - me.z, d = Math.hypot(dx, dz);
    const right = (dx * -Math.cos(heading) + dz * Math.sin(heading)) / (d || 1);
    return { pan: right * .8, gain: Math.max(0, 1 - d / range) ** 1.4, d };
  }
  const play = (name, at, extra) => voice((ctx, out, t) => SOUNDS[name](ctx, out, t, extra), at);

  function update(state, me, heading, dt) {
    if (!sound.ctx) return;
    if (!graph) build();
    const playing = state.phase === 'playing' && me && !sound.muted, deep = playing && floorOf(me.x) > 0, tier = Math.min(4, Math.floor((state.codicia || 0) / 25)), now = graph.ctx.currentTime;
    graph.wet.gain.setTargetAtTime(deep ? .55 : .06, now, .4);
    graph.bed.gain.setTargetAtTime(deep ? .05 + tier * .015 : 0, now, .8);
    graph.drone.gain.setTargetAtTime(deep ? .012 + tier * .01 : 0, now, 1.2);
    if (!playing) return;
    // Footsteps: yours on your stride, others' from where they walk.
    for (const p of state.players) {
      const self = p.id === me.id, body = self ? me : p;
      if (!body.moving || p.downed || p.riding || floorOf(p.x) !== floorOf(me.x)) { steps.delete(p.id); continue; }
      const fast = Math.hypot(body.vx || 0, body.vz || 0) > 5.5, interval = fast ? .3 : .42;
      const left = (steps.get(p.id) ?? interval * Math.random()) - dt;
      if (left <= 0) { const at = self ? { pan: 0, gain: .5 } : place(me, heading, p.x, p.z, 16); play('step', at, deep); steps.set(p.id, interval); }
      else steps.set(p.id, left);
    }
    // Creatures make themselves heard, each on its own clock.
    for (const e of state.enemies) {
      if (floorOf(e.x) !== floorOf(me.x) || e.hp <= 0) continue;
      const at = place(me, heading, e.x, e.z, e.kind === 'jaguar' || e.kind === 'stalker' ? 26 : 16);
      if (at.gain <= .02) continue;
      const v = voices.get(e.id) || { next: 1 + Math.random() * 3, mode: e.mode }; voices.set(e.id, v);
      if ((e.kind === 'jaguar' || e.kind === 'stalker') && e.mode === 'leap' && v.mode !== 'leap') play('roar', at);
      v.mode = e.mode; v.next -= dt;
      if (v.next > 0) continue;
      const sounds = { mummy: ['groan', 4, 8], guardian: ['groan', 3, 5], phantom: ['whisper', 3, 6], spider: ['skitter', .8, 2], snake: ['hiss', 2.5, 5], bat: ['screech', .6, 1.6], jaguar: ['growl', 2.5, 4], stalker: ['growl', 2, 4] }[e.kind];
      if (!sounds || (e.kind === 'spider' && e.hanging) || (e.kind === 'mummy' && !e.awake)) { v.next = 1; continue; }
      play(sounds[0], { ...at, gain: at.gain * (e.kind === 'guardian' ? 1.4 : 1) });
      v.next = sounds[1] + Math.random() * (sounds[2] - sounds[1]);
    }
    for (const id of voices.keys()) if (!state.enemies.some(e => e.id === id)) voices.delete(id);
    // Room tone: drips and creaks below, birds and cicadas at the camp.
    eventIn -= dt;
    if (eventIn <= 0) {
      const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 12, at = place(me, heading, me.x + Math.cos(a) * r, me.z + Math.sin(a) * r, 20);
      if (deep) { const pick = Math.random(), name = pick < .4 ? 'drip' : pick < .6 ? 'pebbles' : pick < .78 ? 'creak' : pick < .92 ? 'moan' : 'whisper'; play(name, { ...at, gain: at.gain * (name === 'drip' ? 1 : .8) }); eventIn = (2 + Math.random() * 5) * (1 - tier * .12); }
      else { play('bird', { ...at, gain: .6 }); eventIn = 2 + Math.random() * 4; }
    }
    if (!deep) { cricketIn -= dt; if (cricketIn <= 0) { play('cicada', { pan: Math.random() - .5, gain: .5 }); cricketIn = 1.5 + Math.random() * 2; } }
    // Late in la codicia your own heartbeat joins in.
    stepAt -= dt;
    if (deep && tier >= 3 && stepAt <= 0) { play('heartbeat', { gain: .35 + (tier - 3) * .25 }); stepAt = tier >= 4 ? .7 : 1.05; }
  }
  return { update };
}
