// Studio demonstration and reusable scenery assembly; games own placement/collision.
import * as THREE from 'three';
import { M, box } from '../models/core/primitives.js';
import { colonialHouse } from '../models/props/colonial-house.js';
import { createHouseSpec } from '../models/props/colonial-house-spec.js';
import { HOUSE_PRESETS } from '../models/props/colonial-house-definitions.js';

export function createColonialStreet({ seed = 70, detail = 'game' } = {}) {
  const group = new THREE.Group(), lots = [], grade = x => 0.8 + x * 0.009;
  const total = 54;
  for (const [width, depth, material, lift] of [[total + 5, 27, 0xb0b38c, -0.18], [total + 5, 13, 0xd9c7a5, 0], [total + 5, 8.5, 0x8f8d81, 0.03]]) {
    const surface = box(width, 0.18, depth, M(material), 0, grade(0) + lift - 0.09, 0);
    surface.rotation.z = Math.atan(0.009); group.add(surface);
  }
  for (const side of [-1, 1]) {
    let edge = -total / 2 + 2;
    for (let i = 0; i < 5; i++) {
      const preset = HOUSE_PRESETS[(i + (side > 0 ? 3 : 0)) % HOUSE_PRESETS.length];
      const spec = createHouseSpec({ ...preset, seed: (seed + i * 19 + (side + 1) * 47) >>> 0 });
      const x = edge + spec.width / 2, z = side * (6.6 + spec.depth / 2), rotation = side > 0 ? Math.PI : 0;
      const bottom = grade(x - spec.width / 2) - 0.08, y = grade(x + spec.width / 2) + 0.08;
      group.add(box(spec.width, y - bottom, spec.depth, M(0xc9b690), x, (bottom + y) / 2, z));
      const house = colonialHouse({ spec, detail }); house.position.set(x, y, z); house.rotation.y = rotation; group.add(house);
      lots.push({ id: `lot-${side}-${i}`, x, y, z, rotation, spec }); edge += spec.width + 2.5;
    }
  }
  group.name = 'Calle de las flores'; group.userData.lots = lots;
  return { group };
}
