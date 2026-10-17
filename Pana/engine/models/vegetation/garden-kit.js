// Static architectural foliage: attachment points stay fixed after town batching.
import * as THREE from 'three';
import { M, mesh } from '../core/primitives.js';
import { leafBlade, taperedStem } from '../core/botanical-shapes.js';
export const gardenLeaf = M(0xffffff, { vertexColors: true, side: THREE.DoubleSide, flatShading: false, roughness: 0.9 });
export const gardenStem = M(0x527235, { roughness: 0.9 });
export function blade(group, position, rotation, length, width, tint, bend = 0.18, segments = 4) {
  const part = mesh(leafBlade(length, width, bend, tint, segments), gardenLeaf, ...position);
  part.rotation.set(...rotation); group.add(part); return part;
}
export function stem(group, points, radius = 0.018, color = gardenStem) {
  group.add(mesh(taperedStem(points, radius, radius * 0.35, 5, 5), color));
}
