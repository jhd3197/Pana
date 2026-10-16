import * as THREE from 'three';

// Rasterize the front of the finished cloth into the same sampling grid used
// by its pockets/buttons. Visit only grid points covered by each triangle,
// instead of ray-testing every triangle for each of the 1,353 grid points.
export function clothDepths(geometry) {
  const nx = 32, ny = 40, minX = -0.65, minY = 1.01, width = 1.3, height = 0.8;
  const depths = new Float64Array((nx + 1) * (ny + 1));
  const p = geometry.attributes.position, index = geometry.index;
  const count = index ? index.count : p.count;
  const x = [], y = [], z = [];
  for (let face = 0; face < count; face += 3) {
    for (let k = 0; k < 3; k++) {
      const i = index ? index.getX(face + k) : face + k;
      x[k] = (p.getX(i) - minX) / width * nx;
      y[k] = (p.getY(i) - minY) / height * ny;
      z[k] = p.getZ(i);
    }
    const denominator = (y[1] - y[2]) * (x[0] - x[2]) + (x[2] - x[1]) * (y[0] - y[2]);
    if (Math.abs(denominator) < 1e-12) continue;
    const left = Math.max(0, Math.ceil(Math.min(...x))), right = Math.min(nx, Math.floor(Math.max(...x)));
    const bottom = Math.max(0, Math.ceil(Math.min(...y))), top = Math.min(ny, Math.floor(Math.max(...y)));
    for (let j = bottom; j <= top; j++) for (let i = left; i <= right; i++) {
      const a = ((y[1] - y[2]) * (i - x[2]) + (x[2] - x[1]) * (j - y[2])) / denominator;
      const b = ((y[2] - y[0]) * (i - x[2]) + (x[0] - x[2]) * (j - y[2])) / denominator;
      const c = 1 - a - b;
      if (a < -1e-10 || b < -1e-10 || c < -1e-10) continue;
      const depth = a * z[0] + b * z[1] + c * z[2];
      const slot = j * (nx + 1) + i;
      if (depth > depths[slot] && depth <= 2) depths[slot] = depth;
    }
  }
  for (let i = 0; i < depths.length; i++) if (!depths[i]) depths[i] = 0.31;
  return { depths, nx, ny, minX, minY, width, height };
}

export function clothFront(geometry) {
  const { depths, nx, ny, minX, minY, width, height } = clothDepths(geometry);
  return (x, y) => {
    const gx = THREE.MathUtils.clamp((x - minX) / width * nx, 0, nx - 0.00001);
    const gy = THREE.MathUtils.clamp((y - minY) / height * ny, 0, ny - 0.00001);
    const i = Math.floor(gx), j = Math.floor(gy), u = gx - i, v = gy - j;
    const at = (a, b) => depths[b * (nx + 1) + a];
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(at(i, j), at(i + 1, j), u),
      THREE.MathUtils.lerp(at(i, j + 1), at(i + 1, j + 1), u), v) + 0.012;
  };
}
