import * as THREE from 'three';
import { M, mesh, rng } from '/engine/models/core/primitives.js';
import { bake } from '/engine/models/core/static-batch.js';
import { natureSurface } from '/engine/models/core/nature-surface.js';

// Faceted boulder wearing one or two cushions of moss: forest-floor filler.
// `color` tints the stone (salt, sandstone); `moss: false` leaves it bare.
export function mossRock({ seed = 1, size = 1, color = null, moss = true } = {}) {
  const r = rng(seed), g = new THREE.Group(), s = size, shade = r() < 0.5;
  const stone = M(color != null ? new THREE.Color(color).multiplyScalar(shade ? 1 : .86).getHex() : shade ? 0x9a9a8c : 0x74746a, { roughness: 0.95 });
  const rock = mesh(new THREE.DodecahedronGeometry(1, 0), stone, 0, s * 0.35, 0);
  rock.rotation.set(r(), r(), r()); rock.scale.set(s, s * 0.7, s * (0.8 + r() * 0.3)); g.add(rock);
  const cap = (x, y, z, sx, sy, sz, rot, color) => {
    const m = mesh(natureSurface(new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), 'foliage'), M(color, { roughness: 1 }), x, y, z);
    m.scale.set(sx, sy, sz); m.rotation.set(...rot); g.add(m);
  };
  if (moss) cap(s * 0.1, s * 0.62, 0, s * 0.82, s * 0.32, s * 0.72, [0.1, r() * 3, 0.1], 0x5a9a3a);
  if (moss && r() < 0.6) cap(-s * 0.3, s * 0.5, s * 0.25, s * 0.4, s * 0.15, s * 0.35, [0.3, 0, 0.2], 0x447a30);
  const out = bake(g); out.name = 'mossRock';
  g.traverse(o => o.geometry?.dispose());
  return out;
}
