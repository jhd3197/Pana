// Reduce full-grid draw calls without changing the shared car constructors.
// Only opaque sibling meshes are combined: every moving pivot stays intact.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function batchRacer(car, paint = null) {
  const paintColor = paint == null ? null : new THREE.Color(paint);
  car.batchedMaterials ??= new Set();
  const protectedParts = new Set([car.flag, ...car.detachables, ...car.danglers]);
  car.driver?.group.traverse(o => protectedParts.add(o));
  const parents = [], removed = new Set();
  car.root.traverse(o => { if (o.children.length) parents.push(o); });
  for (const parent of parents) {
    const buckets = new Map();
    for (const part of parent.children) {
      const g = part.geometry, m = part.material;
      if (!part.isMesh || part.isSkinnedMesh || part.children.length || !part.visible
        || protectedParts.has(part) || part.name || Object.keys(part.userData).length
        || Array.isArray(m) || m.transparent || Object.keys(g.morphAttributes).length
        || g.drawRange.start || g.drawRange.count !== Infinity) continue;
      // Solid colors can share a shader with their exact linear color stored
      // per vertex. Keep texture/custom shader materials in their own bucket.
      const colored = m.isMeshStandardMaterial && !m.map
        && (!paintColor || !m.color.equals(paintColor))
        && m.onBeforeCompile === THREE.Material.prototype.onBeforeCompile;
      let materialKey = m.uuid;
      if (colored) {
        const data = m.toJSON();
        delete data.uuid; delete data.metadata; delete data.color; delete data.vertexColors;
        materialKey = JSON.stringify(data);
      }
      const layout = Object.entries(g.attributes).filter(([name])=>!colored||name!=='color')
        .map(([name,a]) => `${name}:${a.itemSize}:${a.normalized}`).sort().join(',');
      const key = `${materialKey}|${part.castShadow}|${part.receiveShadow}|${part.renderOrder}|${part.layers.mask}|${layout}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push({part,colored});
    }
    for (const entries of buckets.values()) {
      if (entries.length < 2) continue;
      const parts=entries.map(e=>e.part),colored=entries[0].colored;
      const copies = parts.map(part => {
        part.updateMatrix();
        const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
        if (colored) {
          const source=geometry.getAttribute('color'),color=part.material.color,values=[];
          for(let i=0;i<geometry.attributes.position.count;i++)values.push(
            color.r*(part.material.vertexColors&&source?source.getX(i):1),
            color.g*(part.material.vertexColors&&source?source.getY(i):1),
            color.b*(part.material.vertexColors&&source?source.getZ(i):1));
          geometry.setAttribute('color',new THREE.Float32BufferAttribute(values,3));
        }
        return geometry.applyMatrix4(part.matrix);
      });
      const merged = mergeGeometries(copies, false);
      copies.forEach(g => g.dispose());
      if (!merged) continue;
      const first = parts[0], material=colored?first.material.clone():first.material;
      if(colored){material.color.set(0xffffff);material.vertexColors=true;car.batchedMaterials.add(material);}
      const mesh = new THREE.Mesh(merged, material);
      mesh.name = 'rigid-car-parts';
      mesh.castShadow = first.castShadow; mesh.receiveShadow = first.receiveShadow;
      mesh.renderOrder = first.renderOrder; mesh.layers.mask = first.layers.mask;
      for (const part of parts) { removed.add(part.geometry); parent.remove(part); }
      parent.add(mesh);
    }
  }
  // A geometry shared with a surviving wheel or accessory still belongs to it.
  car.root.traverse(o => removed.delete(o.geometry));
  removed.forEach(g => g.dispose());
  return car;
}
