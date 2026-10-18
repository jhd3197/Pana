import * as THREE from 'three';

// Geometry, rather than material identity, carries the surface through static
// batching. Unmarked plaster/stone can share a draw with leaves without acquiring
// their pattern. Consumers opt into shading; other games retain their materials.
export function natureSurface(geometry, kind) {
  // One normalized byte per vertex; the consumer multiplies by three to recover
  // 0..1 grass coverage, 2 foliage and 3 bark. Large forests need no float mask.
  const values = new Uint8Array(geometry.attributes.position.count);
  if (kind === 'grass') {
    const colors = geometry.attributes.color;
    for (let i = 0; i < values.length; i++) {
      // Authored green terrain is grass; sand, concrete, snow and bare rock stay
      // unmarked. Store fractional coverage for soft transitions at biome edges.
      const r = colors?.getX(i) ?? 0, g = colors?.getY(i) ?? 0, b = colors?.getZ(i) ?? 0;
      values[i] = Math.round(85 * THREE.MathUtils.smoothstep((g - Math.max(r, b)) / Math.max(g, 0.001), 0.04, 0.24));
    }
  } else {
    if (kind !== 'foliage' && kind !== 'bark') throw new RangeError(`Unknown nature surface: ${kind}`);
    values.fill(kind === 'foliage' ? 170 : 255);
  }
  geometry.setAttribute('natureSurface', new THREE.BufferAttribute(values, 1, true));
  return geometry;
}
