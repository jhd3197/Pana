import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Merge every static mesh under `root` into one mesh per material.
// Textured and transparent meshes stay separate. Vertex colors are retained
// for foliage's top-to-bottom color variation. With `tint`, plain standard
// materials that differ only in colour share one batch: each mesh's exact
// linear colour moves into its vertices (as racer batching does), so a prop
// of twenty paints is one draw. The new materials are in userData.tinted.
const KEPT = ['position', 'normal', 'color', 'natureSurface'];
const plain = a => a && !a.isInterleavedBufferAttribute && !a.normalized && a.array instanceof Float32Array;

// Unindexes one attribute. Float32 data (nearly all of it) gets its own copy
// loop so the engine keeps it monomorphic; other types share the generic one.
function expandFloats(source, index, size, target) {
  for (let i = 0, k = 0; i < index.length; i++) { const at = index[i] * size; for (let j = 0; j < size; j++) target[k++] = source[at + j]; }
}
function expandAny(source, index, stride, offset, size, count, target) {
  for (let i = 0, k = 0; i < count; i++) { const at = (index ? index[i] : i) * stride + offset; for (let j = 0; j < size; j++) target[k++] = source[at + j]; }
}

// One mesh's batch geometry in world space, unindexed, in a single pass: the
// clone + toNonIndexed + applyMatrix4 sequence it replaces cost most of a
// map's bake in copies and per-vertex accessor calls. Same arithmetic, same
// float rounding (positions as Vector3.applyMatrix4, normals as
// applyNormalMatrix). Null when the slow path must handle the mesh.
function flatten(m) {
  const g = m.geometry, position = g.attributes.position, normal = g.attributes.normal;
  if (m.isSkinnedMesh || g.morphAttributes.position?.length || !plain(position) || !plain(normal)) return null;
  const index = g.index?.array, count = index ? index.length : position.count, out = new THREE.BufferGeometry();
  for (const name of Object.keys(g.attributes)) {
    if (!KEPT.includes(name)) continue;
    const from = g.attributes[name], size = from.itemSize, array = new from.array.constructor(count * size);
    if (from.isInterleavedBufferAttribute) expandAny(from.data.array, index, from.data.stride, from.offset, size, count, array);
    else if (!index) array.set(from.array.subarray(0, count * size));
    else if (array instanceof Float32Array) expandFloats(from.array, index, size, array);
    else expandAny(from.array, index, size, 0, size, count, array);
    out.setAttribute(name, new THREE.BufferAttribute(array, size, from.normalized));
  }
  const e = m.matrixWorld.elements, p = out.attributes.position.array;
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i], y = p[i + 1], z = p[i + 2], w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
    p[i] = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w;
    p[i + 1] = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w;
    p[i + 2] = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
  }
  const n3 = new THREE.Matrix3().getNormalMatrix(m.matrixWorld).elements, n = out.attributes.normal.array;
  for (let i = 0; i < n.length; i += 3) {
    let x = n[i], y = n[i + 1], z = n[i + 2];
    const tx = n3[0] * x + n3[3] * y + n3[6] * z, ty = n3[1] * x + n3[4] * y + n3[7] * z, tz = n3[2] * x + n3[5] * y + n3[8] * z;
    const inverse = 1 / (Math.sqrt(tx * tx + ty * ty + tz * tz) || 1);
    x = tx * inverse; y = ty * inverse; z = tz * inverse;
    n[i] = x; n[i + 1] = y; n[i + 2] = z;
  }
  return out;
}

// The general path: any mesh the single pass does not cover.
function flattenSlowly(m) {
  let geo = m.geometry.clone();
  if (m.isSkinnedMesh || m.geometry.morphAttributes.position?.length) freeze(m, geo);
  geo.morphAttributes = {}; geo.deleteAttribute('skinIndex'); geo.deleteAttribute('skinWeight');
  if (geo.index) { const indexed = geo; geo = indexed.toNonIndexed(); indexed.dispose(); }
  for (const name of Object.keys(geo.attributes)) if (!KEPT.includes(name)) geo.deleteAttribute(name);
  if (!geo.attributes.normal) geo.computeVertexNormals();
  geo.applyMatrix4(m.matrixWorld);
  return geo;
}

// Static statues can use the shared animated character. Freeze the current
// skin/morph pose before batching; never merge bind poses or hidden outfits.
function freeze(m, geo) {
  const positions = geo.attributes.position, point = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) { m.getVertexPosition(i, point); positions.setXYZ(i, point.x, point.y, point.z); }
  geo.computeVertexNormals();
}

export function bake(root, { cellSize = Infinity, tint = false } = {}) {
  root.updateMatrixWorld(true);
  const buckets = new Map();
  const keep = [];
  root.traverseVisible((m) => {
    if (!m.isMesh) return;
    if (m.material.map || m.material.bumpMap || Array.isArray(m.material) || m.material.transparent) {
      const geo = m.geometry.clone();
      if (m.isSkinnedMesh || m.geometry.morphAttributes.position?.length) freeze(m, geo);
      geo.morphAttributes = {}; geo.deleteAttribute('skinIndex'); geo.deleteAttribute('skinWeight');
      const clone = new THREE.Mesh(geo, m.material); clone.castShadow = m.castShadow; clone.receiveShadow = m.receiveShadow;
      m.matrixWorld.decompose(clone.position, clone.quaternion, clone.scale); keep.push(clone); return;
    }
    const geo = flatten(m) ?? flattenSlowly(m);
    // same look = same bucket, even when two builders made separate materials
    const mt = m.material;
    const tinted = tint && mt.isMeshStandardMaterial && !mt.isMeshPhysicalMaterial && !mt.map && !mt.transparent
      && mt.onBeforeCompile === THREE.Material.prototype.onBeforeCompile && !geo.attributes.natureSurface;
    if (tinted) {
      const source = mt.vertexColors ? geo.attributes.color : null, count = geo.attributes.position.count, values = new Float32Array(count * 3);
      const { r, g, b } = mt.color;
      if (!source) for (let i = 0; i < count * 3; i += 3) { values[i] = r; values[i + 1] = g; values[i + 2] = b; }
      else if (plain(source)) {
        const from = source.array, size = source.itemSize;
        for (let i = 0; i < count; i++) { values[i * 3] = r * from[i * size]; values[i * 3 + 1] = g * from[i * size + 1]; values[i * 3 + 2] = b * from[i * size + 2]; }
      } else for (let i = 0; i < count; i++) {
        values[i * 3] = r * source.getX(i); values[i * 3 + 1] = g * source.getY(i); values[i * 3 + 2] = b * source.getZ(i);
      }
      geo.setAttribute('color', new THREE.BufferAttribute(values, 3));
    }
    // Optional spatial buckets let large race environments cull distant
    // vegetation instead of submitting every tree in the world each frame.
    const cellX = Math.floor(m.matrixWorld.elements[12] / cellSize);
    const cellZ = Math.floor(m.matrixWorld.elements[14] / cellSize);
    const key = [cellX, cellZ, mt.type, tinted ? 'tint' : mt.color?.getHex(), mt.emissive?.getHex(), mt.emissiveIntensity, mt.roughness, mt.metalness, mt.side, mt.flatShading, tinted || mt.vertexColors, !!geo.attributes.color, m.castShadow, m.receiveShadow].join('|');
    if (!buckets.has(key)) buckets.set(key, { mat: mt, geos: [], castShadow: m.castShadow, receiveShadow: m.receiveShadow, tinted });
    buckets.get(key).geos.push(geo);
  });
  const out = new THREE.Group();
  out.userData.tinted = [];
  for (const { mat: source, geos, castShadow, receiveShadow, tinted } of buckets.values()) {
    let mat = source;
    if (tinted) { mat = source.clone(); mat.color.set(0xffffff); mat.vertexColors = true; out.userData.tinted.push(mat); }
    if (geos.some(g => g.attributes.natureSurface)) for (const g of geos) {
      if (!g.attributes.natureSurface) g.setAttribute('natureSurface', new THREE.BufferAttribute(new Uint8Array(g.attributes.position.count), 1, true));
    }
    const merged = new THREE.Mesh(mergeGeometries(geos, false), mat);
    merged.castShadow = castShadow;
    merged.receiveShadow = receiveShadow;
    out.add(merged);
    for (const g of geos) g.dispose();
  }
  keep.forEach(m => out.add(m));
  return out;
}

export function finish(group, name) {
  const out = bake(group); out.name = name;
  const geometry = new Set(), textures = new Set();
  group.traverse(o => {
    if (o.geometry) geometry.add(o.geometry);
    if (o.material?.map?.isCanvasTexture) textures.add(o.material.map);
  });
  geometry.forEach(g => g.dispose());
  if (textures.size) out.userData.dispose = () => textures.forEach(t => t.dispose());
  return out;
}

// One baked prototype drawn at many placements ({x, y, z, rot, scale}). The
// placements are bucketed into cells so distant groves cull on their own.
// `source` is consumed: its geometry is baked and released.
export function instancePlacements(parent, source, placements, { name = source.name, cellSize = 110, castShadow = true } = {}) {
  const prototype = bake(source), used = new Set();
  source.traverse(o => { if (o.geometry) used.add(o.geometry); }); used.forEach(g => g.dispose());
  prototype.updateMatrixWorld(true);
  const cells = new Map(), dummy = new THREE.Object3D(), out = [];
  for (const p of placements) { const key = `${Math.floor(p.x / cellSize)},${Math.floor(p.z / cellSize)}`; if (!cells.has(key)) cells.set(key, []); cells.get(key).push(p); }
  prototype.traverse(o => {
    if (!o.isMesh) return;
    if (!placements.length) { o.geometry.dispose(); return; }
    for (const points of cells.values()) {
      const im = new THREE.InstancedMesh(o.geometry, o.material, points.length);
      points.forEach((p, i) => { dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(0, p.rot || 0, 0); dummy.scale.setScalar(p.scale || 1); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix.clone().multiply(o.matrixWorld)); });
      im.name = name; im.castShadow = castShadow; im.receiveShadow = true; im.computeBoundingSphere(); parent.add(im); out.push(im);
    }
  });
  return out;
}
