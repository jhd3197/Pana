import * as THREE from 'three';
import { M, box, mesh } from '/engine/models/core/primitives.js';
import { woodSign } from '/engine/models/props/wood-sign.js';

// A separate short circuit on a timber pier beside the island's fishing harbor.
export function createHarborBoard(scene, tileTop, groundAt) {
  const group = new THREE.Group(), tiles = [], count = 32;
  const wood = M(0xa87240), posts = M(0x60432d), side = M(0x624528);
  const points = Array.from({ length: count }, (_, i) => {
    const angle = Math.PI / 2 + i / count * Math.PI * 2;
    return { x: 153 + Math.cos(angle) * 21, z: 44 + Math.sin(angle) * 29 };
  });
  const deck = Math.max(2.4, ...points.map(p => groundAt(p.x, p.z) + .8));
  points.forEach((p, i) => {
    const kind = i === 0 ? 'start' : i % 5 === 3 ? 'event' : i % 6 === 5 ? 'red' : 'blue';
    const top = mesh(new THREE.BoxGeometry(3.3, .4, 3.3), [side, side, tileTop(kind), side, side, side], p.x, deck + .2, p.z);
    top.castShadow = top.receiveShadow = true; group.add(top);
    tiles.push({ i, kind, baseKind: kind, ...p, inX: 153 - p.x, inZ: 44 - p.z, ground: deck, y: deck + .4, next: [(i + 1) % count], mesh: top });
    const next = points[(i + 1) % count], dx = next.x - p.x, dz = next.z - p.z, distance = Math.hypot(dx, dz);
    for (let k = 0; k < 8; k++) {
      const t = (k + .5) / 8;
      const plank = box(12, .25, distance / 8 - .025, wood, p.x + dx * t, deck - .125, p.z + dz * t);
      plank.rotation.y = Math.atan2(dx, dz); plank.receiveShadow = true; group.add(plank);
    }
    for (const offset of [-4.8, 4.8]) {
      const x = p.x + dz / distance * offset, z = p.z - dx / distance * offset;
      const bottom = Math.min(-3, groundAt(x, z)), height = deck - bottom;
      group.add(mesh(new THREE.CylinderGeometry(.25, .35, height, 8), posts, x, bottom + height / 2, z));
    }
  });
  const sign = woodSign(['MUELLE', 'DE LOS PANAS'], { w: 6, h: 3 });
  sign.position.set(153, deck, 80); group.add(sign);
  scene.add(group); group.visible = false;
  return { group, tiles, deck };
}
