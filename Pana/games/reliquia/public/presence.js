// A mummy close by is felt before it is seen, on this screen only. The first
// time one comes within 11 m a whisper rises from where it stands; while it
// lurches within 9 m a chain or a board ticks under it now and then; within
// 3.6 m its cold breath puffs dust in the light; and the cave's low drone
// swells as the nearest one closes in. Only the recorded clips samples.js
// already loads and the synth layers in ambience.js: no new sounds.
// Sustos: suaves keeps half the whispers, quieter, ticks half as often and no
// breath sound; apagados none of it.
import { floorOf } from './deck.js';

const NOTICE = 11, LURCH = 9, CLOSE = 3.6, DRONE = 14;

export function createPresence({ view, ambience, samples }) {
  const watched = new Map();
  let swell = 0, hush = 0;   // hush: no two whispers within 4 s

  function update(dt, { state, me, heading, scares = 'normal', paused = false }) {
    const on = scares !== 'apagados' && !paused && state.phase === 'playing' && !!me && !me.downed && !me.spectator && floorOf(me.x) > 0;
    const soft = scares === 'suaves';
    let closest = 0; hush = Math.max(0, hush - dt);
    if (!on) watched.clear();
    else for (const e of state.enemies) {
      if (e.kind !== 'mummy' || e.hp <= 0 || floorOf(e.x) !== floorOf(me.x)) continue;
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
  return { update, get swell() { return swell; } };
}
