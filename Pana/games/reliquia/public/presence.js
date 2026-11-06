// A mummy close by is felt before it is seen, on this screen only. The first
// time one comes within 11 m a whisper rises from where it stands; while it
// lurches within 9 m a chain or a board ticks under it now and then; within
// 3.6 m its cold breath puffs dust in the light; and the cave's low drone
// swells as the nearest one closes in. Only the recorded clips samples.js
// already loads and the synth layers in ambience.js: no new sounds.
// Sustos: suaves keeps half the whispers, quieter, ticks half as often and no
// breath sound; apagados none of it.
//
// The library's own two are felt too, from the same clips. El Lector: when it
// stops to listen a page turns where it stands (the tell, heard), it breathes
// in slow creaks while it stands listening within 8 m, and a low chain ticks
// as it walks within 10 m. La Estatua: every stride it takes grinds, a trunk
// lid dragged at half speed under a low book thud, within 24 m. Suaves: the
// same at half the level, fewer creaks, no thud under the grind; apagados:
// none. What they do never changes with the setting.
import { floorOf } from './deck.js';

const MOKELE_DRONE = 58;
const NOTICE = 11, LURCH = 9, CLOSE = 3.6, DRONE = 14, LISTEN = 8, PROWL = 10, GRIND = 24;

export function createPresence({ view, ambience, samples }) {
  const watched = new Map();
  let swell = 0, hush = 0;   // hush: no two whispers within 4 s

  function update(dt, { state, me, heading, scares = 'normal', paused = false }) {
    const on = scares !== 'apagados' && !paused && state.phase === 'playing' && !!me && !me.downed && !me.spectator && floorOf(me.x) > 0;
    const soft = scares === 'suaves';
    let closest = 0; hush = Math.max(0, hush - dt);
    if (!on) watched.clear();
    else for (const e of state.enemies) {
      if (e.hp <= 0 || floorOf(e.x) !== floorOf(me.x)) continue;
      if (e.kind === 'lector') { closest = Math.max(closest, lector(e, me, dt, soft)); continue; }
      if (e.kind === 'estatua') { statue(e, me, soft); continue; }
      // The Mokele's own footfalls come from congo-view.js; the drone rises under them from far off.
      if (e.kind === 'mokele') { const near = 1 - Math.min(1, Math.hypot(e.x - me.x, e.z - me.z) / MOKELE_DRONE); closest = Math.max(closest, near * near * (soft ? .5 : 1)); continue; }
      if (e.kind !== 'mummy') continue;
      const dx = e.x - me.x, dz = e.z - me.z, d = Math.hypot(dx, dz);
      let w = watched.get(e.id);
      if (!w) { w = { noticed: false, x: e.x, z: e.z, still: 1, tickIn: 1 + Math.random() * 2, breathIn: 1.5 + Math.random() * 3 }; watched.set(e.id, w); }
      // Snapshots come at 20 Hz: it is walking if it moved in the last moment.
      if (Math.hypot(e.x - w.x, e.z - w.z) > .01) { w.still = 0; w.x = e.x; w.z = e.z; } else w.still += dt;
      const walking = w.still < .3 && !e.frozen;
      if (!w.noticed && d < NOTICE) {
        w.noticed = true;
        if (!hush && (!soft || Math.random() < .5)) { hush = 4; samples.near('whisper', e.x, e.z, { gain: soft ? .05 : .12, rate: .8 + Math.random() * .12, range: 18, priority: 2 }); }
      } else if (w.noticed && d > NOTICE * 1.6) w.noticed = false;
      if (walking && d < LURCH) {
        w.tickIn -= dt * (soft ? .5 : 1);
        if (w.tickIn <= 0) {
          const chain = Math.random() < .55;
          samples.near(chain ? 'chain' : 'creak', e.x, e.z, { gain: (chain ? .07 : .045) * (soft ? .5 : 1), rate: chain ? .68 + Math.random() * .14 : 1.25 + Math.random() * .2, range: 12, priority: 0 });
          w.tickIn = 1.4 + Math.random() * 1.8;
        }
      }
      if (d < CLOSE) {
        w.breathIn -= dt;
        if (w.breathIn <= 0) {
          w.breathIn = (soft ? 9 : 5) + Math.random() * 4;
          view.puffs.spawn({ x: e.x + Math.sin(e.h) * .3, y: 2, z: e.z + Math.cos(e.h) * .3 }, { color: 0x8f97a2, count: 3, spread: .2, size: .22, rise: .25, life: 1.3 });
          if (!soft) ambience.eerie('breath', { pan: (dx * -Math.cos(heading) + dz * Math.sin(heading)) / (d || 1) * .8, gain: .3 });
        }
      }
      if (!e.frozen) closest = Math.max(closest, 1 - d / DRONE);
    }
    for (const [id] of watched) if (!state.enemies.some(e => e.id === id)) watched.delete(id);
    swell += (closest * (soft ? .5 : 1) - swell) * (1 - Math.exp(-dt * 1.5));
    ambience.presence = swell;
  }
  // El Lector: a page at the tell, creaks while it listens, a chain as it walks.
  function lector(e, me, dt, soft) {
    const d = Math.hypot(e.x - me.x, e.z - me.z);
    let w = watched.get(e.id);
    if (!w) { w = { mode: e.mode, x: e.x, z: e.z, still: 1, tickIn: 1 + Math.random() * 2, creakIn: 2 + Math.random() * 3 }; watched.set(e.id, w); }
    if (Math.hypot(e.x - w.x, e.z - w.z) > .01) { w.still = 0; w.x = e.x; w.z = e.z; } else w.still += dt;
    if (e.mode === 'listen' && w.mode !== 'listen' && d < 18) samples.near('page', e.x, e.z, { gain: soft ? .05 : .1, rate: .72 + Math.random() * .08, range: 18, priority: 1 });
    w.mode = e.mode;
    if (w.still > .3 && d < LISTEN) {
      w.creakIn -= dt * (soft ? .5 : 1);
      if (w.creakIn <= 0) { samples.near('creak', e.x, e.z, { gain: soft ? .025 : .05, rate: .55 + Math.random() * .1, range: 10, priority: 0 }); w.creakIn = 3.5 + Math.random() * 3; }
    }
    if (w.still < .3 && d < PROWL) {
      w.tickIn -= dt * (soft ? .5 : 1);
      if (w.tickIn <= 0) { samples.near('chain', e.x, e.z, { gain: soft ? .03 : .06, rate: .55 + Math.random() * .1, range: 12, priority: 0 }); w.tickIn = (e.mode === 'hunt' ? .7 : 1.4) + Math.random() * 1.2; }
    }
    return e.mode === 'hunt' ? 1 - d / DRONE : 0;
  }
  // La Estatua: each stride grinds stone on stone.
  function statue(e, me, soft) {
    let w = watched.get(e.id);
    if (!w) { w = { steps: e.steps || 0 }; watched.set(e.id, w); }
    if ((e.steps || 0) === w.steps) return;
    w.steps = e.steps || 0;
    if (Math.hypot(e.x - me.x, e.z - me.z) > GRIND) return;
    samples.near('trunk', e.x, e.z, { gain: soft ? .09 : .18, rate: .48 + Math.random() * .06, range: GRIND, priority: 2 });
    if (!soft) samples.near('thud', e.x, e.z, { gain: .07, rate: .55 + Math.random() * .08, range: 16, priority: 1 });
  }
  return { update, get swell() { return swell; } };
}
