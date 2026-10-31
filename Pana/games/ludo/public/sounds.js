// Recorded effects share Pana's AudioContext, volume and voice budget.
export const SAMPLES = ['hop', 'whoosh', 'squish', 'splat', 'swish'];
export function createLudoSounds(sound, { audible = () => true, fetchAudio = globalThis.fetch, events = globalThis.document } = {}) {
  let disposed = false, context = null, preparing = null;
  const buffers = new Map(), active = new Set();
  const bytes = new Map(SAMPLES.map(name => [name, Promise.resolve()
    .then(() => fetchAudio(`/g/ludo/audio/${name}.mp3`))
    .then(r => { if (!r.ok) throw Error('Sound unavailable'); return r.arrayBuffer(); }).catch(() => null)]));
  const ready = () => !disposed && audible() && !sound.muted && sound.volume > 0;
  function stop() { for (const source of active) { try { source.stop(); } catch {} } active.clear(); }
  function prepare() {
    if (!sound.ctx || disposed) return Promise.resolve();
    if (context === sound.ctx) return preparing;
    context = sound.ctx;
    preparing = Promise.all(SAMPLES.map(async name => {
      try { const data = await bytes.get(name); if (!data || disposed) return;
        const buffer = await context.decodeAudioData(data.slice(0));
        if (!disposed) buffers.set(name, buffer);
      } catch { /* A missing recording never blocks a move. */ }
    }));
    return preparing;
  }
  function play(name, rate = 1, volume = .16, delay = 0, priority = 2) {
    if (!ready()) return;
    prepare();
    const buffer = buffers.get(name), ctx = sound.ctx;
    if (!buffer || !ctx) return; // Never replay a stale event after loading.
    const duration = buffer.duration / rate, start = ctx.currentTime + delay;
    const slot = sound.admit(priority, start, start + duration);
    if (!slot) return;
    const source = ctx.createBufferSource(), gain = ctx.createGain();
    source.buffer = buffer; source.playbackRate.value = rate;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + Math.min(.003, duration / 4));
    gain.gain.setValueAtTime(volume, start + Math.max(.003, duration - .015));
    gain.gain.linearRampToValueAtTime(0, start + duration);
    source.connect(gain).connect(sound.out()); slot.gs.push(gain); active.add(source);
    source.onended = () => { active.delete(source); source.disconnect(); gain.disconnect(); };
    source.start(start); source.stop(start + duration);
  }
  function chime(rates, volume = .12) { rates.forEach((rate, i) => play('hop', rate, volume, i * .1, 3)); }
  const visibility = () => { if (!audible() || events?.hidden) stop(); };
  events?.addEventListener('visibilitychange', visibility);
  return {
    prepare, stop,
    update() { if (!ready()) stop(); else prepare(); },
    dispose() { disposed = true; stop(); buffers.clear(); events?.removeEventListener('visibilitychange', visibility); },
    shake(power) { play('hop', .65 + power * .1, .035); },
    throw(power) { play('whoosh', .9 + power * .2, .13); },
    bounce(strength) { play('hop', .68 + strength * .15, .06 + strength * .06); },
    result(value) { chime(value === 6 ? [1, 1.25, 1.5] : [1 + value * .04]); },
    step(index = 0) { play('hop', .96 + index % 3 * .04, .2); },
    land({ entry = false, home = false, capture = false, win = false } = {}) {
      if (win) chime([1, 1.25, 1.5, 2, 1.5, 2], .17);
      else if (home) chime([1, 1.25, 1.5, 2], .15);
      else if (capture) play('splat', 1, .2, 0, 3);
      else if (entry) chime([1, 1.25]);
      else play('hop', .85, .14);
    },
    returnHome() { play('whoosh', 1.2, .14); },
    moment(kind) {
      if (kind === 'sleep') return;
      if (kind === 'nomoves') play('squish', .8, .09);
      else if (['leap', 'sprint', 'nearmiss'].includes(kind)) play('swish', 1.1, .12);
      else if (kind === 'block') play('hop', .65, .12);
      else if (kind === 'suspense') play('hop', .75, .07);
      else chime(kind === 'podium' ? [1, 1.25, 1.5, 2] : [1, 1.5], .1);
    },
    trick(style) {
      if (['gum', 'slip'].includes(style)) play('squish', style === 'gum' ? .8 : 1.15, .16);
      else if (style === 'highfive') play('splat', 1.3, .13);
      else if (['rollbarrel', 'moonwalk', 'piggy'].includes(style)) play('hop', .8, .12);
      else play('swish', style === 'tunnel' ? .8 : 1.1, .13);
    },
  };
}
