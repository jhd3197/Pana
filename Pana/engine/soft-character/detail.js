// Construction is synchronous; restore the previous profile even if it fails.
// The studio keeps the approved sculpt, games sample the same surfaces less densely.
let profile = 'studio';
export const gameDetail = () => profile === 'game';
export const segments = n => gameDetail() ? Math.max(8, Math.round(n * 0.55)) : n;
export function withDetail(value, build) {
  const previous = profile; profile = value;
  try { return build(); } finally { profile = previous; }
}
