// La Estatua: a draped stone scholar that stands in a library room like any
// other statue and only moves while no standing pana has it on screen. "On
// screen" is the host's call for every player at once: inside the player's
// view cone (heading and pitch from what they publish, a field of view wider
// than any real screen; engine/play/sight.js), within 30 m and with a clear
// line from their eyes (layout.sightClear: bookcases and walls hide it,
// tables do not). Light and the dark change nothing. Unseen, it snaps a
// stride closer (1.5–2.5 m along a real path, never through a solid) every
// 0.6–1.1 s, taking a new pose each time; within reach it raises its arms
// and strikes once, then stands still for a while. Seen by anyone, it is
// frozen, wind-up included. Hits only stagger it: stone does not break.
import { watcher, inViewCone } from '../../../engine/play/sight.js';
import { floorOf } from './deck.js';
import { distance } from './layout.js';
import { random } from './director.js';

export const ESTATUA = { range: 30, hunt: 26, eye: 1.45, step: [1.5, 2.5], pause: [.6, 1.1], stop: 1, body: { y0: 0, y1: 2.15, r: .45 }, edge: .32 };
// Poses (the model's STATUE_POSES): 0 and 1 far off (hands over the face, a
// hand lowered), 2 reaching, 3 claws out close, 4 the strike raised.
export const POSES = { far: [0, 1], near: 2, close: 3, strike: 4 };
const standing = p => !p.downed && !p.spectator && !p.riding;
// Scratch objects, reused every tick: no allocation per check.
const eyes = [], body = { x: 0, z: 0, y0: ESTATUA.body.y0, y1: ESTATUA.body.y1, r: ESTATUA.body.r }, point = { x: 0, z: 0 };

// The first standing pana who sees it, or null.
export function seenBy(g, e) {
  const f = floorOf(e.x); body.x = e.x; body.z = e.z;
  for (let i = 0; i < g.players.length; i++) {
    const p = g.players[i]; if (!standing(p) || floorOf(p.x) !== f) continue;
    const eye = watcher(p, ESTATUA.eye, eyes[i] ||= {});
    if (!inViewCone(eye, body, { range: ESTATUA.range })) continue;
    // Its middle or either shoulder in clear view is enough.
    const dx = e.x - eye.x, dz = e.z - eye.z, d = Math.hypot(dx, dz) || 1, px = -dz / d * ESTATUA.edge, pz = dx / d * ESTATUA.edge;
    for (let s = -1; s <= 1; s++) { point.x = e.x + px * s; point.z = e.z + pz * s; if (g.layout.sightClear(eye, point, g)) return p; }
  }
  return null;
}

function nearest(g, e) {
  const f = floorOf(e.x); let best = null, score = ESTATUA.hunt;
  for (const p of g.players) { if (!standing(p) || floorOf(p.x) !== f) continue; const d = distance(p, e); if (d < score) { score = d; best = p; } }
  return best;
}

// One stride along a real path toward the target, stopping short of it.
function stride(g, e, target) {
  const d = distance(e, target), len = Math.min(ESTATUA.step[0] + random(g) * (ESTATUA.step[1] - ESTATUA.step[0]), d - ESTATUA.stop);
  if (len < .2) return false;
  const path = g.layout.findPath(e, target, g, .5); if (!path.length) return false;
  const x0 = e.x, z0 = e.z; let left = len;
  for (const wp of path) {
    const seg = distance(e, wp); if (seg < .05) continue;
    const s = Math.min(seg, left);
    g.layout.moveBody(e, (wp.x - e.x) / seg * s, (wp.z - e.z) / seg * s, g, .5);
    left -= s; if (left <= .05) break;
  }
  return Math.hypot(e.x - x0, e.z - z0) > .1;
}

export function updateEstatua(g, e, k, damage, dt, { stunned = false } = {}) {
  e.frozen = !!seenBy(g, e);
  if (e.frozen || stunned) return;
  if (e.windup > 0) {
    e.windup -= dt;
    if (e.windup <= 0) {
      for (const p of g.players) if (standing(p) && Math.hypot(p.x - e.attackX, p.z - e.attackZ) < k.radius && g.layout.lineClear(e, p, g, .1)) g.damage(p, damage, e);
      e.cooldown = k.cooldown; e.pose = POSES.close;
    }
    return;
  }
  if (e.cooldown > 0) return;
  const target = nearest(g, e); if (!target) return;
  const d = distance(e, target);
  if (d < k.reach && g.layout.lineClear(e, target, g, .1)) {
    e.h = Math.atan2(target.x - e.x, target.z - e.z); e.windup = k.windup; e.pose = POSES.strike;
    e.attackX = e.x + Math.sin(e.h) * .6; e.attackZ = e.z + Math.cos(e.h) * .6; return;
  }
  e.stepIn = (e.stepIn ?? 0) - dt; if (e.stepIn > 0) return;
  e.stepIn = ESTATUA.pause[0] + random(g) * (ESTATUA.pause[1] - ESTATUA.pause[0]);
  if (!stride(g, e, target)) return;
  e.h = Math.atan2(target.x - e.x, target.z - e.z); e.steps = (e.steps || 0) + 1;
  const left = distance(e, target);
  e.pose = left > 9 ? POSES.far[e.steps % 2] : left > 4 ? POSES.near : POSES.close;
}
