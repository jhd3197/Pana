import * as THREE from 'three';
import { gameDetail } from '/engine/models/characters/pana/detail.js';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';

// A small CPU template cache avoids resampling identical bodies for every player.
// Instances clone buffers so disposal and later edits remain independent. The
// shape is the same for every coat colour: the template keeps each vertex's
// paw blend and every pana paints its own colours from it.
const templates = new Map();

// A continuous exposed body using the franela's broad chest and shoulders.
// Build the union with the arms extended: fusing them against the flanks in
// the relaxed pose welds the forearms to the belly and makes a web when waving.
// The skeleton brings this bind pose back to the shared relaxed arm pose.
export function createFurFoundation({ body, arms, material, texture, fur }) {
  const original = body.getObjectByName('Continuous belly and legs');
  const neck = body.getObjectByName('Neck'), armMeshes = arms.map(a => a.getObjectByName('Arm and mitten'));
  const cloth = material('Fuller continuous fur', '#ffffff', { vertexColors: true, bumpMap: texture, bumpScale: 0.006 });
  const resolution = gameDetail() ? 44 : 80, half = resolution / 2, extent = new THREE.Vector3(1.72, 1.28, 0.72);
  const rest = arms.map(a => a.quaternion.clone());
  arms.forEach((arm, i) => arm.rotation.set(0, 0, (i ? -1 : 1) * Math.PI / 2));
  body.updateMatrixWorld(true);
  const inverse = arms.map(a => a.quaternion.clone().invert());
  const restInverse = rest.map(q => q.clone().invert());
  const local = new THREE.Vector3();
  const smooth = THREE.MathUtils.smoothstep;
  const ellipsoid = (x, y, z, rx, ry, rz) => {
    const k0 = Math.hypot(x / rx, y / ry, z / rz);
    const k1 = Math.hypot(x / (rx * rx), y / (ry * ry), z / (rz * rz));
    return k0 * (k0 - 1) / Math.max(0.00001, k1);
  };
  const union = (a, b, k) => {
    const h = Math.max(k - Math.abs(a - b), 0) / k;
    return Math.min(a, b) - h * h * k * 0.25;
  };
  const torsoDistance = (x, y, z) => {
    const fuller = smooth(y, 0.9, 1.25), taper = 1 - 0.14 * (y - 1.13) / 0.72;
    let d = ellipsoid(x, y - 1.13, z + 0.015, 0.77 * taper + 0.025 * fuller, 0.72, 0.54);
    d = union(d, ellipsoid(x, y - 1.52, z + 0.01, 0.66, 0.34, 0.36), 0.12);
    return union(d, ellipsoid(x, y - 1.84, z, 0.41, 0.36, 0.35), 0.12);
  };
  const bodyDistance = (x, y, z) => {
    let d = torsoDistance(x, y, z);
    for (const sign of [-1, 1]) d = union(d, ellipsoid(x - sign * 0.46, y - 0.44, z, 0.305, 0.39, 0.34), 0.20);
    return d;
  };
  const armDistance = (x, y, z, side, rotation = inverse) => {
    local.set(x, y, z).sub(arms[side].position).applyQuaternion(rotation[side]);
    const bulge = 0.035 * smooth(local.y, -0.65, -0.1);
    const rx = 0.215 + bulge, rz = 0.23 + bulge, h = (local.y + 0.43) / 0.57;
    const radial = Math.max(0.00001, Math.hypot(local.x / rx, (local.z - 0.025) / rz));
    const power = 2 / 0.68, derivative = power * radial ** (power - 2);
    const f = radial ** power + h * h - 1;
    const gradient = Math.hypot(derivative * local.x / (rx * rx), 2 * h / 0.57, derivative * (local.z - 0.025) / (rz * rz));
    return f / Math.max(1, gradient);
  };
  const distance = (x, y, z, rotation = inverse) => {
    let d = bodyDistance(x, y, z);
    for (let side = 0; side < 2; side++) d = union(d, armDistance(x, y, z, side, rotation), 0.12);
    return d;
  };
  const cacheKey = `${resolution}`, brown = new THREE.Color('#643215');
  const paint = (geometry, paws) => {
    const colors = []; for (const paw of paws) colors.push(...fur.color.clone().lerp(brown, paw).toArray());
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  };
  let geometry = templates.get(cacheKey)?.geometry.clone();
  if (geometry) paint(geometry, templates.get(cacheKey).paws);
  else {
    const mc = new MarchingCubes(resolution, cloth, false, false, 50000); mc.isolation = 0;
    for (let z = 0; z < resolution; z++) for (let y = 0; y < resolution; y++) for (let x = 0; x < resolution; x++) {
      const px = (x - half) / half * extent.x, py = (y - half) / half * extent.y + 1, pz = (z - half) / half * extent.z;
      mc.field[z * resolution * resolution + y * resolution + x] = -distance(px, py, pz);
    }
    mc.update();
    const count = mc.geometry.drawRange.count; geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(mc.geometry.attributes.position.array.slice(0, count * 3), 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(mc.geometry.attributes.normal.array.slice(0, count * 3), 3));
    const p = geometry.attributes.position, n = geometry.attributes.normal, paws = [], weights = [], indices = [], uvs = [];
    const normal = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) * extent.x, y = p.getY(i) * extent.y + 1, z = p.getZ(i) * extent.z;
      p.setXYZ(i, x, y, z);
      normal.fromBufferAttribute(n, i).divide(extent).normalize(); n.setXYZ(i, normal.x, normal.y, normal.z);
      const side = x >= 0 ? 0 : 1, armD = armDistance(x, y, z, side), torsoD = bodyDistance(x, y, z);
      const armY = local.y, armX = local.x;
      const ownership = smooth(torsoD - armD, -0.10, 0.16);
      const armWeight = ownership * (1 - smooth(armY, -0.27, 0.15));
      const legWeight = (1 - armWeight) * (1 - smooth(y, 0.44, 0.93));
      const remaining = 1 - armWeight - legWeight;
      weights.push(remaining, legWeight, armWeight, 0);
      indices.push(0, side + 1, side + 3, 0);
      const boundary = -0.70 + Math.sin(armX * 16) * 0.015;
      const paw = (1 - smooth(armY, boundary - 0.065, boundary + 0.065)) * smooth(torsoD - armD, -0.02, 0.06);
      paws.push(paw);
      uvs.push(Math.atan2(z, x) / (Math.PI * 2) + 0.5, y / 2);
    }
    paint(geometry, paws);
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
    mc.geometry.dispose();
    if (templates.size >= 4) { const key = templates.keys().next().value; templates.get(key).geometry.dispose(); templates.delete(key); }
    templates.set(cacheKey, { geometry: geometry.clone(), paws });
  }
  const p = geometry.attributes.position;
  const group = new THREE.Group(); group.name = 'Fuller exposed body'; body.add(group);
  const garment = new THREE.SkinnedMesh(geometry, cloth); garment.name = 'Fuller fur torso and shoulders';
  garment.castShadow = garment.receiveShadow = true; garment.frustumCulled = false; group.add(garment);
  body.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton([...original.skeleton.bones, ...arms]); garment.bind(skeleton);
  arms.forEach((arm, i) => arm.quaternion.copy(rest[i])); body.updateMatrixWorld(true); skeleton.update();
  return {
    group, garment, cloth,
    createFitGeometry() {
      // Apron fitting needs the relaxed surface, not the extended bind pose.
      body.updateMatrixWorld(true); skeleton.update();
      const result = geometry.clone(), positions = result.attributes.position, point = new THREE.Vector3();
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(p, i); garment.applyBoneTransform(i, point);
        positions.setXYZ(i, point.x, point.y, point.z);
      }
      return result;
    },
    fitPoint(point, clearance = 0.026, armAmount = 0) {
      const epsilon = 0.001, normal = new THREE.Vector3();
      // A shirt wraps the torso below its armholes; it must not be projected
      // around the nearby hands as though they were part of the waist.
      const clothDistance = (x, y, z) => THREE.MathUtils.lerp(bodyDistance(x, y, z), distance(x, y, z, restInverse), Math.max(armAmount, smooth(y, 1.35, 1.60)));
      for (let step = 0; step < 5; step++) {
        const { x, y, z } = point, d = clothDistance(x, y, z);
        if (d >= clearance - 0.0001) break;
        normal.set(clothDistance(x + epsilon, y, z) - clothDistance(x - epsilon, y, z),
          clothDistance(x, y + epsilon, z) - clothDistance(x, y - epsilon, z),
          clothDistance(x, y, z + epsilon) - clothDistance(x, y, z - epsilon)).normalize();
        point.addScaledVector(normal, Math.min(0.05, clearance - d));
      }
      return point;
    },
    setVisible(value) {
      group.visible = value; original.visible = neck.visible = !value;
      armMeshes.forEach(arm => { arm.visible = !value; });
    },
    dispose() { skeleton.dispose(); },
  };
}
