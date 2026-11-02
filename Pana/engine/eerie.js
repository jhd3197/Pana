// Eerie events for horror levels: a pure, seeded scheduler that decides when
// something unsettling happens on this screen and how strong it is. It draws
// nothing and plays nothing; the game turns each event into lights, sounds
// and shapes. Events are cosmetic and local to one client, so two panas in
// the same room never see the same scare at the same moment.
//
//   const eerie = createEerie({ seed });
//   for (const e of eerie.update(dt, { active, time, codicia, depth, alone, hp, theme, mode })) show(e);
//
// `active` is false at the camp, while downed or in menus: the clocks wait.
// `time` is seconds since the level began (no jump scare in the first
// `grace` seconds). `codicia` 0–100, `depth` 1…, `alone` (no pana within
// reach), `hp` 0–1 and `theme` decide the intensity. `mode` is the player's
// setting: 'normal', 'suaves' (milder: no lights cut, softer stingers,
// flicker and shake at 40 %) or 'apagados' (no jump scares, no flicker, no
// shake: only quiet sounds and far shapes).
import { rng, clamp } from './random.js';

// kind: weight, cooldown (s), minimum intensity, themes (null = any), and
// whether it flickers lights or shakes (scaled down or dropped by `mode`).
export const EERIE_EVENTS = {
  flicker: { weight: 3, cooldown: 14, min: 0, flicker: true },
  candleOut: { weight: 2, cooldown: 18, min: 0, themes: ['biblioteca'] },
  slam: { weight: 2, cooldown: 25, min: .2, shake: true },
  thud: { weight: 2.5, cooldown: 16, min: 0 },
  whisper: { weight: 2, cooldown: 20, min: .15 },
  silhouette: { weight: 1.6, cooldown: 35, min: .25 },
  heartbeat: { weight: 1.2, cooldown: 30, min: .45 },
  bookFall: { weight: 2.5, cooldown: 14, min: 0, themes: ['biblioteca'] },
  fogSurge: { weight: 1.4, cooldown: 30, min: .2 },
  farolStutter: { weight: 1.5, cooldown: 22, min: .1, flicker: true },
};
export const SCARE_MODES = ['normal', 'suaves', 'apagados'];

// How much is going on: la codicia, depth, being alone and being hurt.
export function eerieIntensity({ codicia = 0, depth = 1, alone = false, hp = 1, theme = '' } = {}) {
  return clamp(.12 + codicia / 100 * .45 + Math.min(6, Math.max(0, depth - 1)) * .05 + (alone ? .15 : 0) + (1 - clamp(hp, 0, 1)) * .2 + (theme === 'biblioteca' ? .08 : 0), 0, 1);
}

export function createEerie({ seed = 1, events = EERIE_EVENTS, scareCooldown = 80, grace = 20, gap = [7, 20] } = {}) {
  let R = rng(seed), next = 0, scareIn = 0, last = '', since = {}, clock = 0;
  const roll = (a, b) => a + R() * (b - a);
  function reset(nextSeed = seed) {
    R = rng(nextSeed >>> 0); clock = 0; last = ''; since = {};
    next = roll(gap[0] + 4, gap[1]); scareIn = scareCooldown * roll(.6, 1);
  }
  reset(seed);
  // One event, picked by weight among those allowed now.
  function choose(intensity, theme, mode) {
    const pool = Object.entries(events).filter(([kind, e]) => intensity >= e.min && (!e.themes || e.themes.includes(theme)) && clock - (since[kind] ?? -1e9) >= e.cooldown
      && !(mode === 'apagados' && (e.flicker || e.shake)) && kind !== last);
    const total = pool.reduce((n, [, e]) => n + e.weight, 0);
    let pick = R() * total;
    for (const [kind, e] of pool) { pick -= e.weight; if (pick <= 0) return kind; }
    return pool.at(-1)?.[0] || null;
  }
  function shaped(kind, intensity, mode) {
    const e = events[kind] || {}, soft = mode === 'suaves' ? .4 : 1;
    return { kind, intensity, strength: clamp((.45 + intensity * .55) * (e.flicker || e.shake ? soft : 1), 0, 1), side: R() < .5 ? -1 : 1, angle: roll(-Math.PI, Math.PI), roll: R(), mode };
  }
  function update(dt, { active = false, time = 0, codicia = 0, depth = 1, alone = false, hp = 1, theme = '', mode = 'normal' } = {}) {
    if (!active || !(dt > 0)) return [];
    clock += dt;
    const out = [], intensity = eerieIntensity({ codicia, depth, alone, hp, theme });
    // The jump scare runs on its own long clock, faster with la codicia.
    scareIn -= dt * (.6 + intensity * .9);
    if (scareIn <= 0) {
      if (mode !== 'apagados' && time >= grace && last !== 'jumpscare' && clock - (since.jumpscare ?? -1e9) >= scareCooldown && R() < .35 + intensity * .6) {
        out.push(shaped('jumpscare', intensity, mode)); last = 'jumpscare'; since.jumpscare = clock;
        next = Math.max(next, roll(gap[0], gap[1]));
      }
      scareIn = scareCooldown * roll(.5, 1);
    }
    next -= dt * (.55 + intensity * .9);
    if (next <= 0 && !out.length) {
      const kind = choose(intensity, theme, mode);
      if (kind) { out.push(shaped(kind, intensity, mode)); last = kind; since[kind] = clock; }
      next = roll(gap[0], gap[1]);
    }
    return out;
  }
  return { update, reset, get clock() { return clock; } };
}
