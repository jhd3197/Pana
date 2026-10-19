import * as THREE from 'three';
import { colonialHouse } from '../models/props/colonial-house.js';
import { createHouseBatch, saveHouseBatch } from '../models/props/colonial-house-spec.js';

// An evenly spaced inspection yard. Game maps provide their own streets and collisions.
export function createColonialHouseCollection({ seed = 103, houses = createHouseBatch(seed), detail = 'low' } = {}) {
  const specs = saveHouseBatch(houses).houses, group = new THREE.Group();
  const columns = Math.min(10, specs.length), rows = Math.ceil(specs.length / columns), lots = [];
  specs.forEach((spec, index) => {
    const model = colonialHouse({ spec, detail });
    const x = (index % columns - (columns - 1) / 2) * 16, z = (Math.floor(index / columns) - (rows - 1) / 2) * 14;
    model.position.set(x, 0, z); group.add(model); lots.push({ index, x, z, spec });
  });
  group.userData.houseBatch = specs; group.userData.lots = lots;
  return { group };
}
