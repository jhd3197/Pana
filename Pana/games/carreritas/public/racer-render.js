// Reduce full-grid draw calls without changing the shared car constructors.
// Only opaque sibling meshes are combined: every moving pivot stays intact.
// Also here: paint swaps and the battle balloons dressed onto a car.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { repaintHex } from './shop.js';
import { BALLOONS } from './modes.js';
import { isGhost } from './recovery-rules.js';

// Battle balloons ride on sticks above the trunk, in the car's colour.
const balloonGeo = new THREE.SphereGeometry(0.55, 10, 8);
const stringGeo = new THREE.CylinderGeometry(0.025, 0.025, 1.6, 4);
const stringMat = new THREE.MeshBasicMaterial({ color: 0xf3e9d7 });

export function addBalloons(c) {
  c.balloons = BALLOONS;
  c.balloonMeshes = [];
  const mat = new THREE.MeshStandardMaterial({ color: c.def.color, roughness: 0.35, emissive: c.def.color, emissiveIntensity: 0.15 });
  for (let i = 0; i < BALLOONS; i++) {
    const g = new THREE.Group();
    const ball = new THREE.Mesh(balloonGeo, mat);
    ball.scale.set(1, 1.2, 1);
    ball.position.y = 1.6;
    const string = new THREE.Mesh(stringGeo, stringMat);
    string.position.y = 0.8;
    g.add(ball, string);
    g.position.set((i - 1) * 0.75, 2.1, -1.5);
    g.rotation.z = (i - 1) * -0.25;
    c.car.root.add(g);
    c.balloonMeshes.push(g);
  }
}

// Shifts every body panel in the car's paint family to a new paint (the
// driver keeps their own colours). Materials are shared, so swap in copies.
const paintCache = new Map();
export function repaintCar(car, from, to) {
  if (!to) return car;
  const skip = new Set();
  car.driver?.group?.traverse(o => skip.add(o));
  car.root.traverse(o => {
    if (!o.material || skip.has(o)) return;
    const swap = (m) => {
      if (!m.color) return m;
      const hex = repaintHex('#' + m.color.getHexString(), from, to);
      if (!hex) return m;
      const key = m.uuid + hex;
      if (!paintCache.has(key)) { const n = m.clone(); n.color.set(hex); paintCache.set(key, n); }
      return paintCache.get(key);
    };
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
  });
  return car;
}

// The shared pana is sculpted for Studio close-ups. From the chase camera its
// centimetre details (catchlights, creases, nostrils) are sub-pixel yet each
// costs a draw and a shadow draw, and sheen/clearcoat buy nothing at racing
// distance. Race drivers keep their silhouette, colours and fur bump.
const tiny = new THREE.Vector3();
export function trimDriver(car) {
  if (!car.driver?.group) return car;
  car.batchedMaterials ??= new Set();
  const swapped = new Map();
  car.driver.group.updateMatrixWorld(true);
  car.driver.group.traverse(o => {
    if (!o.isMesh) return;
    const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere();
    const radius = g.boundingSphere.radius * o.getWorldScale(tiny).x;
    if (radius < .06 && !o.isSkinnedMesh) { o.visible = false; return; }
    if (radius < .25) o.castShadow = false;
    const m = o.material;
    if (!m?.isMeshPhysicalMaterial) return;
    if (!swapped.has(m)) {
      const plain = new THREE.MeshStandardMaterial();
      for (const key of ['name', 'color', 'roughness', 'metalness', 'map', 'bumpMap', 'bumpScale', 'normalMap', 'emissive', 'emissiveIntensity', 'emissiveMap', 'vertexColors', 'side', 'transparent', 'opacity', 'alphaTest', 'flatShading', 'skinning'])
        if (key in m && key in plain) plain[key]?.copy && m[key]?.copy ? plain[key].copy(m[key]) : plain[key] = m[key];
      swapped.set(m, plain); car.batchedMaterials.add(plain);
    }
    o.material = swapped.get(m);
  });
  return car;
}

// A rival's shadow only needs its outline: the largest few pieces cast it,
// the trims, lamps and bolts (60–90 shadow draws a car) do not.
export function rivalShadows(car, keep = 6) {
  const casters = [], size = new THREE.Vector3();
  car.root.updateMatrixWorld(true);
  car.root.traverse(o => {
    if (!o.isMesh || !o.castShadow) return;
    const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere();
    casters.push([g.boundingSphere.radius * o.getWorldScale(size).x, o]);
  });
  casters.sort((a, b) => b[0] - a[0]).slice(keep).forEach(([, o]) => { o.castShadow = false; });
  return car;
}

export function batchRacer(car, paint = null) {
  trimDriver(car);
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

// A ghost (the personal-best replay, a respawning or disconnected racer)
// renders translucent: materials are cloned once, flagged ghostClone, and
// restored in place. Re-running it after new parts join the car (a lancha)
// is safe: clones are reused.
export function setGhost(c, ghost) {
  c.ghost = !!ghost;
  syncGhostAppearance(c);
}

export function syncGhostAppearance(c) {
  const ghost = isGhost(c);
  if (!!c.ghostVisible === ghost) return;
  c.ghostVisible = ghost;
  c.car.root.traverse(o => {
    if (!o.material) return;
    const apply = (m) => {
      if (ghost) {
        const clone = m.userData?.ghostClone ? m : m.clone();
        (c.car.ghostMaterials ??= new Set()).add(clone);
        if (!m.userData?.ghostClone) clone.userData = { ...clone.userData, ghostClone: true, baseTransparent: m.transparent, baseOpacity: m.opacity ?? 1 };
        clone.transparent = true;
        clone.opacity = Math.min(0.42, clone.userData.baseOpacity);
        clone.needsUpdate = true;
        return clone;
      }
      if (m.userData?.ghostClone) {
        m.transparent = !!m.userData.baseTransparent;
        m.opacity = m.userData.baseOpacity ?? 1;
        m.needsUpdate = true;
      }
      return m;
    };
    o.material = Array.isArray(o.material) ? o.material.map(apply) : apply(o.material);
  });
}
