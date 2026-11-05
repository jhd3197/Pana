// Reliquia's soundscape, synthesized on the shared context (engine/fx.js): no
// files. Underground every sound runs through a cave reverb and an echo;
// a low rumble and drone fill the silence (thicker as la codicia rises),
// drips, creaks, pebbles and distant moans come and go, footsteps follow
// every pana, and creatures announce themselves in stereo by where they are.
// The buried library has its own room tone: boards that creak under every
// step, long timber groans, pages turning, a book falling somewhere, a
// clock that ticks and stops, wind through broken windows and whispers.
// The camp's cavern breathes on the lake: a low draft, drops on its puddles, the far
// roar of its falls and, under the Sustos setting, far metal and a whistle from below.
// eerie() plays the scare layers for eerie-fx.js: stingers, swells, slams,
// breath on your neck. No music, no files.
import { sound } from '/engine/fx.js';
import { scareSound } from '/engine/eerie.js';
import { floorOf } from './deck.js';
import { peekCueDue } from './silbon.js';
import { DRIPS, dripLands } from './camp-cave.js';
import { roarFor } from './options.js';

export function createAmbience() {
  let graph = null, near = 0, fireLevel = 0, stepAt = 0, eventIn = 2, clockIn = 6, ticks = 0;
  const steps = new Map(), voices = new Map(), peeks = new Map();

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
    // The library's wind: band-passed noise breathing through a slow LFO.
    const gust = ctx.createBufferSource(), band = ctx.createBiquadFilter(), wind = ctx.createGain(), lfo = ctx.createOscillator(), depth = ctx.createGain(), swell = ctx.createGain();
    gust.buffer = noise; gust.loop = true; band.type = 'bandpass'; band.frequency.value = 520; band.Q.value = 1.6; wind.gain.value = 0; swell.gain.value = .5;
    lfo.frequency.value = .09; depth.gain.value = .45; lfo.connect(depth).connect(swell.gain);
    gust.connect(band).connect(swell).connect(wind).connect(input); gust.start(); lfo.start();
    // The falls, far across the lake: the same noise, narrowed to a steady far-off roar.
    const falls = ctx.createBufferSource(), high = ctx.createBiquadFilter(), body = ctx.createBiquadFilter(), roar = ctx.createGain();
    falls.buffer = noise; falls.loop = true; falls.playbackRate.value = 1.6; high.type = 'highpass'; high.frequency.value = 170; body.type = 'lowpass'; body.frequency.value = 620; roar.gain.value = 0;
    falls.connect(high).connect(body).connect(roar).connect(input); falls.start();
    // A fire close by: a soft roar, warmer and lower than the falls, under its crackles.
    const flames = ctx.createBufferSource(), flameBand = ctx.createBiquadFilter(), fireRoar = ctx.createGain();
    flames.buffer = noise; flames.loop = true; flames.playbackRate.value = 2.2; flameBand.type = 'bandpass'; flameBand.frequency.value = 340; flameBand.Q.value = .5; fireRoar.gain.value = 0;
    flames.connect(flameBand).connect(fireRoar).connect(input); flames.start();
    graph = { ctx, input, wet, bed, drone, noise, wind, roar, fireRoar };
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
    // The camp's cavern: the rock settling far off, and iron somewhere below.
    rumble: (ctx, out, t) => { noiseBurst(ctx, out, t, { dur: 3.4, freq: 90, vol: .55, sweep: 1.7 }); osc(ctx, out, t + .2, { from: 42, to: 31, dur: 2.8, vol: .12 }); },
    clank: (ctx, out, t) => { for (const f of [410, 1130, 1870]) osc(ctx, out, t, { type: 'triangle', from: f, to: f * .985, dur: .5 + Math.random() * .4, vol: .05 }); noiseBurst(ctx, out, t, { dur: .05, freq: 2400, type: 'bandpass', q: 3, vol: .18 }); },
    scrape: (ctx, out, t) => { noiseBurst(ctx, out, t, { dur: 1.5, freq: 760, type: 'bandpass', q: 7, vol: .2, sweep: 1.5 }); osc(ctx, out, t, { type: 'sawtooth', from: 150, to: 205, dur: 1.5, vol: .025, vibrato: 21 }); },
    groan: (ctx, out, t) => osc(ctx, out, t, { type: 'sawtooth', from: 130 + Math.random() * 40, to: 90, dur: 1.1, vol: .09, vibrato: 7 }),
    skitter: (ctx, out, t) => { for (let i = 0; i < 8; i++) noiseBurst(ctx, out, t + i * .035, { dur: .02, freq: 3800, type: 'bandpass', q: 6, vol: .1 }); },
    hiss: (ctx, out, t) => noiseBurst(ctx, out, t, { dur: .8, freq: 5000, type: 'highpass', vol: .12 }),
    // The swarm: a hiss that swells out of the walls with a dry rattle under it...
    swarmHiss: (ctx, out, t) => { noiseBurst(ctx, out, t, { dur: 2.2, freq: 2600, type: 'bandpass', q: 1.4, vol: .3, sweep: 2.6 }); noiseBurst(ctx, out, t + .3, { dur: 1.9, freq: 6200, type: 'highpass', vol: .1, sweep: 1.2 }); for (let i = 0; i < 16; i++) noiseBurst(ctx, out, t + .2 + i * (.09 + Math.random() * .05), { dur: .035, freq: 3400 + Math.random() * 1800, type: 'bandpass', q: 7, vol: .1 + i * .008 }); osc(ctx, out, t, { type: 'sawtooth', from: 58, to: 74, dur: 2.2, vol: .05, vibrato: 19 }); },
    // ...and one snake close by: a short, wet breath of it.
    slither: (ctx, out, t) => { noiseBurst(ctx, out, t, { dur: .32 + Math.random() * .3, freq: 3600 + Math.random() * 1800, type: 'bandpass', q: 2.2, vol: .14, sweep: .75 }); for (let i = 0; i < 4; i++) noiseBurst(ctx, out, t + i * .05, { dur: .02, freq: 5200, type: 'bandpass', q: 9, vol: .04 }); },
    // Bats: a thin high squeak and the soft leathery beat of wings.
    squeak: (ctx, out, t) => { const n = 1 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) osc(ctx, out, t + i * .09, { from: 5200 + Math.random() * 1400, to: 3600 + Math.random() * 800, dur: .05 + Math.random() * .03, vol: .035 }); },
    flutter: (ctx, out, t) => { const n = 5 + Math.floor(Math.random() * 5); for (let i = 0; i < n; i++) noiseBurst(ctx, out, t + i * (.055 + Math.random() * .03), { dur: .05, freq: 620 + Math.random() * 260, type: 'bandpass', q: .8, vol: .1 }); },
    screech: (ctx, out, t) => { osc(ctx, out, t, { type: 'square', from: 6200, to: 3400, dur: .22, vol: .05 }); osc(ctx, out, t + .05, { type: 'sawtooth', from: 4800, to: 2600, dur: .28, vol: .03 }); for (let i = 0; i < 7; i++) noiseBurst(ctx, out, t + .1 + i * .06, { dur: .05, freq: 700, type: 'bandpass', q: .8, vol: .1 }); },
    // El Silbón: its whistle falls slowly, the way the story tells it.
    whistle: (ctx, out, t) => { osc(ctx, out, t, { from: 1180, to: 1320, dur: .5, vol: .05, vibrato: 5 }); osc(ctx, out, t + .46, { from: 1320, to: 720, dur: 1.1, vol: .055, vibrato: 7 }); },
    // El Mokele: a foot coming down under water, a wave of it being pushed aside, and its call.
    footfall: (ctx, out, t) => { osc(ctx, out, t, { from: 74, to: 34, dur: .46, vol: .62 }); osc(ctx, out, t, { type: 'triangle', from: 120, to: 62, dur: .2, vol: .26 }); noiseBurst(ctx, out, t + .01, { dur: .42, freq: 300, vol: .42, sweep: .4 }); },
    wake: (ctx, out, t) => { noiseBurst(ctx, out, t, { dur: 1.5, freq: 520, q: .7, vol: .34, sweep: 2.1 }); noiseBurst(ctx, out, t + .4, { dur: 1.1, freq: 1100, type: 'bandpass', q: 1, vol: .14, sweep: .5 }); },
    bellow: (ctx, out, t) => { osc(ctx, out, t, { type: 'sawtooth', from: 62, to: 96, dur: 1.1, vol: .3, vibrato: 7 }); osc(ctx, out, t + .9, { type: 'sawtooth', from: 96, to: 44, dur: 2, vol: .3, vibrato: 11 }); osc(ctx, out, t, { from: 40, to: 34, dur: 3, vol: .45 }); },
    frog: (ctx, out, t) => { for (let i = 0, n = 2 + Math.floor(Math.random() * 3); i < n; i++) osc(ctx, out, t + i * .22, { type: 'square', from: 210 + Math.random() * 60, to: 130, dur: .14, vol: .035 }); },
    insects: (ctx, out, t) => { for (let i = 0; i < 9; i++) osc(ctx, out, t + i * .09, { from: 4200 + Math.random() * 300, dur: .05, vol: .012 }); },
    // About to look into a nook: stone scraping, then two wet sniffs. Unlike anything else down here.
    peek: (ctx, out, t) => { noiseBurst(ctx, out, t, { dur: .42, freq: 420, type: 'bandpass', q: 3.5, vol: .5, sweep: 1.6 }); osc(ctx, out, t, { type: 'sawtooth', from: 62, to: 92, dur: .42, vol: .1, vibrato: 26 }); for (const at of [.34, .52]) noiseBurst(ctx, out, t + at, { dur: .14, freq: 1500, type: 'bandpass', q: 1.4, vol: .4, sweep: 2.2 }); },
    plummet: (ctx, out, t) => { osc(ctx, out, t, { from: 900, to: 90, dur: 1.3, vol: .09 }); osc(ctx, out, t, { type: 'sawtooth', from: 240, to: 45, dur: 1.3, vol: .06 }); noiseBurst(ctx, out, t + 1.3, { dur: .7, freq: 130, vol: .8 }); },
    growl: (ctx, out, t) => osc(ctx, out, t, { type: 'sawtooth', from: 70, to: 55, dur: 1.2, vol: .14, vibrato: 22 }),
    roar: (ctx, out, t) => { osc(ctx, out, t, { type: 'sawtooth', from: 160, to: 60, dur: 1, vol: .2, vibrato: 30 }); noiseBurst(ctx, out, t, { dur: .8, freq: 900, vol: .2, sweep: .3 }); },
    heartbeat: (ctx, out, t) => { osc(ctx, out, t, { from: 60, to: 40, dur: .16, vol: .25 }); osc(ctx, out, t + .22, { from: 55, to: 38, dur: .18, vol: .2 }); },
    // A log popping: a dry tick or two, high and short.
    crackle: (ctx, out, t) => { for (let i = 0, n = 1 + Math.floor(Math.random() * 3); i < n; i++) noiseBurst(ctx, out, t + i * (.03 + Math.random() * .05), { dur: .02 + Math.random() * .025, freq: 2200 + Math.random() * 3200, type: 'bandpass', q: 2.5, vol: .22 }); },
    // A cave-in giving way: a dry tok on each blow, a crunch when it splits, a fall of stone at the end.
    tok: (ctx, out, t) => { noiseBurst(ctx, out, t, { dur: .05, freq: 1500 + Math.random() * 700, type: 'bandpass', q: 3, vol: .42 }); osc(ctx, out, t, { type: 'triangle', from: 300, to: 150, dur: .07, vol: .16 }); },
    crunch: (ctx, out, t) => { for (let i = 0; i < 4; i++) noiseBurst(ctx, out, t + i * .035, { dur: .09, freq: 650 + Math.random() * 900, type: 'bandpass', q: 1.4, vol: .4 }); osc(ctx, out, t, { type: 'triangle', from: 130, to: 62, dur: .22, vol: .18 }); },
    rockfall: (ctx, out, t) => { noiseBurst(ctx, out, t, { dur: .5, freq: 340, vol: .55, sweep: .5 }); osc(ctx, out, t, { from: 92, to: 42, dur: .4, vol: .26 }); for (let i = 0; i < 7; i++) noiseBurst(ctx, out, t + .12 + i * (.05 + Math.random() * .08), { dur: .05, freq: 900 + Math.random() * 1400, type: 'bandpass', q: 2.4, vol: .2 }); },
    // ---- The library ----
    // A board under a foot: a dull knock and, sometimes, a short squeal.
    board: (ctx, out, t, squeal) => { noiseBurst(ctx, out, t, { dur: .08, freq: 380, vol: .45 }); osc(ctx, out, t, { type: 'triangle', from: 150, to: 95, dur: .09, vol: .12 }); if (squeal) osc(ctx, out, t + .03, { type: 'sawtooth', from: 260 + Math.random() * 120, to: 180 + Math.random() * 80, dur: .35 + Math.random() * .3, vol: .035, vibrato: 30 }); },
    // Old timber settling: a long, slow groan with a rasp.
    timber: (ctx, out, t) => { osc(ctx, out, t, { type: 'sawtooth', from: 70 + Math.random() * 30, to: 110 + Math.random() * 60, dur: 1.8, vol: .05, vibrato: 11 }); noiseBurst(ctx, out, t + .2, { dur: 1.2, freq: 900, type: 'bandpass', q: 6, vol: .03, sweep: 1.6 }); },
    pages: (ctx, out, t) => { for (let i = 0; i < 4; i++) noiseBurst(ctx, out, t + i * (.07 + Math.random() * .09), { dur: .12, freq: 3000 + Math.random() * 2500, type: 'bandpass', q: 1.2, vol: .07, sweep: .6 }); },
    book: (ctx, out, t) => { noiseBurst(ctx, out, t, { dur: .18, freq: 260, vol: .5 }); osc(ctx, out, t, { from: 110, to: 55, dur: .2, vol: .2 }); noiseBurst(ctx, out, t + .12, { dur: .1, freq: 220, vol: .2 }); },
    tick: (ctx, out, t, tock) => { osc(ctx, out, t, { type: 'square', from: tock ? 1500 : 1900, to: tock ? 1300 : 1700, dur: .03, vol: .03 }); noiseBurst(ctx, out, t, { dur: .02, freq: 4000, type: 'bandpass', q: 5, vol: .04 }); },
    wind: (ctx, out, t) => { noiseBurst(ctx, out, t, { dur: 2.6, freq: 700, type: 'bandpass', q: 3, vol: .09, sweep: 1.8 }); osc(ctx, out, t + .4, { from: 820 + Math.random() * 200, to: 640, dur: 1.8, vol: .015, vibrato: 4 }); },
    // ---- Scares (eerie-fx.js) ----
    // A sharp stinger: a dissonant cluster that hits at once, a scrape on top.
    stinger: (ctx, out, t, v = 1) => { for (const f of [311, 330, 466, 622, 659]) osc(ctx, out, t, { type: 'sawtooth', from: f, to: f * .97, dur: 1.4, vol: .05 * v }); noiseBurst(ctx, out, t, { dur: .5, freq: 3200, type: 'highpass', vol: .25 * v }); osc(ctx, out, t, { from: 90, to: 35, dur: .9, vol: .35 * v }); },
    // A sub-bass swell you feel more than hear.
    sub: (ctx, out, t, v = 1) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(34, t); o.frequency.linearRampToValueAtTime(44, t + 3); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.32 * v, t + 2.4); g.gain.linearRampToValueAtTime(0, t + 3.4); o.connect(g).connect(out); o.start(t); o.stop(t + 3.5); },
    // A reversed swell: noise that grows and cuts off dead.
    reverse: (ctx, out, t, v = 1) => { const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); src.buffer = graph.noise; f.type = 'bandpass'; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2400, t + 1.6); f.Q.value = 2; g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.22 * v, t + 1.6); g.gain.setValueAtTime(0, t + 1.62); src.connect(f).connect(g).connect(out); src.start(t, Math.random() * 2); src.stop(t + 1.7); },
    // A heavy door or case slamming somewhere behind you.
    slam: (ctx, out, t) => { noiseBurst(ctx, out, t, { dur: .5, freq: 180, vol: .9 }); osc(ctx, out, t, { from: 70, to: 40, dur: .5, vol: .4 }); noiseBurst(ctx, out, t + .03, { dur: .15, freq: 1400, type: 'bandpass', q: 2, vol: .2 }); },
    // Something heavy falls in the next room.
    thud: (ctx, out, t) => { noiseBurst(ctx, out, t, { dur: .7, freq: 140, vol: .8 }); osc(ctx, out, t, { from: 55, to: 30, dur: .6, vol: .3 }); for (let i = 0; i < 4; i++) noiseBurst(ctx, out, t + .2 + i * .09, { dur: .06, freq: 600 + Math.random() * 600, type: 'bandpass', q: 3, vol: .12 }); },
    // Breathing right at your neck: two slow, close, filtered breaths.
    breath: (ctx, out, t) => { for (let i = 0; i < 2; i++) { noiseBurst(ctx, out, t + i * 1.3, { dur: .9, freq: 900, type: 'bandpass', q: 1.5, vol: .16, sweep: .7 }); noiseBurst(ctx, out, t + i * 1.3 + .55, { dur: .6, freq: 600, type: 'bandpass', q: 1.2, vol: .1, sweep: 1.3 }); } },
    whisperNear: (ctx, out, t) => { for (let i = 0; i < 5; i++) noiseBurst(ctx, out, t + i * .22, { dur: .3, freq: 2200 + Math.random() * 1600, type: 'bandpass', q: 12, vol: .09 }); },
    // A flame guttering / blown out: a soft whoosh.
    gutter: (ctx, out, t) => noiseBurst(ctx, out, t, { dur: .45, freq: 600, type: 'bandpass', q: .8, vol: .18, sweep: .4 }),
  };
  // Pan and loudness of a point seen from a pana looking along `heading`.
  function place(me, heading, x, z, range = 18) {
    const dx = x - me.x, dz = z - me.z, d = Math.hypot(dx, dz);
    const right = (dx * -Math.cos(heading) + dz * Math.sin(heading)) / (d || 1);
    return { pan: right * .8, gain: Math.max(0, 1 - d / range) ** 1.4, d };
  }
  const play = (name, at, extra) => voice((ctx, out, t) => SOUNDS[name](ctx, out, t, extra), at);

  // ownSteps false: your own feet are played elsewhere (recorded steps in samples.js).
  function update(state, me, heading, dt, theme = 'mina', ownSteps = true, scares = 'normal') {
    if (!sound.ctx) return;
    if (!graph) build();
    const playing = state.phase === 'playing' && me && !sound.muted, deep = playing && floorOf(me.x) > 0, cave = playing && !deep, tier = Math.min(4, Math.floor((state.codicia || 0) / 25)), now = graph.ctx.currentTime;
    const library = deep && theme === 'biblioteca';
    graph.wet.gain.setTargetAtTime(deep ? library ? .42 : theme === 'congo' ? .24 : .55 : cave ? .4 : .06, now, .4);
    graph.wind.gain.setTargetAtTime(library ? .05 + tier * .015 : cave ? .03 : 0, now, 1.5);
    graph.roar.gain.setTargetAtTime(cave ? roarFor(scares) : 0, now, 1.8);
    graph.bed.gain.setTargetAtTime(deep ? .05 + tier * .015 : cave ? .03 : 0, now, .8);
    // presence.js swells the drone while a mummy closes in (0…1).
    graph.drone.gain.setTargetAtTime(deep ? .012 + tier * .01 + near * .03 : cave ? .007 : 0, now, 1.2);
    graph.fireRoar.gain.setTargetAtTime(fireLevel * fireLevel * .55, now, .35);
    if (!playing) return;
    // Footsteps: yours on your stride, others' from where they walk.
    for (const p of state.players) {
      const self = p.id === me.id, body = self ? me : p;
      if (!body.moving || p.downed || p.riding || floorOf(p.x) !== floorOf(me.x) || (self && !ownSteps)) { steps.delete(p.id); continue; }
      const fast = Math.hypot(body.vx || 0, body.vz || 0) > 5.5, interval = fast ? .3 : .42;
      const left = (steps.get(p.id) ?? interval * Math.random()) - dt;
      // In the library every step finds a board; some of them squeal.
      if (left <= 0) { const at = self ? { pan: 0, gain: library ? .3 : .5 } : place(me, heading, p.x, p.z, 16); if (library) play('board', { ...at, gain: at.gain * (self ? .7 : 1) }, Math.random() < .14 + tier * .04); else play('step', at, deep); steps.set(p.id, interval); }
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
      // The look into a nook is warned once per peek, from where the boss stands.
      if (peekCueDue(e, peeks.get(e.id))) { peeks.set(e.id, e.peek.seq); play('peek', { pan: at.pan, gain: Math.max(.25, at.gain) * 1.2 }); }
      if (v.next > 0) continue;
      const sounds = { mummy: ['groan', 4, 8], guardian: ['groan', 3, 5], phantom: ['whisper', 3, 6], spider: ['skitter', .8, 2], snake: ['hiss', 2.5, 5], bat: ['squeak', .5, 1.5], silbon: ['whistle', 5, 10], jaguar: ['growl', 2.5, 4], stalker: ['growl', 2, 4] }[e.kind];
      if (!sounds || (e.kind === 'spider' && e.hanging) || (e.kind === 'mummy' && !e.awake)) { v.next = 1; continue; }
      // A sleeping bat only ever shifts and chirps, quietly.
      if (e.kind === 'bat' && e.hanging) { if (Math.random() < .3) play('squeak', { ...at, gain: at.gain * .35 }); v.next = 2 + Math.random() * 4; continue; }
      if (e.kind === 'bat' && Math.random() < .5) play('flutter', { ...at, gain: at.gain * .9 });
      play(sounds[0], { ...at, gain: at.gain * (e.kind === 'guardian' ? 1.4 : e.kind === 'silbon' ? 1.2 : 1) });
      v.next = sounds[1] + Math.random() * (sounds[2] - sounds[1]);
    }
    for (const id of voices.keys()) if (!state.enemies.some(e => e.id === id)) { voices.delete(id); peeks.delete(id); }
    // Room tone: drips and creaks below, the draft and the far rock at the camp.
    eventIn -= dt;
    if (eventIn <= 0) {
      const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 12, at = place(me, heading, me.x + Math.cos(a) * r, me.z + Math.sin(a) * r, 20);
      if (library) { const pick = Math.random(), name = pick < .3 ? 'timber' : pick < .5 ? 'pages' : pick < .64 ? 'book' : pick < .8 ? 'wind' : pick < .9 ? 'whisper' : 'moan'; play(name, { ...at, gain: at.gain * (name === 'book' ? .6 : .85) }); eventIn = (2.5 + Math.random() * 5) * (1 - tier * .13); }
      else if (deep && theme === 'congo') { const pick = Math.random(); play(pick < .4 ? 'frog' : pick < .75 ? 'insects' : 'drip', at); eventIn = 1.5 + Math.random() * 4; }
      else if (deep) { const pick = Math.random(), name = pick < .4 ? 'drip' : pick < .6 ? 'pebbles' : pick < .78 ? 'creak' : pick < .92 ? 'moan' : 'whisper'; play(name, { ...at, gain: at.gain * (name === 'drip' ? 1 : .8) }); eventIn = (2 + Math.random() * 5) * (1 - tier * .12); }
      else {
        // Only what might not be the rock asks Sustos; the whistle stays faint and rare.
        const pick = Math.random(), name = pick < .34 ? 'wind' : pick < .58 ? 'pebbles' : pick < .78 ? 'rumble' : pick < .88 ? 'clank' : pick < .97 ? 'scrape' : 'whistle', far = pick >= .78 ? scareSound(scares, Math.random()) : { gain: 1 };
        if (far) play(name, { pan: Math.random() * 1.2 - .6, gain: { wind: .55, pebbles: .3, rumble: .6, clank: .32, scrape: .3, whistle: .16 }[name] * far.gain });
        eventIn = 3 + Math.random() * 6;
      }
    }
    // A drop reaching a puddle, heard from where it falls.
    if (cave) { const t = performance.now() / 1000; for (const d of DRIPS) if (dripLands(d, t, dt)) play('drip', place(me, heading, d.x, d.z, 15)); }
    // A clock somewhere in the library: it ticks for a while, then stops.
    if (library) { clockIn -= dt; if (clockIn <= 0) { if (ticks > 0) { play('tick', { pan: -.5, gain: .5 }, ticks % 2); ticks--; clockIn = 1; } else { ticks = Math.random() < .5 ? 6 + Math.floor(Math.random() * 12) : 0; clockIn = ticks ? .2 : 6 + Math.random() * 10; } } }
    // Late in la codicia your own heartbeat joins in.
    stepAt -= dt;
    if (deep && tier >= 3 && stepAt <= 0) { play('heartbeat', { gain: .35 + (tier - 3) * .25 }); stepAt = tier >= 4 ? .7 : 1.05; }
  }
  // The scare layers, placed like everything else (pan -1…1).
  function eerie(name, { pan = 0, gain = 1, strength = 1 } = {}) { if (SOUNDS[name]) voice((ctx, out, t) => SOUNDS[name](ctx, out, t, strength), { pan, gain }); }
  // One world sound, panned and faded from where this pana stands.
  function at(name, me, heading, x, z, range = 24) { if (graph && me) play(name, place(me, heading, x, z, range)); }
  return { update, eerie, at, set presence(v) { near = Math.max(0, Math.min(1, v || 0)); }, set fire(v) { fireLevel = Math.max(0, Math.min(1, v || 0)); } };
}
