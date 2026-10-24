// Shared by the procedural pose and rules: the fist reaches its target at
// impact, stays extended during contact, then returns to guard.
export const ATTACK_TIMING = {
  jab: { impact: .1, release: .18, total: .36 },
  trompon: { impact: .12, release: .18, total: .5 },
  grab: { impact: .14, release: .24, total: .55 },
};
export function attackExtension(kind, time) {
  const { impact, release, total } = ATTACK_TIMING[kind];
  return Math.max(0, Math.min(1, time < impact ? time / impact : time <= release ? 1 : (total - time) / (total - release)));
}
// Like grandma-gta's analyseMoves, find the most extended sampled pose.
// Renderer-free so authored motion can be checked without loading a scene.
export function analyseImpact(sample, duration, samples = 120) {
  let time = 0, reach = -Infinity;
  for (let i = 0; i <= samples; i++) {
    const t = duration * i / samples, points = sample(t);
    for (const p of points) {
      const distance = Math.hypot(p.x, p.z);
      if (distance > reach) { reach = distance; time = t; }
    }
  }
  return { time, reach };
}
