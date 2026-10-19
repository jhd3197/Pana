// Continuous terrain and sandstone table mountains for the archipelago.
// Distant vegetation is instanced; the terrain functions also place props.
import * as THREE from 'three';
import { rng } from '/engine/models/core/primitives.js';
import { SEA, fbm, smooth } from './island-terrain.js';
import { terrainMaterial } from './terrain-material.js';
import { waterfall as waterfallEffect } from '../models/effects/waterfall.js';
import { waterPool } from '../models/effects/water-surface.js';
import { tickWind } from '../models/vegetation/plant-kit.js';

const sand = new THREE.Color(0xe7d3a0);
const grass = new THREE.Color(0x679c4c);
const forest = new THREE.Color(0x315f43);
const stone = new THREE.Color(0x78614d);
const sandstone = new THREE.Color(0xbe9568);
const shallow = new THREE.Color(0x69c8c4);
const deep = new THREE.Color(0x2a7fa8);
const landMaterial = terrainMaterial();
const treeGeometry = new THREE.IcosahedronGeometry(1, 1);
const treeMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });

function terrainMesh(geometry, name) {
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, landMaterial);
  mesh.name = name;
  return mesh;
}

function addForest(group, points, seed) {
  const random = rng(seed), matrix = new THREE.Matrix4(), color = new THREE.Color();
  const mesh = new THREE.InstancedMesh(treeGeometry, treeMaterial, points.length);
  mesh.name = 'Distant forest';
  points.forEach(([x, y, z, size], i) => {
    matrix.compose(new THREE.Vector3(x, y + size * 0.6, z), new THREE.Quaternion(), new THREE.Vector3(size, size * (0.65 + random() * 0.3), size * 0.85));
    mesh.setMatrixAt(i, matrix);
    color.copy(forest).lerp(grass, random() * 0.7);
    mesh.setColorAt(i, color);
  });
  mesh.computeBoundingSphere();
  group.add(mesh);
}

export function createIslet({ radius = 40, height = 18, seed = 1, wooded = true } = {}) {
  const group = new THREE.Group();
  const heightAt = (x, z) => {
    const a = Math.atan2(z, x);
    const warp = 1 + Math.sin(a * 3 + seed) * 0.1 + Math.sin(a * 5 - seed) * 0.055;
    const q = Math.hypot(x / 1.16, z / 0.87) / (radius * warp);
    const coast = smooth((1.12 - q) / 0.32);
    const hills = Math.pow(smooth((0.88 - q) / 0.72), 1.3);
    return SEA - 3 + coast * 4.6 + height * hills * (0.58 + fbm(x * 0.035 + seed, z * 0.04) * 0.7);
  };
  const geo = new THREE.PlaneGeometry(radius * 3, radius * 2.5, 64, 56);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, heightAt(p.getX(i), p.getZ(i)));
  geo.computeVertexNormals();
  const colors = [], c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (y < SEA + 0.18) c.copy(shallow).lerp(deep, smooth((SEA - y) / 3));
    else {
      c.copy(grass).lerp(forest, fbm(x * 0.065 + seed, z * 0.065) * 0.65);
      c.lerp(sand, 1 - smooth((y - SEA - 0.3) / 2));
      c.lerp(stone, smooth((0.77 - geo.attributes.normal.getY(i)) / 0.3) * 0.6);
    }
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  group.add(terrainMesh(geo, 'Organic island'));
  if (wooded) {
    const random = rng(seed + 100), points = [];
    for (let i = 0; i < 100; i++) {
      const x = (random() - 0.5) * radius * 1.7, z = (random() - 0.5) * radius * 1.3;
      const y = heightAt(x, z);
      if (y > SEA + 3) points.push([x, y, z, 1.4 + random() * 2]);
    }
    addForest(group, points, seed);
  }
  return { group, heightAt };
}

export function createTepui({ width = 115, depth = 75, height = 130, seed = 1, waterfall = false } = {}) {
  const group = new THREE.Group(), random = rng(seed);
  // Rock shelves interrupt the vertical wall; a broad talus apron grounds it.
  const profile = [[1.22,-0.02],[1.12,0.01],[0.98,0.06],[0.84,0.18],[0.76,0.23],
    [0.73,0.3],[0.72,0.43],[0.7,0.45],[0.69,0.58],[0.7,0.61],
    [0.67,0.76],[0.68,0.79],[0.65,0.96],[0.64,1],[0.56,1.015],[0.3,1.025],[0,1.02]];
  const levels = [];
  for (let i = 0; i < profile.length - 1; i++) {
    const [ra, ya] = profile[i], [rb, yb] = profile[i + 1];
    const count = Math.max(1, Math.ceil(Math.abs(yb - ya) * height / 3));
    for (let k = 0; k < count; k++) levels.push([THREE.MathUtils.lerp(ra, rb, k / count), THREE.MathUtils.lerp(ya, yb, k / count)]);
  }
  levels.push(profile[profile.length - 1]);
  const contour = a => (1 + Math.sin(a * 3 + seed) * 0.12 + Math.sin(a * 5 - seed) * 0.065 + Math.sin(a * 11 + 0.5) * 0.035)
    / (Math.abs(Math.cos(a)) ** 4 + Math.abs(Math.sin(a)) ** 4) ** 0.25;
  const surfaceY = (a, y, x, z) => SEA + y * height + (Math.sin(a * 7 + seed) * 2.3 + Math.sin(a * 17 + seed) * 1.1) * smooth(y / 0.25) * Math.min(1, Math.hypot(x / width, z / depth) * 8)
    + (fbm(x * 0.07 + seed, z * 0.07) - 0.5) * (y > 0.97 ? 3 : 1.2);
  const heightAt = (x, z) => {
    const a = Math.atan2(z / depth, x / width), q = Math.hypot(x / width, z / depth) / contour(a);
    for (let i = 0; i < levels.length - 1; i++) {
      const [ra, ya] = levels[i], [rb, yb] = levels[i + 1];
      if (q <= ra && q >= rb) return surfaceY(a, THREE.MathUtils.lerp(ya, yb, (ra - q) / (ra - rb)), x, z);
    }
    return q < 0.3 ? surfaceY(a, 1.02, x, z) : SEA - 3;
  };
  const pos = [], colors = [], indices = [], segments = 128, c = new THREE.Color();
  for (let ring = 0; ring < levels.length; ring++) {
    const [radius, y] = levels[ring];
    for (let i = 0; i <= segments; i++) {
      const a = i / segments * Math.PI * 2;
      const grooves = y > 0.23 && y < 1.01 ? 1 + Math.sin(a * 17 + seed) * 0.033 + Math.cos(a * 37) * 0.018
        + (fbm(Math.cos(a) * 18 + seed, Math.sin(a) * 18 + y * 35) - 0.5) * 0.035 : 1;
      const r = radius * contour(a) * grooves;
      const x = Math.cos(a) * width * r, z = Math.sin(a) * depth * r;
      const h = surfaceY(a, y, x, z);
      pos.push(x, h, z);
      if (y < 0) c.copy(shallow);
      else if (y < 0.23 || y >= 1) c.copy(forest).lerp(grass, fbm(x * 0.05, z * 0.05) * 0.85);
      else {
        const band = 0.45 + Math.sin(y * 85 + Math.sin(a * 3) * 1.3) * 0.18;
        const streak = Math.pow(Math.max(0, Math.sin(a * 23 + seed)), 8) * 0.28;
        c.copy(stone).lerp(sandstone, THREE.MathUtils.clamp(band + fbm(x * 0.08, z * 0.08) * 0.4 - streak, 0, 1));
        c.lerp(forest, Math.pow(Math.max(0, Math.cos(a * 13 + seed)), 10) * 0.25);
      }
      colors.push(c.r, c.g, c.b);
      if (ring < levels.length - 1 && i < segments) {
        const k = ring * (segments + 1) + i, next = k + segments + 1;
        indices.push(k, next, k + 1, k + 1, next, next + 1);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  group.add(terrainMesh(geo, 'Layered sandstone tepui'));

  const points = [];
  for (let i = 0; i < 850; i++) {
    const a = random() * Math.PI * 2;
    const r = i < 740 ? 0.83 + random() * 0.29 : Math.sqrt(random()) * 0.53;
    const x = Math.cos(a) * width * r * contour(a), z = Math.sin(a) * depth * r * contour(a);
    points.push([x, heightAt(x, z), z, 3.2 + random() * 3.8]);
  }
  addForest(group, points, seed + 1);

  let fall = null, pool = null;
  if (waterfall) {
    const a = Math.PI / 2, crestZ = depth * 0.64 * contour(a), footZ = depth * 1.13 * contour(a);
    const top = heightAt(0, crestZ - 0.4) + 0.5, bottom = heightAt(0, footZ) + 0.4;
    fall = waterfallEffect({ width: 11, height: top - bottom, run: footZ - crestZ - 6, seed });
    fall.position.set(0, bottom, footZ); group.add(fall);
    pool = waterPool(13, 7.8, { color: 0x54adb2, depth: 3.5 });
    pool.position.set(0, bottom + 0.03, footZ + 3);
    group.add(pool);
  }
  return {
    group, heightAt,
    update(t) {
      tickWind(t);
      fall?.userData.tick(t);
      pool?.userData.tick(t);
    },
  };
}
