// Timed protection is separate from a disconnected/eliminated racer.
export const START_GHOST_TIME = 3;
export const RESCUE_GHOST_TIME = 3;
export const IMPACT_GHOST_TIME = 2.5;
export const isGhost = c => !!(c.ghost || c.phaseRemote || c.phaseT > 0 || c.rescueT > 0);

export function recordImpact(c, now, discrete = false) {
  if (isGhost(c)) return;
  c.impacts = (c.impacts || []).filter(t => now - t < 3);
  // Debounce continuous contact. Separate weapons/hazards already have unique
  // hit resolution and may legitimately strike together in one physics step.
  if (!discrete && c.impacts.length && now - c.impacts.at(-1) < 0.45) return;
  c.impacts.push(now);
  if (c.impacts.length >= 2) {
    c.phaseT = IMPACT_GHOST_TIME;
    c.impacts = [];
  }
}

export function stepProtection(c, cars, dt) {
  if (c.remote) return;
  c.phaseT = Math.max(0, (c.phaseT || 0) - dt);
  // Do not become solid inside a rival. Separation must be continuous for a
  // short moment, preventing a fresh collision at the expiry boundary.
  if (c.phaseT > 0 && c.phaseT < 0.2 && cars.some(o => o !== c && !o.done && !o.ghost
    && Math.abs(c.y - o.y) < 1.6 && Math.hypot(c.x - o.x, c.z - o.z) < 3.6)) c.phaseT = 0.2;
}
