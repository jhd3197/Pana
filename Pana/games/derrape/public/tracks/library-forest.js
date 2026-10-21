// Dense, zoned library forest for circuits built before the reference-ported
// maps. A map declares a recipe as `def.forest`; background-forest.js plants it
// once the map's own environment and scenery exist, so every landmark, town,
// grandstand, lake and authored tree already standing is left clear.
import * as THREE from 'three';
import { rng } from '/engine/random.js';
import { coastalVegetation } from './coastal-vegetation.js';

const CELL = 4, HIDDEN = /terrain|horizon|grass|sky|cloud|mist|rain|fog/i;
const sstep = THREE.MathUtils.smoothstep;

// Cells where anything stands more than 0.6 m above the ground. Small objects
// mark their footprint; large baked batches mark each raised triangle's.
// Ground decals (paths, plazas, pastures: polygon-offset materials) mark
// their whole surface, however low they lie.
function occupancy(root, groundAt, [x0, z0, x1, z1]) {
  const nx = Math.ceil((x1 - x0) / CELL), nz = Math.ceil((z1 - z0) / CELL), grid = new Uint8Array(nx * nz);
  const mark = (ax, az, bx, bz) => {
    const i0 = Math.max(0, Math.floor((ax - x0) / CELL)), i1 = Math.min(nx - 1, Math.floor((bx - x0) / CELL));
    const j0 = Math.max(0, Math.floor((az - z0) / CELL)), j1 = Math.min(nz - 1, Math.floor((bz - z0) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) grid[j * nx + i] = 1;
  };
  const box = new THREE.Box3(), m = new THREE.Matrix4(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const raised = (y, x, z) => y > groundAt(x, z) + .6;
  const triangles = (geometry, matrix, decal) => {
    const p = geometry.attributes.position, index = geometry.index, count = index ? index.count : p.count;
    for (let k = 0; k < count; k += 3) {
      const ia = index ? index.getX(k) : k, ib = index ? index.getX(k + 1) : k + 1, ic = index ? index.getX(k + 2) : k + 2;
      a.fromBufferAttribute(p, ia).applyMatrix4(matrix); b.fromBufferAttribute(p, ib).applyMatrix4(matrix); c.fromBufferAttribute(p, ic).applyMatrix4(matrix);
      const minX = Math.min(a.x, b.x, c.x), maxX = Math.max(a.x, b.x, c.x), minZ = Math.min(a.z, b.z, c.z), maxZ = Math.max(a.z, b.z, c.z);
      if (maxX - minX > 40 || maxZ - minZ > 40) continue;
      if (!decal && !raised(Math.max(a.y, b.y, c.y), (minX + maxX) / 2, (minZ + maxZ) / 2)) continue;
      mark(minX, minZ, maxX, maxZ);
    }
  };
  const each = (geometry, matrix, decal) => {
    if (decal) return triangles(geometry, matrix, true);
    box.copy(geometry.boundingBox).applyMatrix4(matrix);
    const w = box.max.x - box.min.x, d = box.max.z - box.min.z;
    if (w < 60 && d < 60) {
      if (raised(box.max.y, (box.min.x + box.max.x) / 2, (box.min.z + box.max.z) / 2)) mark(box.min.x, box.min.z, box.max.x, box.max.z);
    } else if (box.max.y - box.min.y > 2.5) triangles(geometry, matrix);
  };
  root.updateMatrixWorld(true);
  root.traverse(o => {
    if (!o.isMesh || HIDDEN.test(o.name) || !o.geometry?.attributes.position) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const decal = [].concat(o.material).some(material => material?.polygonOffset);
    if (o.isInstancedMesh) for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m); m.premultiply(o.matrixWorld); each(o.geometry, m, decal); }
    else each(o.geometry, o.matrixWorld, decal);
  });
  return (x, z, r = 1) => {
    const i = Math.floor((x - x0) / CELL), j = Math.floor((z - z0) / CELL);
    for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      const ii = i + di, jj = j + dj;
      if (ii >= 0 && jj >= 0 && ii < nx && jj < nz && grid[jj * nx + ii]) return true;
    }
    return false;
  };
}

// recipe: { bounds:[x0,z0,x1,z1], count, spacing, edge (metres past the road
// edge), minY, maxSlope, clump (0 even .. 1 groves and clearings), seed,
// species:[{ name, weight, scale:[a,b], where(x,z,y,edge) -> weight factor }],
// accept(x,z,y), roadside:{ count, from, to }, whole:[species kept unsimplified] }
// `roadside` lines the route with detailed trees `from`..`to` metres past the
// edge, the near band the reference-ported maps keep at full detail.
export function libraryForest(T, recipe) {
  const group = new THREE.Group(); group.name = 'background-forest';
  const { bounds, count, spacing = 8, edge = 6, minY = .3, maxSlope = .8, clump = .5, seed = 1, species, accept = () => true, roadside } = recipe;
  const groundAt = T.terrainAt, random = rng(seed);
  const taken = occupancy(T.group, groundAt, bounds);
  // Distant crowns only cost a few dozen triangles; big cells keep draws few.
  const vegetation = coastalVegetation(group, 1, T.roadDistance, { cellSize: 900, whole: recipe.whole });
  const consider = (px, pz, pick, size, minEdge) => {
    const road = T.roadDistance(px, pz), past = road - T.HW;
    if (past < minEdge) return null;
    const y = groundAt(px, pz);
    if (!Number.isFinite(y) || y < minY) return null;
    if (Math.hypot(groundAt(px + 2, pz) - groundAt(px - 2, pz), groundAt(px, pz + 2) - groundAt(px, pz - 2)) / 4 > maxSlope) return null;
    if (T.def.waterAt?.(px, pz, 0, T) > .01 || taken(px, pz) || !accept(px, pz, y)) return null;
    let total = 0;
    const weights = species.map(s => { const w = s.weight * (s.where ? s.where(px, pz, y, past) : 1); total += w; return w; });
    if (total <= 0) return null;
    let k = 0; for (let r = pick * total; k < species.length - 1 && (r -= weights[k]) > 0; k++);
    const s = species[k], [lo, hi] = s.scale ?? [.85, 1.25];
    return { name: s.name, x: px, z: pz, y, scale: lo + (hi - lo) * size, road };
  };
  const candidates = [];
  for (let z = bounds[1]; z < bounds[3]; z += spacing) for (let x = bounds[0]; x < bounds[2]; x += spacing) {
    const px = x + random() * spacing, pz = z + random() * spacing, keep = random(), pick = random(), size = random();
    // Groves and clearings rather than an even carpet.
    const grove = .5 + .5 * Math.sin(px * .017 + Math.sin(pz * .013) * 2.2) * Math.cos(pz * .019 - px * .007);
    if (keep > 1 - clump + clump * sstep(grove, .25, .75)) continue;
    const tree = consider(px, pz, pick, size, edge);
    if (tree) candidates.push({ ...tree, rank: grove + random() * .2 });
  }
  // The cap takes whole groves, strongest first: an even thinning would leave
  // lone trees, and a lone distant tree keeps its trunk (several times the
  // triangles of a crown inside a dense stand).
  candidates.sort((a, b) => b.rank - a.rank);
  const planted = candidates.slice(0, count);
  if (roadside) {
    const { from = 6, to = 16 } = roadside, step = T.TOTAL / (roadside.count * 2.5), near = [];
    for (let s = random() * step; s < T.TOTAL && near.length < roadside.count; s += step * (.6 + random() * .8)) {
      const a = T.pointAt(s), b = T.pointAt(s + 1), l = Math.hypot(b.x - a.x, b.y - a.y) || 1, side = random() < .5 ? -1 : 1;
      const off = T.HW + from + random() * (to - from), px = a.x - (b.y - a.y) / l * off * side, pz = a.y + (b.x - a.x) / l * off * side;
      if (near.some(p => Math.hypot(p.x - px, p.z - pz) < 7)) continue;
      const tree = consider(px, pz, random(), random(), from - .5);
      if (tree) near.push(tree);
    }
    planted.push(...near);
  }
  for (const p of planted) vegetation.add(p.name, p.x, p.z, p.y, p.scale, p.road);
  vegetation.flush();
  group.userData.treeCount = group.userData.libraryTrees;
  return group;
}
