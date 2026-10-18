// Glowing crystal clusters for caves: hexagonal lathe prisms fanned around a
// surface normal. One InstancedMesh per colour keeps a whole cave at a few
// draw calls; each prism pulses out of phase with its neighbours. Metres, +Y
// up, a cluster's origin is where it grows out of the floor or wall.
// Lights belong to the consumer: userData.brightest lists the biggest
// clusters (position, normal, colour) for the few real lights a track affords.
import * as THREE from 'three';
import { rng } from '/engine/models/core/primitives.js';

// Copa Arcoíris colours, red to violet, plus the pink of the salt caves.
export const SPECTRUM = [0xff4a5c, 0xff8a3d, 0xffd23f, 0x5fe08a, 0x3fd6e0, 0x4a7dff, 0x9b5cff, 0xff6fc0];

// `count` colours evenly spaced along part of the rainbow (0 red … 1 violet).
export function spectrumPalette(count = 5, from = 0, to = 1) {
  const colour = new THREE.Color();
  return Array.from({ length: count }, (_, i) => {
    const k = count > 1 ? from + (to - from) * i / (count - 1) : from;
    return colour.setHSL(k * .78, .9, .6).getHex();
  });
}

// Unit prism: a hexagonal column with a pointed termination, base at y=0,
// tip at y=1, radius about .27.
let prismTemplate = null;
function crystalPrism() {
  prismTemplate ??= new THREE.LatheGeometry([
    new THREE.Vector2(0, -.06), new THREE.Vector2(.25, 0), new THREE.Vector2(.27, .66), new THREE.Vector2(.12, .9), new THREE.Vector2(0, 1),
  ], 6);
  return prismTemplate.clone();
}

// Emissive pulse with a phase taken from each instance's position, brighter
// toward the tips. The time uniform is owned by the field.
function crystalMaterial(color, time, { glow, pulse, speed }) {
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color).lerp(new THREE.Color(0xffffff), .25), emissive: color, emissiveIntensity: glow,
    roughness: .18, metalness: .05, flatShading: true,
  });
  material.onBeforeCompile = shader => {
    shader.uniforms.crystalTime = time;
    shader.vertexShader = `uniform float crystalTime;\nvarying float crystalGlow;\n${shader.vertexShader}`.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 crystalAt = instanceMatrix[3].xyz;
      crystalGlow = (.55 + .45 * clamp(position.y, 0., 1.)) * (1. + ${pulse.toFixed(3)} * sin(crystalTime * ${speed.toFixed(3)} + crystalAt.x * .37 + crystalAt.z * .23 + crystalAt.y * .11));`);
    shader.fragmentShader = `varying float crystalGlow;\n${shader.fragmentShader}`.replace('#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n      totalEmissiveRadiance *= crystalGlow;');
  };
  material.customProgramCacheKey = () => `crystal-${pulse.toFixed(3)}-${speed.toFixed(3)}`;
  return material;
}

// clusters: [{ x, y, z, normal = [0, 1, 0], size = 1.5, count, color }], where
// color is a hex or an index into `palette`; without it the seed picks one.
export function crystalField(clusters, { palette = SPECTRUM.slice(0, 3), seed = 31, glow = .7, pulse = .35, speed = .8, brightest = 6, castShadow = false } = {}) {
  const group = new THREE.Group(), random = rng(seed), time = { value: 0 };
  group.name = 'crystal-field';
  const up = new THREE.Vector3(0, 1, 0), axis = new THREE.Vector3(), side = new THREE.Vector3(), other = new THREE.Vector3();
  const clusterTurn = new THREE.Quaternion(), tilt = new THREE.Quaternion(), dummy = new THREE.Object3D();
  const byColour = new Map(), placed = [];
  for (const cluster of clusters) {
    const size = cluster.size ?? 1.5, count = cluster.count ?? Math.round(4 + size * 2.5 + random() * 3);
    const color = typeof cluster.color === 'number' && cluster.color >= palette.length ? cluster.color
      : palette[(cluster.color ?? Math.floor(random() * palette.length)) % palette.length];
    axis.set(...(cluster.normal ?? [0, 1, 0])).normalize();
    clusterTurn.setFromUnitVectors(up, axis);
    side.set(1, 0, 0).applyQuaternion(clusterTurn); other.crossVectors(axis, side);
    if (!byColour.has(color)) byColour.set(color, []);
    for (let i = 0; i < count; i++) {
      const main = i === 0, h = size * (main ? 1 + random() * .4 : .35 + random() * .65), w = h * (.15 + random() * .09) / .27;
      const a = random() * Math.PI * 2, r = main ? 0 : random() * size * .35;
      // Embed each prism a little so none floats on curved rock.
      dummy.position.set(cluster.x, cluster.y, cluster.z).addScaledVector(side, Math.cos(a) * r).addScaledVector(other, Math.sin(a) * r).addScaledVector(axis, -.12 * h);
      tilt.setFromEuler(new THREE.Euler(main ? random() * .15 : .15 + random() * .7, 0, 0));
      dummy.quaternion.copy(clusterTurn).multiply(new THREE.Quaternion().setFromAxisAngle(up, a)).multiply(tilt);
      dummy.scale.set(w, h, w); dummy.updateMatrix();
      byColour.get(color).push({ matrix: dummy.matrix.clone(), shade: .82 + random() * .3 });
    }
    placed.push({ x: cluster.x, y: cluster.y, z: cluster.z, normal: axis.toArray(), size, color });
  }
  const geometry = crystalPrism(), materials = [], tint = new THREE.Color();
  for (const [color, prisms] of byColour) {
    const material = crystalMaterial(color, time, { glow, pulse, speed }); materials.push(material);
    const mesh = new THREE.InstancedMesh(geometry, material, prisms.length);
    prisms.forEach((p, i) => { mesh.setMatrixAt(i, p.matrix); mesh.setColorAt(i, tint.setScalar(p.shade)); });
    mesh.name = 'crystals'; mesh.castShadow = castShadow; mesh.receiveShadow = true; mesh.computeBoundingSphere();
    group.add(mesh);
  }
  group.userData.brightest = placed.sort((a, b) => b.size - a.size).slice(0, brightest);
  // Studio previews clone materials, and clones drop onBeforeCompile; put
  // the pulse back on whatever material is live.
  const patches = group.children.map(mesh => [mesh, mesh.material.onBeforeCompile, mesh.material.customProgramCacheKey]);
  group.userData.tick = t => {
    time.value = t;
    for (const [mesh, patch, key] of patches) if (mesh.material.onBeforeCompile !== patch) {
      Object.assign(mesh.material, { onBeforeCompile: patch, customProgramCacheKey: key, needsUpdate: true });
    }
  };
  const box = new THREE.Box3();
  for (const p of placed) {
    const base = new THREE.Vector3(p.x, p.y, p.z), reach = new THREE.Vector3(p.size * .6, p.size * .6, p.size * .6);
    const tip = base.clone().addScaledVector(new THREE.Vector3(...p.normal), p.size * 1.4);
    box.union(new THREE.Box3(base.clone().sub(reach), base.clone().add(reach))).union(new THREE.Box3(tip.clone().sub(reach), tip.clone().add(reach)));
  }
  if (!box.isEmpty()) group.userData.previewBounds = [box.min.toArray(), box.max.toArray()];
  let disposed = false;
  group.userData.dispose = () => { if (disposed) return; disposed = true; geometry.dispose(); materials.forEach(m => m.dispose()); };
  return group;
}

// One cluster for previews and hand-placed accents.
export function crystalCluster({ size = 1.6, count, color = 0, palette = SPECTRUM, normal = [0, 1, 0], seed = 31 } = {}) {
  const group = crystalField([{ x: 0, y: 0, z: 0, size, count, color, normal }], { palette, seed });
  group.name = 'crystal-cluster';
  return group;
}

// A ring of clusters walking through the palette, for previews and halls.
export function crystalGarden({ radius = 4, clusters = 8, palette = SPECTRUM, size = 1.2, seed = 33 } = {}) {
  const random = rng(seed);
  const spots = Array.from({ length: clusters }, (_, i) => {
    const a = i / clusters * Math.PI * 2, r = radius * (.7 + random() * .3);
    return { x: Math.cos(a) * r, y: 0, z: Math.sin(a) * r, size: size * (.6 + random() * .8), color: i % palette.length, normal: [Math.cos(a) * -.25, 1, Math.sin(a) * -.25] };
  });
  const group = crystalField(spots, { palette, seed });
  group.name = 'crystal-garden';
  return group;
}
