import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Merge every static mesh under `root` into one mesh per material.
// Textured and transparent meshes stay separate. Vertex colors are retained
// for foliage's top-to-bottom color variation.
export function bake(root, { cellSize = Infinity } = {}) {
  root.updateMatrixWorld(true);
  const buckets = new Map();
  const keep = [];
  root.traverseVisible((m) => {
    if (!m.isMesh) return;
    let geo = m.geometry.clone();
    // Static statues can use the shared animated character. Freeze the current
    // skin/morph pose before batching; never merge bind poses or hidden outfits.
    if (m.isSkinnedMesh || m.geometry.morphAttributes.position?.length) {
      const positions = geo.attributes.position, point = new THREE.Vector3();
      for (let i = 0; i < positions.count; i++) { m.getVertexPosition(i, point); positions.setXYZ(i, point.x, point.y, point.z); }
      geo.computeVertexNormals();
    }
    geo.morphAttributes = {}; geo.deleteAttribute('skinIndex'); geo.deleteAttribute('skinWeight');
    if (m.material.map || m.material.bumpMap || Array.isArray(m.material) || m.material.transparent) {
      const clone = new THREE.Mesh(geo, m.material); clone.castShadow = m.castShadow; clone.receiveShadow = m.receiveShadow;
      m.matrixWorld.decompose(clone.position, clone.quaternion, clone.scale); keep.push(clone); return;
    }
    if (geo.index) { const indexed = geo; geo = indexed.toNonIndexed(); indexed.dispose(); }
    for (const name of Object.keys(geo.attributes)) if (!['position', 'normal', 'color', 'natureSurface'].includes(name)) geo.deleteAttribute(name);
    if (!geo.attributes.normal) geo.computeVertexNormals();
    geo.applyMatrix4(m.matrixWorld);
    // same look = same bucket, even when two builders made separate materials
    const mt = m.material;
    // Optional spatial buckets let large race environments cull distant
    // vegetation instead of submitting every tree in the world each frame.
    const cellX = Math.floor(m.matrixWorld.elements[12] / cellSize);
    const cellZ = Math.floor(m.matrixWorld.elements[14] / cellSize);
    const key = [cellX, cellZ, mt.type, mt.color?.getHex(), mt.emissive?.getHex(), mt.emissiveIntensity, mt.roughness, mt.metalness, mt.side, mt.flatShading, mt.vertexColors, !!geo.attributes.color, m.castShadow, m.receiveShadow].join('|');
    if (!buckets.has(key)) buckets.set(key, { mat: mt, geos: [], castShadow: m.castShadow, receiveShadow: m.receiveShadow });
    buckets.get(key).geos.push(geo);
  });
  const out = new THREE.Group();
  for (const { mat, geos, castShadow, receiveShadow } of buckets.values()) {
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
