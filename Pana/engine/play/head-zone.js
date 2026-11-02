// Head hits for flat shots, for any game whose server sweeps shots on the
// ground plane (engine/play/projectile.js sweep). Pure and renderer-free, so a
// server room and Node tests run the same numbers.
//
// A shot is a ray from the shooter's eye `y0` at `pitch`. Where the flat sweep
// meets a victim, the ray's height there decides the zone: at or above the
// victim's head line (plus their jump) it is the head, lower the body.
//
// A first-person client sends its look pitch. Other views (third person, a
// top-down court) have no vertical aim to send, so the server derives one with
// `aimedPitch` from what it already knows, never from new client data: the
// closest target inside a narrow cone around the shot's own line is the one
// aimed at. A shot whose line passes within `width` metres of that target's
// centre is aimed at its head (the head is narrower than the body); wider is
// aimed at its chest. No target in the cone: no pitch, so a body hit.

// Height of a shot from `shot` ({ y0, pitch }) once it has flown `travel` metres flat.
export const shotHeight = (shot, travel) => shot.y0 + Math.tan(shot.pitch) * travel;

// True when a shot with a pitch meets a victim at or above `head` (lifted by `lift`, their jump).
export const headHit = (shot, travel, head, lift = 0) => shot.pitch != null && Number.isFinite(shot.pitch) && shotHeight(shot, travel) >= head + lift;

// The pitch for a shot fired without a look, or null when no target is aimed at.
// from: { x, z, y0 }; dir: the shot's flight direction { x, z } (any length);
// targets: [{ id, x, z, jumpHeight? }]; opts: { cone (rad), width (m), head and
// chest (aim heights, m) }. Returns { pitch, target, zone } with the target's id.
export function aimedPitch(from, dir, targets, { cone = .12, width = .25, head = 1.6, chest = 1.1 } = {}) {
  const length = Math.hypot(dir.x, dir.z); if (!length) return null;
  const ux = dir.x / length, uz = dir.z / length;
  let best = null;
  for (const t of targets) {
    const rx = t.x - from.x, rz = t.z - from.z, along = rx * ux + rz * uz;
    if (!(along > 0)) continue;
    const lateral = Math.abs(rx * uz - rz * ux);
    if (Math.atan2(lateral, along) > cone || (best && along >= best.along)) continue;
    best = { t, along, lateral };
  }
  if (!best) return null;
  const zone = best.lateral <= width ? 'head' : 'body', y = zone === 'head' ? head + (best.t.jumpHeight || 0) : chest;
  return { pitch: Math.atan2(y - from.y0, best.along), target: best.t.id, zone };
}
