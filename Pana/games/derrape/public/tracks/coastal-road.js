// Fair the reference's display-only hairpins before terrain, river crossings
// and scenery are sampled. Both the visible ribbon and driving use this path.
export function fairRoute(points, window = 40) {
  const n = points.length;
  for (let pass = 0; pass < 8; pass++) {
    const source = points.map(p => p.clone());
    for (let i = 0; i < n; i++) {
      let x = 0, z = 0, weights = 0;
      for (let j = -window; j <= window; j++) {
        const weight = window + 1 - Math.abs(j), p = source[(i+j+n)%n];
        x += p.x * weight; z += p.z * weight; weights += weight;
      }
      points[i].x = x / weights; points[i].z = z / weights;
    }
  }
}

export function fairHeights(points, heights) {
  const n = points.length;
  for (let pass = 0; pass < 3000; pass++) {
    for (let i = 0; i < n; i++) {
      const j = (i+1)%n, a = points[i], b = points[j];
      const limit = Math.hypot(b.x-a.x,b.z-a.z) * .27;
      const delta = heights[j]-heights[i];
      if (Math.abs(delta) > limit) {
        const correction = (Math.abs(delta)-limit)*.5*Math.sign(delta);
        heights[i] += correction; heights[j] -= correction;
      }
    }
  }
}
