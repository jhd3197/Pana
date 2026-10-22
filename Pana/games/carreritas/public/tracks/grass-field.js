import * as THREE from 'three';
import { rng } from '/engine/models/core/primitives.js';
import { savannaGrass } from '/engine/models/vegetation/savanna-grass.js';
import { natureStyle } from './nature-material.js';
import { clear } from './world-kit.js';

class GrassMaterial extends THREE.MeshStandardMaterial {
  constructor() {
    super({ color: 0xffffff, vertexColors: true, side: THREE.DoubleSide, roughness: 1 });
    this.userData.grassTime = { value: 0 };
  }
  customProgramCacheKey() { return 'carreritas-ground-grass-v1'; }
  onBeforeCompile(shader) {
    shader.uniforms.grassTime = this.userData.grassTime;
    shader.vertexShader = `uniform float grassTime;\n${shader.vertexShader}`.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 grassRoot = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      float grassFade = 1.0 - smoothstep(45.0, 95.0, distance(cameraPosition, grassRoot));
      transformed.x += sin(grassTime * 1.6 + grassRoot.x * 0.31 + grassRoot.z * 0.27) * position.y * position.y * 0.10;
      transformed *= grassFade;`);
  }
}

// A single instanced draw, no alpha planes or shadows per blade. Deterministic
// shuffled placements let Medium draw an evenly distributed first third.
export function createGrassField(placements, { seed = 73, dry = false, height = 0.85 } = {}) {
  const group = new THREE.Group(); group.name = 'ground-grass';
  if (!placements.length) return group;
  const prototype = savannaGrass({ seed, height, dry, detail: 'ground' }).children[0];
  const material = new GrassMaterial(), field = new THREE.InstancedMesh(prototype.geometry, material, placements.length);
  const dummy = new THREE.Object3D();
  for (const [i, p] of placements.entries()) {
    dummy.position.set(p.x, p.y, p.z); dummy.rotation.y = p.rot;
    dummy.scale.setScalar(p.scale); dummy.updateMatrix(); field.setMatrixAt(i, dummy.matrix);
  }
  field.name = 'ground-grass-tufts'; field.receiveShadow = true; field.castShadow = false;
  field.computeBoundingSphere(); field.userData.detailLevel = 1;
  field.userData.grassField = { full: placements.length, medium: Math.ceil(placements.length / 3) };
  // Decorative blades are neither terrain nor an obstacle/picking surface.
  field.raycast = () => {};
  group.add(field); group.userData.placements = placements;
  group.userData.tick = t => { field.material.userData.grassTime.value = t; };
  let disposed = false;
  group.userData.dispose = () => { if (!disposed) { disposed = true; material.dispose(); } };
  return group;
}

// All current race heightfields share the same two triangles per grid cell.
// Sample the actual vertices and coverage, not an analytic hill approximation.
export function grassAt(land, x, z) {
  const { bounds: [x0, z0, x1, z1], nx, nz } = land.userData.grassGrid;
  const gx = (x - x0) / (x1 - x0) * nx, gz = (z - z0) / (z1 - z0) * nz;
  const ix = Math.floor(gx), iz = Math.floor(gz);
  if (ix < 0 || iz < 0 || ix >= nx || iz >= nz) return null;
  const tx = gx - ix, tz = gz - iz, a = iz * (nx + 1) + ix;
  const ids = tx + tz <= 1 ? [a, a + 1, a + nx + 1] : [a + nx + 2, a + 1, a + nx + 1];
  const weights = tx + tz <= 1 ? [1 - tx - tz, tx, tz] : [tx + tz - 1, 1 - tz, 1 - tx];
  const p = land.geometry.attributes.position, mask = land.geometry.attributes.natureSurface;
  return { y: ids.reduce((sum, v, i) => sum + p.getY(v) * weights[i], 0), coverage: ids.reduce((sum, v, i) => sum + mask.getX(v) * 3 * weights[i], 0) };
}

// Large static batches span whole neighborhoods. Restrict downward cover rays
// to a 24 m cell, so each tuft doesn't raycast every roof and paving triangle.
// These temporary CPU-only meshes borrow attributes; they never enter a scene.
function covered(blocker, ray, point) {
  const object = blocker.object, geometry = object.geometry;
  if (object.isInstancedMesh || Array.isArray(object.material) || (geometry.index?.count || geometry.attributes.position.count) < 6000) return ray.intersectObject(object, false).length > 0;
  if (!blocker.cells) {
    const cells = new Map(), p = geometry.attributes.position, index = geometry.index;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), local = new THREE.Vector3();
    for (let i = 0, count = index?.count || p.count; i < count; i += 3) {
      const ids = index ? [index.getX(i), index.getX(i + 1), index.getX(i + 2)] : [i, i + 1, i + 2];
      a.fromBufferAttribute(p, ids[0]).applyMatrix4(object.matrixWorld);
      b.fromBufferAttribute(p, ids[1]).applyMatrix4(object.matrixWorld);
      c.fromBufferAttribute(p, ids[2]).applyMatrix4(object.matrixWorld);
      if (Math.abs((b.x - a.x) * (c.z - a.z) - (c.x - a.x) * (b.z - a.z)) < 1e-9) continue;
      const x0 = Math.floor(Math.min(a.x, b.x, c.x) / 24), x1 = Math.floor(Math.max(a.x, b.x, c.x) / 24);
      const z0 = Math.floor(Math.min(a.z, b.z, c.z) / 24), z1 = Math.floor(Math.max(a.z, b.z, c.z) / 24);
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
        const key = `${x},${z}`;
        if (!cells.has(key)) cells.set(key, { indices: [], bounds: new THREE.Box3() });
        const cell = cells.get(key); cell.indices.push(...ids);
        for (const id of ids) cell.bounds.expandByPoint(local.fromBufferAttribute(p, id));
      }
    }
    blocker.cells = new Map();
    for (const [key, cell] of cells) {
      const proxy = new THREE.BufferGeometry(); proxy.setAttribute('position', p); proxy.setIndex(cell.indices);
      proxy.boundingBox = cell.bounds; proxy.boundingSphere = cell.bounds.getBoundingSphere(new THREE.Sphere());
      const mesh = new THREE.Mesh(proxy, object.material); mesh.matrixWorld.copy(object.matrixWorld);
      blocker.cells.set(key, mesh);
    }
  }
  const proxy = blocker.cells.get(`${Math.floor(point.x / 24)},${Math.floor(point.z / 24)}`);
  return proxy ? ray.intersectObject(proxy, false).length > 0 : false;
}

export function raceGrass(group, T) {
  const lands = [], blockers = [];
  group.updateMatrixWorld(true);
  group.traverse(o => {
    if (!o.isMesh) return;
    if (o.userData.grassGrid) { lands.push(o); return; }
    if (o.userData.worldContinuation || o.geometry.attributes.natureSurface) return;
    blockers.push({ object: o, bounds: new THREE.Box3().setFromObject(o) });
  });
  const style = natureStyle(T.id), random = rng(style.seed), candidates = [];
  for (let s = 0; s < T.TOTAL; s += 8) for (const side of [-1, 1]) {
    const p = T.pointAt(s), q = T.pointAt(s + 0.5), h = Math.atan2(q.x - p.x, q.y - p.y);
    const off = side * (T.HW + 8 + random() * 6);
    const cx = p.x - Math.cos(h) * off, cz = p.y + Math.sin(h) * off;
    for (let i = 0; i < 5; i++) candidates.push({ x: cx + (random() - 0.5) * 5, z: cz + (random() - 0.5) * 5, rot: random() * Math.PI * 2, scale: 0.8 + random() * 0.5 });
  }
  for (let i = candidates.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [candidates[i], candidates[j]] = [candidates[j], candidates[i]]; }
  const ray = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, 1.47), placements = [];
  const max = ['delta', 'salto', 'cuevas', 'salinas'].includes(T.id) ? 1000 : 1800;
  for (const p of candidates) {
    const land = lands.find(o => grassAt(o, p.x, p.z)); if (!land) continue;
    const surface = grassAt(land, p.x, p.z);
    if (surface.coverage < 0.8 || surface.y < 0.25 || !clear(T, p.x, p.z, 0.8) || (T.def.waterAt?.(p.x, p.z, 0, T) || 0) > 0.05) continue;
    const supports = [[0, 0], [-0.65, 0], [0.65, 0], [0, -0.65], [0, 0.65]].map(([x, z]) => grassAt(land, p.x + x, p.z + z));
    if (supports.some(s => !s || s.coverage < 0.65) || Math.max(...supports.map(s => s.y)) - Math.min(...supports.map(s => s.y)) > 0.4) continue;
    ray.ray.origin.set(p.x, surface.y + 1.5, p.z);
    // Low occluders include sidewalks, paved lots, water and foundations. Tall
    // roofs don't need a ray: a tuft below a closed building is already hidden.
    if (blockers.some(blocker => { const b = blocker.bounds; return p.x >= b.min.x && p.x <= b.max.x && p.z >= b.min.z && p.z <= b.max.z && b.min.y <= surface.y + 1.5 && b.max.y >= surface.y + 0.03 && covered(blocker, ray, p); })) continue;
    placements.push({ ...p, y: Math.min(...supports.map(s => s.y)) - 0.025 });
    if (placements.length >= max) break;
  }
  for (const blocker of blockers) blocker.cells?.forEach(proxy => proxy.geometry.dispose());
  return createGrassField(placements, { seed: style.seed, dry: T.id === 'llanos' || T.id === 'desierto', height: T.id === 'estadio' ? 0.55 : 0.85 });
}
