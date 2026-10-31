import { sfx as lib, burst, pitch } from '/engine/sfx.js';
import { createFootsteps } from '/engine/play/footsteps.js';

// Pepazo's sounds are the engine's shared library (engine/sfx.js) called by
// meaning: a distinct shot per marker, a wet splat, the reload clicks, the
// countdown. Only the knockout fanfare and the "you are out" thud are its own.
export const sfx = {
  // Your marker, or another pana's quieter with distance (volume 0–1).
  shot(volume = 1, weapon = 'pistol') { lib.shot(weapon, { volume }); },
  dry: lib.dry, reloaded: lib.reloaded, hurt: () => lib.hurt(), swap: lib.swap, go: lib.go,
  reload: (weapon, seconds) => lib.reload(weapon, seconds),
  impact: (volume = 1) => lib.impact('paint', { volume }),
  // An explosion by what blew up: La Bazuca loudest, a sticky grenade softest.
  boom: (kind, volume = 1) => lib.boom({ bazooka: 1.25, rocket: 1, pinita: .9, chispita: .8 }[kind] || .65, { volume }),
  hitTick: lib.hitConfirm,
  count: n => lib.count(n),
  knockout(long = false, streak = 1) {
    burst({ dur: .2, f0: 650, q: .7, vol: .2, priority: 3 });
    const lift = 1 + Math.min(4, streak - 1) * .12;
    [660, 880, 1320].forEach((f, i) => pitch({ dur: .11, f0: f * lift, type: 'triangle', vol: .08, delay: .05 + i * .07, priority: 3 }));
    if (long) { pitch({ dur: .22, f0: 1760 * lift, vol: .07, delay: .3, priority: 3 }); pitch({ dur: .2, f0: 2640 * lift, vol: .04, delay: .38, priority: 3 }); }
  },
  out() { burst({ dur: .3, f0: 380, q: .5, vol: .24, priority: 3 }); pitch({ dur: .7, f0: 520, f1: 100, type: 'triangle', vol: .12, priority: 3 }); },
};

// What each court is paved with, for the footsteps.
const FLOOR = { terminal: 'concrete', muelle: 'wood', noche: 'grass' };

// Everyone's feet: one shared-controller stepper per pana. Speed comes from how far
// the avatar moved this frame, so bots and remote panas are heard too, quieter
// with distance and silent beyond the court's hearing.
export function createSteps() {
  const feet = new Map(), last = new Map();
  return {
    update(state, myId, avatars, dt) {
      const me = state.players.find(p => p.id === myId), surface = FLOOR[state.mapId] || 'concrete';
      for (const p of state.players) {
        const at = avatars.get(p.id)?.group.position, before = last.get(p.id);
        if (at) last.set(p.id, { x: at.x, z: at.z });
        const out = !p.connected || p.respawn > 0 || p.eliminated || state.phase !== 'playing';
        const jump = Math.hypot(at && before ? at.x - before.x : 0, at && before ? at.z - before.z : 0);
        const speed = out || !at || !before || jump > 6 || dt < .001 ? 0 : jump / dt;
        const distance = me && p.id !== myId ? Math.hypot(p.x - me.x, p.z - me.z) : 0;
        if (!feet.has(p.id)) feet.set(p.id, createFootsteps());
        if (distance > 28) { feet.get(p.id).reset(); continue; }
        feet.get(p.id).update(dt, { speed, height: out ? 0 : p.jumpHeight || 0, sprint: !!p.sprint, surface, volume: p.id === myId ? .8 : .55 / (1 + distance / 6) }, lib);
      }
      for (const id of feet.keys()) if (!state.players.some(p => p.id === id)) { feet.delete(id); last.delete(id); }
    },
    reset() { feet.forEach(f => f.reset()); last.clear(); },
  };
}
