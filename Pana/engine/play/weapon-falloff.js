// Damage that falls off with range, for any weapon in any game. Pure and
// renderer-free, so a server room and Node tests run the same numbers.
//
// A weapon's falloff config is { near, far, close, min, round }: `close` damage
// up to `near` metres, then a straight line down to `min` at `far` and beyond,
// never below `min`. `round` (default true) rounds to whole damage units.
// A weapon with no config always deals its flat `base` damage.

// A valid config with defaults filled in, or null when there is none to use.
export function falloffConfig(config) {
  if (!config || typeof config !== 'object') return null;
  const near = Math.max(0, Number(config.near) || 0), far = Math.max(near, Number(config.far) || 0);
  const close = Number(config.close), min = Number.isFinite(config.min) ? config.min : 1;
  if (!Number.isFinite(close)) return null;
  return { near, far, close, min: Math.min(min, close), round: config.round !== false };
}

// Damage after flying `distance` metres; `base` when the weapon has no falloff.
export function rangeDamage(config, distance, base = 1) {
  const f = falloffConfig(config); if (!f) return base;
  const d = Math.max(0, Number(distance) || 0);
  const k = d <= f.near ? 0 : d >= f.far ? 1 : (d - f.near) / (f.far - f.near);
  const value = f.close + (f.min - f.close) * k;
  return Math.max(f.min, f.round ? Math.round(value) : value);
}
