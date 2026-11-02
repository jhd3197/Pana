// Is something on a player's screen? Renderer-free and pure: a host decides
// for every player at once (a statue that only moves unseen), from what each
// player already publishes (heading `h`, `pitch`) and a conservative field of
// view, wider than any real screen, so the answer errs on "seen".
//
//   const eye = watcher(p, eyeHeight, scratch);           // caches sin/cos of p.h
//   if (inViewCone(eye, { x, z, y0: 0, y1: 2.1, r: .4 }, { range: 30 }) && clear(eye, target)) frozen = true;
//
// Heading convention: forward is (sin h, cos h) on x/z; pitch > 0 looks up.
// The cone is the camera's horizontal half-angle plus the target's own
// angular radius; vertically, any part of the target between y0 and y1
// inside pitch ± the vertical half-angle counts.

// Reliquia's camera is 74° tall; at 21:9 that is about 61° each side.
export const VIEW = { half: 62 * Math.PI / 180, vhalf: 41 * Math.PI / 180, range: 30, near: .7 };

// A watcher's eye with its heading's sin/cos, written into `out` (no allocation).
export function watcher(p, eye = 1.45, out = {}) {
  out.x = p.x; out.z = p.z; out.y = (p.y || 0) + eye; out.pitch = Number.isFinite(p.pitch) ? p.pitch : 0;
  if (out.h !== p.h) { out.h = p.h; out.sin = Math.sin(p.h); out.cos = Math.cos(p.h); }
  out.id = p.id; return out;
}

export function inViewCone(eye, target, { half = VIEW.half, vhalf = VIEW.vhalf, range = VIEW.range, near = VIEW.near } = {}) {
  const dx = target.x - eye.x, dz = target.z - eye.z, d = Math.hypot(dx, dz);
  if (!(d <= range)) return false;
  if (d < near) return true;
  const r = target.r || 0, along = (dx * eye.sin + dz * eye.cos) / d;
  const angle = Math.acos(Math.max(-1, Math.min(1, along)));
  if (angle > half + Math.atan2(r, d)) return false;
  const low = Math.atan2((target.y0 ?? 0) - eye.y, d), high = Math.atan2((target.y1 ?? 2) - eye.y, d);
  return high >= eye.pitch - vhalf && low <= eye.pitch + vhalf;
}
