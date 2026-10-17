import * as THREE from 'three';
import { M, mesh, rng } from '/engine/models/core/primitives.js';
import { taperedStem } from '/engine/models/core/botanical-shapes.js';
import { paleBark, leafyCushion, leafSprig } from '/engine/models/vegetation/canopy.js';
import { natureSurface } from '/engine/models/core/nature-surface.js';

export function ceiba({ seed = 1, detail = 'full' } = {}) {
  const distant=detail==='distant';
  const r = rng(seed);
  const g = new THREE.Group();
  const h = 5.7 + r() * 2.2;
  const lean = (r() - 0.5) * 0.7;
  const trunk = new THREE.CylinderGeometry(1, 1, 1, distant?8:20, distant?5:12), p = trunk.attributes.position, colors = [];
  const low = new THREE.Color(0x756746), high = new THREE.Color(0xb8a37a);
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) + 0.5, x = p.getX(i), z = p.getZ(i), angle = Math.atan2(z, x);
    const flute = Math.pow(Math.max(0, Math.cos(angle * 5 + seed)), 4);
    const radius = 0.64 - t * 0.37 + Math.pow(1 - t, 6) * (0.16 + flute * 1.05) + Math.sin(t * Math.PI) * 0.1;
    p.setXYZ(i, x * radius + lean * t * t, t * h, z * radius + Math.sin(t * Math.PI * 0.6) * 0.18);
    const color = low.clone().lerp(high, 0.38 + t * 0.4 + Math.cos(angle * 5 + seed) * 0.08);
    colors.push(color.r, color.g, color.b);
  }
  trunk.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); trunk.computeVertexNormals();
  g.add(mesh(natureSurface(trunk, 'bark'), M(0xffffff, { vertexColors: true, flatShading: false, roughness: 1 })));
  const tint = [0x78a84a, 0x629e48, 0x8ab252][Math.abs(seed) % 3];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + r() * 0.35;
    const reach = 1.95 + r() * 0.5;
    const x = Math.cos(a) * reach, z = Math.sin(a) * reach;
    const y = h + r() * 0.65, size = 1.35 + r() * 0.4;
    g.add(mesh(natureSurface(taperedStem([[lean * 0.5, h * 0.61, 0.13], [x * 0.5, h * 0.92, z * 0.5], [x, y, z]], 0.3, 0.07, distant?4:7, distant?3:8), 'bark'), paleBark));
    const canopy = leafyCushion(size, seed + i, tint, distant); canopy.position.set(x, y + 0.45, z); canopy.scale.set(1.12, 0.72, 1); g.add(canopy);
    if(distant)continue;
    const edge = leafyCushion(size * 0.55, seed + i + 12, tint, true); edge.position.set(x * 1.35, y + 0.08, z * 1.35); edge.scale.y = 0.75; g.add(edge);
    leafSprig(g, x * 1.35, y + size * 0.55, z * 1.35, -a, 0.72, seed + i, 0x629238);
  }
  const top = leafyCushion(1.95, seed + 31, tint, distant); top.position.set(lean, h + 1.15, 0); top.scale.set(1.1, 0.76, 1); g.add(top);
  return g;
}
