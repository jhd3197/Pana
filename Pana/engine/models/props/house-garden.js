import * as THREE from 'three';
import { M, mesh, box } from '../core/primitives.js';
import { gardenRosette } from '../vegetation/garden-rosette.js';
import { trailingVine } from '../vegetation/trailing-vine.js';
import { trinitaria } from '../vegetation/trinitaria.js';

const clay = M(0xcf5930, { roughness: 0.9 }), rim = M(0xe0753c, { roughness: 0.9 }), soil = M(0x47372a);
export function housePlanter({ seed = 1, kind = 'rosette', scale = 1, detail = 'game', boxWidth = 0, trailHeight = 2.1 } = {}) {
  const group = new THREE.Group();
  if (boxWidth) {
    group.add(box(boxWidth, 0.3, 0.38, clay, 0, 0.15, 0), box(boxWidth + 0.08, 0.08, 0.44, rim, 0, 0.29, 0), box(boxWidth - 0.05, 0.02, 0.32, soil, 0, 0.335, 0));
  } else {
    const profile = [[0.23, 0], [0.28, 0.05], [0.36, 0.55], [0.4, 0.57], [0.4, 0.67], [0.33, 0.67], [0.32, 0.57]].map(p => new THREE.Vector2(...p));
    group.add(mesh(new THREE.LatheGeometry(profile, 10), clay));
    group.add(mesh(new THREE.CylinderGeometry(0.405, 0.405, 0.07, 10), rim, 0, 0.6, 0));
    group.add(mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.025, 10), soil, 0, 0.635, 0));
  }
  const height = boxWidth ? 0.35 : 0.65;
  if (kind === 'trailing') {
    const vine = trailingVine({ seed, detail, height: trailHeight }); vine.position.y = height - vine.userData.attachment[1]; group.add(vine);
    const crown = gardenRosette({ seed, detail }); crown.scale.setScalar(0.42); crown.position.y = height; group.add(crown);
  } else {
    const count = boxWidth ? 3 : 1;
    for (let i = 0; i < count; i++) {
      const plant = gardenRosette({ seed: seed + i, detail }); plant.scale.setScalar(boxWidth ? 0.35 : 0.85);
      plant.position.set((i - (count - 1) / 2) * boxWidth / count, height, 0); group.add(plant);
    }
  }
  group.scale.setScalar(scale); return group;
}

export function plantHouse(group, spec, detail) {
  if (spec.planting === 'ninguna') return;
  const { width: w, depth: d, plantSeed: seed } = spec, front = d / 2;
  const doors = spec.openings.filter(o => o.face === 'front' && o.floor === 0 && o.kind === 'door');
  // Corner anchors avoid the entrance regardless of whether the facade has 2 or 5 bays.
  for (const side of [-1, 1]) {
    const x = side * (w / 2 - 0.56);
    if (doors.some(door => Math.abs(x - door.x) < 1.45)) continue;
    const pot = housePlanter({ seed: seed + side, scale: side < 0 ? 0.95 : 0.78, detail });
    pot.position.set(x, spec.base, front + 0.47); group.add(pot);
  }
  if (spec.planting === 'balcon' && spec.balcony) {
    for (const side of [-1, 1]) {
      const pot = housePlanter({ seed: seed + 10 + side, kind: 'trailing', scale: 0.78, detail });
      const x = side * (w / 2 - 0.65), y = spec.base + spec.floorHeight + 0.96;
      group.add(box(0.65, 0.09, 0.5, M(0x683c24), x, y - 0.045, front + 0.94));
      pot.position.set(x, y, front + 0.94); group.add(pot);
    }
  } else if (spec.planting === 'flores') {
    const plant = trinitaria({ seed, height: spec.floors * spec.floorHeight + 0.3, detail });
    plant.position.set(-w / 2 + 0.05, spec.base, front + 0.25); group.add(plant);
  }
  if (spec.planting === 'ventanas' || spec.planting === 'balcon' && !spec.balcony) {
    for (const face of spec.faces) for (const slot of face.openings) {
      if (slot.kind !== 'window' || slot.floor > 0 && spec.balcony || face.id === 'rear') continue;
      const frame = new THREE.Group(); frame.position.set(...face.position); frame.rotation.y = face.angle;
      const pot = housePlanter({ seed: seed + Math.round((slot.x + 10) * 20), detail, boxWidth: 0.95, trailHeight: Math.min(2.1, slot.bottom + 0.3), kind: spec.planting === 'balcon' ? 'trailing' : 'rosette' });
      pot.position.set(slot.x, slot.bottom + 0.04, 0.25); frame.add(pot); group.add(frame);
    }
  }
}
